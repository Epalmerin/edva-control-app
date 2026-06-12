"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type StoreVisitRecord = {
  id: string;
  visit_type: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  comments: string | null;
  created_at: string;
  profiles: {
    name: string;
    email: string;
  } | null;
  stores: {
    id: string;
    name: string;
    chain_name: string | null;
    brand_name: string | null;
  } | null;
};

type VisitGroup = {
  key: string;
  employeeName: string;
  email: string;
  storeName: string;
  chain: string;
  brand: string;
  arrival: StoreVisitRecord | null;
  departure: StoreVisitRecord | null;
  records: StoreVisitRecord[];
};

function getMexicoTodayInputDate() {
  const now = new Date();

  const mexicoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return mexicoDate;
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

function formatMexicoDateTime(date: string) {
  return new Date(date).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatMexicoTime(date: string) {
  return new Date(date).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDurationMinutes(
  arrival: StoreVisitRecord | null,
  departure: StoreVisitRecord | null
) {
  if (!arrival || !departure) return null;

  const diff =
    new Date(departure.created_at).getTime() -
    new Date(arrival.created_at).getTime();

  if (diff <= 0) return null;

  return Math.round(diff / 1000 / 60);
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "Pendiente";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins} min`;

  return `${hours} h ${mins} min`;
}

export default function AdminStoreVisitsPage() {
  const [records, setRecords] = useState<StoreVisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(getMexicoTodayInputDate());
  const [chainFilter, setChainFilter] = useState("TODAS");

  const loadVisits = async () => {
    setLoading(true);
    setMessage("");

    const { start, end } = getMexicoDateRange(selectedDate);

    const { data, error } = await supabase
      .from("store_visit_records")
      .select(`
        id,
        visit_type,
        latitude,
        longitude,
        photo_url,
        comments,
        created_at,
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
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error al cargar rutas: ${error.message}`);
      setLoading(false);
      return;
    }

    setRecords(
      (data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles)
          ? item.profiles[0]
          : item.profiles,
        stores: Array.isArray(item.stores) ? item.stores[0] : item.stores,
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    loadVisits();
  }, [selectedDate]);

  const chains = useMemo(() => {
    return Array.from(
      new Set(
        records
          .map((record) => record.stores?.chain_name || "Sin cadena")
          .filter(Boolean)
      )
    ).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (chainFilter === "TODAS") return records;

    return records.filter(
      (record) => (record.stores?.chain_name || "Sin cadena") === chainFilter
    );
  }, [records, chainFilter]);

  const groupedVisits = useMemo<VisitGroup[]>(() => {
    const map = new Map<string, VisitGroup>();

    filteredRecords.forEach((record) => {
      const employeeName = record.profiles?.name || "Sin nombre";
      const email = record.profiles?.email || "Sin correo";
      const storeName = record.stores?.name || "Sin tienda";
      const chain = record.stores?.chain_name || "Sin cadena";
      const brand = record.stores?.brand_name || "Sin marca";

      const key = `${email}|||${record.stores?.id || storeName}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          employeeName,
          email,
          storeName,
          chain,
          brand,
          arrival: null,
          departure: null,
          records: [],
        });
      }

      const group = map.get(key)!;
      group.records.push(record);

      if (record.visit_type === "ARRIVAL") {
        if (
          !group.arrival ||
          new Date(record.created_at) < new Date(group.arrival.created_at)
        ) {
          group.arrival = record;
        }
      }

      if (record.visit_type === "DEPARTURE") {
        if (
          !group.departure ||
          new Date(record.created_at) > new Date(group.departure.created_at)
        ) {
          group.departure = record;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.arrival?.created_at || a.records[0]?.created_at || "";
      const bTime = b.arrival?.created_at || b.records[0]?.created_at || "";
      return bTime.localeCompare(aTime);
    });
  }, [filteredRecords]);

  const totalVisits = filteredRecords.length;
  const totalStoresVisited = new Set(
    groupedVisits.map((visit) => `${visit.email}-${visit.storeName}`)
  ).size;
  const totalPromoters = new Set(groupedVisits.map((visit) => visit.email)).size;
  const openVisits = groupedVisits.filter(
    (visit) => visit.arrival && !visit.departure
  ).length;

  const completedVisits = groupedVisits.filter(
    (visit) => visit.arrival && visit.departure
  );

  const averageMinutes =
    completedVisits.length > 0
      ? Math.round(
          completedVisits.reduce((sum, visit) => {
            return (
              sum +
              (getDurationMinutes(visit.arrival, visit.departure) || 0)
            );
          }, 0) / completedVisits.length
        )
      : null;

  const openMap = (record: StoreVisitRecord | null) => {
    if (!record || record.latitude === null || record.longitude === null) {
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

      <section className="flex-1 p-8">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-800">
              Rutas de tienda
            </h1>
            <p className="text-neutral-500 mt-2">
              Control de llegada y salida por tienda visitada.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4 flex flex-col md:flex-row gap-3 md:items-end">
            <div>
              <label className="text-sm font-semibold text-neutral-700">
                Fecha
              </label>
              <input
                type="date"
                className="block mt-1 px-4 py-3 border rounded-xl"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-700">
                Cadena
              </label>
              <select
                className="block mt-1 px-4 py-3 border rounded-xl bg-white"
                value={chainFilter}
                onChange={(e) => setChainFilter(e.target.value)}
              >
                <option value="TODAS">Todas</option>
                {chains.map((chain) => (
                  <option key={chain} value={chain}>
                    {chain}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={loadVisits}
              className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
            >
              Actualizar
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-6 text-sm text-neutral-700">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-neutral-500 text-sm">Registros</p>
            <p className="text-4xl font-black text-red-500 mt-2">
              {loading ? "..." : totalVisits}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-neutral-500 text-sm">Promotores en ruta</p>
            <p className="text-4xl font-black text-red-500 mt-2">
              {loading ? "..." : totalPromoters}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-neutral-500 text-sm">Tiendas visitadas</p>
            <p className="text-4xl font-black text-red-500 mt-2">
              {loading ? "..." : totalStoresVisited}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-neutral-500 text-sm">Visitas abiertas</p>
            <p className="text-4xl font-black text-red-500 mt-2">
              {loading ? "..." : openVisits}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-neutral-800 mb-2">
            Tiempo promedio en tienda
          </h2>
          <p className="text-3xl font-black text-neutral-900">
            {loading ? "..." : formatDuration(averageMinutes)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-bold text-neutral-800 mb-6">
            Detalle de rutas
          </h2>

          {loading && (
            <p className="text-sm text-neutral-500">Cargando rutas...</p>
          )}

          {!loading && groupedVisits.length === 0 && (
            <p className="text-sm text-neutral-500">
              No hay registros de ruta para esta fecha.
            </p>
          )}

          <div className="space-y-4">
            {groupedVisits.map((visit) => {
              const duration = getDurationMinutes(
                visit.arrival,
                visit.departure
              );

              return (
                <div
                  key={visit.key}
                  className="border rounded-2xl p-5 bg-neutral-50"
                >
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                    <div>
                      <h3 className="text-lg font-bold text-neutral-800">
                        {visit.employeeName}
                      </h3>

                      <p className="text-sm text-neutral-500">
                        {visit.email}
                      </p>

                      <p className="text-sm text-neutral-600 mt-3">
                        <span className="font-semibold">Tienda:</span>{" "}
                        {visit.storeName}
                      </p>

                      <p className="text-sm text-neutral-500">
                        {visit.chain} / {visit.brand}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <div className="bg-white border rounded-xl p-4">
                          <p className="text-xs text-neutral-400">
                            Llegada
                          </p>
                          <p className="font-bold text-neutral-800">
                            {visit.arrival
                              ? formatMexicoTime(visit.arrival.created_at)
                              : "Sin registro"}
                          </p>

                          {visit.arrival && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                onClick={() => openMap(visit.arrival)}
                                className="bg-neutral-900 text-white px-3 py-2 rounded-xl text-xs font-semibold"
                              >
                                Ubicación
                              </button>

                              {visit.arrival.photo_url && (
                                <a
                                  href={visit.arrival.photo_url}
                                  target="_blank"
                                  className="bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-semibold"
                                >
                                  Foto
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="bg-white border rounded-xl p-4">
                          <p className="text-xs text-neutral-400">
                            Salida
                          </p>
                          <p className="font-bold text-neutral-800">
                            {visit.departure
                              ? formatMexicoTime(visit.departure.created_at)
                              : "Pendiente"}
                          </p>

                          {visit.departure && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                onClick={() => openMap(visit.departure)}
                                className="bg-neutral-900 text-white px-3 py-2 rounded-xl text-xs font-semibold"
                              >
                                Ubicación
                              </button>

                              {visit.departure.photo_url && (
                                <a
                                  href={visit.departure.photo_url}
                                  target="_blank"
                                  className="bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-semibold"
                                >
                                  Foto
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {visit.records.some((record) => record.comments) && (
                        <div className="mt-4 bg-white border rounded-xl p-4">
                          <p className="text-xs text-neutral-400 mb-2">
                            Comentarios
                          </p>

                          <div className="space-y-2">
                            {visit.records
                              .filter((record) => record.comments)
                              .map((record) => (
                                <p
                                  key={record.id}
                                  className="text-sm text-neutral-700"
                                >
                                  {record.visit_type === "ARRIVAL"
                                    ? "Llegada"
                                    : "Salida"}
                                  : {record.comments}
                                </p>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="xl:text-right min-w-40">
                      <p className="text-xs text-neutral-400">
                        Tiempo en tienda
                      </p>

                      <p className="text-2xl font-black text-red-500">
                        {formatDuration(duration)}
                      </p>

                      <p
                        className={`mt-3 text-xs font-bold px-3 py-1 rounded-full inline-block ${
                          visit.arrival && visit.departure
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {visit.arrival && visit.departure
                          ? "Cerrada"
                          : "Abierta"}
                      </p>

                      <p className="text-xs text-neutral-400 mt-4">
                        Último movimiento
                      </p>
                      <p className="text-sm font-semibold text-neutral-700">
                        {formatMexicoDateTime(
                          visit.records[0]?.created_at ||
                            visit.arrival?.created_at ||
                            visit.departure?.created_at ||
                            new Date().toISOString()
                        )}
                      </p>
                    </div>
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