"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { findSuburbiaProduct, resolveSuburbiaProduct, SUBURBIA_BRAND, SUBURBIA_CHAIN, type SuburbiaProduct, type SuburbiaSaleInput } from "@/lib/suburbia-products";
import styles from "./SuburbiaSaleForm.module.css";

type Store = { id: string; name: string; chain_name: string | null; brand_name: string | null };
type Props = { stores: Store[]; storeId: string; onStoreChange: (id: string) => void; onSave: (sale: SuburbiaSaleInput) => Promise<boolean>; saving: boolean };

export default function SuburbiaSaleForm({ stores, storeId, onStoreChange, onSave, saving }: Props) {
  const fieldId = useId();
  const [products, setProducts] = useState<SuburbiaProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [retry, setRetry] = useState(0);
  const [sku, setSku] = useState("");
  const [model, setModel] = useState("");
  const [size, setSize] = useState("");
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [ticket, setTicket] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const matched = findSuburbiaProduct(products, sku);
  const canEnterDetails = !!sku.trim() && !matched && !catalogLoading && !catalogError;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCatalogLoading(true); setCatalogError(""); setProducts([]);
      try {
        const { data, error } = await supabase.from("sales_product_catalog")
          .select("id, chain_name, brand_name, sku, model, size")
          .eq("chain_name", SUBURBIA_CHAIN).eq("brand_name", SUBURBIA_BRAND).eq("active", true).order("sku");
        if (error) throw error;
        if (!data?.length) throw new Error("El catálogo no está disponible para tu usuario.");
        if (!cancelled) setProducts(data as SuburbiaProduct[]);
      } catch {
        if (!cancelled) setCatalogError("No fue posible cargar el catálogo. Vuelve a intentar antes de guardar.");
      } finally { if (!cancelled) setCatalogLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => { setSku(""); setModel(""); setSize(""); setError(""); }, [storeId]);

  function updateSku(value: string) {
    const product = findSuburbiaProduct(products, value);
    setSku(value); setModel(product?.model || ""); setSize(product?.size || ""); setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (saving || catalogLoading || catalogError) return;
    if (!storeId || !date || !ticket.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setError("Completa la tienda, fecha, ticket y un monto mayor a cero."); return;
    }
    try {
      const product = resolveSuburbiaProduct(products, sku, model, size);
      const saved = await onSave({ store_id: storeId, sale_date: date, ticket_number: ticket.trim(), amount: Number(amount), ...product });
      if (saved) { setSku(""); setModel(""); setSize(""); setTicket(""); setAmount(""); }
    } catch (error) { setError(error instanceof Error ? error.message : "No fue posible guardar la venta. Intenta nuevamente."); }
  }

  return <div className={styles.app}>
    <header className={styles.header}><div><p className={styles.overline}>EDVA · VENTAS</p><h1>Nueva venta</h1></div><Image className={styles.logo} src="/edva-logo.jpeg" alt="EDVA MKT & Publicidad" width={1483} height={1061} sizes="86px" loading="eager" /></header>
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.group} disabled={saving}><legend>Tienda y fecha</legend><div className={styles.grid}>
        <div className={styles.field}><label htmlFor={`${fieldId}-store`}>Tienda *</label><select id={`${fieldId}-store`} value={storeId} onChange={(event) => onStoreChange(event.target.value)} required><option value="">Selecciona tienda</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.chain_name}</option>)}</select><p className={styles.help}>Cadena: <strong>Suburbia</strong></p></div>
        <div className={styles.field}><label htmlFor={`${fieldId}-date`}>Fecha de venta *</label><input id={`${fieldId}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
      </div></fieldset>

      <fieldset className={`${styles.group} ${styles.product}`} disabled={saving || catalogLoading || !!catalogError}><legend>Producto vendido</legend><div className={styles.stack}>
        <div className={styles.field}><label htmlFor={`${fieldId}-sku`}>SKU *</label><input id={`${fieldId}-sku`} list={`${fieldId}-catalog`} value={sku} onChange={(event) => updateSku(event.target.value)} placeholder="Busca o escribe el SKU completo" autoComplete="off" required aria-describedby={`${fieldId}-help ${fieldId}-status`} /><datalist id={`${fieldId}-catalog`}>{products.map((product) => <option key={product.id} value={product.sku} label={`${product.model} · ${product.size}`} />)}</datalist><p id={`${fieldId}-help`} className={styles.help}>Selecciona un SKU de la cadena. Si no aparece, escríbelo directamente aquí.</p></div>
        <div className={styles.grid}><div className={styles.field}><label htmlFor={`${fieldId}-model`}>Modelo *</label><input id={`${fieldId}-model`} value={matched?.model || model} onChange={(event) => setModel(event.target.value)} readOnly={!canEnterDetails} placeholder="Nombre del modelo" required /></div><div className={styles.field}><label htmlFor={`${fieldId}-size`}>Tamaño *</label><input id={`${fieldId}-size`} value={matched?.size || size} onChange={(event) => setSize(event.target.value)} readOnly={!canEnterDetails} list={`${fieldId}-sizes`} placeholder="Selecciona o escribe el tamaño" required /><datalist id={`${fieldId}-sizes`}>{["Individual", "Matrimonial", "Queen", "King"].map((value) => <option key={value} value={value} />)}</datalist></div></div>
      </div><p id={`${fieldId}-status`} className={styles.status} aria-live="polite">{catalogLoading ? "Cargando catálogo de Suburbia..." : catalogError ? "Catálogo no disponible." : matched ? "Modelo y tamaño completados con el SKU del catálogo." : canEnterDetails ? "Este SKU no aparece en el catálogo. Completa su modelo y tamaño." : "Cada SKU del catálogo tiene su modelo y tamaño definidos."}</p></fieldset>
      {catalogError && <div className={styles.error} role="alert">{catalogError}<button type="button" onClick={() => setRetry((value) => value + 1)} className={styles.retry}>Volver a cargar catálogo</button></div>}

      <fieldset className={styles.group} disabled={saving}><legend>Ticket e importe</legend><div className={styles.grid}><div className={styles.field}><label htmlFor={`${fieldId}-ticket`}>Número de ticket *</label><input id={`${fieldId}-ticket`} value={ticket} onChange={(event) => setTicket(event.target.value)} placeholder="Número de ticket" required /></div><div className={styles.field}><label htmlFor={`${fieldId}-amount`}>Monto total (MXN) *</label><input id={`${fieldId}-amount`} type="number" inputMode="decimal" step="0.01" min="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></div></div></fieldset>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.save} type="submit" disabled={saving || catalogLoading || !!catalogError}>{saving ? "Guardando venta..." : "Guardar venta"}</button>
    </form>
  </div>;
}
