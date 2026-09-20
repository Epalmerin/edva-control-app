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
  store_id: string;
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

type VisibleStore = {
  id: string;
  name: string;
  chain_name: string | null;
  brand_name: string | null;
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
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [visibleStores, setVisibleStores] = useState<VisibleStore[]>([]);

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

  const loadVisibleStores = async () => {
    if (!activeAccountId) return;

    if (activeAccountId === "all") {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, chain_name, brand_name")
        .order("chain_name")
        .order("name");

      if (error) {
        console.error("Error cargando tiendas:", error);
        setVisibleStores([]);
        return;
      }

      setVisibleStores(data || []);
      return;
    }

    const { data: accountStoreRows, error: accountStoresError } = await supabase
      .from("account_stores")
      .select("store_id")
      .eq("account_id", activeAccountId);

    if (accountStoresError) {
      console.error("Error cargando tiendas de la cuenta:", accountStoresError);
      setVisibleStores([]);
      return;
    }

    const storeIds = (accountStoreRows || []).map(
      (item: { store_id: string }) => item.store_id
    );

    if (storeIds.length === 0) {
      setVisibleStores([]);
      return;
    }

    const { data, error } = await supabase
      .from("stores")
      .select("id, name, chain_name, brand_name")
      .in("id", storeIds)
      .order("name");

    if (error) {
      console.error("Error cargando tiendas:", error);
      setVisibleStores([]);
      return;
    }

    setVisibleStores(data || []);
  };

  const loadSales = async () => {
    if (!activeAccountId) return;

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

    let allowedStoreIds: string[] | null = null;

    if (activeAccountId !== "all") {
      const { data: accountStores, error: accountStoresError } = await supabase
        .from("account_stores")
        .select("store_id")
        .eq("account_id", activeAccountId);

      if (accountStoresError) {
        setSales([]);
        setMessage(
          `Error al cargar las tiendas de la cuenta: ${accountStoresError.message}`
        );
        setLoading(false);
        return;
      }

      allowedStoreIds = (accountStores || []).map(
        (item: { store_id: string }) => item.store_id
      );

      if (allowedStoreIds.length === 0) {
        setSales([]);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from("sales_records")
      .select(`
        id,
        sale_date,
        sku,
        model,
        ticket_number,
        amount,
        created_at,
        store_id,
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
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (allowedStoreIds) {
      query = query.in("store_id", allowedStoreIds);
    }

    const { data, error } = await query
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setSales([]);
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
        stores: Array.isArray(sale.stores) ? sale.stores[0] : sale.stores,
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    const savedAccount =
      localStorage.getItem("edva_active_account") || "all";

    setActiveAccountId(savedAccount);

    const handleAccountChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;

      setActiveAccountId(customEvent.detail || "all");
      setSelectedChain("TODAS");
      setSelectedBrand("TODAS");
      setExpandedStore(null);
      setMessage("");
    };

    window.addEventListener("edva-account-change", handleAccountChange);

    return () => {
      window.removeEventListener("edva-account-change", handleAccountChange);
    };
  }, []);

  useEffect(() => {
    if (!activeAccountId) return;

    loadSales();
    loadVisibleStores();
  }, [activeAccountId, selectedMonth, selectedYear]);

  const chains = useMemo(() => {
    return Array.from(
      new Set(sales.map((sale) => sale.stores?.chain_name || "SIN CADENA"))
    ).sort();
  }, [sales]);

  const brands = useMemo(() => {
    return Array.from(
      new Set(sales.map((sale) => sale.stores?.brand_name || "SIN MARCA"))
    ).sort();
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const chain = sale.stores?.chain_name || "SIN CADENA";
      const brand = sale.stores?.brand_name || "SIN MARCA";

      const chainOk = selectedChain === "TODAS" || chain === selectedChain;
      const brandOk = selectedBrand === "TODAS" || brand === selectedBrand;

      return chainOk && brandOk;
    });
  }, [sales, selectedChain, selectedBrand]);

  const totalSales = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.amount || 0),
    0
  );

  const tickets = filteredSales.length;


  const storesCount = visibleStores.length;

  const averageTicket = tickets > 0 ? totalSales / tickets : 0;

  const storeRanking = useMemo<StoreGroup[]>(() => {
    const map = new Map<string, StoreGroup>();

    visibleStores.forEach((store) => {
      const chain = store.chain_name || "SIN CADENA";
      const brand = store.brand_name || "SIN MARCA";
      const key = store.id;

      map.set(key, {
        key,
        chain,
        brand,
        store: store.name,
        total: 0,
        tickets: 0,
        promoters: new Set<string>(),
        sales: [],
      });
    });

    filteredSales.forEach((sale) => {
      const chain = sale.stores?.chain_name || "SIN CADENA";
      const brand = sale.stores?.brand_name || "SIN MARCA";
      const store = sale.stores?.name || "SIN TIENDA";
      const key = sale.store_id;

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

    return Array.from(map.values()).sort((a, b) => {
      if (a.chain !== b.chain) {
        return a.chain.localeCompare(b.chain, "es");
      }

      if (b.total !== a.total) {
        return b.total - a.total;
      }

      return a.store.localeCompare(b.store, "es");
    });
  }, [filteredSales, visibleStores]);

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

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-neutral-200">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Venta mensual
            </p>
            <p className="text-xl font-black text-red-500 mt-1">
              {money(totalSales)}
            </p>
          </div>

          <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-neutral-200">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Tickets
            </p>
            <p className="text-xl font-black text-neutral-900 mt-1">{tickets}</p>
          </div>

          <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-neutral-200">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Tiendas
            </p>
            <p className="text-xl font-black text-neutral-900 mt-1">
              {storesCount}
            </p>
          </div>

          <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-neutral-200">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Ticket promedio
            </p>
            <p className="text-xl font-black text-neutral-900 mt-1">
              {money(averageTicket)}
            </p>
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

        <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-neutral-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-neutral-900">
                Ventas por tienda
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                Todas las tiendas de la cuenta, agrupadas por cadena.
              </p>
            </div>

            <p className="text-sm font-semibold text-neutral-500">
              {storeRanking.length} tienda(s)
            </p>
          </div>

          {storeRanking.length === 0 && !loading ? (
            <div className="p-8 text-center text-neutral-500">
              No hay tiendas registradas para esta cuenta.
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {storeRanking.map((store, index) => {
                const isExpanded = expandedStore === store.key;

                return (
                  <div key={store.key}>
                    <button
                      onClick={() => {
                        if (store.tickets > 0) {
                          setExpandedStore(isExpanded ? null : store.key);
                        }
                      }}
                      className={`w-full px-6 py-4 text-left transition ${
                        store.tickets > 0
                          ? "hover:bg-neutral-50 cursor-pointer"
                          : "cursor-default"
                      }`}
                    >
                      <div className="grid grid-cols-[44px_minmax(0,1fr)_90px_150px_28px] items-center gap-4">
                        <p className="text-sm font-bold text-neutral-400">
                          #{index + 1}
                        </p>

                        <div className="min-w-0">
                          <p className="font-bold text-neutral-900 truncate">
                            {store.store}
                          </p>
                          <p className="text-xs text-neutral-400 mt-1">
                            {store.chain} · {store.brand}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-neutral-400">Tickets</p>
                          <p className="font-bold text-neutral-800">
                            {store.tickets}
                          </p>
                        </div>

                        <p className="font-black text-red-500 text-right">
                          {money(store.total)}
                        </p>

                        <p className="text-neutral-400 text-right">
                          {store.tickets > 0 ? (isExpanded ? "−" : "+") : ""}
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="bg-neutral-50 border-t border-neutral-200 px-6 py-4">
                        <div className="space-y-2">
                          {store.sales.map((sale) => (
                            <div
                              key={sale.id}
                              className="bg-white border border-neutral-200 rounded-xl px-4 py-3 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_180px_140px] gap-3 xl:items-center"
                            >
                              <div>
                                <p className="font-semibold text-neutral-800">
                                  Ticket: {sale.ticket_number}
                                </p>
                                <p className="text-sm text-neutral-500 mt-1">
                                  {sale.profiles?.name || "Sin promotor"}
                                </p>
                                <p className="text-xs text-neutral-400 mt-1">
                                  SKU: {sale.sku || "N/A"} · Modelo:{" "}
                                  {sale.model || "N/A"}
                                </p>
                              </div>

                              <p className="text-sm text-neutral-500 xl:text-right">
                                {sale.sale_date}
                              </p>

                              <p className="font-black text-red-500 xl:text-right">
                                {money(Number(sale.amount))}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>



      </section>
    </main>
  );
}