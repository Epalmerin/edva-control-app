"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type SaleRecord = {
  id: string;
  employee_id: string | null;
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

type SalesTarget = {
  id: string;
  employee_id: string;
  account_id: string;
  target_amount: number | string;
};

type TargetProfile = { id: string; name: string; email: string };

type SellerSummary = {
  employeeId: string;
  name: string;
  email: string;
  sales: number;
  target: number | null;
  percentage: number | null;
  remaining: number | null;
};

// Read every page so a busy month is not limited to the first API response.
async function readAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  isCurrent: () => boolean
): Promise<T[]> {
  const rows: T[] = [];
  while (isCurrent()) {
    const { data, error } = await fetchPage(rows.length, rows.length + 499);
    if (error) throw new Error(error.message);
    if (!isCurrent()) throw new Error("Consulta reemplazada");
    if (!data?.length) return rows;
    rows.push(...data);
  }
  throw new Error("Consulta reemplazada");
}

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
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [targetProfiles, setTargetProfiles] = useState<TargetProfile[]>([]);
  const [targetMessage, setTargetMessage] = useState("");
  const [accountName, setAccountName] = useState("Cuenta seleccionada");
  const [accountChange, setAccountChange] = useState(0);
  const requestId = useRef(0);

  const clearResults = useCallback(() => {
    requestId.current += 1;
    setLoading(true);
    setSales([]);
    setVisibleStores([]);
    setTargets([]);
    setTargetProfiles([]);
    setMessage("");
    setTargetMessage("");
    setExpandedStore(null);
  }, []);

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

  const loadSales = useCallback(async () => {
    if (!activeAccountId) return;
    clearResults();
    const currentRequest = requestId.current;
    const isCurrent = () => currentRequest === requestId.current;
    const specificAccount = activeAccountId !== "all";
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Targets belong to the account and period, independently of current membership.
    const loadTargets = async () => {
      if (!specificAccount) return { rows: [] as SalesTarget[], people: [] as TargetProfile[], error: "" };
      try {
        const rows = await readAllRows<SalesTarget>((from, to) =>
          supabase.from("sales_targets")
            .select("id, employee_id, account_id, target_amount")
            .eq("account_id", activeAccountId)
            .eq("year", selectedYear).eq("month", selectedMonth)
            .order("id").range(from, to), isCurrent);
        const ids = Array.from(new Set(rows.map((row) => row.employee_id)));
        const people: TargetProfile[] = [];
        for (let offset = 0; offset < ids.length; offset += 100) {
          const batch = ids.slice(offset, offset + 100);
          people.push(...await readAllRows<TargetProfile>((from, to) =>
            supabase.from("profiles").select("id, name, email")
              .in("id", batch).order("id").range(from, to), isCurrent));
        }
        return { rows, people, error: "" };
      } catch (error: unknown) {
        return { rows: [] as SalesTarget[], people: [] as TargetProfile[],
          error: `No fue posible cargar las metas: ${error instanceof Error ? error.message : "Error desconocido"}` };
      }
    };

    try {
      let allowedStoreIds: string[] | null = null;
      if (specificAccount) {
        const accountStores = await readAllRows<{ store_id: string }>((from, to) =>
          supabase.from("account_stores").select("store_id")
            .eq("account_id", activeAccountId).order("store_id").range(from, to), isCurrent);
        allowedStoreIds = Array.from(new Set(accountStores.map((row) => row.store_id)));
      }
      if (!isCurrent()) return;
      const storeIds = allowedStoreIds;
      const noStores = storeIds !== null && storeIds.length === 0;

      const [saleRows, storeRows, targetResult, accountResult] = await Promise.all([
        noStores ? Promise.resolve([] as SaleRecord[]) : readAllRows<SaleRecord>(async (from, to) => {
          let query = supabase.from("sales_records").select(`
            id, employee_id, sale_date, sku, model, ticket_number, amount, created_at, store_id,
            profiles:employee_id (name, email),
            stores:store_id (name, chain_name, brand_name)
          `).gte("sale_date", startDate).lte("sale_date", endDate);
          if (storeIds) query = query.in("store_id", storeIds);
          const { data, error } = await query
            .order("sale_date", { ascending: false })
            .order("created_at", { ascending: false }).order("id").range(from, to);
          return { error, data: (data || []).map((sale: any) => ({
            ...sale,
            profiles: Array.isArray(sale.profiles) ? sale.profiles[0] || null : sale.profiles,
            stores: Array.isArray(sale.stores) ? sale.stores[0] || null : sale.stores,
          })) };
        }, isCurrent),
        noStores ? Promise.resolve([] as VisibleStore[]) : readAllRows<VisibleStore>((from, to) => {
          let query = supabase.from("stores").select("id, name, chain_name, brand_name");
          if (storeIds) query = query.in("id", storeIds);
          return query.order("chain_name").order("name").order("id").range(from, to);
        }, isCurrent),
        loadTargets(),
        specificAccount
          ? supabase.from("accounts").select("name").eq("id", activeAccountId).maybeSingle()
          : Promise.resolve({ data: { name: "Todas las cuentas" }, error: null }),
      ]);
      if (!isCurrent()) return;
      setSales(saleRows);
      setVisibleStores(storeRows);
      setTargets(targetResult.rows);
      setTargetProfiles(targetResult.people);
      setTargetMessage(targetResult.error);
      setAccountName(accountResult.data?.name || "Cuenta seleccionada");
    } catch (error: unknown) {
      if (!isCurrent()) return;
      setMessage(`Error al cargar ventas: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [activeAccountId, selectedMonth, selectedYear, clearResults]);

  useEffect(() => {
    setActiveAccountId(localStorage.getItem("edva_active_account") || "all");
    const handleAccountChange = (event: Event) => {
      clearResults();
      setAccountName("Cuenta seleccionada");
      setActiveAccountId((event as CustomEvent<string>).detail || "all");
      setAccountChange((value) => value + 1);
      setSelectedChain("TODAS");
      setSelectedBrand("TODAS");
    };
    window.addEventListener("edva-account-change", handleAccountChange);
    return () => {
      window.removeEventListener("edva-account-change", handleAccountChange);
      requestId.current += 1;
    };
  }, [clearResults]);

  useEffect(() => {
    void loadSales();
    return () => { requestId.current += 1; };
  }, [loadSales, accountChange]);

  const sellerRanking = useMemo<SellerSummary[]>(() => {
    if (!activeAccountId || activeAccountId === "all") return [];
    const map = new Map<string, SellerSummary>();
    const people = new Map(targetProfiles.map((person) => [person.id, person]));
    const ensureSeller = (employeeId: string) => {
      let row = map.get(employeeId);
      if (!row) {
        const person = people.get(employeeId);
        row = { employeeId, name: person?.name || "Sin nombre", email: person?.email || "",
          sales: 0, target: null, percentage: null, remaining: null };
        map.set(employeeId, row);
      }
      return row;
    };
    targets.forEach((target) => {
      if (target.account_id !== activeAccountId) return;
      const row = ensureSeller(target.employee_id);
      row.target = (row.target ?? 0) + Number(target.target_amount);
    });
    // Use the full account month: a chain/brand subset has no allocated employee target.
    sales.forEach((sale) => {
      if (!sale.employee_id) return;
      const row = ensureSeller(sale.employee_id);
      row.sales += Number(sale.amount || 0);
      if (sale.profiles?.name) row.name = sale.profiles.name;
      if (sale.profiles?.email) row.email = sale.profiles.email;
    });
    return Array.from(map.values()).map((row) => ({
      ...row,
      percentage: row.target !== null && row.target > 0 ? row.sales / row.target * 100 : null,
      remaining: row.target !== null && row.target > 0 ? Math.max(row.target - row.sales, 0) : null,
    })).sort((a, b) => (b.percentage ?? -Infinity) - (a.percentage ?? -Infinity)
      || b.sales - a.sales || a.name.localeCompare(b.name, "es"));
  }, [activeAccountId, sales, targets, targetProfiles]);

  const salesWithoutSeller = sales.filter((sale) => !sale.employee_id).length;

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

      <section className="flex-1 min-w-0 p-6 xl:p-8">
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
              onChange={(e) => { clearResults(); setSelectedMonth(Number(e.target.value)); }}
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
              onChange={(e) => { clearResults(); setSelectedYear(Number(e.target.value)); }}
              className="px-4 py-3 rounded-xl border bg-white"
            >
              {[2025, 2026, 2027].map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>

            <button
              onClick={loadSales}
              disabled={loading || !activeAccountId}
              className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold"
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
              {loading ? "..." : message ? "—" : money(totalSales)}
            </p>
          </div>

          <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-neutral-200">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Tickets
            </p>
            <p className="text-xl font-black text-neutral-900 mt-1">{loading ? "..." : message ? "—" : tickets}</p>
          </div>

          <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-neutral-200">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Tiendas
            </p>
            <p className="text-xl font-black text-neutral-900 mt-1">
              {loading ? "..." : message ? "—" : storesCount}
            </p>
          </div>

          <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-neutral-200">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Ticket promedio
            </p>
            <p className="text-xl font-black text-neutral-900 mt-1">
              {loading ? "..." : message ? "—" : money(averageTicket)}
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
          <div className="px-6 py-5 border-b border-neutral-200">
            <h2 className="text-xl font-bold text-neutral-900">Cumplimiento por vendedor</h2>
            <p className="text-sm text-neutral-500 mt-1">
              {months[selectedMonth - 1]} {selectedYear}
              {activeAccountId && activeAccountId !== "all" ? ` · ${accountName}` : ""}
            </p>
            <p className="text-xs text-neutral-500 mt-2">
              Venta mensual del vendedor ÷ su meta mensual × 100. Este resumen considera toda
              la cuenta; los filtros de cadena y marca aplican al concentrado de ventas.
            </p>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-neutral-500">Cargando cumplimiento...</p>
          ) : message ? (
            <p className="p-6 text-sm text-neutral-500">Cumplimiento no disponible. Vuelve a intentar con Actualizar.</p>
          ) : activeAccountId === "all" ? (
            <p className="p-6 text-sm text-neutral-600">
              Selecciona una cuenta específica en el menú lateral para consultar las metas
              y el cumplimiento de cada vendedor.
            </p>
          ) : targetMessage ? (
            <p role="alert" className="p-6 text-sm text-red-600">{targetMessage} Usa Actualizar para reintentar.</p>
          ) : (
            <>
              {salesWithoutSeller > 0 && (
                <p className="px-6 py-3 text-sm text-amber-800 bg-amber-50">
                  Hay {salesWithoutSeller} registro(s) de venta sin vendedor identificado.
                  Están incluidos en las ventas por tienda, pero no en este cálculo.
                </p>
              )}
              {sellerRanking.length === 0 ? (
                <p className="p-8 text-center text-neutral-500">No hay ventas ni metas por vendedor para esta cuenta y periodo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left">Vendedor</th>
                        <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">Venta mensual</th>
                        <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">Meta mensual</th>
                        <th scope="col" className="px-4 py-3 text-left">Cumplimiento</th>
                        <th scope="col" className="px-6 py-3 text-right">Faltante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {sellerRanking.map((seller) => {
                        const achieved = seller.percentage !== null && seller.percentage >= 100;
                        return (
                          <tr key={seller.employeeId} className="hover:bg-neutral-50">
                            <td className="px-6 py-4 min-w-52">
                              <p className="font-semibold text-neutral-900">{seller.name}</p>
                              <p className="text-xs text-neutral-400 mt-1">{seller.email || seller.employeeId}</p>
                            </td>
                            <td className="px-4 py-4 text-right font-bold text-neutral-900 whitespace-nowrap">{money(seller.sales)}</td>
                            <td className="px-4 py-4 text-right whitespace-nowrap">
                              {seller.target === null ? <span className="text-neutral-400">Sin meta</span> : money(seller.target)}
                            </td>
                            <td className="px-4 py-4 min-w-48">
                              {seller.percentage === null ? (
                                <span className="text-xs text-neutral-500">{seller.target === null ? "Sin meta asignada" : "Meta no mayor a cero"}</span>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between gap-3 mb-2">
                                    <span className={`font-bold ${achieved ? "text-emerald-600" : "text-neutral-800"}`}>
                                      {seller.percentage.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%
                                    </span>
                                    <span className={`text-xs ${achieved ? "text-emerald-600" : "text-neutral-500"}`}>
                                      {achieved ? "Meta alcanzada" : "En avance"}
                                    </span>
                                  </div>
                                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden" aria-hidden="true">
                                    <div className={`h-full rounded-full ${achieved ? "bg-emerald-500" : "bg-red-500"}`}
                                      style={{ width: `${Math.max(0, Math.min(seller.percentage, 100))}%` }} />
                                  </div>
                                </>
                              )}
                            </td>
                            <td className={`px-6 py-4 text-right font-semibold whitespace-nowrap ${achieved ? "text-emerald-600" : "text-neutral-700"}`}>
                              {seller.remaining === null ? "—" : money(seller.remaining)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

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

          {message ? (
            <div className="p-8 text-center text-neutral-500">Ventas no disponibles.</div>
          ) : storeRanking.length === 0 && !loading ? (
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