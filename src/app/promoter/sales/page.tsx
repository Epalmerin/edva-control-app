"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  chain_name: string | null;
  brand_name: string | null;
};

export default function PromoterSalesPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [sku, setSku] = useState("");
  const [model, setModel] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [amount, setAmount] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
  };

  useEffect(() => {
    loadAssignedStores();
    setSaleDate(new Date().toISOString().slice(0, 10));
  }, []);

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
      sku,
      model,
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
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-neutral-800">
          Captura de ventas
        </h1>

        <p className="text-neutral-500 mt-2 mb-8">
          Registra las ventas realizadas en punto de venta.
        </p>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <form onSubmit={handleSaveSale} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-neutral-700">
                Tienda
              </label>
              <select
                className="w-full mt-1 px-4 py-3 border rounded-xl"
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
              <label className="text-sm font-medium text-neutral-700">
                Fecha
              </label>
              <input
                type="date"
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                SKU
              </label>
              <input
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Modelo
              </label>
              <input
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Modelo"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Número de ticket
              </label>
              <input
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="Ticket"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Monto total
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-60"
            >
              {loading ? "Guardando venta..." : "Guardar venta"}
            </button>
          </form>

          {message && (
            <div className="mt-5 bg-neutral-100 rounded-xl p-4 text-sm font-medium text-neutral-700">
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}