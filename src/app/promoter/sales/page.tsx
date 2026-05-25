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

export default function PromoterSalesPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [monthlySales, setMonthlySales] = useState<SaleRecord[]>([]);

  const [storeId, setStoreId] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [sku, setSku] = useState("");
  const [model, setModel] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [amount, setAmount] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
        stores: Array.isArray(sale.stores) ? sale.stores[0] : sale.stores,
      }))
    );

    setHistoryLoading(false);
  };

  useEffect(() => {
    loadAssignedStores();
    setSaleDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    loadMonthlySales();
  }, [selectedMonth, selectedYear]);

  const monthlyTotal = monthlySales.reduce(
    (sum, sale) => sum + Number(sale.amount || 0),
    0
  );

  const monthlyTickets = monthlySales.length;
  const monthlyAverage = monthlyTickets > 0 ? monthlyTotal / monthlyTickets : 0;

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
        <div className="bg-neutral-900 text-white rounded-3xl p-6 shadow-xl">
          <h1 className="text-3xl font-black">Ventas</h1>
          <p className="text-neutral-300 mt-2">
            Captura y consulta tu histórico mensual.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-md p-5">
          <h2 className="text-xl font-bold text-neutral-800 mb-5">
            Nueva venta
          </h2>

          <form onSubmit={handleSaveSale} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-neutral-700">
                Tienda
              </label>

              <select
                className="w-full mt-1 px-4 py-4 border rounded-2xl"
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
              <label className="text-sm font-semibold text-neutral-700">
                Fecha
              </label>

              <input
                type="date"
                className="w-full mt-1 px-4 py-4 border rounded-2xl"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-semibold text-neutral-700">
                  SKU
                </label>

                <input
                  className="w-full mt-1 px-4 py-4 border rounded-2xl"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="SKU"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-neutral-700">
                  Modelo
                </label>

                <input
                  className="w-full mt-1 px-4 py-4 border rounded-2xl"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Modelo"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-700">
                Número de ticket
              </label>

              <input
                className="w-full mt-1 px-4 py-4 border rounded-2xl"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="Ticket"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-700">
                Monto total
              </label>

              <input
                type="number"
                step="0.01"
                className="w-full mt-1 px-4 py-4 border rounded-2xl"
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
            <div className="mt-5 bg-neutral-100 rounded-2xl p-4 text-sm font-medium text-neutral-700">
              {message}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-md p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-neutral-800">
                Mi histórico
              </h2>
              <p className="text-sm text-neutral-500">
                Consulta tus ventas por mes y por día.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-4 py-3 border rounded-2xl"
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
              className="px-4 py-3 border rounded-2xl"
            >
              {[2025, 2026, 2027].map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-neutral-100 rounded-2xl p-3">
              <p className="text-[11px] text-neutral-500">Total</p>
              <p className="text-lg font-black text-red-500">
                {money(monthlyTotal)}
              </p>
            </div>

            <div className="bg-neutral-100 rounded-2xl p-3">
              <p className="text-[11px] text-neutral-500">Tickets</p>
              <p className="text-lg font-black text-red-500">
                {monthlyTickets}
              </p>
            </div>

            <div className="bg-neutral-100 rounded-2xl p-3">
              <p className="text-[11px] text-neutral-500">Promedio</p>
              <p className="text-lg font-black text-red-500">
                {money(monthlyAverage)}
              </p>
            </div>
          </div>

          {historyLoading && (
            <p className="text-sm text-neutral-500">Cargando histórico...</p>
          )}

          {!historyLoading && monthlySales.length === 0 && (
            <p className="text-sm text-neutral-500">
              No tienes ventas registradas en este mes.
            </p>
          )}

          <div className="space-y-4">
            {salesByDay.map((day) => (
              <div
                key={day.date}
                className="border rounded-2xl overflow-hidden bg-neutral-50"
              >
                <div className="px-4 py-3 bg-neutral-900 text-white">
                  <p className="font-bold">{day.date}</p>
                  <p className="text-xs text-neutral-300">
                    {day.tickets} ticket(s) · {money(day.total)}
                  </p>
                </div>

                <div className="divide-y">
                  {day.sales.map((sale) => (
                    <div key={sale.id} className="p-4 bg-white">
                      <div className="flex justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs text-neutral-400">
                            Venta registrada
                          </p>

                          <p className="font-black text-neutral-900">
                            Ticket: {sale.ticket_number}
                          </p>
                        </div>

                        <p className="font-black text-red-500 text-lg">
                          {money(Number(sale.amount))}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="bg-neutral-50 rounded-xl p-3">
                          <p className="text-neutral-400 text-xs">Tienda</p>
                          <p className="font-semibold text-neutral-800">
                            {sale.stores?.name || "Sin tienda"}
                          </p>
                        </div>

                        <div className="bg-neutral-50 rounded-xl p-3">
                          <p className="text-neutral-400 text-xs">
                            Cadena / Marca
                          </p>
                          <p className="font-semibold text-neutral-800">
                            {sale.stores?.chain_name || "Sin cadena"} /{" "}
                            {sale.stores?.brand_name || "Sin marca"}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-neutral-50 rounded-xl p-3">
                            <p className="text-neutral-400 text-xs">SKU</p>
                            <p className="font-semibold text-neutral-800">
                              {sale.sku || "N/A"}
                            </p>
                          </div>

                          <div className="bg-neutral-50 rounded-xl p-3">
                            <p className="text-neutral-400 text-xs">Modelo</p>
                            <p className="font-semibold text-neutral-800">
                              {sale.model || "N/A"}
                            </p>
                          </div>
                        </div>

                        <div className="bg-neutral-50 rounded-xl p-3">
                          <p className="text-neutral-400 text-xs">
                            Hora de captura
                          </p>
                          <p className="font-semibold text-neutral-800">
                            {new Date(sale.created_at).toLocaleTimeString(
                              "es-MX",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PromoterBottomNav />
    </main>
  );
}