"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { SEARS_CHAIN, SEARS_BRAND, findSearsProduct, searchSearsProducts, resolveSearsProduct, type SearsProduct, type SearsSaleInput } from "@/lib/sears-products";
import { parseSaleQuantity } from "@/lib/suburbia-products";
import styles from "./SuburbiaSaleForm.module.css";
import searchStyles from "./SearsSaleForm.module.css";

type Store = { id: string; name: string; chain_name: string | null; brand_name: string | null };
type Props = { stores: Store[]; storeId: string; onStoreChange: (id: string) => void; onSave: (sale: SearsSaleInput) => Promise<boolean>; saving: boolean };

export default function SearsSaleForm({ stores, storeId, onStoreChange, onSave, saving }: Props) {
  const id = useId();
  const [products, setProducts] = useState<SearsProduct[]>([]);
  const [loading, setLoading] = useState(true), [catalogError, setCatalogError] = useState("");
  const [retry, setRetry] = useState(0), [query, setQuery] = useState("");
  const [manualType, setManualType] = useState(""), [manualModel, setManualModel] = useState(""), [manualSize, setManualSize] = useState("");
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [quantity, setQuantity] = useState("1"), [ticket, setTicket] = useState(""), [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const matched = findSearsProduct(products, query);
  const results = searchSearsProducts(products, query);
  const direct = !loading && !catalogError && !matched && results.length === 0 && /^\d{6,14}$/.test(query.trim());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setCatalogError(""); setProducts([]);
      try {
        const { data, error } = await supabase.from("sales_product_catalog").select("id, chain_name, brand_name, sku, model, size")
          .eq("chain_name", SEARS_CHAIN).eq("brand_name", SEARS_BRAND).eq("active", true).order("model").order("sku");
        if (error || !data?.length) throw new Error("Catálogo no disponible");
        if (!cancelled) setProducts(data as SearsProduct[]);
      } catch { if (!cancelled) setCatalogError("No se pudo cargar el catálogo de Sears. Vuelve a intentar antes de guardar."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [retry]);

  function changeQuery(value: string) { setQuery(value); setManualType(""); setManualModel(""); setManualSize(""); setError(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (saving || loading || catalogError) return;
    try {
      if (!storeId || !date || !ticket.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error("Completa tienda, fecha, ticket e importe mayor a cero.");
      const product = resolveSearsProduct(products, query, manualType, manualModel, manualSize);
      const saved = await onSave({ store_id: storeId, sale_date: date, ticket_number: ticket.trim(), amount: Number(amount), quantity: parseSaleQuantity(quantity), ...product });
      if (saved) { changeQuery(""); setTicket(""); setAmount(""); setQuantity("1"); }
    } catch (error) { setError(error instanceof Error ? error.message : "No fue posible guardar. Intenta nuevamente."); }
  }

  return <div className={styles.app}>
    <header className={styles.header}><div><p className={styles.overline}>EDVA · VENTAS SEARS</p><h1>Nueva venta</h1></div><Image className={styles.logo} src="/edva-logo.jpeg" alt="EDVA MKT & Publicidad" width={1483} height={1061} sizes="86px" /></header>
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.group} disabled={saving}><legend>Tienda y fecha</legend><div className={styles.grid}>
        <div className={styles.field}><label htmlFor={`${id}-store`}>Tienda *</label><select id={`${id}-store`} value={storeId} onChange={event => onStoreChange(event.target.value)} required><option value="">Selecciona tienda</option>{stores.map(store => <option key={store.id} value={store.id}>{store.name} · {store.chain_name}</option>)}</select></div>
        <div className={styles.field}><label htmlFor={`${id}-date`}>Fecha de venta *</label><input id={`${id}-date`} type="date" value={date} onChange={event => setDate(event.target.value)} required /></div>
      </div></fieldset>
      <fieldset className={`${styles.group} ${styles.product}`} disabled={saving || loading || !!catalogError}><legend>Producto vendido</legend><div className={styles.stack}>
        <div className={styles.field}><label htmlFor={`${id}-search`}>Buscar por SKU o modelo *</label><input id={`${id}-search`} type="search" autoComplete="off" placeholder="Ej. 40156009 o CASSAT" value={query} onChange={event => changeQuery(event.target.value)} required aria-describedby={`${id}-status`} /></div>
        {!matched && results.length > 0 && <><p className={styles.help}>Elige el producto y tamaño. Mostrando {Math.min(10, results.length)} de {results.length} opciones.</p><ul className={searchStyles.results} aria-label="Productos encontrados">{results.slice(0, 10).map(product => <li key={product.id}><button type="button" onClick={() => changeQuery(product.sku)}><strong>{product.model} · {product.size}</strong><span>SKU {product.sku}</span></button></li>)}</ul></>}
        {matched && <><div className={styles.field}><label htmlFor={`${id}-product`}>Producto / modelo</label><input id={`${id}-product`} readOnly value={matched.model} /></div><div className={styles.grid}><div className={styles.field}><label htmlFor={`${id}-sku`}>SKU</label><input id={`${id}-sku`} readOnly value={matched.sku} /></div><div className={styles.field}><label htmlFor={`${id}-size`}>Tamaño</label><input id={`${id}-size`} readOnly value={matched.size} /></div></div></>}
        {direct && <><div className={styles.field}><label htmlFor={`${id}-type`}>Tipo de producto *</label><select id={`${id}-type`} required value={manualType} onChange={event => setManualType(event.target.value)}><option value="">Selecciona tipo</option>{["COLCHÓN", "BOX", "COLCHÓN Y BOX", "COLCHÓN Y BOX CON BASE"].map(type => <option key={type}>{type}</option>)}</select></div><div className={styles.grid}><div className={styles.field}><label htmlFor={`${id}-manual-model`}>Modelo *</label><input id={`${id}-manual-model`} required value={manualModel} onChange={event => setManualModel(event.target.value)} /></div><div className={styles.field}><label htmlFor={`${id}-manual-size`}>Tamaño *</label><select id={`${id}-manual-size`} required value={manualSize} onChange={event => setManualSize(event.target.value)}><option value="">Selecciona tamaño</option>{["Individual", "Matrimonial", "Queen", "King"].map(size => <option key={size}>{size}</option>)}</select></div></div></>}
      </div><p id={`${id}-status`} className={styles.status} aria-live="polite">{loading ? "Cargando catálogo de Sears…" : catalogError ? "Catálogo no disponible." : matched ? "Producto y tamaño completados desde el catálogo de Sears." : direct ? "SKU no encontrado. Completa el tipo de producto, modelo y tamaño." : query.trim() && !results.length ? "Sin coincidencias. Prueba otro modelo o escribe el SKU completo (solo números)." : "Escribe un SKU o modelo y selecciona la presentación correcta."}</p></fieldset>
      {catalogError && <div className={styles.error} role="alert">{catalogError}<button className={styles.retry} type="button" onClick={() => setRetry(value => value + 1)}>Volver a cargar catálogo</button></div>}
      <fieldset className={styles.group} disabled={saving}><legend>Cantidad y ticket</legend><div className={styles.grid}><div className={styles.field}><label htmlFor={`${id}-qty`}>Cantidad de piezas o juegos *</label><input id={`${id}-qty`} type="number" inputMode="numeric" min="1" max="2147483647" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} /><p className={styles.help}>Unidades del mismo SKU y tamaño. Cada juego completo cuenta como una unidad; los productos distintos se registran por separado.</p></div><div className={styles.field}><label htmlFor={`${id}-ticket`}>Número de ticket *</label><input id={`${id}-ticket`} required value={ticket} onChange={event => setTicket(event.target.value)} /></div></div></fieldset>
      <fieldset className={styles.group} disabled={saving}><legend>Importe de venta</legend><div className={styles.field}><label htmlFor={`${id}-amount`}>Monto total de la venta (MXN) *</label><input id={`${id}-amount`} type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /><p className={styles.help}>Importe total de todas las unidades de este registro, no el precio por unidad.</p></div></fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button className={styles.save} type="submit" disabled={saving || loading || !!catalogError}>{saving ? "Guardando venta…" : "Guardar venta"}</button>
    </form>
  </div>;
}
