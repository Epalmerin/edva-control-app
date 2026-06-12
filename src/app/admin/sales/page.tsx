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
    id: string;
    name: string;
    chain_name: string | null;
    brand_name: string | null;
  } | null;
};

type AssignedStore = {
  store_id: string;
  stores: {
    id: string;
    name: string;
    chain_name: string | null;
    brand_name: string | null;
  } | null;
};

type StoreGroup = {
  key: string;
  chain: string;
  brand: string;
  store: string;
  total: number;
  tickets: number;
  promoters: Set<string>;
  sales: SaleRecord[];
};

type PromoterGroup = {
  key: string;
  name: string;
  email: string;
  total: number;
  tickets: number;
  stores: Set<string>;
};

type StoreWithoutSales = {
  id: string;
  name: string;
  chain: string;
  brand: string;
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

function getMexicoTodayDate() {
  const now = new Date();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function getMexicoDateMinusDays(days: number) {
  const today = getMexicoTodayDate();
  const date = new Date(`${today}T00:00:00-06:00`);
  date.setDate(date.getDate() - days);

  return date.toISOString().slice(0, 10);
}

export default function AdminSalesPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [assignedStores, setAssignedStores] = useState<StoreWithoutSales[]>([]);
  const [recentSalesStoreIds, setRecentSalesStoreIds] = useState<Set<string>>(
    new Set()
  );

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedChain, setSelectedChain] = useState("TODAS");
  const [selectedBrand, setSelectedBrand] = useState("TODAS");
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  const money = (value: number) =>
    value.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });

  const loadSales = async () => {
    setLoading(true);
    setMessage("");

    const startDate = `${selectedYear}-${String(selectedMonth).padStart(
      2,
      "0"
    )}-01`;

    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();

    const endDate = `${selectedYear}-${String(selectedMonth).padStart(
      2,
      "0"
    )}-${String(lastDay).padStart(2, "0")}`;

    const recentStartDate = getMexicoDateMinusDays(3);

    const [salesResult, assignmentsResult, recentSalesResult] =
      await Promise.all([
        supabase
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
              id,
              name,
              chain_name,
              brand_name
            )
          `)
          .gte("sale_date", startDate)
          .lte("sale_date", endDate)
          .order("sale_date", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("employee_store_assignments")
          .select(`
            store_id,
            stores:store_id (
              id,
              name,
              chain_name,
              brand_name
            )
          `)
          .eq("active", true),

        supabase
          .from("sales_records")
          .select("store_id")
          .gte("sale_date", recentStartDate),
      ]);

    if (salesResult.error) {
      setMessage(`Error al cargar ventas: ${salesResult.error.message}`);
      setLoading(false);
      return;
    }

    if (assignmentsResult.error) {
      setMessage(
        `Error al cargar tiendas asignadas: ${assignmentsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (recentSalesResult.error) {
      setMessage(
        `Error al cargar ventas recientes: ${recentSalesResult.error.message}`
      );
      setLoading(false);
      return;
    }

    setSales(
      (salesResult.data || []).map((sale: any) => ({
        ...sale,
        profiles: Array.isArray(sale.profiles)
          ? sale.profiles[0]
          : sale.profiles,
        stores: Array.isArray(sale.stores) ? sale.stores[0] : sale.stores,
      }))
    );

    const uniqueStoresMap = new Map<string, StoreWithoutSales>();

    (assignmentsResult.data || []).forEach((item: any) => {
      const store = Array.isArray(item.stores) ? item.stores[0] : item.stores;

      if (!store?.id) return;

      uniqueStoresMap.set(store.id, {
        id: store.id,
        name: store.name || "SIN TIENDA",
        chain: store.chain_name || "SIN CADENA",
        brand: store.brand_name || "SIN MARCA",
      });
    });

    setAssignedStores(Array.from(uniqueStoresMap.values()));

    setRecentSalesStoreIds(
      new Set(
        (recentSalesResult.data || [])
          .map((sale: any) => sale.store_id)
          .filter(Boolean)
      )
    );

    setLoading(false);
  };

  useEffect(() => {
    loadSales();
  }, [selectedMonth, selectedYear]);

  const chains = useMemo(() => {
    const salesChains = sales.map(
      (sale) => sale.stores?.chain_name || "SIN CADENA"
    );

    const assignedChains = assignedStores.map((store) => store.chain);

    return Array.from(new Set([...salesChains, ...assignedChains])).sort();
  }, [sales, assignedStores]);

  const brands = useMemo(() => {
    const salesBrands = sales.map(
      (sale) => sale.stores?.brand_name || "SIN MARCA"
    );

    const assignedBrands = assignedStores.map((store) => store.brand);

    return Array.from(new Set([...salesBrands, ...assignedBrands])).sort();
  }, [sales, assignedStores]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const chain = sale.stores?.chain_name || "SIN CADENA";
      const brand = sale.stores?.brand_name || "SIN MARCA";

      const chainOk = selectedChain === "TODAS" || chain === selectedChain;
      const brandOk = selectedBrand === "TODAS" || brand === selectedBrand;

      return chainOk && brandOk;
    });
  }, [sales, selectedChain, selectedBrand]);

  const filteredAssignedStores = useMemo(() => {
    return assignedStores.filter((store) => {
      const chainOk =
        selectedChain === "TODAS" || store.chain === selectedChain;

      const brandOk = selectedBrand === "TODAS" || store.brand === selectedBrand;

      return chainOk && brandOk;
    });
  }, [assignedStores, selectedChain, selectedBrand]);

  const storesWithoutSales3Days = useMemo(() => {
    return filteredAssignedStores
      .filter((store) => !recentSalesStoreIds.has(store.id))
      .sort((a, b) => a.chain.localeCompare(b.chain) || a.name.localeCompare(b.name));
  }, [filteredAssignedStores, recentSalesStoreIds]);

  const totalSales = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.amount || 0),
    0
  );

  const tickets = filteredSales.length;

  const promoters = new Set(
    filteredSales.map((sale) => sale.profiles?.email).filter(Boolean)
  ).size;

  const storesCount = new Set(
    filteredSales.map((sale) => sale.stores?.name).filter(Boolean)
  ).size;

  const averageTicket = tickets > 0 ? totalSales / tickets : 0;

  const storeRanking = useMemo<StoreGroup[]>(() => {
    const map = new Map<string, StoreGroup>();

    filteredSales.forEach((sale) => {
      const chain = sale.stores?.chain_name || "SIN CADENA";
      const brand = sale.stores?.brand_name || "SIN MARCA";
      const store = sale.stores?.name || "SIN TIENDA";
      const key = `${chain}-${brand}-${store}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          chain,
          brand,
          store,
          total: 0,
          tickets: 0,
          promoters: new Set<string>(),
          sales: [],
        });
      }

      const group = map.get(key)!;

      group.total += Number(sale.amount || 0);
      group.tickets += 1;
      group.sales.push(sale);

      if (sale.profiles?.email) {
        group.promoters.add(sale.profiles.email);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  const promoterRanking = useMemo<PromoterGroup[]>(() => {
    const map = new Map<string, PromoterGroup>();

    filteredSales.forEach((sale) => {
      const email = sale.profiles?.email || `SIN-CORREO-${sale.id}`;
      const name = sale.profiles?.name || "Sin promotor";

      if (!map.has(email)) {
        map.set(email, {
          key: email,
          name,
          email,
          total: 0,
          tickets: 0,
          stores: new Set<string>(),
        });
      }

      const group = map.get(email)!;

      group.total += Number(sale.amount || 0);
      group.tickets += 1;

      if (sale.stores?.name) {
        group.stores.add(sale.stores.name);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  const topStore = storeRanking[0];
  const topPromoter = promoterRanking[0];

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-6 xl:p-8">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-800">
              Concentrado de ventas
            </h1>

            <p className="text-neutral-500 mt-2">
              Vista ejecutiva por cadena, marca, tienda y promotor.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="px-4 py-3 rounded-xl border bg-white"
            >
              <option value="TODAS">Todas las cadenas</option>
              {chains.map((chain) => (
                <option key={chain} value={chain}>
                  {chain}
                </option>
              ))}
            </select>

            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="px-4 py-3 rounded-xl border bg-white"
            >
              <option value="TODAS">Todas las marcas</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
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
              onChange={(e) => setSelectedYear(Number(e.target.value))}
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

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-sm text-neutral-500">Venta mensual</p>
            <p className="text-3xl font-black text-red-500 mt-2">
              {money(totalSales)}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-sm text-neutral-500">Tickets</p>
            <p className="text-3xl font-black text-red-500 mt-2">{tickets}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-sm text-neutral-500">Promotores</p>
            <p className="text-3xl font-black text-red-500 mt-2">
              {promoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-sm text-neutral-500">Tiendas con venta</p>
            <p className="text-3xl font-black text-red-500 mt-2">
              {storesCount}
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-md">
            <p className="text-sm text-red-600">Sin venta +3 días</p>
            <p className="text-3xl font-black text-red-600 mt-2">
              {storesWithoutSales3Days.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-neutral-900 rounded-2xl p-5 shadow-md text-white">
            <p className="text-sm text-neutral-400">Top tienda</p>
            <p className="text-xl font-black mt-2">
              {topStore?.store || "Sin datos"}
            </p>
            <p className="text-red-400 font-bold mt-1">
              {topStore ? money(topStore.total) : "$0"}
            </p>
          </div>

          <div className="bg-neutral-900 rounded-2xl p-5 shadow-md text-white">
            <p className="text-sm text-neutral-400">Top promotor</p>
            <p className="text-xl font-black mt-2">
              {topPromoter?.name || "Sin datos"}
            </p>
            <p className="text-red-400 font-bold mt-1">
              {topPromoter ? money(topPromoter.total) : "$0"}
            </p>
          </div>

          <div className="bg-neutral-900 rounded-2xl p-5 shadow-md text-white">
            <p className="text-sm text-neutral-400">Ticket promedio</p>
            <p className="text-xl font-black mt-2">{money(averageTicket)}</p>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <p className="text-neutral-500">Cargando ventas...</p>
          </div>
        )}

        {message && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <p className="text-neutral-700">{message}</p>
          </div>
        )}

        {storesWithoutSales3Days.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold text-neutral-800 mb-2">
              Alertas: tiendas sin venta en más de 3 días
            </h2>

            <p className="text-sm text-neutral-500 mb-5">
              Tiendas asignadas sin registros de venta recientes.
            </p>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-2">
              {storesWithoutSales3Days.map((store) => (
                <div
                  key={store.id}
                  className="border border-red-200 bg-red-50 rounded-xl p-4"
                >
                  <p className="font-bold text-neutral-800">{store.name}</p>

                  <p className="text-sm text-neutral-500">
                    {store.chain} · {store.brand}
                  </p>

                  <p className="text-xs font-bold text-red-600 mt-2">
                    Sin venta registrada en los últimos 3 días
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-neutral-800 mb-5">
              Ranking por tienda
            </h2>

            <div className="space-y-3">
              {storeRanking.map((store, index) => (
                <button
                  key={store.key}
                  onClick={() =>
                    setExpandedStore(
                      expandedStore === store.key ? null : store.key
                    )
                  }
                  className="w-full border rounded-xl p-4 text-left hover:bg-neutral-50 transition"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-bold text-neutral-800">
                        #{index + 1} {store.store}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {store.chain} · {store.brand}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {store.promoters.size} promotor(es) · {store.tickets}{" "}
                        ticket(s)
                      </p>
                    </div>

                    <p className="font-black text-red-500">
                      {money(store.total)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-neutral-800 mb-5">
              Ranking por promotor
            </h2>

            <div className="space-y-3">
              {promoterRanking.map((promoter, index) => (
                <div key={promoter.key} className="border rounded-xl p-4">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-bold text-neutral-800">
                        #{index + 1} {promoter.name}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {promoter.email}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {promoter.stores.size} tienda(s) · {promoter.tickets}{" "}
                        ticket(s)
                      </p>
                    </div>

                    <p className="font-black text-red-500">
                      {money(promoter.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {expandedStore && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-neutral-800 mb-5">
              Detalle de tickets
            </h2>

            {storeRanking
              .filter((store) => store.key === expandedStore)
              .map((store) => (
                <div key={store.key}>
                  <div className="bg-neutral-900 text-white rounded-2xl p-5 mb-5">
                    <h3 className="text-xl font-bold">{store.store}</h3>
                    <p className="text-sm text-neutral-300">
                      {store.chain} · {store.brand}
                    </p>
                    <p className="text-red-400 font-black mt-2">
                      {money(store.total)} · {store.tickets} ticket(s)
                    </p>
                  </div>

                  <div className="space-y-2">
                    {store.sales.map((sale) => (
                      <div
                        key={sale.id}
                        className="border rounded-xl p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2"
                      >
                        <div>
                          <p className="font-bold text-neutral-800">
                            Ticket: {sale.ticket_number}
                          </p>
                          <p className="text-sm text-neutral-500">
                            {sale.profiles?.name || "Sin promotor"}
                          </p>
                          <p className="text-xs text-neutral-400 mt-1">
                            SKU: {sale.sku || "N/A"} · Modelo:{" "}
                            {sale.model || "N/A"}
                          </p>
                        </div>

                        <div className="xl:text-right">
                          <p className="font-black text-red-500">
                            {money(Number(sale.amount))}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {sale.sale_date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}