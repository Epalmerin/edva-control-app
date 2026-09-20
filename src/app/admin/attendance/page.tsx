"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type AttendanceRecord = {
  id: string;
  employee_id: string;
  store_id: string | null;
  type: string;
  created_at: string;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
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

type Employee = {
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
  employee_id: string;
  store_id: string;
};

type Account = {
  id: string;
  name: string;
};

type PromoterRow = {
  employee: Employee;
  store: Store | null;
  records: AttendanceRecord[];
  lastRecord: AttendanceRecord | null;
  hasEntry: boolean;
};

const labels: Record<string, string> = {
  ENTRY: "Entrada",
  BREAK_OUT: "Salida comida",
  BREAK_IN: "Regreso comida",
  EXIT: "Salida",
};

const statusText: Record<string, string> = {
  ENTRY: "Presente",
  BREAK_OUT: "En comida",
  BREAK_IN: "Presente",
  EXIT: "Jornada completa",
};

const statusStyles: Record<string, string> = {
  ENTRY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BREAK_OUT: "bg-amber-50 text-amber-700 border-amber-200",
  BREAK_IN: "bg-blue-50 text-blue-700 border-blue-200",
  EXIT: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

function getTodayInputDate() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";

  return `${year}-${month}-${day}`;
}

function getMexicoDateRange(selectedDate: string) {
  const start = new Date(`${selectedDate}T00:00:00-06:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatMexicoTime(date: string) {
  return new Date(date).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDisplayDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccountName, setActiveAccountName] = useState("Todas las cuentas");
  const [selectedDate, setSelectedDate] = useState(getTodayInputDate());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showPending, setShowPending] = useState(true);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  useEffect(() => {
    const resolveAccount = async (accountId: string) => {
      setActiveAccountId(accountId);

      if (accountId === "all") {
        setActiveAccountName("Todas las cuentas");
        return;
      }

      const { data } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", accountId)
        .maybeSingle();

      setActiveAccountName(data?.name || "Cuenta");
    };

    const savedAccount = localStorage.getItem("edva_active_account") || "all";
    resolveAccount(savedAccount);

    const handleAccountChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      resolveAccount(customEvent.detail || "all");
    };

    window.addEventListener("edva-account-change", handleAccountChange);

    return () => {
      window.removeEventListener("edva-account-change", handleAccountChange);
    };
  }, []);

  const loadData = async () => {
    if (!activeAccountId) return;

    setLoading(true);
    setMessage("");
    setExpandedEmployee(null);

    try {
      let employeeIds: string[] = [];
      let storeIds: string[] = [];

      if (activeAccountId === "all") {
        const { data: employeeData, error: employeeError } = await supabase
          .from("profiles")
          .select("id, name, email")
          .eq("role", "PROMOTOR")
          .eq("active", true)
          .order("name");

        if (employeeError) throw employeeError;

        const { data: storeData, error: storeError } = await supabase
          .from("stores")
          .select("id, name, chain_name, brand_name")
          .order("name");

        if (storeError) throw storeError;

        const loadedEmployees = (employeeData || []) as Employee[];
        const loadedStores = (storeData || []) as Store[];

        employeeIds = loadedEmployees.map((employee) => employee.id);
        storeIds = loadedStores.map((store) => store.id);

        setEmployees(loadedEmployees);
        setStores(loadedStores);
      } else {
        const [{ data: accountEmployees, error: accountEmployeesError }, { data: accountStores, error: accountStoresError }] =
          await Promise.all([
            supabase
              .from("account_employees")
              .select("employee_id")
              .eq("account_id", activeAccountId)
              .eq("active", true),
            supabase
              .from("account_stores")
              .select("store_id")
              .eq("account_id", activeAccountId),
          ]);

        if (accountEmployeesError) throw accountEmployeesError;
        if (accountStoresError) throw accountStoresError;

        employeeIds = (accountEmployees || []).map((row: any) => row.employee_id);
        storeIds = (accountStores || []).map((row: any) => row.store_id);

        if (employeeIds.length > 0) {
          const { data: employeeData, error: employeeError } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", employeeIds)
            .eq("role", "PROMOTOR")
            .eq("active", true)
            .order("name");

          if (employeeError) throw employeeError;
          setEmployees((employeeData || []) as Employee[]);
        } else {
          setEmployees([]);
        }

        if (storeIds.length > 0) {
          const { data: storeData, error: storeError } = await supabase
            .from("stores")
            .select("id, name, chain_name, brand_name")
            .in("id", storeIds)
            .order("name");

          if (storeError) throw storeError;
          setStores((storeData || []) as Store[]);
        } else {
          setStores([]);
        }
      }

      if (employeeIds.length > 0 && storeIds.length > 0) {
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("employee_store_assignments")
          .select("employee_id, store_id")
          .eq("active", true)
          .in("employee_id", employeeIds)
          .in("store_id", storeIds);

        if (assignmentError) throw assignmentError;
        setAssignments((assignmentData || []) as Assignment[]);
      } else {
        setAssignments([]);
      }

      const { start, end } = getMexicoDateRange(selectedDate);

      let attendanceQuery = supabase
        .from("attendance_records")
        .select(`
          id,
          employee_id,
          store_id,
          type,
          created_at,
          photo_url,
          latitude,
          longitude,
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
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });

      if (activeAccountId !== "all") {
        if (employeeIds.length === 0 || storeIds.length === 0) {
          setRecords([]);
          setLoading(false);
          return;
        }

        attendanceQuery = attendanceQuery
          .in("employee_id", employeeIds)
          .in("store_id", storeIds);
      }

      const { data: attendanceData, error: attendanceError } = await attendanceQuery;

      if (attendanceError) throw attendanceError;

      setRecords(
        (attendanceData || []).map((record: any) => ({
          ...record,
          profiles: Array.isArray(record.profiles)
            ? record.profiles[0] || null
            : record.profiles,
          stores: Array.isArray(record.stores)
            ? record.stores[0] || null
            : record.stores,
        }))
      );
    } catch (error: any) {
      console.error("Error al cargar asistencia:", error);
      setMessage(`Error al cargar asistencia: ${error.message || "Error desconocido"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeAccountId) return;
    loadData();
  }, [activeAccountId, selectedDate]);

  const storesById = useMemo(
    () => new Map(stores.map((store) => [store.id, store])),
    [stores]
  );

  const primaryStoreByEmployee = useMemo(() => {
    const map = new Map<string, Store>();

    assignments.forEach((assignment) => {
      if (!map.has(assignment.employee_id)) {
        const store = storesById.get(assignment.store_id);
        if (store) map.set(assignment.employee_id, store);
      }
    });

    return map;
  }, [assignments, storesById]);

  const promoterRows = useMemo<PromoterRow[]>(() => {
    return employees
      .map((employee) => {
        const employeeRecords = records
          .filter((record) => record.employee_id === employee.id)
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

        const lastRecord =
          employeeRecords.length > 0
            ? employeeRecords[employeeRecords.length - 1]
            : null;

        const recordStore = lastRecord?.store_id
          ? storesById.get(lastRecord.store_id) || null
          : null;

        return {
          employee,
          store: recordStore || primaryStoreByEmployee.get(employee.id) || null,
          records: employeeRecords,
          lastRecord,
          hasEntry: employeeRecords.some((record) => record.type === "ENTRY"),
        };
      })
      .sort((a, b) => {
        const storeCompare = (a.store?.name || "").localeCompare(b.store?.name || "");
        if (storeCompare !== 0) return storeCompare;
        return a.employee.name.localeCompare(b.employee.name);
      });
  }, [employees, records, storesById, primaryStoreByEmployee]);

  const reportedRows = useMemo(
    () => promoterRows.filter((row) => row.hasEntry),
    [promoterRows]
  );

  const pendingRows = useMemo(
    () => promoterRows.filter((row) => !row.hasEntry),
    [promoterRows]
  );

  const inBreak = useMemo(
    () =>
      reportedRows.filter((row) => row.lastRecord?.type === "BREAK_OUT").length,
    [reportedRows]
  );

  const completed = useMemo(
    () => reportedRows.filter((row) => row.lastRecord?.type === "EXIT").length,
    [reportedRows]
  );

  const openLocation = (record: AttendanceRecord) => {
    if (record.latitude === null || record.longitude === null) {
      alert("Este registro no tiene ubicación.");
      return;
    }

    window.open(
      `https://www.google.com/maps?q=${record.latitude},${record.longitude}`,
      "_blank"
    );
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 min-w-0 px-6 py-6 xl:px-8">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400 uppercase">
              Control operativo
            </p>
            <h1 className="text-2xl xl:text-3xl font-bold text-neutral-900 mt-1">
              Asistencia
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              {activeAccountName} · {formatDisplayDate(selectedDate)}
            </p>
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 px-3 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:border-neutral-400"
              />
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="h-10 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-semibold"
            >
              Actualizar
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">Presentes</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {loading ? "—" : reportedRows.length}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              de {employees.length} promotores
            </p>
          </div>

          <button
            onClick={() => setShowPending((value) => !value)}
            className="bg-white border border-neutral-200 hover:border-red-200 rounded-xl px-4 py-4 text-left transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-neutral-500">
                  Faltan por reportar
                </p>
                <p className="text-2xl font-bold text-red-500 mt-1">
                  {loading ? "—" : pendingRows.length}
                </p>
              </div>
              <span className="text-xs text-neutral-400 mt-1">
                {showPending ? "Ocultar" : "Ver"}
              </span>
            </div>
          </button>

          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">En comida</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {loading ? "—" : inBreak}
            </p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">
              Jornada completa
            </p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {loading ? "—" : completed}
            </p>
          </div>
        </div>

        {!loading && showPending && (
          <div className="bg-white border border-neutral-200 rounded-xl mb-5 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">
                  Pendientes por reportar
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Promotores sin registro de entrada en la fecha seleccionada.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600">
                {pendingRows.length}
              </span>
            </div>

            {pendingRows.length === 0 ? (
              <div className="px-4 py-5 text-sm text-neutral-500">
                Todos los promotores de la cuenta ya reportaron entrada.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {pendingRows.map((row) => (
                  <div
                    key={row.employee.id}
                    className="px-4 py-3 grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-1 md:gap-4"
                  >
                    <p className="text-sm font-semibold text-neutral-800">
                      {row.employee.name}
                    </p>
                    <p className="text-sm text-neutral-500 md:text-right">
                      {row.store?.name || "Sin tienda asignada"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Asistencia del día
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Último estatus registrado por promotor.
              </p>
            </div>
            <span className="text-xs text-neutral-400">
              {reportedRows.length} reportados
            </span>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-sm text-neutral-500">
              Cargando asistencia...
            </div>
          ) : reportedRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-neutral-500">
              No hay entradas registradas para esta fecha.
            </div>
          ) : (
            <>
              <div className="hidden lg:grid grid-cols-[1.2fr_1fr_150px_110px_42px] gap-4 px-4 py-2.5 bg-neutral-50 border-b border-neutral-100 text-[11px] font-bold tracking-wide text-neutral-400 uppercase">
                <span>Promotor</span>
                <span>Tienda</span>
                <span>Estatus</span>
                <span>Último registro</span>
                <span />
              </div>

              <div className="divide-y divide-neutral-100">
                {reportedRows.map((row) => {
                  const last = row.lastRecord!;
                  const isOpen = expandedEmployee === row.employee.id;

                  return (
                    <div key={row.employee.id}>
                      <button
                        onClick={() =>
                          setExpandedEmployee(
                            isOpen ? null : row.employee.id
                          )
                        }
                        className="w-full grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_150px_110px_42px] gap-2 lg:gap-4 items-center px-4 py-3 text-left hover:bg-neutral-50 transition"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {row.employee.name}
                          </p>
                          <p className="text-xs text-neutral-400 truncate mt-0.5">
                            {row.employee.email}
                          </p>
                        </div>

                        <p className="text-sm text-neutral-600 truncate">
                          {row.store?.name || "Sin tienda"}
                        </p>

                        <div>
                          <span
                            className={`inline-flex border px-2.5 py-1 rounded-full text-xs font-semibold ${
                              statusStyles[last.type] ||
                              "bg-neutral-50 text-neutral-600 border-neutral-200"
                            }`}
                          >
                            {statusText[last.type] || labels[last.type] || last.type}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-neutral-700">
                          {formatMexicoTime(last.created_at)}
                        </p>

                        <span className="text-neutral-400 text-lg lg:text-center">
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="bg-neutral-50 border-t border-neutral-100 px-4 py-3">
                          <div className="space-y-2 max-w-4xl">
                            {row.records.map((record) => (
                              <div
                                key={record.id}
                                className="bg-white border border-neutral-200 rounded-lg px-3 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                              >
                                <div className="flex items-center gap-4">
                                  <p className="text-sm font-semibold text-neutral-800 min-w-[110px]">
                                    {labels[record.type] || record.type}
                                  </p>
                                  <p className="text-sm text-neutral-500">
                                    {formatMexicoTime(record.created_at)}
                                  </p>
                                </div>

                                <div className="flex gap-2">
                                  {record.photo_url && (
                                    <a
                                      href={record.photo_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700"
                                    >
                                      Ver foto
                                    </a>
                                  )}

                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openLocation(record);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-white"
                                  >
                                    Ver ubicación
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
