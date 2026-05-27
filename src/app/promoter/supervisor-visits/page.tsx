"use client";

import { useEffect, useState } from "react";
import PromoterBottomNav from "@/components/PromoterBottomNav";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  chain_name: string | null;
  brand_name: string | null;
};

const supervisors = [
  "Angélica V",
  "Erick Paredes",
  "Erick Lozano",
  "Julio Martínez",
  "Equipo EDVA",
];

const visitTypes = [
  "Supervisión",
  "Capacitación",
  "Auditoría",
  "Acompañamiento",
  "Inventario",
  "Otro",
];

export default function SupervisorVisitsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");

  const [supervisorName, setSupervisorName] = useState("");
  const [visitType, setVisitType] = useState("");
  const [comments, setComments] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadAssignedStores = async () => {
    const { data: sessionData } = await supabase.auth.getSession();

    const userId = sessionData.session?.user.id;

    if (!userId) return;

    const { data } = await supabase
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

    const assignedStores = (data || [])
      .map((item: any) => item.stores)
      .filter(Boolean) as Store[];

    setStores(assignedStores);

    if (assignedStores.length === 1) {
      setStoreId(assignedStores[0].id);
    }
  };

  useEffect(() => {
    loadAssignedStores();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();

    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se encontró sesión.");
      setLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setMessage("Tu dispositivo no soporta GPS.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        const { error } = await supabase
          .from("supervisor_visit_reports")
          .insert({
            promoter_id: userId,
            store_id: storeId,
            supervisor_name: supervisorName,
            visit_type: visitType,
            comments,
            latitude,
            longitude,
          });

        if (error) {
          setMessage(`Error: ${error.message}`);
          setLoading(false);
          return;
        }

        setMessage("Visita registrada correctamente.");

        setSupervisorName("");
        setVisitType("");
        setComments("");

        setLoading(false);
      },
      () => {
        setMessage("No se pudo obtener ubicación.");
        setLoading(false);
      }
    );
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-5 pb-24">
      <div className="max-w-md mx-auto">
        <div className="bg-neutral-900 text-white rounded-3xl p-6 shadow-xl mb-6">
          <h1 className="text-3xl font-black">
            Visita de supervisor
          </h1>

          <p className="text-neutral-300 mt-2">
            Registra supervisiones y acompañamientos en tienda.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-md p-5">
          <form onSubmit={handleSave} className="space-y-5">

            <div>
              <label className="text-sm font-semibold text-neutral-700">
                Tienda
              </label>

              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full mt-1 px-4 py-4 border rounded-2xl"
                required
              >
                <option value="">Selecciona tienda</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} - {store.chain_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-700">
                Supervisor
              </label>

              <select
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                className="w-full mt-1 px-4 py-4 border rounded-2xl"
                required
              >
                <option value="">Selecciona supervisor</option>

                {supervisors.map((supervisor) => (
                  <option key={supervisor}>
                    {supervisor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-700">
                Tipo de visita
              </label>

              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value)}
                className="w-full mt-1 px-4 py-4 border rounded-2xl"
                required
              >
                <option value="">Selecciona tipo</option>

                {visitTypes.map((type) => (
                  <option key={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-700">
                Comentario
              </label>

              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full mt-1 px-4 py-4 border rounded-2xl min-h-[120px]"
                placeholder="Comentarios de la visita..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
            >
              {loading
                ? "Guardando..."
                : "Registrar visita"}
            </button>

          </form>

          {message && (
            <div className="mt-5 bg-neutral-100 rounded-2xl p-4 text-sm font-medium text-neutral-700">
              {message}
            </div>
          )}
        </div>
      </div>

      <PromoterBottomNav />
    </main>
  );
}