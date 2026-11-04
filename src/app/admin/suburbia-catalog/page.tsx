"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import { SUBURBIA_BRAND, SUBURBIA_CHAIN, type SuburbiaProduct } from "@/lib/suburbia-products";

export default function SuburbiaCatalogPage() {
  const [products, setProducts] = useState<SuburbiaProduct[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(""); setProducts([]); setRates({});
      try {
        const [catalog, commissions] = await Promise.all([
          supabase.from("sales_product_catalog").select("id, chain_name, brand_name, sku, model, size").eq("chain_name", SUBURBIA_CHAIN).eq("brand_name", SUBURBIA_BRAND).eq("active", true).order("model").order("sku"),
          supabase.from("sales_product_commissions").select("product_id, commission_amount"),
        ]);
        if (catalog.error) throw catalog.error;
        if (commissions.error) throw commissions.error;
        if (!cancelled) {
          setProducts((catalog.data || []) as SuburbiaProduct[]);
          setRates(Object.fromEntries((commissions.data || []).map((row) => [row.product_id, Number(row.commission_amount)])));
        }
      } catch { if (!cancelled) setError("No fue posible cargar el catálogo y las comisiones. Vuelve a intentar."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reload]);

  const visible = useMemo(() => {
    const value = search.trim().toLocaleLowerCase("es-MX");
    return products.filter((product) => `${product.sku} ${product.model} ${product.size}`.toLocaleLowerCase("es-MX").includes(value));
  }, [search, products]);
  const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  return <main className="min-h-screen bg-neutral-100 flex">
    <Sidebar userName="Eduardo Palmerin" />
    <section className="flex-1 min-w-0 p-5 md:p-8 text-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div><p className="text-xs uppercase tracking-wide font-semibold text-red-600 mb-2">Administración</p><h1 className="text-3xl font-bold">Catálogo Suburbia</h1><p className="text-sm text-neutral-600 mt-2">COLCHONES MASTER · SKU, modelo, tamaño y comisión por unidad.</p></div>
        <Link href="/admin/sales" className="bg-neutral-900 text-white px-4 py-3 rounded-xl text-sm font-semibold">Volver a ventas</Link>
      </div>
      <p className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-neutral-700 mb-6">Las comisiones de este catálogo son visibles únicamente para administradores activos. El promotor consulta el SKU, modelo y tamaño, sin recibir estos importes.</p>
      <div className="flex flex-wrap gap-3 items-end mb-5">
        <label className="block flex-1 min-w-48 text-sm font-medium">Buscar producto<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SKU, modelo o tamaño" type="search" className="block w-full mt-2 bg-white border border-neutral-300 rounded-xl px-4 py-3 font-normal" /></label>
        <button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)} className="bg-white border border-neutral-300 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50">Actualizar</button>
      </div>
      {error && <p role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">{error}</p>}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 text-sm text-neutral-600">{loading ? "Cargando catálogo..." : `${visible.length} de ${products.length} productos`}</div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-neutral-50 text-neutral-600"><tr><th scope="col" className="text-left px-5 py-4">SKU</th><th scope="col" className="text-left px-5 py-4">Modelo</th><th scope="col" className="text-left px-5 py-4">Tamaño</th><th scope="col" className="text-right px-5 py-4 whitespace-nowrap">Comisión por unidad (MXN)</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">{!loading && !error && visible.map((product) => <tr key={product.id}><td className="px-5 py-4 font-mono whitespace-nowrap">{product.sku}</td><td className="px-5 py-4 font-medium">{product.model}</td><td className="px-5 py-4">{product.size}</td><td className="px-5 py-4 text-right font-semibold whitespace-nowrap">{rates[product.id] === undefined ? "Sin comisión definida" : money(rates[product.id])}</td></tr>)}
            {!loading && !error && visible.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-neutral-500">No se encontraron productos.</td></tr>}
          </tbody></table></div>
      </div>
      <p className="text-xs text-neutral-500 mt-4">Los SKU escritos fuera del catálogo no tienen una comisión definida en esta lista. Las ventas anteriores no se modifican al consultar o cargar este catálogo.</p>
    </section>
  </main>;
}
