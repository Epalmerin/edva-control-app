"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  stores: { chain_name: string | null } | null;
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
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    date: mexicoDate,
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

  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccountName, setActiveAccountName] = useState("Todas las cuentas");
  const [message, setMessage] = useState("");
  const requestId = useRef(0);
  const [accountChange, setAccountChange] = useState(0);

  useEffect(() => {
    const selectAccount = (id: string) => {
      // Invalidate an earlier request immediately when the selector changes.
      requestId.current += 1;
      setLoading(true);
      setMessage("");
      setAssignments([]);
      setAttendanceEntries([]);
      setActiveAccountName(id === "all" ? "Todas las cuentas" : "Cuenta seleccionada");
      setActiveAccountId(id);
      setAccountChange((value) => value + 1);
    };
    selectAccount(localStorage.getItem("edva_active_account") || "all");
    const handler = (event: Event) => {
      const id = (event as CustomEvent<string>).detail || "all";
      selectAccount(id);
    };
    window.addEventListener("edva-account-change", handler);
    return () => {
      window.removeEventListener("edva-account-change", handler);
      requestId.current += 1;
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!activeAccountId) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setMessage("");
    setAssignments([]);
    setAttendanceEntries([]);

    try {
      const { date, start, end } = getMexicoTodayRange();
      const specificAccount = activeAccountId !== "all";
      let employeeIds: string[] = [];
      let storeIds: string[] = [];
      let accountName = "Todas las cuentas";

      if (specificAccount) {
        const [members, stores, account] = await Promise.all([
          supabase.from("account_employees").select("employee_id")
            .eq("account_id", activeAccountId).eq("active", true),
          supabase.from("account_stores").select("store_id")
            .eq("account_id", activeAccountId),
          supabase.from("accounts").select("name")
            .eq("id", activeAccountId).maybeSingle(),
        ]);
        for (const result of [members, stores, account]) {
          if (result.error) throw result.error;
        }
        employeeIds = Array.from(new Set((members.data || []).map((row) => row.employee_id as string)));
        storeIds = Array.from(new Set((stores.data || []).map((row) => row.store_id as string)));
        accountName = account.data?.name || "Cuenta seleccionada";
      }
      if (currentRequest !== requestId.current) return;

      const emptyResult = { data: [], count: 0, error: null };
      let employeesQuery = supabase.from("profiles").select("*", { count: "exact", head: true });
      let promotersQuery = supabase.from("profiles").select("id")
        .eq("role", "PROMOTOR").eq("active", true);
      if (specificAccount && employeeIds.length) {
        employeesQuery = employeesQuery.in("id", employeeIds);
        promotersQuery = promotersQuery.in("id", employeeIds);
      }
      const [employeesResult, promotersResult] = await Promise.all([
        specificAccount && !employeeIds.length ? emptyResult : employeesQuery,
        specificAccount && !employeeIds.length ? emptyResult : promotersQuery,
      ]);
      if (employeesResult.error) throw employeesResult.error;
      if (promotersResult.error) throw promotersResult.error;
      if (currentRequest !== requestId.current) return;
      const promoterIds = (promotersResult.data || []).map((row) => row.id as string);

      let attendanceQuery = supabase.from("attendance_records")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start).lt("created_at", end);
      let salesQuery = supabase.from("sales_records")
        .select("*", { count: "exact", head: true }).eq("sale_date", date);
      let incidencesQuery = supabase.from("incidence_requests")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start).lt("created_at", end);
      let routesQuery = supabase.from("store_visit_records")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start).lt("created_at", end);
      let assignmentsQuery = supabase.from("employee_store_assignments")
        .select(`employee_id, profiles:employee_id (name, email),
          stores:store_id (name, chain_name, brand_name)`)
        .eq("active", true);
      let entriesQuery = supabase.from("attendance_records")
        .select("employee_id, type, stores:store_id (chain_name)")
        .eq("type", "ENTRY").gte("created_at", start).lt("created_at", end);

      if (promoterIds.length) {
        assignmentsQuery = assignmentsQuery.in("employee_id", promoterIds);
        entriesQuery = entriesQuery.in("employee_id", promoterIds);
      }
      if (specificAccount) {
        if (employeeIds.length) {
          attendanceQuery = attendanceQuery.in("employee_id", employeeIds);
          incidencesQuery = incidencesQuery.in("employee_id", employeeIds);
          routesQuery = routesQuery.in("employee_id", employeeIds);
        }
        if (storeIds.length) {
          attendanceQuery = attendanceQuery.in("store_id", storeIds);
          salesQuery = salesQuery.in("store_id", storeIds);
          routesQuery = routesQuery.in("store_id", storeIds);
          assignmentsQuery = assignmentsQuery.in("store_id", storeIds);
          entriesQuery = entriesQuery.in("store_id", storeIds);
        }
      }
      const noEmployees = specificAccount && !employeeIds.length;
      const noStores = specificAccount && !storeIds.length;
      const [attendanceResult, salesResult, incidencesResult, routeRecordsResult,
        assignmentsResult, entriesResult] = await Promise.all([
        noEmployees || noStores ? emptyResult : attendanceQuery,
        noStores ? emptyResult : salesQuery,
        noEmployees ? emptyResult : incidencesQuery,
        noEmployees || noStores ? emptyResult : routesQuery,
        !promoterIds.length || noStores ? emptyResult : assignmentsQuery,
        !promoterIds.length || noStores ? emptyResult : entriesQuery,
      ]);
      for (const result of [attendanceResult, salesResult, incidencesResult,
        routeRecordsResult, assignmentsResult, entriesResult]) {
        if (result.error) throw result.error;
      }
      if (currentRequest !== requestId.current) return;

      setActiveAccountName(accountName);
      setEmployees(employeesResult.count || 0);
      setAttendanceToday(attendanceResult.count || 0);
      setSalesToday(salesResult.count || 0);
      setIncidencesToday(incidencesResult.count || 0);
      setRouteRecordsToday(routeRecordsResult.count || 0);
      setAssignments((assignmentsResult.data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] || null : item.profiles,
        stores: Array.isArray(item.stores) ? item.stores[0] || null : item.stores,
      })));
      setAttendanceEntries((entriesResult.data || []).map((item: any) => ({
        ...item,
        stores: Array.isArray(item.stores) ? item.stores[0] || null : item.stores,
      })));
    } catch (error: unknown) {
      if (currentRequest !== requestId.current) return;
      const detail = error && typeof error === "object" && "message" in error
        ? String(error.message) : "Error desconocido";
      setMessage(`No fue posible cargar el Dashboard: ${detail}`);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    void loadDashboard();
    return () => { requestId.current += 1; };
  }, [loadDashboard, accountChange]);

  const reportedEmployees = useMemo(() => {
    const assignedIds = new Set(assignments.map((item) => item.employee_id));
    return new Set(attendanceEntries
      .filter((record) => assignedIds.has(record.employee_id))
      .map((record) => record.employee_id));
  }, [attendanceEntries, assignments]);

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

      if (attendanceEntries.some((record) =>
        record.employee_id === assignment.employee_id &&
        (record.stores?.chain_name || "Sin cadena") === chain
      )) {
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
  }, [assignments, attendanceEntries]);

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
              {activeAccountName} · Vista ejecutiva de operación diaria.
            </p>
          </div>

          <button
            onClick={loadDashboard}
            disabled={loading || !activeAccountId}
            className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Actualizar
          </button>
        </div>

        {message && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Empleados</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {loading ? "..." : message ? "—" : employees}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Asistencias hoy</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {loading ? "..." : message ? "—" : attendanceToday}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Ventas hoy</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {loading ? "..." : message ? "—" : salesToday}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Incidencias hoy</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {loading ? "..." : message ? "—" : incidencesToday}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Promotores activos</p>
            <p className="text-4xl font-black text-neutral-900 mt-3">
              {loading ? "..." : message ? "—" : activePromoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Reportaron entrada</p>
            <p className="text-4xl font-black text-green-500 mt-3">
              {loading ? "..." : message ? "—" : reportedPromoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Pendientes</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {loading ? "..." : message ? "—" : pendingPromoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <p className="text-neutral-500 text-sm">Cobertura entrada</p>
            <p className="text-4xl font-black text-blue-500 mt-3">
              {loading ? "..." : message ? "—" : `${attendanceCoverage}%`}
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
                  {(loading || message || chainSummaries.length === 0) && (
                    <tr><td colSpan={5} className="py-4 text-neutral-500">
                      {loading ? "Cargando..." : message ? "Datos no disponibles." : "No hay promotores con asignaciones activas en esta cuenta."}
                    </td></tr>
                  )}
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
              {(loading || message || chainSummaries.length === 0) && (
                <p className="text-sm text-neutral-500">
                  {loading ? "Cargando..." : message ? "Datos no disponibles." : "Sin asignaciones activas para evaluar."}
                </p>
              )}
              {!loading && !message && chainSummaries.length > 0 && criticalChains.length === 0 && (
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
              {loading ? "..." : message ? "—" : routeRecordsToday} movimientos
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
          </Link><Link
  href="/admin/sales-targets"
  className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition"
>
  <p className="text-sm text-neutral-500">Acceso rápido</p>
  <h3 className="text-xl font-bold text-neutral-900 mt-2">
    Metas de venta
  </h3>
</Link>
        </div>
      </section>
    </main>
  );
}
