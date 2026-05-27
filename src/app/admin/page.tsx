"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Assignment = {
  employee_id: string;
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

type AttendanceRecord = {
  employee_id: string;
  type: string;
};

type ChainSummary = {
  chain: string;
  total: number;
  reported: number;
  pending: {
    name: string;
    store: string;
  }[];
};

export default function AdminPage() {
  const [employees, setEmployees] = useState(0);
  const [attendanceToday, setAttendanceToday] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [incidencesToday, setIncidencesToday] = useState(0);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceRecord[]>([]);

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
      assignmentsResult,
      entriesResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),

      supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),

      supabase
        .from("sales_records")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),

      supabase
        .from("incidences")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),

      supabase
        .from("employee_store_assignments")
        .select(`
          employee_id,
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
        .eq("active", true),

      supabase
        .from("attendance_records")
        .select("employee_id, type")
        .eq("type", "ENTRY")
        .gte("created_at", todayStart.toISOString()),
    ]);

    setEmployees(employeesResult.count || 0);
    setAttendanceToday(attendanceResult.count || 0);
    setSalesToday(salesResult.count || 0);
    setIncidencesToday(incidencesResult.count || 0);

    setAssignments(
      (assignmentsResult.data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
        stores: Array.isArray(item.stores) ? item.stores[0] : item.stores,
      }))
    );

    setAttendanceEntries(entriesResult.data || []);

    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const reportedEmployees = useMemo(() => {
    return new Set(attendanceEntries.map((record) => record.employee_id));
  }, [attendanceEntries]);

  const chainSummaries = useMemo<ChainSummary[]>(() => {
    const map = new Map<string, ChainSummary>();

    assignments.forEach((assignment) => {
      const chain = assignment.stores?.chain_name || "Sin cadena";

      if (!map.has(chain)) {
        map.set(chain, {
          chain,
          total: 0,
          reported: 0,
          pending: [],
        });
      }

      const item = map.get(chain)!;
      item.total += 1;

      if (reportedEmployees.has(assignment.employee_id)) {
        item.reported += 1;
      } else {
        item.pending.push({
          name: assignment.profiles?.name || "Sin nombre",
          store: assignment.stores?.name || "Sin tienda",
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const pendingA = a.total - a.reported;
      const pendingB = b.total - b.reported;
      return pendingB - pendingA;
    });
  }, [assignments, reportedEmployees]);

  const activePromoters = assignments.length;
  const reportedPromoters = reportedEmployees.size;
  const pendingPromoters = Math.max(activePromoters - reportedPromoters, 0);

  const attendanceCoverage =
    activePromoters > 0
      ? Math.round((reportedPromoters / activePromoters) * 100)
      : 0;

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
              Centro ejecutivo de operación EDVA Control App.
            </p>
          </div>

          <button
            onClick={loadDashboard}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
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
              Asistencias hoy
            </h2>

            <p className="text-4xl font-bold text-red-500 mt-4">
              {loading ? "..." : attendanceToday}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold text-neutral-700">
              Ventas hoy
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Promotores activos</p>
            <p className="text-4xl font-black text-neutral-900 mt-3">
              {loading ? "..." : activePromoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Reportaron entrada</p>
            <p className="text-4xl font-black text-green-500 mt-3">
              {loading ? "..." : reportedPromoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Pendientes</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {loading ? "..." : pendingPromoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Cobertura entrada</p>
            <p className="text-4xl font-black text-blue-500 mt-3">
              {loading ? "..." : `${attendanceCoverage}%`}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-800">
                Monitoreo operativo de hoy
              </h2>

              <p className="text-sm text-neutral-500 mt-1">
                Promotores pendientes de reportar entrada agrupados por cadena.
              </p>
            </div>
          </div>

          {loading && (
            <p className="text-sm text-neutral-500">
              Cargando operación...
            </p>
          )}

          <div className="space-y-5">
            {chainSummaries.map((chain) => {
              const pendingCount = chain.total - chain.reported;

              const chainCoverage =
                chain.total > 0
                  ? Math.round((chain.reported / chain.total) * 100)
                  : 0;

              return (
                <div
                  key={chain.chain}
                  className="border rounded-2xl overflow-hidden"
                >
                  <div className="bg-neutral-900 text-white px-5 py-4">
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <h3 className="font-bold text-lg">
                          {chain.chain}
                        </h3>

                        <p className="text-sm text-neutral-300">
                          {chain.reported} presentes · {pendingCount} pendientes ·{" "}
                          {chain.total} asignados
                        </p>
                      </div>

                      <p className="text-3xl font-black">
                        {chainCoverage}%
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-neutral-50">
                    {chain.pending.length === 0 ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="font-semibold text-green-700">
                          ✅ Todos reportaron entrada.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {chain.pending.slice(0, 10).map((employee, index) => (
                          <div
                            key={`${employee.name}-${index}`}
                            className="bg-white border border-red-200 rounded-xl p-4 flex justify-between items-center gap-4"
                          >
                            <div>
                              <p className="font-bold text-neutral-800">
                                {employee.name}
                              </p>

                              <p className="text-sm text-neutral-500">
                                {employee.store}
                              </p>
                            </div>

                            <span className="bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full font-bold">
                              Pendiente
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {chain.pending.length > 10 && (
                      <p className="text-xs text-neutral-400 mt-3">
                        Hay más pendientes. Revisa el módulo de Asistencia para detalle completo.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}