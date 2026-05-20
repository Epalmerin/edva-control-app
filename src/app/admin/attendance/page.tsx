"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type AttendanceRecord = {
  id: string;
  type: string;
  created_at: string;
  photo_url: string;
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

const labels: Record<string, string> = {
  ENTRY: "Entrada",
  BREAK_OUT: "Salida comida",
  BREAK_IN: "Regreso comida",
  EXIT: "Salida",
};

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadAttendance = async () => {
    setLoading(true);
    setMessage("");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("attendance_records")
      .select(`
        id,
        type,
        created_at,
        photo_url,
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
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error al cargar asistencia: ${error.message}`);
      setLoading(false);
      return;
    }

    setRecords((data || []).map((record: any) => ({
  ...record,
  profiles: Array.isArray(record.profiles) ? record.profiles[0] : record.profiles,
  stores: Array.isArray(record.stores) ? record.stores[0] : record.stores,
})));
    setLoading(false);
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const uniqueEmployees = new Set(records.map((r) => r.profiles?.email));

  const presentToday = Array.from(uniqueEmployees).filter(Boolean).length;

  const inBreak = records.filter((record) => record.type === "BREAK_OUT").length -
    records.filter((record) => record.type === "BREAK_IN").length;

  const completed = records.filter((record) => record.type === "EXIT").length;

  const entries = records.filter((record) => record.type === "ENTRY").length;

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-800">
              Asistencia de hoy
            </h1>
            <p className="text-neutral-500 mt-2">
              Control diario de entradas, comidas, regresos y salidas.
            </p>
          </div>

          <button
            onClick={loadAttendance}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Presentes hoy</p>
            <p className="text-4xl font-bold text-red-500 mt-3">
              {presentToday}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Entradas</p>
            <p className="text-4xl font-bold text-red-500 mt-3">
              {entries}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">En comida</p>
            <p className="text-4xl font-bold text-red-500 mt-3">
              {Math.max(inBreak, 0)}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Jornada completa</p>
            <p className="text-4xl font-bold text-red-500 mt-3">
              {completed}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-neutral-800 mb-6">
            Registros recientes
          </h2>

          {loading && (
            <p className="text-neutral-500 text-sm">Cargando asistencia...</p>
          )}

          {message && (
            <div className="bg-neutral-100 rounded-xl p-4 text-sm text-neutral-700 mb-4">
              {message}
            </div>
          )}

          {!loading && records.length === 0 && (
            <p className="text-neutral-500 text-sm">
              Aún no hay registros de asistencia hoy.
            </p>
          )}

          <div className="space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="border rounded-xl p-4 bg-neutral-50 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-semibold text-neutral-800">
                    {record.profiles?.name || "Sin nombre"}
                  </h3>

                  <p className="text-sm text-neutral-600">
                    {record.stores?.name || "Sin tienda"} ·{" "}
                    {record.stores?.chain_name || ""} /{" "}
                    {record.stores?.brand_name || ""}
                  </p>

                  <p className="text-sm text-neutral-500 mt-1">
                    {labels[record.type] || record.type} ·{" "}
                    {new Date(record.created_at).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <a
                  href={record.photo_url}
                  target="_blank"
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold text-center"
                >
                  Ver foto
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}