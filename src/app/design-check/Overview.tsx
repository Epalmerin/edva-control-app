"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./mock";
import { commissionCents, saleCommissionCents, summarizeCommissions, type CommissionRates } from "@/app/admin/sales/suburbia-summary";
import styles from "@/app/admin/sales/SuburbiaSearsSales.module.css";
import { buildSuburbiaCommissions } from "@/app/admin/reports/suburbia-commissions";

export type SuburbiaAdminSale = {
  id: string; employee_id: string | null; store_id: string; sale_date: string; ticket_number: string; amount: number; quantity: number;
  sku: string | null; model: string | null; size: string | null;
  product_catalog_id: string | null; sku_source: string | null;
  profiles: { name: string; email: string } | null;
  stores: { name: string; chain_name: string | null; brand_name: string | null } | null;
};

const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const origin = (sale: SuburbiaAdminSale) => sale.sku_source === "catalog" ? "Catálogo" : sale.sku_source === "direct" ? "SKU escrito" : "Registro anterior";

type Store = { id: string; name: string; chain_name: string | null; brand_name: string | null };

export default function SuburbiaSalesOverview({ sales, stores, period, children }: { sales: SuburbiaAdminSale[]; stores: Store[]; period: string; children: ReactNode }) {
  const [rates, setRates] = useState<CommissionRates>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [commissionState, setCommissionState] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(""); setRates({});
      try {
        const rows: { product_id: string; commission_amount: number | string }[] = [];
        while (!cancelled) {
          const { data, error: queryError } = await supabase.from("sales_product_commissions")
            .select("product_id, commission_amount").order("product_id").range(rows.length, rows.length + 499);
          if (queryError) throw queryError;
          if (!data?.length) break;
          rows.push(...data);
        }
        if (!cancelled) setRates(Object.fromEntries(rows.map((row) => [row.product_id, row.commission_amount])));
      } catch { if (!cancelled) setError("No se pudieron consultar las comisiones. El acumulado no está disponible."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reload]);

  const visible = useMemo(() => {
    const value = search.trim().toLocaleLowerCase("es-MX");
    return sales.filter((sale) => (source === "all" || (source === "legacy" ? !sale.sku_source : sale.sku_source === source)) &&
      (commissionState === "all" || (commissionState === "defined" ? saleCommissionCents(sale, rates) !== null : saleCommissionCents(sale, rates) === null)) &&
      `${sale.profiles?.name || ""} ${sale.profiles?.email || ""} ${sale.stores?.name || ""} ${sale.ticket_number} ${sale.sku || ""} ${sale.model || ""} ${sale.size || ""}`.toLocaleLowerCase("es-MX").includes(value));
  }, [sales, search, source, commissionState, rates]);
  const summary = summarizeCommissions(visible, rates);
  const unavailable = loading || Boolean(error);
  const commissionLabel = (sale: SuburbiaAdminSale, total = false) => {
    if (!sale.sku_source) return "Sin revisión histórica";
    if (unavailable) return loading ? "Consultando…" : "No disponible";
    const cents = total ? saleCommissionCents(sale, rates) : commissionCents(sale, rates);
    return cents === null ? "Sin comisión definida" : money(cents / 100);
  };

  const groups = useMemo(() => {
    const map = new Map(stores.map(store => [store.id, { store, sales: [] as SuburbiaAdminSale[], total: 0, units: 0 }]));
    for (const sale of visible) {
      const group = map.get(sale.store_id) || { store: { id: sale.store_id, name: sale.stores?.name || "Sin tienda", chain_name: sale.stores?.chain_name || null, brand_name: sale.stores?.brand_name || null }, sales: [], total: 0, units: 0 };
      group.sales.push(sale); group.total += Number(sale.amount || 0); group.units += sale.quantity ?? 1;
      map.set(sale.store_id, group);
    }
    return [...map.values()].filter(group => !(search || source !== "all" || commissionState !== "all") || group.sales.length > 0)
      .sort((a, b) => b.total - a.total || a.store.name.localeCompare(b.store.name, "es"));
  }, [stores, visible, search, source, commissionState]);

  async function exportExcel() {
    if (unavailable || exporting) return;
    setExporting(true); setExportError("");
    try {
      const XLSX = await import("xlsx");
      const report = buildSuburbiaCommissions(visible, rates);
      const book = XLSX.utils.book_new();
      const append = (name: string, rows: object[]) => {
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0] || {}).map(key => ({ wch: key.includes("Promotor") || key === "Tienda" ? 42 : Math.max(18, key.length + 2) }));
        for (const key of Object.keys(sheet)) {
          if (key.startsWith("!")) continue;
          const cell = sheet[key];
          if (cell.t === "s") delete cell.f;
        }
        XLSX.utils.book_append_sheet(book, sheet, name);
      };
      append("Resumen", [{ Periodo: period, "Registros de venta": visible.length, Colchones: report.units, "Venta total (MXN)": visible.reduce((total, sale) => total + Number(sale.amount || 0), 0), "Comisión definida (MXN)": report.total, "Registros pendientes": report.pending, Nota: "Tarifa vigente × cantidad. Pendientes excluidos. No representa comisiones pagadas." }]);
      append("Comisiones promotores", report.byPromoter);
      append("Ventas detalle", report.detail);
      XLSX.writeFile(book, `Ventas_Suburbia_${period.replaceAll(" ", "_")}.xlsx`);
    } catch { setExportError("No se pudo generar el Excel. Intenta nuevamente."); }
    finally { setExporting(false); }
  }

  return <div className={styles.overview}>
    <div className={styles.metrics} aria-live="polite">
      <div className={styles.metric}><p>Venta mensual</p><strong>{money(visible.reduce((sum, sale) => sum + Number(sale.amount || 0), 0))}</strong><small>Según los filtros actuales · MXN</small></div>
      <div className={styles.metric}><p>Colchones</p><strong>{visible.reduce((sum, sale) => sum + (sale.quantity ?? 1), 0)}</strong><small>{visible.length} registros de venta</small></div>
      <div className={styles.metric}><p>Comisión acumulada</p><strong>{unavailable ? loading ? "Consultando…" : "No disponible" : summary.defined === 0 && summary.pending > 0 ? "Por definir" : money(summary.cents / 100)}</strong><small>{unavailable ? "Tarifas del catálogo" : `${summary.defined} con tarifa · ${summary.pending} por revisar`}</small></div>
      <div className={styles.metric}><p>Por revisar</p><strong>{unavailable ? "—" : summary.pending}</strong><small>Sin tarifa o sin revisión histórica</small></div>
    </div>
    {children}
    {error && <p role="alert" className={styles.error}>{error}<button type="button" onClick={() => setReload(value => value + 1)}>Reintentar</button></p>}
    <section className={styles.panel} aria-label="Ventas Suburbia por tienda">
      <div className={styles.heading}><div><h2>Ventas por tienda</h2><p>Selecciona una tienda para consultar sus ventas. · {period}</p></div><button className={styles.export} type="button" disabled={unavailable || exporting || !visible.length} onClick={() => void exportExcel()}>{exporting ? "Generando…" : "Exportar Excel"}</button></div>
      <div className={styles.toolbar}>
        <label>Buscar venta<input type="search" placeholder="Promotor, tienda, ticket o SKU" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label>Origen del producto<select value={source} onChange={event => setSource(event.target.value)}><option value="all">Todos los registros</option><option value="catalog">Catálogo</option><option value="direct">SKU escrito</option><option value="legacy">Registros anteriores</option></select></label>
        <label>Comisión<select disabled={unavailable} value={commissionState} onChange={event => setCommissionState(event.target.value)}><option value="all">Todos los estados</option><option value="defined">Definida</option><option value="pending">Por revisar</option></select></label>
      </div>
      {exportError && <p role="alert" className={styles.error}>{exportError}</p>}
      <div>{groups.map((group, index) => <details key={group.store.id} className={styles.store}>
        <summary className={styles.storeSummary}><span className={styles.rank}>#{index + 1}</span><span className={styles.storeName}><strong>{group.store.name}</strong><small>{group.store.chain_name} · {group.store.brand_name}</small></span><span className={styles.storeCount}>{group.units} colchones<small>{group.sales.length} registros</small></span><strong className={styles.storeTotal}>{money(group.total)}</strong><span className={styles.expand} aria-hidden="true" /></summary>
        <StoreSales sales={group.sales} commissionLabel={commissionLabel} unavailable={unavailable} rates={rates} />
      </details>)}</div>
      {groups.length === 0 && <p className={styles.empty}>No hay ventas que coincidan con estos filtros.</p>}
      <p className={styles.note}>{visible.length} registros · {groups.length} tiendas. Comisión: tarifa vigente × cantidad. Los pendientes quedan fuera del acumulado. El monto de venta ya incluye todos los colchones del registro. No representa comisiones pagadas.</p>
    </section>
  </div>;
}

function StoreSales({ sales, commissionLabel, unavailable, rates }: { sales: SuburbiaAdminSale[]; commissionLabel: (sale: SuburbiaAdminSale, total?: boolean) => string; unavailable: boolean; rates: CommissionRates }) {
  const [limit, setLimit] = useState(25);
  return <div className={styles.storeBody}>
    {sales.length === 0 && <p className={styles.empty}>Esta tienda no tiene ventas registradas en el período.</p>}
    {sales.slice(0, limit).map(sale => {
      const defined = !unavailable && saleCommissionCents(sale, rates) !== null;
      return <article key={sale.id} className={styles.sale}>
        <div className={styles.saleMain}><div className={styles.product}><h3>Ticket: {sale.ticket_number}</h3><p className={styles.promoter}>{sale.profiles?.name || "Sin promotor"}</p><p>SKU: <span className={styles.sku}>{sale.sku || "No registrado"}</span> · Modelo: {sale.model || "No registrado"}</p><p>{sale.size || "Tamaño no registrado"} · Cantidad: <strong>{sale.quantity ?? 1}</strong></p></div><div className={styles.saleAmount}><time dateTime={sale.sale_date}>{sale.sale_date.split("-").reverse().join("/")}</time><strong>{money(Number(sale.amount))}</strong><span className={`${styles.badge} ${defined ? styles.defined : styles.pending}`}>{unavailable ? "Consultando tarifa" : defined ? "Definida" : "Por revisar"}</span></div></div>
        <div className={styles.commissions}><p>Comisión por unidad<strong>{commissionLabel(sale)}</strong></p><p>Comisión total<strong>{commissionLabel(sale, true)}</strong></p></div>
        <p className={styles.origin}>{origin(sale)}</p>
      </article>;
    })}
    {sales.length > 25 && <div className={styles.pagination}><span>Mostrando {Math.min(limit, sales.length)} de {sales.length} registros</span>{limit < sales.length && <button type="button" onClick={() => setLimit(value => value + 25)}>Mostrar 25 más</button>}{limit > 25 && <button type="button" onClick={() => setLimit(25)}>Mostrar menos</button>}</div>}
  </div>;
}
