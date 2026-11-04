"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { commissionCents, summarizeCommissions, type CommissionRates } from "./suburbia-summary";
import styles from "./SuburbiaSalesOverview.module.css";

export type SuburbiaAdminSale = {
  id: string; sale_date: string; ticket_number: string; amount: number;
  sku: string | null; model: string | null; size: string | null;
  product_catalog_id: string | null; sku_source: string | null;
  profiles: { name: string; email: string } | null;
  stores: { name: string; chain_name: string | null; brand_name: string | null } | null;
};

const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const origin = (sale: SuburbiaAdminSale) => sale.sku_source === "catalog" ? "Catálogo" : sale.sku_source === "direct" ? "SKU escrito" : "Registro anterior";

export default function SuburbiaSalesOverview({ sales }: { sales: SuburbiaAdminSale[] }) {
  const [rates, setRates] = useState<CommissionRates>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useRef<HTMLElement>(null);

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
      `${sale.profiles?.name || ""} ${sale.profiles?.email || ""} ${sale.stores?.name || ""} ${sale.ticket_number} ${sale.sku || ""} ${sale.model || ""} ${sale.size || ""}`.toLocaleLowerCase("es-MX").includes(value));
  }, [sales, search, source]);
  const summary = summarizeCommissions(visible, rates);
  const selected = visible.find((sale) => sale.id === selectedId);
  const unavailable = loading || Boolean(error);
  const commissionLabel = (sale: SuburbiaAdminSale) => {
    if (!sale.sku_source) return "Sin revisión histórica";
    if (unavailable) return loading ? "Consultando…" : "No disponible";
    const cents = commissionCents(sale, rates);
    return cents === null ? "Sin comisión definida" : money(cents / 100);
  };

  return <div className={styles.overview}>
    <div className={styles.metrics} aria-live="polite">
      <div className={styles.metric}><p>Venta del período</p><strong>{money(visible.reduce((sum, sale) => sum + Number(sale.amount || 0), 0))}</strong><small>Según los filtros actuales · MXN</small></div>
      <div className={`${styles.metric} ${styles.highlight}`}><p>Comisión acumulada</p><strong>{unavailable ? loading ? "Consultando…" : "No disponible" : summary.defined === 0 && summary.pending > 0 ? "Por definir" : money(summary.cents / 100)}</strong><small>{unavailable ? "Tarifas del catálogo" : `${summary.defined} con tarifa · ${summary.pending} por revisar`}</small></div>
      <div className={styles.metric}><p>Registros de venta</p><strong>{visible.length}</strong><small>Dentro del período seleccionado</small></div>
      <div className={styles.metric}><p>Por revisar</p><strong>{unavailable ? "—" : summary.pending}</strong><small>Sin tarifa o sin revisión histórica</small></div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}<button type="button" onClick={() => setReload((value) => value + 1)}>Reintentar</button></p>}
    <section className={styles.panel} aria-label="Ventas Suburbia">
      <div className={styles.toolbar}>
        <label>Buscar venta<input type="search" placeholder="Promotor, tienda, ticket o SKU" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Origen del producto<select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">Todos los registros</option><option value="catalog">Catálogo</option><option value="direct">SKU escrito</option><option value="legacy">Registros anteriores</option></select></label>
      </div>
      <div className={styles.scroll}><table className={styles.table}>
        <thead><tr><th scope="col">Fecha / Ticket</th><th scope="col">Promotor / Tienda</th><th scope="col">Producto / Tamaño</th><th scope="col">Venta (MXN)</th><th scope="col">Comisión por unidad (MXN)</th></tr></thead>
        <tbody>{visible.map((sale) => <tr key={sale.id}>
          <td data-label="Fecha / Ticket"><strong>{sale.sale_date.split("-").reverse().join("/")}</strong><small>Ticket {sale.ticket_number}</small></td>
          <td data-label="Promotor / Tienda"><strong>{sale.profiles?.name || "Sin promotor"}</strong><small>{sale.stores?.name || "Sin tienda"}</small></td>
          <td data-label="Producto / Tamaño"><button type="button" aria-controls="suburbia-sale-detail" onClick={() => { setSelectedId(sale.id); detail.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}>{sale.model || "Modelo no registrado"}</button><small className={styles.sku}>SKU: {sale.sku || "No registrado"}</small><small>{sale.size || "Tamaño no registrado"}</small><span className={`${styles.badge} ${sale.sku_source === "catalog" ? styles.catalog : ""}`}>{origin(sale)}</span></td>
          <td data-label="Venta (MXN)" className={styles.money}>{money(Number(sale.amount))}</td>
          <td data-label="Comisión por unidad (MXN)" className={styles.pending}>{commissionLabel(sale)}</td>
        </tr>)}</tbody>
      </table>{visible.length === 0 && <p className={styles.empty}>No hay ventas que coincidan con estos filtros.</p>}</div>
      <p className={styles.note}>{visible.length} registro(s). El acumulado suma una tarifa vigente del catálogo por cada registro con producto identificado. Los registros pendientes y anteriores quedan fuera del cálculo. Este importe no indica comisiones pagadas.</p>
    </section>
    <section ref={detail} id="suburbia-sale-detail" className={`${styles.panel} ${styles.detail}`} aria-live="polite">
      <h2>{selected ? `Detalle del producto · Ticket ${selected.ticket_number}` : "Revisa el producto de cada venta"}</h2>
      <p>{selected ? `${selected.profiles?.name || "Sin promotor"} · ${selected.stores?.name || "Sin tienda"}` : "Selecciona un modelo para consultar su SKU, tamaño y el estado de la comisión."}</p>
      {selected && <><dl><div><dt>SKU</dt><dd className={styles.sku}>{selected.sku || "No registrado"}</dd></div><div><dt>Modelo</dt><dd>{selected.model || "No registrado"}</dd></div><div><dt>Tamaño</dt><dd>{selected.size || "No registrado"}</dd></div><div><dt>Comisión por unidad</dt><dd>{commissionLabel(selected)}</dd></div></dl><p>{origin(selected)} · Consulta de información registrada.</p><button type="button" onClick={() => setSelectedId(null)}>Cerrar detalle</button></>}
    </section>
  </div>;
}
