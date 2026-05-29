"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type AttendanceRecord = {
  id: string;
  type: string;
  created_at: string;
  photo_url: string;
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

type PromoterGroup = {
  email: string;
  name: string;
  records: AttendanceRecord[];
  lastRecord: AttendanceRecord;
};

type StoreGroup = {
  store: string;
  promoters: PromoterGroup[];
};

type BrandGroup = {
  brand: string;
  stores: StoreGroup[];
};

type ChainGroup = {
  chain: string;
  brands: BrandGroup[];
  promotersCount: number;
  entries: number;
  inBreak: number;
  completed: number;
};

const labels: Record<string, string> = {
  ENTRY: "Entrada",
  BREAK_OUT: "Salida comida",
  BREAK_IN: "Regreso comida",
  EXIT: "Salida",
};

const statusStyles: Record<string, string> = {
  ENTRY: "bg-green-100 text-green-700",
  BREAK_OUT: "bg-yellow-100 text-yellow-700",
  BREAK_IN: "bg-blue-100 text-blue-700",
  EXIT: "bg-neutral-900 text-white",
};

const statusText: Record<string, string> = {
  ENTRY: "Presente",
  BREAK_OUT: "En comida",
  BREAK_IN: "Regresó de comida",
  EXIT: "Jornada completa",
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

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState(getTodayInputDate());

  const [openChains, setOpenChains] = useState<Record<string, boolean>>({});
  const [openBrands, setOpenBrands] = useState<Record<string, boolean>>({});
  const [openStores, setOpenStores] = useState<Record<string, boolean>>({});
  const [openPromoters, setOpenPromoters] = useState<Record<string, boolean>>({});

  const loadAttendance = async () => {
    setLoading(true);
    setMessage("");

    const { start, end } = getMexicoDateRange(selectedDate);

    const { data, error } = await supabase
      .from("attendance_records")
      .select(`
        id,
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
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error al cargar asistencia: ${error.message}`);
      setLoading(false);
      return;
    }

    // CORRECCIÓN 1: Se usa "Record<string, any>" en lugar de "any" y se hace un cast a AttendanceRecord[]
    setRecords(
      (data || []).map((record: Record<string, any>) => ({
        ...record,
        profiles: Array.isArray(record.profiles)
          ? record.profiles[0]
          : record.profiles,
        stores: Array.isArray(record.stores) ? record.stores[0] : record.stores,
      })) as AttendanceRecord[]
    );

    setLoading(false);
  };

  useEffect(() => {
    loadAttendance();
  }, [selectedDate]);

  const filteredRecords = useMemo(() => {
    if (typeFilter === "ALL") return records;
    return records.filter((record) => record.type === typeFilter);
  }, [records, typeFilter]);

  const promoterGroups = useMemo(() => {
    const promoterMap = new Map<string, PromoterGroup>();

    filteredRecords.forEach((record) => {
      const email = record.profiles?.email || record.id;
      const name = record.profiles?.name || "Sin nombre";

      if (!promoterMap.has(email)) {
        promoterMap.set(email, {
          email,
          name,
          records: [],
          lastRecord: record,
        });
      }

      const group = promoterMap.get(email)!;
      group.records.push(record);

      if (new Date(record.created_at) > new Date(group.lastRecord.created_at)) {
        group.lastRecord = record;
      }
    });

    return Array.from(promoterMap.values()).map((promoter) => ({
      ...promoter,
      records: promoter.records.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    }));
  }, [filteredRecords]);

  const presentToday = promoterGroups.length;
  const entries = records.filter((record) => record.type === "ENTRY").length;
  const completed = records.filter((record) => record.type === "EXIT").length;

  // CORRECCIÓN 2: Se excluyen los que ya tienen salida ("EXIT") del estado "En comida" (Global)
  const inBreak = promoterGroups.filter((promoter) => {
    const types = promoter.records.map((record) => record.type);
    return types.includes("BREAK_OUT") && !types.includes("BREAK_IN") && !types.includes("EXIT");
  }).length;

  const chainGroups = useMemo(() => {
    const chainMap = new Map<string, Map<string, Map<string, PromoterGroup[]>>>();

    promoterGroups.forEach((promoter) => {
      const last = promoter.lastRecord;
      const chain = last.stores?.chain_name || "SIN CADENA";
      const brand = last.stores?.brand_name || "SIN MARCA";
      const store = last.stores?.name || "SIN TIENDA";

      if (!chainMap.has(chain)) {
        chainMap.set(chain, new Map());
      }

      const brandMap = chainMap.get(chain)!;

      if (!brandMap.has(brand)) {
        brandMap.set(brand, new Map());
      }

      const storeMap = brandMap.get(brand)!;

      if (!storeMap.has(store)) {
        storeMap.set(store, []);
      }

      storeMap.get(store)!.push(promoter);
    });

    return Array.from(chainMap.entries())
      .map(([chain, brandMap]) => {
        const brands: BrandGroup[] = Array.from(brandMap.entries())
          .map(([brand, storeMap]) => ({
            brand,
            stores: Array.from(storeMap.entries())
              .map(([store, promoters]) => ({
                store,
                promoters: promoters.sort((a, b) => a.name.localeCompare(b.name)),
              }))
              .sort((a, b) => a.store.localeCompare(b.store)),
          }))
          .sort((a, b) => a.brand.localeCompare(b.brand));

        const promoters = brands.flatMap((brand) =>
          brand.stores.flatMap((store) => store.promoters)
        );

        const chainEntries = promoters.filter((promoter) =>
          promoter.records.some((record) => record.type === "ENTRY")
        ).length;

        const chainCompleted = promoters.filter((promoter) =>
          promoter.records.some((record) => record.type === "EXIT")
        ).length;

        // CORRECCIÓN 3: Se excluyen los que ya tienen salida ("EXIT") del estado "En comida" (Por cadena)
        const chainInBreak = promoters.filter((promoter) => {
          const types = promoter.records.map((record) => record.type);
          return types.includes("BREAK_OUT") && !types.includes("BREAK_IN") && !types.includes("EXIT");
        }).length;

        return {
          chain,
          brands,
          promotersCount: promoters.length,
          entries: chainEntries,
          inBreak: chainInBreak,
          completed: chainCompleted,
        };
      })
      .sort((a, b) => a.chain.localeCompare(b.chain));
  }, [promoterGroups]);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    key: string
  ) => {
    setter((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const openLocation = (record: AttendanceRecord) => {
    if (record.latitude === null || record.longitude === null) {
      alert("Este registro no tiene ubicación.");
      return;
    }

    // CORRECCIÓN 4: Sintaxis arreglada y uso de la URL oficial de búsqueda de Google Maps
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${record.latitude},${record.longitude}`,
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
              Consulta de asistencia
            </h1>
            <p className="text-neutral-500 mt-2">
              Agrupado por fecha, cadena, marca, tienda y promotor.
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

            <button
              onClick={loadAttendance}
              className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
            >
              Actualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-neutral-500 text-sm">Presentes</p>
            <p className="text-4xl font-bold text-red-500 mt-2">
              {presentToday}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-neutral-500 text-sm">Entradas</p>
            <p className="text-4xl font-bold text-red-500 mt-2">{entries}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-neutral-500 text-sm">En comida</p>
            <p className="text-4xl font-bold text-red-500 mt-2">
              {Math.max(inBreak, 0)}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md">
            <p className="text-neutral-500 text-sm">Jornada completa</p>
            <p className="text-4xl font-bold text-red-500 mt-2">{completed}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-5 mb-6">
          <div className="flex flex-wrap gap-3">
            {[
              { value: "ALL", label: "Todos" },
              { value: "ENTRY", label: "Entradas" },
              { value: "BREAK_OUT", label: "Salida comida" },
              { value: "BREAK_IN", label: "Regreso comida" },
              { value: "EXIT", label: "Salidas" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setTypeFilter(filter.value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  typeFilter === filter.value
                    ? "bg-red-500 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">Cargando asistencia...</p>
          </div>
        )}

        {message && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <p className="text-neutral-700 text-sm">{message}</p>
          </div>
        )}

        {!loading && filteredRecords.length === 0 && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">
              No hay registros para esta fecha o filtro.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {chainGroups.map((chainGroup) => {
            const chainKey = chainGroup.chain;
            const isChainOpen = openChains[chainKey] ?? true;

            return (
              <div
                key={chainKey}
                className="bg-white rounded-2xl shadow-md overflow-hidden"
              >
                <button
                  onClick={() => toggle(setOpenChains, chainKey)}
                  className="w-full bg-neutral-900 text-white px-6 py-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 text-left"
                >
                  <div>
                    <h2 className="text-2xl font-bold">{chainGroup.chain}</h2>
                    <p className="text-sm text-neutral-300">
                      {chainGroup.promotersCount} promotor(es)
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <span>Entradas: {chainGroup.entries}</span>
                    <span>Comida: {chainGroup.inBreak}</span>
                    <span>Completas: {chainGroup.completed}</span>
                  </div>
                </button>

                {isChainOpen && (
                  <div className="p-5 space-y-4">
                    {chainGroup.brands.map((brandGroup) => {
                      const brandKey = `${chainGroup.chain}-${brandGroup.brand}`;
                      const isBrandOpen = openBrands[brandKey] ?? true;

                      const brandPromoters = brandGroup.stores.flatMap(
                        (store) => store.promoters
                      );

                      return (
                        <div
                          key={brandKey}
                          className="border rounded-2xl overflow-hidden bg-neutral-50"
                        >
                          <button
                            onClick={() => toggle(setOpenBrands, brandKey)}
                            className="w-full px-5 py-4 flex justify-between items-center text-left bg-neutral-100"
                          >
                            <div>
                              <h3 className="font-bold text-neutral-800">
                                {brandGroup.brand}
                              </h3>
                              <p className="text-sm text-neutral-500">
                                {brandPromoters.length} promotor(es)
                              </p>
                            </div>

                            <span className="font-bold">
                              {isBrandOpen ? "−" : "+"}
                            </span>
                          </button>

                          {isBrandOpen && (
                            <div className="p-4 space-y-4">
                              {brandGroup.stores.map((storeGroup) => {
                                const storeKey = `${brandKey}-${storeGroup.store}`;
                                const isStoreOpen = openStores[storeKey] ?? false;

                                return (
                                  <div
                                    key={storeKey}
                                    className="bg-white border rounded-2xl overflow-hidden"
                                  >
                                    <button
                                      onClick={() =>
                                        toggle(setOpenStores, storeKey)
                                      }
                                      className="w-full px-5 py-4 flex justify-between items-center text-left"
                                    >
                                      <div>
                                        <h4 className="font-bold text-neutral-800">
                                          {storeGroup.store}
                                        </h4>
                                        <p className="text-sm text-neutral-500">
                                          {storeGroup.promoters.length}{" "}
                                          promotor(es)
                                        </p>
                                      </div>

                                      <span className="font-bold">
                                        {isStoreOpen ? "−" : "+"}
                                      </span>
                                    </button>

                                    {isStoreOpen && (
                                      <div className="p-4 space-y-4 bg-neutral-50">
                                        {storeGroup.promoters.map((promoter) => {
                                          const promoterKey = `${storeKey}-${promoter.email}`;
                                          const isPromoterOpen =
                                            openPromoters[promoterKey] ?? false;
                                          const last = promoter.lastRecord;

                                          return (
                                            <div
                                              key={promoterKey}
                                              className="bg-white border rounded-2xl p-4"
                                            >
                                              <button
                                                onClick={() =>
                                                  toggle(
                                                    setOpenPromoters,
                                                    promoterKey
                                                  )
                                                }
                                                className="w-full flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 text-left"
                                              >
                                                <div>
                                                  <div className="flex flex-wrap items-center gap-3">
                                                    <h5 className="font-bold text-neutral-800 text-lg">
                                                      {promoter.name}
                                                    </h5>

                                                    <span
                                                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        statusStyles[last.type] ||
                                                        "bg-neutral-100 text-neutral-700"
                                                      }`}
                                                    >
                                                      {statusText[last.type] ||
                                                        labels[last.type]}
                                                    </span>
                                                  </div>

                                                  <p className="text-sm text-neutral-500 mt-1">
                                                    {promoter.email}
                                                  </p>
                                                </div>

                                                <div className="xl:text-right">
                                                  <p className="text-xs text-neutral-400">
                                                    Último registro
                                                  </p>
                                                  <p className="text-lg font-bold text-neutral-800">
                                                    {formatMexicoTime(
                                                      last.created_at
                                                    )}
                                                  </p>
                                                  <p className="text-sm text-neutral-500">
                                                    {labels[last.type] ||
                                                      last.type}
                                                  </p>
                                                </div>
                                              </button>

                                              {isPromoterOpen && (
                                                <div className="mt-4 space-y-2">
                                                  {promoter.records.map(
                                                    (record) => (
                                                      <div
                                                        key={record.id}
                                                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-neutral-50 border rounded-xl px-4 py-3"
                                                      >
                                                        <div>
                                                          <p className="font-semibold text-neutral-700">
                                                            {labels[
                                                              record.type
                                                            ] || record.type}
                                                          </p>

                                                          <p className="text-sm text-neutral-500">
                                                            {formatMexicoTime(
                                                              record.created_at
                                                            )}
                                                          </p>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2">
                                                          {record.photo_url && (
                                                            <a
                                                              href={
                                                                record.photo_url
                                                              }
                                                              target="_blank"
                                                              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                                                            >
                                                              Ver foto
                                                            </a>
                                                          )}

                                                          <button
                                                            onClick={() =>
                                                              openLocation(
                                                                record
                                                              )
                                                            }
                                                            className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                                                          >
                                                            Ver ubicación
                                                          </button>
                                                        </div>
                                                      </div>
                                                    )
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}