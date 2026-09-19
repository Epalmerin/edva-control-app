"use client";

import { useEffect, useMemo, useState } from "react";
import PromoterBottomNav from "@/components/PromoterBottomNav";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  chain_name: string | null;
  brand_name: string | null;
};

type SaleRecord = {
  id: string;
  sale_date: string;
  sku: string | null;
  model: string | null;
  ticket_number: string;
  amount: number;
  created_at: string;
  stores: {
    name: string;
    chain_name: string | null;
    brand_name: string | null;
  } | null;
};

const inputClass =
  "w-full mt-1 px-4 py-4 border border-neutral-300 rounded-2xl text-neutral-950 font-semibold placeholder:text-neutral-400 bg-white outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500";

const selectClass =
  "w-full mt-1 px-4 py-4 border border-neutral-300 rounded-2xl text-neutral-950 font-semibold bg-white outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500";

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

const shortMonths = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

export default function PromoterSalesPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [monthlySales, setMonthlySales] = useState<SaleRecord[]>([]);

  const [storeId, setStoreId] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [sku, setSku] = useState("");
  const [model, setModel] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [amount, setAmount] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );

  const [salesTarget, setSalesTarget] = useState<number | null>(null);
  const [targetLoading, setTargetLoading] = useState(false);

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const money = (value: number) =>
    value.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });

  const loadAssignedStores = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se encontró sesión activa.");
      return;
    }

    const { data, error } = await supabase
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
      .eq("employee_id", userId)
      .eq("active", true);

    if (error) {
      setMessage(`Error al cargar tiendas: ${error.message}`);
      return;
    }

    const assignedStores = (data || [])
      .map((item: any) => item.stores)
      .filter(Boolean) as Store[];

    setStores(assignedStores);

    if (assignedStores.length === 1) {
      setStoreId(assignedStores[0].id);
    }
  };

  const loadMonthlySales = async () => {
    setHistoryLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se encontró sesión activa.");
      setHistoryLoading(false);
      return;
    }

    const startDate = `${selectedYear}-${String(selectedMonth).padStart(
      2,
      "0"
    )}-01`;

    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();

    const endDate = `${selectedYear}-${String(selectedMonth).padStart(
      2,
      "0"
    )}-${String(lastDay).padStart(2, "0")}`;

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
        stores:store_id (
          name,
          chain_name,
          brand_name
        )
      `)
      .eq("employee_id", userId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error al cargar histórico: ${error.message}`);
      setHistoryLoading(false);
      return;
    }

    setMonthlySales(
      (data || []).map((sale: any) => ({
        ...sale,
        stores: Array.isArray(sale.stores)
          ? sale.stores[0]
          : sale.stores,
      }))
    );

    setHistoryLoading(false);
  };

  const loadSalesTarget = async () => {
    setTargetLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setSalesTarget(null);
      setTargetLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("sales_targets")
      .select("target_amount")
      .eq("employee_id", userId)
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .maybeSingle();

    if (error) {
      console.error("Error al cargar meta:", error);
      setSalesTarget(null);
      setTargetLoading(false);
      return;
    }

    if (data) {
      setSalesTarget(Number(data.target_amount));
    } else {
      setSalesTarget(null);
    }

    setTargetLoading(false);
  };

  useEffect(() => {
    loadAssignedStores();
    setSaleDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    loadMonthlySales();
    loadSalesTarget();
  }, [selectedMonth, selectedYear]);

  const monthlyTotal = monthlySales.reduce(
    (sum, sale) => sum + Number(sale.amount || 0),
    0
  );

  const monthlyTickets = monthlySales.length;

  const monthlyAverage =
    monthlyTickets > 0 ? monthlyTotal / monthlyTickets : 0;

  const targetProgress =
    salesTarget && salesTarget > 0
      ? (monthlyTotal / salesTarget) * 100
      : 0;

  const progressBarWidth = Math.min(targetProgress, 100);

  const remainingToTarget =
    salesTarget !== null
      ? Math.max(salesTarget - monthlyTotal, 0)
      : 0;

  const targetReached =
    salesTarget !== null &&
    salesTarget > 0 &&
    monthlyTotal >= salesTarget;

  const salesByDay = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        total: number;
        tickets: number;
        sales: SaleRecord[];
      }
    >();

    monthlySales.forEach((sale) => {
      const key = sale.sale_date;

      if (!map.has(key)) {
        map.set(key, {
          date: key,
          total: 0,
          tickets: 0,
          sales: [],
        });
      }

      const item = map.get(key)!;

      item.total += Number(sale.amount || 0);
      item.tickets += 1;
      item.sales.push(sale);
    });

    return Array.from(map.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [monthlySales]);

  useEffect(() => {
    if (salesByDay.length === 0) {
      setExpandedDays({});
      return;
    }

    setExpandedDays({
      [salesByDay[0].date]: true,
    });
  }, [selectedMonth, selectedYear, monthlySales.length]);

  const toggleDay = (date: string) => {
    setExpandedDays((current) => ({
      ...current,
      [date]: !current[date],
    }));
  };

  const getDayParts = (dateString: string) => {
    const parts = dateString.split("-");
    const monthIndex = Number(parts[1]) - 1;

    return {
      day: parts[2],
      month: shortMonths[monthIndex] || "",
    };
  };

  const getDayStoreName = (sales: SaleRecord[]) => {
    const storeNames = Array.from(
      new Set(
        sales
          .map((sale) => sale.stores?.name)
          .filter(Boolean) as string[]
      )
    );

    if (storeNames.length === 1) {
      return storeNames[0];
    }

    if (storeNames.length > 1) {
      return "VARIAS TIENDAS";
    }

    return "SIN TIENDA";
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se encontró sesión activa.");
      setLoading(false);
      return;
    }

    if (!storeId) {
      setMessage("Selecciona una tienda.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("sales_records").insert({
      employee_id: userId,
      store_id: storeId,
      sale_date: saleDate,
      sku: sku || null,
      model: model || null,
      ticket_number: ticketNumber,
      amount: Number(amount),
    });

    if (error) {
      setMessage(`Error al guardar venta: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Venta registrada correctamente.");
    setSku("");
    setModel("");
    setTicketNumber("");
    setAmount("");
    setLoading(false);

    await loadMonthlySales();
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-5 pb-24">
      <div className="max-w-md mx-auto space-y-6">

        {/* ENCABEZADO */}
        <div className="bg-neutral-900 text-white rounded-3xl p-6 shadow-xl">
          <h1 className="text-3xl font-black">Ventas</h1>

          <p className="text-neutral-300 mt-2">
            Captura y consulta tu histórico mensual.
          </p>
        </div>

        {/* NUEVA VENTA */}
        <div className="bg-white rounded-3xl shadow-md p-5">
          <h2 className="text-xl font-bold text-neutral-800 mb-5">
            Nueva venta
          </h2>

          <form onSubmit={handleSaveSale} className="space-y-4">

            <div>
              <label className="text-sm font-semibold text-neutral-800">
                Tienda
              </label>

              <select
                className={selectClass}
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                required
              >
                <option value="">Selecciona tienda</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} - {store.chain_name} / {store.brand_name}
                  </option>
                ))}
              </select>

              {stores.length === 0 && (
                <p className="text-sm text-red-500 mt-2">
                  No tienes tiendas asignadas.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-800">
                Fecha
              </label>

              <input
                type="date"
                className={inputClass}
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-800">
                SKU
              </label>

              <input
                className={inputClass}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-800">
                Modelo
              </label>

              <input
                className={inputClass}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Modelo"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-800">
                Número de ticket
              </label>

              <input
                className={inputClass}
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="Ticket"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-800">
                Monto total
              </label>

              <input
                type="number"
                step="0.01"
                className={inputClass}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
            >
              {loading ? "Guardando venta..." : "Guardar venta"}
            </button>
          </form>

          {message && (
            <div className="mt-5 bg-neutral-100 rounded-2xl p-4 text-sm font-medium text-neutral-800">
              {message}
            </div>
          )}
        </div>

        {/* HISTÓRICO */}
        <div className="bg-white rounded-3xl shadow-md p-5">

          <div className="mb-5">
            <h2 className="text-2xl font-black text-neutral-900">
              Mi histórico
            </h2>

            <p className="text-sm text-neutral-500 mt-1">
              Consulta tus ventas por mes.
            </p>
          </div>

          {/* MES Y AÑO */}
          <div className="grid grid-cols-2 gap-3 mb-4">

            <select
              value={selectedMonth}
              onChange={(e) =>
                setSelectedMonth(Number(e.target.value))
              }
              className="w-full px-4 py-3 border border-neutral-300 rounded-2xl text-neutral-950 font-bold bg-white outline-none focus:ring-2 focus:ring-red-200"
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
              className="w-full px-4 py-3 border border-neutral-300 rounded-2xl text-neutral-950 font-bold bg-white outline-none focus:ring-2 focus:ring-red-200"
            >
              {[2025, 2026, 2027].map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>

          </div>

          {/* META */}
          {targetLoading ? (
            <div className="bg-neutral-100 rounded-3xl p-5 mb-5">
              <p className="text-sm text-neutral-500">
                Cargando meta...
              </p>
            </div>
          ) : salesTarget !== null ? (
            <div className="bg-neutral-900 text-white rounded-3xl p-5 mb-5 shadow-lg">

              <div className="grid grid-cols-[1fr_auto] gap-5 items-center">

                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400 font-semibold">
                    Meta de {months[selectedMonth - 1]}
                  </p>

                  <p className="text-3xl font-black mt-2 leading-none">
                    {money(monthlyTotal)}
                  </p>

                  <p className="text-sm text-neutral-400 mt-2">
                    de {money(salesTarget)}
                  </p>
                </div>

                <div className="border-l border-neutral-600 pl-5 text-right">
                  <p className="text-3xl font-black text-red-500 leading-none">
                    {targetProgress.toFixed(1)}%
                  </p>

                  <p className="text-xs text-neutral-400 mt-2">
                    cumplimiento
                  </p>
                </div>

              </div>

              {/* BARRA */}
              <div className="mt-5">
                <div className="w-full h-3 bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      targetReached
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: `${progressBarWidth}%`,
                    }}
                  />
                </div>
              </div>

              {/* RESULTADO */}
              {targetReached ? (
                <div className="mt-5 bg-neutral-800 rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-wide text-neutral-400">
                    Resultado
                  </p>

                  <p className="text-xl font-black text-white mt-1">
                    Meta alcanzada
                  </p>

                  <p className="text-sm text-neutral-400 mt-1">
                    Has superado tu objetivo mensual.
                  </p>
                </div>
              ) : (
                <div className="mt-5 bg-neutral-800 rounded-2xl p-5">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-5 items-center">

                    <div>
                      <p className="text-sm text-neutral-300">
                        Te faltan
                      </p>

                      <p className="text-xl font-black text-white mt-1">
                        {money(remainingToTarget)}
                      </p>

                      <p className="text-xs text-neutral-400 mt-1">
                        para llegar a tu meta.
                      </p>
                    </div>

                    <div className="h-16 w-px bg-neutral-600" />

                    <div>
                      <p className="text-base font-bold text-white">
                        ¡Tú puedes!
                      </p>

                      <p className="text-sm text-neutral-400 mt-1">
                        Sigue con todo.
                      </p>
                    </div>

                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-neutral-100 border border-neutral-200 rounded-2xl p-4 mb-5">
              <p className="text-sm font-semibold text-neutral-700">
                Aún no tienes una meta asignada para{" "}
                {months[selectedMonth - 1]} de {selectedYear}.
              </p>
            </div>
          )}

          {/* INDICADORES */}
          <div className="grid grid-cols-3 gap-3 mb-8">

            <div className="bg-neutral-100 rounded-2xl p-4 min-w-0">
              <p className="text-sm text-neutral-500">
                Total
              </p>

              <p className="text-sm font-black text-red-500 mt-1 whitespace-nowrap">
                {money(monthlyTotal)}
              </p>
            </div>

            <div className="bg-neutral-100 rounded-2xl p-4 min-w-0">
              <p className="text-sm text-neutral-500">
                Tickets
              </p>

              <p className="text-sm font-black text-red-500 mt-1">
                {monthlyTickets}
              </p>
            </div>

            <div className="bg-neutral-100 rounded-2xl p-4 min-w-0">
              <p className="text-sm text-neutral-500">
                Promedio
              </p>

              <p className="text-sm font-black text-red-500 mt-1 whitespace-nowrap">
                {money(monthlyAverage)}
              </p>
            </div>

          </div>

          {/* ÚLTIMAS VENTAS */}
          <div className="mb-5">

            <h3 className="text-xl font-black text-neutral-900">
              Últimas ventas · {months[selectedMonth - 1]}
            </h3>

            <p className="text-sm text-neutral-500 mt-1">
              {monthlyTickets}{" "}
              {monthlyTickets === 1
                ? "venta registrada"
                : "ventas registradas"}
            </p>

          </div>

          {historyLoading && (
            <div className="bg-neutral-100 rounded-2xl p-4">
              <p className="text-sm text-neutral-600">
                Cargando histórico...
              </p>
            </div>
          )}

          {!historyLoading && monthlySales.length === 0 && (
            <div className="bg-neutral-100 rounded-2xl p-4">
              <p className="text-sm text-neutral-600">
                No tienes ventas registradas en este mes.
              </p>
            </div>
          )}

          {/* HISTÓRICO POR DÍA */}
          {!historyLoading && (
            <div className="space-y-4">

              {salesByDay.map((day) => {
                const dateParts = getDayParts(day.date);
                const isExpanded = !!expandedDays[day.date];
                const storeName = getDayStoreName(day.sales);

                return (
                  <div
                    key={day.date}
                    className="border border-neutral-200 rounded-2xl overflow-hidden bg-white"
                  >

                    {/* ENCABEZADO DEL DÍA */}
                    <button
                      type="button"
                      onClick={() => toggleDay(day.date)}
                      className="w-full text-left grid grid-cols-[72px_1fr_42px] items-stretch bg-neutral-50 hover:bg-neutral-100 transition-colors"
                    >

                      <div className="border-r border-neutral-200 flex flex-col items-center justify-center py-4">

                        <span className="text-3xl leading-none font-black text-neutral-900">
                          {dateParts.day}
                        </span>

                        <span className="text-xs font-bold text-neutral-500 mt-1">
                          {dateParts.month}
                        </span>

                      </div>

                      <div className="px-4 py-4 min-w-0">

                        <p className="font-black text-neutral-900 truncate">
                          {storeName}
                        </p>

                        <p className="text-sm text-neutral-500 mt-1">
                          {day.tickets}{" "}
                          {day.tickets === 1 ? "venta" : "ventas"} ·{" "}
                          {money(day.total)}
                        </p>

                      </div>

                      <div className="flex items-center justify-center">

                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          className={`w-5 h-5 text-neutral-600 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m6 9 6 6 6-6"
                          />
                        </svg>

                      </div>

                    </button>

                    {/* DETALLE */}
                    {isExpanded && (
                      <div className="px-5 bg-white">

                        {day.sales.map((sale, index) => (
                          <div
                            key={sale.id}
                            className={`py-4 flex items-center justify-between gap-4 ${
                              index !== day.sales.length - 1
                                ? "border-b border-neutral-200"
                                : ""
                            }`}
                          >

                            <div className="min-w-0">

                              <p className="font-black text-neutral-900 capitalize">
                                {sale.model || "Sin modelo"}
                              </p>

                              <p className="text-sm text-neutral-500 mt-1">
                                Ticket #{sale.ticket_number}
                                <span className="mx-2">·</span>
                                SKU: {sale.sku || "N/A"}
                              </p>

                              {storeName === "VARIAS TIENDAS" && (
                                <p className="text-xs text-neutral-400 mt-1">
                                  {sale.stores?.name || "Sin tienda"}
                                </p>
                              )}

                            </div>

                            <p className="font-black text-lg text-red-500 whitespace-nowrap">
                              {money(Number(sale.amount))}
                            </p>

                          </div>
                        ))}

                      </div>
                    )}

                  </div>
                );
              })}

            </div>
          )}

        </div>
      </div>

      <PromoterBottomNav />
    </main>
  );
}