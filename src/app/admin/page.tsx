"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  pending: number;
  coverage: number;
};

function getMexicoTodayRange() {
  const now = new Date();

  const mexicoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const start = new Date(`${mexicoDate}T00:00:00-06:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export default function AdminPage() {
  const [employees, setEmployees] = useState(0);
  const [attendanceToday, setAttendanceToday] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [incidencesToday, setIncidencesToday] = useState(0);
  const [routeRecordsToday, setRouteRecordsToday] = useState(0);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<
    AttendanceRecord[]
  >([]);

  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);

    const { start, end } = getMexicoTodayRange();

    const [
      employeesResult,
      attendanceResult,
      salesResult,
      incidencesResult,
      routeRecordsResult,
      assignmentsResult,
      entriesResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),

      supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start)
        .lt("created_at", end),

      supabase
        .from("sales_records")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start)
        .lt("created_at", end),

      supabase
        .from("incidence_requests")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start)
        .lt("created_at", end),

      supabase
        .from("store_visit_records")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start)
        .lt("created_at", end),

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
        .gte("created_at", start)
        .lt("created_at", end),
    ]);

    setEmployees(employeesResult.count || 0);
    setAttendanceToday(attendanceResult.count || 0);
    setSalesToday(salesResult.count || 0);
    setIncidencesToday(incidencesResult.count || 0);
    setRouteRecordsToday(routeRecordsResult.count || 0);

    setAssignments(
      (assignmentsResult.data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles)
          ? item.profiles[0]
          : item.profiles,
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
    const map = new Map<
      string,
      {
        chain: string;
        employeeIds: Set<string>;
        reportedIds: Set<string>;
      }
    >();

    assignments.forEach((assignment) => {
      const chain = assignment.stores?.chain_name || "Sin cadena";

      if (!map.has(chain)) {
        map.set(chain, {
          chain,
          employeeIds: new Set<string>(),
          reportedIds: new Set<string>(),
        });
      }

      const item = map.get(chain)!;

      item.employeeIds.add(assignment.employee_id);

      if (reportedEmployees.has(assignment.employee_id)) {
        item.reportedIds.add(assignment.employee_id);
      }
    });

    return Array.from(map.values())
      .map((item) => {
        const total = item.employeeIds.size;
        const reported = item.reportedIds.size;
        const pending = Math.max(total - reported, 0);

        return {
          chain: item.chain,
          total,
          reported,
          pending,
          coverage: total > 0 ? Math.round((reported / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.pending - a.pending);
  }, [assignments, reportedEmployees]);

  const activePromoters = new Set(
    assignments.map((assignment) => assignment.employee_id)
  ).size;

  const reportedPromoters = reportedEmployees.size;
  const pendingPromoters = Math.max(activePromoters - reportedPromoters, 0);

  const attendanceCoverage =
    activePromoters > 0
      ? Math.round((reportedPromoters / activePromoters) * 100)
      : 0;

  const criticalChains = chainSummaries.filter(
    (chain) => chain.pending > 0 || chain.coverage < 80
  );

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
              Vista ejecutiva de operación diaria.
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
            <p className="text-neutral-500 text-sm">Empleados</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {loading ? "..." : employees}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Asistencias hoy</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {loading ? "..." : attendanceToday}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Ventas hoy</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {loading ? "..." : salesToday}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Incidencias hoy</p>
            <p className="text-4xl font-black text-red-500 mt-3">
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-md p-6">
            <div className="flex justify-between items-start gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-neutral-800">
                  Resumen por cadena
                </h2>

                <p className="text-sm text-neutral-500 mt-1">
                  Cobertura de entrada del día por promotores únicos.
                </p>
              </div>

              <Link
                href="/admin/attendance"
                className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-sm font-semibold"
              >
                Ver asistencia
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-neutral-500">
                    <th className="py-3">Cadena</th>
                    <th className="py-3 text-center">Promotores</th>
                    <th className="py-3 text-center">Presentes</th>
                    <th className="py-3 text-center">Pendientes</th>
                    <th className="py-3 text-center">Cobertura</th>
                  </tr>
                </thead>

                <tbody>
                  {chainSummaries.map((chain) => (
                    <tr key={chain.chain} className="border-b">
                      <td className="py-4 font-bold text-neutral-800">
                        {chain.chain}
                      </td>

                      <td className="py-4 text-center">{chain.total}</td>

                      <td className="py-4 text-center text-green-600 font-bold">
                        {chain.reported}
                      </td>

                      <td className="py-4 text-center text-red-500 font-bold">
                        {chain.pending}
                      </td>

                      <td className="py-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full font-bold text-xs ${
                            chain.coverage >= 80
                              ? "bg-green-100 text-green-700"
                              : chain.coverage >= 50
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {chain.coverage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-neutral-800 mb-2">
              Alertas operativas
            </h2>

            <p className="text-sm text-neutral-500 mb-6">
              Cadenas que requieren atención.
            </p>

            <div className="space-y-3">
              {criticalChains.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="font-semibold text-green-700">
                    Operación sin alertas críticas.
                  </p>
                </div>
              )}

              {criticalChains.slice(0, 5).map((chain) => (
                <div
                  key={chain.chain}
                  className="border border-red-200 bg-red-50 rounded-xl p-4"
                >
                  <p className="font-bold text-neutral-800">{chain.chain}</p>

                  <p className="text-sm text-neutral-600 mt-1">
                    {chain.pending} pendiente(s) · {chain.coverage}% cobertura
                  </p>
                </div>
              ))}

              {criticalChains.length > 5 && (
                <p className="text-xs text-neutral-400">
                  Hay más alertas. Revisa el módulo de asistencia.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Link
            href="/admin/attendance"
            className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition"
          >
            <p className="text-sm text-neutral-500">Acceso rápido</p>
            <h3 className="text-xl font-bold text-neutral-900 mt-2">
              Asistencia
            </h3>
          </Link>

          <Link
            href="/admin/store-visits"
            className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition"
          >
            <p className="text-sm text-neutral-500">Rutas hoy</p>
            <h3 className="text-xl font-bold text-neutral-900 mt-2">
              {loading ? "..." : routeRecordsToday} movimientos
            </h3>
          </Link>

          <Link
            href="/admin/sales"
            className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition"
          >
            <p className="text-sm text-neutral-500">Acceso rápido</p>
            <h3 className="text-xl font-bold text-neutral-900 mt-2">
              Ventas
            </h3>
          </Link>

          <Link
            href="/admin/supervisor-visits"
            className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition"
          >
            <p className="text-sm text-neutral-500">Acceso rápido</p>
            <h3 className="text-xl font-bold text-neutral-900 mt-2">
              Visitas supervisor
            </h3>
          </Link>
        </div>
      </section>
    </main>
  );
}