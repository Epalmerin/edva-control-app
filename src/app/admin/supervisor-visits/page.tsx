"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type VisitRecord = {
  id: string;
  supervisor_name: string;
  visit_type: string;
  comments: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  profiles: { name: string } | null;
  stores: {
    id: string;
    name: string;
    chain_name: string | null;
    brand_name: string | null;
  } | null;
};

type Store = {
  id: string;
  name: string;
  chain_name: string | null;
  brand_name: string | null;
};

type StoreAlert = {
  id: string;
  store: string;
  chain: string;
  brand: string;
  lastVisit: string | null;
  daysWithoutVisit: number;
};

type ChainAlertGroup = {
  chain: string;
  total: number;
  visited: number;
  noVisit: number;
  stores: StoreAlert[];
};

export default function AdminSupervisorVisitsPage() {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedChain, setSelectedChain] = useState("TODAS");
  const [expandedChains, setExpandedChains] = useState<string[]>([]);

  const loadVisits = async () => {
    const { data, error } = await supabase
      .from("supervisor_visit_reports")
      .select(`
        id,
        supervisor_name,
        visit_type,
        comments,
        latitude,
        longitude,
        created_at,
        profiles:promoter_id (name),
        stores:store_id (
          id,
          name,
          chain_name,
          brand_name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setVisits(
      (data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles)
          ? item.profiles[0]
          : item.profiles,
        stores: Array.isArray(item.stores) ? item.stores[0] : item.stores,
      }))
    );
  };

  const loadStores = async () => {
    const { data, error } = await supabase
      .from("stores")
      .select("id, name, chain_name, brand_name")
      .order("chain_name", { ascending: true })
      .order("brand_name", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setStores(data || []);
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadVisits(), loadStores()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const totalVisits = visits.length;
  const supervisorsCount = new Set(visits.map((v) => v.supervisor_name)).size;
  const storesVisited = new Set(visits.map((v) => v.stores?.id).filter(Boolean)).size;
  const totalStores = stores.length;
  const coverage = totalStores > 0 ? Math.round((storesVisited / totalStores) * 100) : 0;

  const visitsBySupervisor = useMemo(() => {
    const map = new Map<string, number>();
    visits.forEach((visit) => {
      map.set(visit.supervisor_name, (map.get(visit.supervisor_name) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [visits]);

  const chainAlerts = useMemo<ChainAlertGroup[]>(() => {
    const latestVisitMap = new Map<string, VisitRecord>();

    visits.forEach((visit) => {
      if (!visit.stores) return;
      const existing = latestVisitMap.get(visit.stores.id);

      if (!existing || new Date(visit.created_at) > new Date(existing.created_at)) {
        latestVisitMap.set(visit.stores.id, visit);
      }
    });

    const grouped = new Map<string, ChainAlertGroup>();

    stores.forEach((store) => {
      const lastVisit = latestVisitMap.get(store.id);
      let daysWithoutVisit = 999;

      if (lastVisit) {
        daysWithoutVisit = Math.floor(
          (new Date().getTime() - new Date(lastVisit.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        );
      }

      const alert: StoreAlert = {
        id: store.id,
        store: store.name,
        chain: store.chain_name || "Sin cadena",
        brand: store.brand_name || "Sin marca",
        lastVisit: lastVisit?.created_at || null,
        daysWithoutVisit,
      };

      if (!grouped.has(alert.chain)) {
        grouped.set(alert.chain, {
          chain: alert.chain,
          total: 0,
          visited: 0,
          noVisit: 0,
          stores: [],
        });
      }

      const group = grouped.get(alert.chain)!;
      group.total += 1;
      lastVisit ? (group.visited += 1) : (group.noVisit += 1);
      group.stores.push(alert);
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        stores: group.stores.sort((a, b) => b.daysWithoutVisit - a.daysWithoutVisit),
      }))
      .sort((a, b) => {
        const coverageA = a.total > 0 ? a.visited / a.total : 0;
        const coverageB = b.total > 0 ? b.visited / b.total : 0;
        return coverageA - coverageB;
      });
  }, [visits, stores]);

  const chains = useMemo(
    () => Array.from(new Set(chainAlerts.map((chain) => chain.chain))).sort(),
    [chainAlerts]
  );

  const filteredChains = useMemo(() => {
    return chainAlerts
      .filter((chain) => selectedChain === "TODAS" || chain.chain === selectedChain)
      .map((chain) => ({
        ...chain,
        stores: chain.stores.filter((store) =>
          `${store.store} ${store.brand}`.toLowerCase().includes(search.toLowerCase())
        ),
      }))
      .filter((chain) => chain.stores.length > 0);
  }, [chainAlerts, selectedChain, search]);

  const abandonedStores = useMemo(() => {
    return chainAlerts
      .flatMap((chain) => chain.stores)
      .sort((a, b) => b.daysWithoutVisit - a.daysWithoutVisit)
      .slice(0, 10);
  }, [chainAlerts]);

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const chain = visit.stores?.chain_name || "Sin cadena";
      const text = [
        visit.supervisor_name,
        visit.visit_type,
        visit.profiles?.name,
        visit.stores?.name,
        visit.stores?.chain_name,
        visit.stores?.brand_name,
        visit.comments,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (selectedChain !== "TODAS" && chain !== selectedChain) return false;
      if (search && !text.includes(search.toLowerCase())) return false;

      return true;
    });
  }, [visits, selectedChain, search]);

  const toggleChain = (chain: string) => {
    setExpandedChains((prev) =>
      prev.includes(chain) ? prev.filter((c) => c !== chain) : [...prev, chain]
    );
  };

  const openAllChains = () => setExpandedChains(filteredChains.map((chain) => chain.chain));
  const closeAllChains = () => setExpandedChains([]);

  const openMap = (visit: VisitRecord) => {
    if (!visit.latitude || !visit.longitude) return;
    window.open(`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`, "_blank");
  };

  const getAlertClass = (store: StoreAlert) => {
    if (!store.lastVisit || store.daysWithoutVisit >= 15) return "bg-red-50 border-red-200";
    if (store.daysWithoutVisit >= 8) return "bg-yellow-50 border-yellow-200";
    return "bg-green-50 border-green-200";
  };

  const getAlertDot = (store: StoreAlert) => {
    if (!store.lastVisit || store.daysWithoutVisit >= 15) return "🔴";
    if (store.daysWithoutVisit >= 8) return "🟡";
    return "🟢";
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <div className="sticky top-0 z-30 bg-neutral-100/95 backdrop-blur pb-5 mb-6">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-4xl font-bold text-neutral-800">
                Visitas de supervisión
              </h1>
              <p className="text-neutral-500 mt-2">
                Control de visitas, cobertura por cadena y alertas operativas.
              </p>
            </div>

            <button
              onClick={loadAll}
              className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
            >
              Actualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">Total visitas</p>
            <p className="text-4xl font-black text-red-500 mt-3">{totalVisits}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">Supervisores</p>
            <p className="text-4xl font-black text-red-500 mt-3">{supervisorsCount}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">Tiendas visitadas</p>
            <p className="text-4xl font-black text-red-500 mt-3">
              {storesVisited}/{totalStores}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">Cobertura</p>
            <p className="text-4xl font-black text-red-500 mt-3">{coverage}%</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-5 mb-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Buscar tienda, supervisor, promotor o comentario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="xl:col-span-2 border rounded-xl px-4 py-3"
            />

            <select
              value={selectedChain}
              onChange={(e) => {
                setSelectedChain(e.target.value);
                setExpandedChains([]);
              }}
              className="border rounded-xl px-4 py-3 bg-white"
            >
              <option value="TODAS">Todas las cadenas</option>
              {chains.map((chain) => (
                <option key={chain} value={chain}>
                  {chain}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={openAllChains}
              className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Abrir todo
            </button>

            <button
              onClick={closeAllChains}
              className="bg-neutral-100 text-neutral-700 px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Cerrar todo
            </button>

            <button
              onClick={() => {
                setSearch("");
                setSelectedChain("TODAS");
                setExpandedChains([]);
              }}
              className="bg-neutral-100 text-neutral-700 px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-neutral-800 mb-5">
              Ranking supervisores
            </h2>

            {visitsBySupervisor.length === 0 && (
              <p className="text-sm text-neutral-500">Sin visitas registradas.</p>
            )}

            <div className="space-y-3">
              {visitsBySupervisor.slice(0, 8).map(([name, total]) => (
                <div
                  key={name}
                  className="flex justify-between items-center border rounded-xl p-4"
                >
                  <p className="font-semibold text-neutral-800">{name}</p>
                  <p className="font-black text-red-500">{total} visitas</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-neutral-800 mb-5">
              Ranking tiendas abandonadas
            </h2>

            {abandonedStores.length === 0 && (
              <p className="text-sm text-neutral-500">Sin tiendas registradas.</p>
            )}

            <div className="space-y-3">
              {abandonedStores.map((store) => (
                <div
                  key={store.id}
                  className={`border rounded-xl p-4 ${getAlertClass(store)}`}
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-bold text-neutral-800">{store.store}</p>
                      <p className="text-sm text-neutral-500">
                        {store.chain} / {store.brand}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {!store.lastVisit
                          ? "Nunca visitada"
                          : `Última visita hace ${store.daysWithoutVisit} día(s)`}
                      </p>
                    </div>

                    <p className="text-xl">{getAlertDot(store)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-neutral-800">
                Cobertura por cadena
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                Abre una cadena para revisar sus tiendas.
              </p>
            </div>

            <p className="text-sm font-semibold text-neutral-500">
              {filteredChains.length} cadena(s) visibles
            </p>
          </div>

          {loading && <p className="text-sm text-neutral-500">Cargando visitas...</p>}

          <div className="space-y-4">
            {filteredChains.map((chain) => {
              const chainCoverage =
                chain.total > 0 ? Math.round((chain.visited / chain.total) * 100) : 0;

              const isOpen = expandedChains.includes(chain.chain);

              return (
                <div key={chain.chain} className="border rounded-2xl overflow-hidden">
                  <button
                    onClick={() => toggleChain(chain.chain)}
                    className="w-full bg-neutral-900 text-white px-5 py-4"
                  >
                    <div className="flex justify-between items-center gap-4">
                      <div className="text-left">
                        <h3 className="font-bold text-lg">{chain.chain}</h3>
                        <p className="text-sm text-neutral-300">
                          {chain.visited} visitadas · {chain.noVisit} sin visita ·{" "}
                          {chain.total} tiendas
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <p className="text-2xl font-black">{chainCoverage}%</p>
                        <p className="text-2xl">{isOpen ? "−" : "+"}</p>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 space-y-3 bg-neutral-50">
                      {chain.stores.map((store) => (
                        <div
                          key={store.id}
                          className={`border rounded-xl p-4 ${getAlertClass(store)}`}
                        >
                          <div className="flex justify-between gap-4">
                            <div>
                              <p className="font-bold text-neutral-800">
                                {store.store}
                              </p>
                              <p className="text-sm text-neutral-500">
                                {store.brand}
                              </p>
                              <p className="text-xs text-neutral-400 mt-1">
                                {!store.lastVisit
                                  ? "Nunca visitada"
                                  : `Última visita hace ${store.daysWithoutVisit} día(s)`}
                              </p>
                            </div>

                            <p className="text-xl">{getAlertDot(store)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-neutral-800">
                Historial de visitas
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                Mostrando {filteredVisits.length} registro(s).
              </p>
            </div>
          </div>

          {loading && <p className="text-sm text-neutral-500">Cargando visitas...</p>}

          {!loading && filteredVisits.length === 0 && (
            <p className="text-sm text-neutral-500">
              No hay visitas con estos filtros.
            </p>
          )}

          <div className="space-y-4">
            {filteredVisits.slice(0, 50).map((visit) => (
              <div
                key={visit.id}
                className="border rounded-2xl p-5 bg-neutral-50"
              >
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <h3 className="font-bold text-lg text-neutral-800">
                        {visit.supervisor_name}
                      </h3>

                      <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
                        {visit.visit_type}
                      </span>
                    </div>

                    <p className="text-sm text-neutral-500 mt-1">
                      Promotor: {visit.profiles?.name || "Sin nombre"}
                    </p>

                    <p className="text-sm text-neutral-500">
                      {visit.stores?.name} · {visit.stores?.chain_name} /{" "}
                      {visit.stores?.brand_name}
                    </p>

                    {visit.comments && (
                      <p className="mt-3 text-sm text-neutral-700">
                        {visit.comments}
                      </p>
                    )}
                  </div>

                  <div className="xl:text-right">
                    <p className="text-xs text-neutral-400">Fecha</p>
                    <p className="font-bold text-neutral-800">
                      {new Date(visit.created_at).toLocaleString("es-MX")}
                    </p>

                    <button
                      onClick={() => openMap(visit)}
                      className="mt-3 bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                    >
                      Ver ubicación
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredVisits.length > 50 && (
            <p className="text-xs text-neutral-400 mt-4">
              Se muestran los primeros 50 registros. Usa búsqueda o filtro por cadena
              para encontrar información específica.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}