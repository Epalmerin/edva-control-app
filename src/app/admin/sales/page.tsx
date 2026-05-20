"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type SaleRecord = {
  id: string;
  sale_date: string;
  sku: string | null;
  model: string | null;
  ticket_number: string;
  amount: number;
  created_at: string;
  profiles: {
    name: string;
    email: string;
  } | null;
  stores: {
    name: string;
    chain_name: string | null;
    brand_name: string | null;
  } | null;
};

type SummaryItem = {
  name: string;
  tickets: number;
  total: number;
};

export default function AdminSalesPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadSales = async () => {
    setLoading(true);
    setMessage("");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("sales_records")
      .select(`
        id,
        sale_date,
        sku,
        model,
        ticket_number,
        amount,
        created_at,
        profiles:employee_id (
          name,
          email
        ),
        stores:store_id (
          name,
          chain_name,
          brand_name
        )
      `)
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error al cargar ventas: ${error.message}`);
      setLoading(false);
      return;
    }

    setSales((data || []).map((sale: any) => ({
  ...sale,
  profiles: Array.isArray(sale.profiles) ? sale.profiles[0] : sale.profiles,
  stores: Array.isArray(sale.stores) ? sale.stores[0] : sale.stores,
})));
    setLoading(false);
  };

  useEffect(() => {
    loadSales();
  }, []);

  const totalSales = sales.reduce(
    (sum, sale) => sum + Number(sale.amount || 0),
    0
  );

  const tickets = sales.length;

  const promoters = new Set(
    sales.map((sale) => sale.profiles?.email).filter(Boolean)
  ).size;

  const storesCount = new Set(
    sales.map((sale) => sale.stores?.name).filter(Boolean)
  ).size;

  const buildSummary = (
    getName: (sale: SaleRecord) => string
  ): SummaryItem[] => {
    const map = new Map<string, SummaryItem>();

    sales.forEach((sale) => {
      const name = getName(sale);
      const amount = Number(sale.amount || 0);

      if (!map.has(name)) {
        map.set(name, {
          name,
          tickets: 0,
          total: 0,
        });
      }

      const item = map.get(name)!;
      item.tickets += 1;
      item.total += amount;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  };

  const salesByChain = buildSummary(
    (sale) => sale.stores?.chain_name || "Sin cadena"
  );

  const salesByPromoter = buildSummary(
    (sale) => sale.profiles?.name || "Sin promotor"
  );

  const salesByStore = buildSummary(
    (sale) => sale.stores?.name || "Sin tienda"
  );

  const SummaryCard = ({
    title,
    items,
  }: {
    title: string;
    items: SummaryItem[];
  }) => (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-semibold text-neutral-800 mb-5">
        {title}
      </h2>

      {items.length === 0 && (
        <p className="text-neutral-500 text-sm">Sin información.</p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.name}
            className="border rounded-xl p-4 bg-neutral-50"
          >
            <div className="flex justify-between gap-4">
              <div>
                <h3 className="font-semibold text-neutral-800">
                  {item.name}
                </h3>

                <p className="text-sm text-neutral-500">
                  Tickets: {item.tickets}
                </p>
              </div>

              <p className="font-bold text-red-500">
                ${item.total.toLocaleString("es-MX")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-800">
              Ventas de hoy
            </h1>
            <p className="text-neutral-500 mt-2">
              Consulta de ventas por cadena, promotor y tienda.
            </p>
          </div>

          <button
            onClick={loadSales}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Total vendido</p>
            <p className="text-4xl font-bold text-red-500 mt-3">
              ${totalSales.toLocaleString("es-MX")}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Tickets</p>
            <p className="text-4xl font-bold text-red-500 mt-3">
              {tickets}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Promotores con venta</p>
            <p className="text-4xl font-bold text-red-500 mt-3">
              {promoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Tiendas con venta</p>
            <p className="text-4xl font-bold text-red-500 mt-3">
              {storesCount}
            </p>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
            <p className="text-neutral-500 text-sm">Cargando ventas...</p>
          </div>
        )}

        {message && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
            <p className="text-neutral-700 text-sm">{message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          <SummaryCard title="Ventas por cadena" items={salesByChain} />
          <SummaryCard title="Ventas por promotor" items={salesByPromoter} />
          <SummaryCard title="Ventas por tienda" items={salesByStore} />
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-neutral-800 mb-6">
            Detalle de ventas
          </h2>

          {!loading && sales.length === 0 && (
            <p className="text-neutral-500 text-sm">
              Aún no hay ventas registradas hoy.
            </p>
          )}

          <div className="space-y-4">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="border rounded-xl p-4 bg-neutral-50 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-semibold text-neutral-800">
                    {sale.profiles?.name || "Sin promotor"}
                  </h3>

                  <p className="text-sm text-neutral-600">
                    {sale.stores?.name || "Sin tienda"} ·{" "}
                    {sale.stores?.chain_name || ""} /{" "}
                    {sale.stores?.brand_name || ""}
                  </p>

                  <p className="text-sm text-neutral-500 mt-1">
                    SKU: {sale.sku || "N/A"} · Modelo:{" "}
                    {sale.model || "N/A"}
                  </p>

                  <p className="text-sm text-neutral-500">
                    Ticket: {sale.ticket_number}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <p className="text-2xl font-bold text-red-500">
                    ${Number(sale.amount).toLocaleString("es-MX")}
                  </p>

                  <p className="text-xs text-neutral-400 mt-1">
                    {new Date(sale.created_at).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}