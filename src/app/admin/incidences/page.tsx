"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Incidence = {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
  file_url: string | null;
  status: string;
  created_at: string;

  profiles: {
    name: string;
    email: string;
  } | null;
};

const labels: Record<string, string> = {
  VACATION: "Vacaciones",
  PERMISSION: "Permiso",
  MEDICAL: "Incapacidad",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function AdminIncidencesPage() {
  const [incidences, setIncidences] = useState<Incidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadIncidences = async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("incidence_requests")
      .select(`
        id,
        type,
        start_date,
        end_date,
        reason,
        file_url,
        status,
        created_at,
        profiles:employee_id (
          name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error al cargar incidencias: ${error.message}`);
      setLoading(false);
      return;
    }

    const normalized = (data || []).map((item: any) => ({
      ...item,
      profiles: Array.isArray(item.profiles)
        ? item.profiles[0]
        : item.profiles,
    }));

    setIncidences(normalized);
    setLoading(false);
  };

  useEffect(() => {
    loadIncidences();
  }, []);

  const updateStatus = async (
    incidenceId: string,
    status: "APPROVED" | "REJECTED"
  ) => {
    const { error } = await supabase
      .from("incidence_requests")
      .update({
        status,
      })
      .eq("id", incidenceId);

    if (error) {
      setMessage(`Error al actualizar incidencia: ${error.message}`);
      return;
    }

    loadIncidences();
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-800">
              Incidencias
            </h1>

            <p className="text-neutral-500 mt-2">
              Administración de vacaciones, permisos e incapacidades.
            </p>
          </div>

          <button
            onClick={loadIncidences}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Actualizar
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-neutral-800 mb-6">
            Solicitudes registradas
          </h2>

          {loading && (
            <p className="text-neutral-500 text-sm">
              Cargando incidencias...
            </p>
          )}

          {message && (
            <div className="bg-neutral-100 rounded-xl p-4 text-sm text-neutral-700 mb-4">
              {message}
            </div>
          )}

          {!loading && incidences.length === 0 && (
            <p className="text-neutral-500 text-sm">
              No hay incidencias registradas.
            </p>
          )}

          <div className="space-y-5">
            {incidences.map((incidence) => (
              <div
                key={incidence.id}
                className="border rounded-2xl p-5 bg-neutral-50"
              >
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                  <div>
                    <h3 className="font-bold text-neutral-800 text-lg">
                      {incidence.profiles?.name || "Sin nombre"}
                    </h3>

                    <p className="text-sm text-neutral-500 mt-1">
                      {incidence.profiles?.email || ""}
                    </p>

                    <div className="mt-3 space-y-1">
                      <p className="text-sm text-neutral-700">
                        <span className="font-semibold">Tipo:</span>{" "}
                        {labels[incidence.type] || incidence.type}
                      </p>

                      <p className="text-sm text-neutral-700">
                        <span className="font-semibold">Fecha inicio:</span>{" "}
                        {incidence.start_date}
                      </p>

                      <p className="text-sm text-neutral-700">
                        <span className="font-semibold">Fecha fin:</span>{" "}
                        {incidence.end_date}
                      </p>

                      <p className="text-sm text-neutral-700">
                        <span className="font-semibold">Motivo:</span>{" "}
                        {incidence.reason}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[220px]">
                    <div
                      className={`px-4 py-2 rounded-xl text-sm font-semibold text-center ${
                        statusColors[incidence.status] ||
                        "bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      {incidence.status}
                    </div>

                    {incidence.file_url && (
                      <a
                        href={incidence.file_url}
                        target="_blank"
                        className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-3 rounded-xl text-sm font-semibold text-center"
                      >
                        Ver archivo
                      </a>
                    )}

                    {incidence.status === "PENDING" && (
                      <>
                        <button
                          onClick={() =>
                            updateStatus(incidence.id, "APPROVED")
                          }
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-xl text-sm font-semibold"
                        >
                          Aprobar
                        </button>

                        <button
                          onClick={() =>
                            updateStatus(incidence.id, "REJECTED")
                          }
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-semibold"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}