"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [employees, setEmployees] = useState(0);
  const [attendanceToday, setAttendanceToday] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [incidencesToday, setIncidencesToday] = useState(0);

  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      employeesResult,
      attendanceResult,
      salesResult,
      incidencesResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),

      supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),

      supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),

      supabase
        .from("incidences")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),
    ]);

    setEmployees(employeesResult.count || 0);
    setAttendanceToday(attendanceResult.count || 0);
    setSalesToday(salesResult.count || 0);
    setIncidencesToday(incidencesResult.count || 0);

    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-800">
              Dashboard Administrador
            </h1>

            <p className="text-neutral-500 mt-2">
              Panel general de EDVA Control App
            </p>
          </div>

          <button
            onClick={loadDashboard}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold text-neutral-700">
              Empleados
            </h2>

            <p className="text-4xl font-bold text-red-500 mt-4">
              {loading ? "..." : employees}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold text-neutral-700">
              Asistencias Hoy
            </h2>

            <p className="text-4xl font-bold text-red-500 mt-4">
              {loading ? "..." : attendanceToday}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold text-neutral-700">
              Ventas Hoy
            </h2>

            <p className="text-4xl font-bold text-red-500 mt-4">
              {loading ? "..." : salesToday}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold text-neutral-700">
              Incidencias
            </h2>

            <p className="text-4xl font-bold text-red-500 mt-4">
              {loading ? "..." : incidencesToday}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}