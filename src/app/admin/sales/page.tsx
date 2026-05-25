"use client";

import { useEffect, useMemo, useState } from "react";
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

type PromoterGroup = {
  email: string;
  name: string;
  total: number;
  tickets: number;
  sales: SaleRecord[];
};

type StoreGroup = {
  chain: string;
  brand: string;
  store: string;
  total: number;
  tickets: number;
  promoters: PromoterGroup[];
};

const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function AdminSalesPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );

  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );

  const loadSales = async () => {
    setLoading(true);
    setMessage("");

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 1);

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
      .gte("created_at", startDate.toISOString())
      .lt("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error al cargar ventas: ${error.message}`);
      setLoading(false);
      return;
    }

    setSales(
      (data || []).map((sale: any) => ({
        ...sale,
        profiles: Array.isArray(sale.profiles)
          ? sale.profiles[0]
          : sale.profiles,
        stores: Array.isArray(sale.stores)
          ? sale.stores[0]
          : sale.stores,
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    loadSales();
  }, [selectedMonth, selectedYear]);

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

  const groupedSales = useMemo(() => {
    const storeMap = new Map<string, StoreGroup>();

    sales.forEach((sale) => {
      const chain = sale.stores?.chain_name || "SIN CADENA";
      const brand = sale.stores?.brand_name || "SIN MARCA";
      const store = sale.stores?.name || "SIN TIENDA";

      const key = `${chain}-${brand}-${store}`;

      if (!storeMap.has(key)) {
        storeMap.set(key, {
          chain,
          brand,
          store,
          total: 0,
          tickets: 0,
          promoters: [],
        });
      }

      const group = storeMap.get(key)!;

      group.total += Number(sale.amount || 0);
      group.tickets += 1;

      const promoterEmail =
        sale.profiles?.email || `PROMOTOR-${sale.id}`;

      let promoter = group.promoters.find(
        (p) => p.email === promoterEmail
      );

      if (!promoter) {
        promoter = {
          email: promoterEmail,
          name: sale.profiles?.name || "Sin promotor",
          total: 0,
          tickets: 0,
          sales: [],
        };

        group.promoters.push(promoter);
      }

      promoter.total += Number(sale.amount || 0);
      promoter.tickets += 1;
      promoter.sales.push(sale);
    });

    return Array.from(storeMap.values()).sort(
      (a, b) => b.total - a.total
    );
  }, [sales]);

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-6 xl:p-8">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-800">
              Concentrado de ventas
            </h1>

            <p className="text-neutral-500 mt-2">
              Histórico mensual por cadena, tienda y promotor.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={selectedMonth}
              onChange={(e) =>
                setSelectedMonth(Number(e.target.value))
              }
              className="px-4 py-3 rounded-xl border bg-white"
            >
              {months.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(Number(e.target.value))
              }
              className="px-4 py-3 rounded-xl border bg-white"
            >
              {[2025, 2026, 2027].map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>

            <button
              onClick={loadSales}
              className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
            >
              Actualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-sm text-neutral-500">
              Venta mensual
            </p>

            <p className="text-3xl font-bold text-red-500 mt-2">
              ${totalSales.toLocaleString("es-MX")}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-sm text-neutral-500">
              Tickets
            </p>

            <p className="text-3xl font-bold text-red-500 mt-2">
              {tickets}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-sm text-neutral-500">
              Promotores
            </p>

            <p className="text-3xl font-bold text-red-500 mt-2">
              {promoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-sm text-neutral-500">
              Tiendas
            </p>

            <p className="text-3xl font-bold text-red-500 mt-2">
              {storesCount}
            </p>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500">
              Cargando ventas...
            </p>
          </div>
        )}

        {message && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <p className="text-neutral-700">{message}</p>
          </div>
        )}

        <div className="space-y-6">
          {groupedSales.map((group) => (
            <div
              key={`${group.chain}-${group.store}`}
              className="bg-white rounded-2xl shadow-md overflow-hidden"
            >
              <div className="bg-neutral-900 text-white px-5 py-4">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold">
                      {group.store}
                    </h2>

                    <p className="text-sm text-neutral-300">
                      {group.chain} · {group.brand}
                    </p>
                  </div>

                  <div className="xl:text-right">
                    <p className="text-2xl font-bold text-red-400">
                      ${group.total.toLocaleString("es-MX")}
                    </p>

                    <p className="text-sm text-neutral-300">
                      Tickets: {group.tickets}
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y">
                {group.promoters.map((promoter) => (
                  <div
                    key={promoter.email}
                    className="p-5"
                  >
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-neutral-800">
                          {promoter.name}
                        </h3>

                        <p className="text-sm text-neutral-500">
                          {promoter.email}
                        </p>
                      </div>

                      <div className="xl:text-right">
                        <p className="text-xl font-bold text-red-500">
                          ${promoter.total.toLocaleString("es-MX")}
                        </p>

                        <p className="text-sm text-neutral-500">
                          Tickets: {promoter.tickets}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {promoter.sales.map((sale) => (
                        <div
                          key={sale.id}
                          className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 text-sm border-b pb-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-neutral-800">
                              Ticket: {sale.ticket_number}
                            </span>

                            <span className="text-neutral-500">
                              SKU: {sale.sku || "N/A"}
                            </span>

                            <span className="text-neutral-500">
                              Modelo: {sale.model || "N/A"}
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="text-neutral-400">
                              {new Date(
                                sale.created_at
                              ).toLocaleTimeString("es-MX", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>

                            <span className="font-bold text-red-500">
                              $
                              {Number(
                                sale.amount
                              ).toLocaleString("es-MX")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}