"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Promoter = {
  id: string;
  name: string;
  email: string;
};

type Store = {
  id: string;
  name: string;
  chain_name: string | null;
  brand_name: string | null;
};

type Assignment = {
  id: string;
  employee_id: string;
  store_id: string;
  active: boolean;
};

export default function StoreAssignmentsPage() {
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedPromoter, setSelectedPromoter] = useState("");
  const [selectedStore, setSelectedStore] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const { data: promotersData } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("role", "PROMOTOR")
      .order("name", { ascending: true });

    const { data: storesData } = await supabase
      .from("stores")
      .select("id, name, chain_name, brand_name")
      .order("name", { ascending: true });

    const { data: assignmentsData } = await supabase
      .from("employee_store_assignments")
      .select("id, employee_id, store_id, active")
      .eq("active", true);

    setPromoters(promotersData || []);
    setStores(storesData || []);
    setAssignments(assignmentsData || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getPromoterName = (id: string) => {
    return promoters.find((p) => p.id === id)?.name || "Promotor no encontrado";
  };

  const getStoreName = (id: string) => {
    const store = stores.find((s) => s.id === id);
    if (!store) return "Tienda no encontrada";
    return `${store.name} - ${store.chain_name || ""} / ${store.brand_name || ""}`;
  };

  const handleAssignStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!selectedPromoter || !selectedStore) {
      setMessage("Selecciona un promotor y una tienda.");
      setLoading(false);
      return;
    }

    const alreadyAssigned = assignments.some(
      (item) =>
        item.employee_id === selectedPromoter &&
        item.store_id === selectedStore &&
        item.active
    );

    if (alreadyAssigned) {
      setMessage("Esta tienda ya está asignada a este promotor.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("employee_store_assignments").insert({
      employee_id: selectedPromoter,
      store_id: selectedStore,
      active: true,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Tienda asignada correctamente.");
    setSelectedPromoter("");
    setSelectedStore("");
    await loadData();
    setLoading(false);
  };

  const handleDeactivate = async (assignmentId: string) => {
    const { error } = await supabase
      .from("employee_store_assignments")
      .update({ active: false })
      .eq("id", assignmentId);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setMessage("Asignación desactivada.");
    await loadData();
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <h1 className="text-4xl font-bold text-neutral-800">
          Asignación de tiendas
        </h1>

        <p className="text-neutral-500 mt-2 mb-8">
          Asigna una o varias tiendas a cada promotor.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-neutral-800 mb-6">
              Nueva asignación
            </h2>

            <form onSubmit={handleAssignStore} className="space-y-5">
              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Promotor
                </label>
                <select
                  className="w-full mt-1 px-4 py-3 border rounded-xl"
                  value={selectedPromoter}
                  onChange={(e) => setSelectedPromoter(e.target.value)}
                  required
                >
                  <option value="">Selecciona promotor</option>
                  {promoters.map((promoter) => (
                    <option key={promoter.id} value={promoter.id}>
                      {promoter.name} - {promoter.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Tienda
                </label>
                <select
                  className="w-full mt-1 px-4 py-3 border rounded-xl"
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  required
                >
                  <option value="">Selecciona tienda</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} - {store.chain_name} / {store.brand_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-60"
              >
                {loading ? "Asignando..." : "Asignar tienda"}
              </button>
            </form>

            {message && (
              <div className="mt-5 bg-neutral-100 rounded-xl p-4 text-sm font-medium text-neutral-700">
                {message}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-neutral-800 mb-6">
              Tiendas asignadas
            </h2>

            <div className="space-y-4">
              {assignments.length === 0 && (
                <p className="text-neutral-500 text-sm">
                  Aún no hay tiendas asignadas.
                </p>
              )}

              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="border rounded-xl p-4 bg-neutral-50 flex justify-between gap-4"
                >
                  <div>
                    <h3 className="font-semibold text-neutral-800">
                      {getPromoterName(assignment.employee_id)}
                    </h3>

                    <p className="text-sm text-neutral-600 mt-1">
                      {getStoreName(assignment.store_id)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeactivate(assignment.id)}
                    className="text-sm bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl"
                  >
                    Desactivar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}