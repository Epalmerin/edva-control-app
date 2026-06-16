"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Assignment = {
  employee_id: string;
  store_id: string;
  profiles: { name: string; email: string } | null;
  stores: {
    id: string;
    name: string;
    chain_name: string | null;
    brand_name: string | null;
  } | null;
};

type VisitRecord = {
  employee_id: string;
  store_id: string;
  visit_type: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
};

type AttendanceRecord = {
  employee_id: string;
  type: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
};

type SaleRecord = {
  employee_id: string;
  store_id: string;
  sale_date: string;
  amount: number;
  ticket_number: string;
};

type StoreFilter = "TODAS" | "SIN_VISITA" | "VISITADAS" | "SIN_VENTA";

const VILLARREAL_CHAINS = ["MUEBLERIAS VILLARREAL", "MUEBLERIAS VILLAREAL"];

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function getMexicoTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getMexicoTodayRange() {
  const today = getMexicoTodayDate();
  const start = new Date(`${today}T00:00:00-06:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { today, start: start.toISOString(), end: end.toISOString() };
}

function getDateMinusDays(days: number) {
  const today = getMexicoTodayDate();
  const date = new Date(`${today}T00:00:00-06:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function money(value: number) {
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

function formatTime(date: string | null) {
  if (!date) return "Sin registro";

  return new Date(date).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupervisorVillarrealPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<AttendanceRecord[]>([]);
  const [visitsToday, setVisitsToday] = useState<VisitRecord[]>([]);
  const [salesToday, setSalesToday] = useState<SaleRecord[]>([]);
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [storeFilter, setStoreFilter] = useState<StoreFilter>("TODAS");

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const { today, start, end } = getMexicoTodayRange();
    const threeDaysAgo = getDateMinusDays(3);

    const [
      assignmentsResult,
      attendanceResult,
      visitsResult,
      salesTodayResult,
      recentSalesResult,
    ] = await Promise.all([
      supabase
        .from("employee_store_assignments")
        .select(`
          employee_id,
          store_id,
          profiles:employee_id (
            name,
            email
          ),
          stores:store_id (
            id,
            name,
            chain_name,
            brand_name
          )
        `)
        .eq("active", true),

      supabase
        .from("attendance_records")
        .select(`
          employee_id,
          type,
          created_at,
          latitude,
          longitude
        `)
        .gte("created_at", start)
        .lt("created_at", end),

      supabase
        .from("store_visit_records")
        .select(`
          employee_id,
          store_id,
          visit_type,
          created_at,
          latitude,
          longitude
        `)
        .gte("created_at", start)
        .lt("created_at", end),

      supabase
        .from("sales_records")
        .select(`
          employee_id,
          store_id,
          sale_date,
          amount,
          ticket_number
        `)
        .eq("sale_date", today),

      supabase
        .from("sales_records")
        .select(`
          employee_id,
          store_id,
          sale_date,
          amount,
          ticket_number
        `)
        .gte("sale_date", threeDaysAgo),
    ]);

    if (assignmentsResult.error) {
      setMessage(`Error al cargar asignaciones: ${assignmentsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (attendanceResult.error) {
      setMessage(`Error al cargar asistencia: ${attendanceResult.error.message}`);
      setLoading(false);
      return;
    }

    if (visitsResult.error) {
      setMessage(`Error al cargar rutas: ${visitsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (salesTodayResult.error) {
      setMessage(`Error al cargar ventas del día: ${salesTodayResult.error.message}`);
      setLoading(false);
      return;
    }

    if (recentSalesResult.error) {
      setMessage(`Error al cargar ventas recientes: ${recentSalesResult.error.message}`);
      setLoading(false);
      return;
    }

    const cleanAssignments = (assignmentsResult.data || [])
      .map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles)
          ? item.profiles[0]
          : item.profiles,
        stores: Array.isArray(item.stores) ? item.stores[0] : item.stores,
      }))
      .filter((item: Assignment) =>
        VILLARREAL_CHAINS.includes(normalizeText(item.stores?.chain_name))
      );

    const allowedEmployeeIds = new Set(
      cleanAssignments.map((item: Assignment) => item.employee_id)
    );

    const allowedStoreIds = new Set(
      cleanAssignments.map((item: Assignment) => item.store_id)
    );

    setAssignments(cleanAssignments);

    setAttendanceToday(
      (attendanceResult.data || []).filter((record: AttendanceRecord) =>
        allowedEmployeeIds.has(record.employee_id)
      )
    );

    setVisitsToday(
      (visitsResult.data || []).filter((visit: VisitRecord) =>
        allowedStoreIds.has(visit.store_id)
      )
    );

    setSalesToday(
      (salesTodayResult.data || []).filter((sale: SaleRecord) =>
        allowedStoreIds.has(sale.store_id)
      )
    );

    setRecentSales(
      (recentSalesResult.data || []).filter((sale: SaleRecord) =>
        allowedStoreIds.has(sale.store_id)
      )
    );

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const entryRecords = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();

    attendanceToday
      .filter((record) => record.type === "ENTRY")
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .forEach((record) => {
        if (!map.has(record.employee_id)) map.set(record.employee_id, record);
      });

    return map;
  }, [attendanceToday]);

  const exitRecords = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();

    attendanceToday
      .filter((record) => record.type === "EXIT")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .forEach((record) => {
        if (!map.has(record.employee_id)) map.set(record.employee_id, record);
      });

    return map;
  }, [attendanceToday]);

  const storesMap = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        chain: string;
        brand: string;
        promoterIds: Set<string>;
        promoterNames: Set<string>;
      }
    >();

    assignments.forEach((assignment) => {
      if (!assignment.stores) return;

      if (!map.has(assignment.store_id)) {
        map.set(assignment.store_id, {
          id: assignment.store_id,
          name: assignment.stores.name,
          chain: assignment.stores.chain_name || "SIN CADENA",
          brand: assignment.stores.brand_name || "SIN MARCA",
          promoterIds: new Set<string>(),
          promoterNames: new Set<string>(),
        });
      }

      const store = map.get(assignment.store_id)!;
      store.promoterIds.add(assignment.employee_id);
      store.promoterNames.add(assignment.profiles?.name || "Sin promotor");
    });

    return map;
  }, [assignments]);

  const promoterSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        storeIds: Set<string>;
        visitedStoreIds: Set<string>;
        salesTotal: number;
        tickets: number;
        lastVisit: string | null;
        entry: AttendanceRecord | null;
        exit: AttendanceRecord | null;
        status: string;
        progress: number;
      }
    >();

    assignments.forEach((assignment) => {
      if (!map.has(assignment.employee_id)) {
        map.set(assignment.employee_id, {
          id: assignment.employee_id,
          name: assignment.profiles?.name || "Sin nombre",
          email: assignment.profiles?.email || "Sin correo",
          storeIds: new Set<string>(),
          visitedStoreIds: new Set<string>(),
          salesTotal: 0,
          tickets: 0,
          lastVisit: null,
          entry: entryRecords.get(assignment.employee_id) || null,
          exit: exitRecords.get(assignment.employee_id) || null,
          status: "Sin entrada",
          progress: 0,
        });
      }

      map.get(assignment.employee_id)!.storeIds.add(assignment.store_id);
    });

    visitsToday.forEach((visit) => {
      const promoter = map.get(visit.employee_id);
      if (!promoter) return;

      promoter.visitedStoreIds.add(visit.store_id);

      if (
        !promoter.lastVisit ||
        new Date(visit.created_at) > new Date(promoter.lastVisit)
      ) {
        promoter.lastVisit = visit.created_at;
      }
    });

    salesToday.forEach((sale) => {
      const promoter = map.get(sale.employee_id);
      if (!promoter) return;

      promoter.salesTotal += Number(sale.amount || 0);
      promoter.tickets += 1;
    });

    return Array.from(map.values())
      .map((promoter) => {
        const hasEntry = !!promoter.entry;
        const hasExit = !!promoter.exit;
        const assigned = promoter.storeIds.size;
        const visited = promoter.visitedStoreIds.size;
        const progress = assigned > 0 ? Math.round((visited / assigned) * 100) : 0;

        let status = "Sin entrada";

        if (!hasEntry) {
          status = "Sin entrada";
        } else if (hasExit) {
          status = "Salida registrada";
        } else if (visited === 0) {
          status = "Con entrada / sin ruta";
        } else if (visited >= assigned) {
          status = "Ruta completa";
        } else {
          status = "En ruta";
        }

        return { ...promoter, status, progress };
      })
      .sort((a, b) => {
        const priority = (status: string) => {
          if (status === "Con entrada / sin ruta") return 1;
          if (status === "Sin entrada") return 2;
          if (status === "En ruta") return 3;
          if (status === "Ruta completa") return 4;
          return 5;
        };

        return priority(a.status) - priority(b.status);
      });
  }, [assignments, visitsToday, salesToday, entryRecords, exitRecords]);

  const storeSummary = useMemo(() => {
    return Array.from(storesMap.values())
      .map((store) => {
        const storeVisits = visitsToday.filter(
          (visit) => visit.store_id === store.id
        );

        const storeSalesToday = salesToday.filter(
          (sale) => sale.store_id === store.id
        );

        const storeRecentSales = recentSales.filter(
          (sale) => sale.store_id === store.id
        );

        const lastVisit =
          storeVisits.length > 0
            ? storeVisits.map((visit) => visit.created_at).sort().reverse()[0]
            : null;

        const lastSale =
          storeRecentSales.length > 0
            ? storeRecentSales.map((sale) => sale.sale_date).sort().reverse()[0]
            : null;

        const salesTotal = storeSalesToday.reduce(
          (sum, sale) => sum + Number(sale.amount || 0),
          0
        );

        const latestLocation = storeVisits
          .filter((visit) => visit.latitude !== null && visit.longitude !== null)
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )[0];

        return {
          ...store,
          visitedToday: storeVisits.length > 0,
          lastVisit,
          lastSale,
          salesTotal,
          tickets: storeSalesToday.length,
          withoutSales3Days: storeRecentSales.length === 0,
          latestLocation,
        };
      })
      .sort((a, b) => {
        const priority = (store: any) => {
          if (!store.visitedToday && store.withoutSales3Days) return 1;
          if (!store.visitedToday) return 2;
          if (store.withoutSales3Days) return 3;
          return 4;
        };

        return priority(a) - priority(b);
      });
  }, [storesMap, visitsToday, salesToday, recentSales]);

  const filteredStores = useMemo(() => {
    if (storeFilter === "SIN_VISITA") {
      return storeSummary.filter((store) => !store.visitedToday);
    }

    if (storeFilter === "VISITADAS") {
      return storeSummary.filter((store) => store.visitedToday);
    }

    if (storeFilter === "SIN_VENTA") {
      return storeSummary.filter((store) => store.withoutSales3Days);
    }

    return storeSummary;
  }, [storeSummary, storeFilter]);

  const promotersActive = promoterSummary.length;
  const entriesToday = promoterSummary.filter((promoter) => promoter.entry).length;
  const pendingEntries = Math.max(promotersActive - entriesToday, 0);
  const storesAssigned = storesMap.size;
  const storesVisitedToday = storeSummary.filter((store) => store.visitedToday).length;

  const promotersWithoutRoute = promoterSummary.filter(
    (promoter) => promoter.status === "Con entrada / sin ruta"
  );

  const promotersWithoutEntry = promoterSummary.filter(
    (promoter) => promoter.status === "Sin entrada"
  );

  const promotersInRoute = promoterSummary.filter(
    (promoter) => promoter.status === "En ruta"
  ).length;

  const salesTotalToday = salesToday.reduce(
    (sum, sale) => sum + Number(sale.amount || 0),
    0
  );

  const storesWithoutSales3Days = storeSummary.filter(
    (store) => store.withoutSales3Days
  ).length;

  const criticalStores = storeSummary.filter(
    (store) => !store.visitedToday || store.withoutSales3Days
  );

  const openMap = (record: VisitRecord | AttendanceRecord | undefined | null) => {
    if (!record || record.latitude === null || record.longitude === null) {
      alert("No hay ubicación disponible.");
      return;
    }

    window.open(
      `https://www.google.com/maps?q=${record.latitude},${record.longitude}`,
      "_blank"
    );
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-6 xl:p-8">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black text-neutral-800">
            Supervisor Villarreal
          </h1>
          <p className="text-neutral-500 mt-2">
            Asistencia, rutas y ventas del día.
          </p>
        </div>

        <button
          onClick={loadData}
          className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
        >
          Actualizar
        </button>
      </div>

      {message && (
        <div className="bg-white rounded-2xl shadow-md p-5 mb-6 text-sm text-neutral-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-md">
          <p className="text-sm text-neutral-500">Promotores</p>
          <p className="text-3xl font-black text-red-500 mt-2">
            {loading ? "..." : promotersActive}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md">
          <p className="text-sm text-neutral-500">Entradas hoy</p>
          <p className="text-3xl font-black text-green-600 mt-2">
            {loading ? "..." : entriesToday}
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-md">
          <p className="text-sm text-red-600">Sin entrada</p>
          <p className="text-3xl font-black text-red-600 mt-2">
            {loading ? "..." : pendingEntries}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md">
          <p className="text-sm text-neutral-500">Tiendas</p>
          <p className="text-3xl font-black text-red-500 mt-2">
            {loading ? "..." : storesAssigned}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md">
          <p className="text-sm text-neutral-500">Visitadas hoy</p>
          <p className="text-3xl font-black text-green-600 mt-2">
            {loading ? "..." : storesVisitedToday}
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 shadow-md">
          <p className="text-sm text-yellow-700">En ruta</p>
          <p className="text-3xl font-black text-yellow-700 mt-2">
            {loading ? "..." : promotersInRoute}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md">
          <p className="text-sm text-neutral-500">Venta hoy</p>
          <p className="text-3xl font-black text-red-500 mt-2">
            {loading ? "..." : money(salesTotalToday)}
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-md">
          <p className="text-sm text-red-600">Sin venta 3 días</p>
          <p className="text-3xl font-black text-red-600 mt-2">
            {loading ? "..." : storesWithoutSales3Days}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold text-neutral-800 mb-4">
          Atención inmediata
        </h2>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4">
            <p className="font-bold text-neutral-800">
              Con entrada / sin ruta
            </p>
            <p className="text-3xl font-black text-yellow-700 mt-2">
              {promotersWithoutRoute.length}
            </p>
            <p className="text-sm text-neutral-600 mt-2">
              Promotores que ya entraron pero aún no visitan tiendas.
            </p>
          </div>

          <div className="border border-red-200 bg-red-50 rounded-xl p-4">
            <p className="font-bold text-neutral-800">Sin entrada</p>
            <p className="text-3xl font-black text-red-600 mt-2">
              {promotersWithoutEntry.length}
            </p>
            <p className="text-sm text-neutral-600 mt-2">
              Promotores que aún no inician jornada.
            </p>
          </div>

          <div className="border border-red-200 bg-red-50 rounded-xl p-4">
            <p className="font-bold text-neutral-800">Tiendas críticas</p>
            <p className="text-3xl font-black text-red-600 mt-2">
              {criticalStores.length}
            </p>
            <p className="text-sm text-neutral-600 mt-2">
              Sin visita hoy y/o sin venta en 3 días.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-neutral-800 mb-5">
            Promotores
          </h2>

          <div className="space-y-3">
            {promoterSummary.map((promoter) => {
              const pendingStores =
                promoter.storeIds.size - promoter.visitedStoreIds.size;

              return (
                <div key={promoter.id} className="border rounded-xl p-4">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-bold text-neutral-800">
                        {promoter.name}
                      </p>

                      <p className="text-sm text-neutral-500">
                        {promoter.email}
                      </p>

                      <p className="text-xs text-neutral-400 mt-1">
                        Entrada: {formatTime(promoter.entry?.created_at || null)}
                      </p>

                      <p className="text-xs text-neutral-400">
                        Última ruta: {formatTime(promoter.lastVisit)}
                      </p>

                      <p className="text-xs text-neutral-400">
                        {promoter.visitedStoreIds.size}/{promoter.storeIds.size} tiendas visitadas
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-black text-red-500">
                        {money(promoter.salesTotal)}
                      </p>

                      <p className="text-xs text-neutral-400">
                        {promoter.tickets} ticket(s)
                      </p>

                      <button
                        onClick={() => openMap(promoter.entry)}
                        className="mt-3 px-3 py-1 rounded-full text-xs font-bold bg-neutral-900 text-white"
                      >
                        Ubicación entrada
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-neutral-500 mb-1">
                      <span>Avance ruta</span>
                      <span>{promoter.progress}%</span>
                    </div>

                    <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          promoter.progress >= 100
                            ? "bg-green-500"
                            : promoter.progress > 0
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${promoter.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        promoter.status === "Sin entrada"
                          ? "bg-red-100 text-red-700"
                          : promoter.status === "Salida registrada"
                          ? "bg-neutral-100 text-neutral-700"
                          : promoter.status === "Ruta completa"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {promoter.status}
                    </span>

                    {pendingStores > 0 && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                        {pendingStores} tienda(s) pendiente(s)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-5">
            <h2 className="text-2xl font-bold text-neutral-800">Tiendas</h2>

            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value as StoreFilter)}
              className="px-4 py-3 border rounded-xl bg-white"
            >
              <option value="TODAS">Todas</option>
              <option value="SIN_VISITA">Sin visita hoy</option>
              <option value="VISITADAS">Visitadas hoy</option>
              <option value="SIN_VENTA">Sin venta 3 días</option>
            </select>
          </div>

          <div className="space-y-3 max-h-[820px] overflow-y-auto pr-2">
            {filteredStores.map((store) => (
              <div
                key={store.id}
                className={`border rounded-xl p-4 ${
                  !store.visitedToday || store.withoutSales3Days
                    ? "bg-red-50 border-red-200"
                    : "bg-white"
                }`}
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-bold text-neutral-800">{store.name}</p>

                    <p className="text-sm text-neutral-500">
                      {store.chain} · {store.brand}
                    </p>

                    <p className="text-xs text-neutral-400 mt-1">
                      Promotor: {Array.from(store.promoterNames).join(", ")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-black text-red-500">
                      {money(store.salesTotal)}
                    </p>

                    <p className="text-xs text-neutral-400">
                      {store.tickets} ticket(s)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      store.visitedToday
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {store.visitedToday ? "Visitada hoy" : "Sin visita hoy"}
                  </span>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      store.withoutSales3Days
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {store.withoutSales3Days
                      ? "Sin venta 3 días"
                      : `Última venta: ${store.lastSale}`}
                  </span>

                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700">
                    Última visita: {formatTime(store.lastVisit)}
                  </span>

                  <button
                    onClick={() => openMap(store.latestLocation)}
                    className="px-3 py-1 rounded-full text-xs font-bold bg-neutral-900 text-white"
                  >
                    Ubicación visita
                  </button>
                </div>
              </div>
            ))}

            {!loading && filteredStores.length === 0 && (
              <p className="text-sm text-neutral-500">
                No hay tiendas con este filtro.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}