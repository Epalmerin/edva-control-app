"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  chain_name: string | null;
  brand_name: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number | null;
};

type CatalogItem = {
  id: string;
  name: string;
};

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [chains, setChains] = useState<CatalogItem[]>([]);
  const [brands, setBrands] = useState<CatalogItem[]>([]);

  const [name, setName] = useState("");
  const [chainName, setChainName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("200");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStores = async () => {
    const { data, error } = await supabase
      .from("stores")
      .select(
        "id, name, chain_name, brand_name, address, latitude, longitude, radius_meters"
      )
      .order("chain_name", { ascending: true })
      .order("brand_name", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setMessage(`Error al cargar tiendas: ${error.message}`);
      return;
    }

    setStores(data || []);
  };

  const loadCatalogs = async () => {
    const { data: chainsData, error: chainsError } = await supabase
      .from("chains")
      .select("id, name")
      .order("name", { ascending: true });

    const { data: brandsData, error: brandsError } = await supabase
      .from("brands")
      .select("id, name")
      .order("name", { ascending: true });

    if (chainsError) {
      setMessage(`Error al cargar cadenas: ${chainsError.message}`);
      return;
    }

    if (brandsError) {
      setMessage(`Error al cargar marcas: ${brandsError.message}`);
      return;
    }

    setChains(chainsData || []);
    setBrands(brandsData || []);
  };

  useEffect(() => {
    loadStores();
    loadCatalogs();
  }, []);

  const groupedStores = useMemo(() => {
    const groups = new Map<string, Store[]>();

    stores.forEach((store) => {
      const chain = store.chain_name || "SIN CADENA";
      const brand = store.brand_name || "SIN MARCA";
      const key = `${chain}|||${brand}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(store);
    });

    return Array.from(groups.entries()).map(([key, items]) => {
      const [chain, brand] = key.split("|||");

      return {
        chain,
        brand,
        stores: items,
      };
    });
  }, [stores]);

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const cleanName = name.trim().toUpperCase();
    const cleanChain = chainName.trim().toUpperCase();
    const cleanBrand = brandName.trim().toUpperCase();

    const { error } = await supabase.from("stores").insert({
      name: cleanName,
      chain_name: cleanChain,
      brand_name: cleanBrand,
      address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      radius_meters: Number(radius),
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Tienda guardada correctamente.");

    setName("");
    setChainName("");
    setBrandName("");
    setAddress("");
    setLatitude("");
    setLongitude("");
    setRadius("200");

    await loadStores();

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <h1 className="text-4xl font-bold text-neutral-800">Tiendas</h1>

        <p className="text-neutral-500 mt-2 mb-8">
          Administración de tiendas, cadenas, marcas y geolocalización.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-neutral-800 mb-6">
              Nueva tienda
            </h2>

            <form
              onSubmit={handleSaveStore}
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
            >
              <input
                className="px-4 py-3 border rounded-xl"
                placeholder="Nombre de tienda"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <select
                className="px-4 py-3 border rounded-xl"
                value={chainName}
                onChange={(e) => setChainName(e.target.value)}
                required
              >
                <option value="">Selecciona cadena</option>
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.name}>
                    {chain.name}
                  </option>
                ))}
              </select>

              <select
                className="px-4 py-3 border rounded-xl"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
              >
                <option value="">Selecciona marca</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.name}>
                    {brand.name}
                  </option>
                ))}
              </select>

              <input
                className="px-4 py-3 border rounded-xl"
                placeholder="Dirección"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />

              <input
                className="px-4 py-3 border rounded-xl"
                placeholder="Latitud"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />

              <input
                className="px-4 py-3 border rounded-xl"
                placeholder="Longitud"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />

              <input
                className="px-4 py-3 border rounded-xl"
                placeholder="Radio permitido"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                required
              />

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-60"
                >
                  {loading ? "Guardando tienda..." : "Guardar tienda"}
                </button>
              </div>
            </form>

            {message && (
              <div className="mt-5 bg-neutral-100 rounded-xl p-4 text-sm font-medium text-neutral-700">
                {message}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6 max-h-[75vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-neutral-800 mb-6">
              Tiendas registradas
            </h2>

            {stores.length === 0 && (
              <p className="text-neutral-500 text-sm">
                Aún no hay tiendas registradas.
              </p>
            )}

            <div className="space-y-6">
              {groupedStores.map((group) => (
                <div
                  key={`${group.chain}-${group.brand}`}
                  className="border rounded-2xl overflow-hidden bg-neutral-50"
                >
                  <div className="bg-neutral-900 text-white px-5 py-4">
                    <h3 className="font-bold text-lg">{group.chain}</h3>
                    <p className="text-sm text-neutral-300">
                      Marca: {group.brand} · {group.stores.length} tienda(s)
                    </p>
                  </div>

                  <div className="p-4 space-y-3">
                    {group.stores.map((store) => (
                      <div
                        key={store.id}
                        className="border rounded-xl p-4 bg-white"
                      >
                        <h4 className="font-semibold text-neutral-800">
                          {store.name}
                        </h4>

                        <p className="text-sm text-neutral-500 mt-1">
                          {store.address}
                        </p>

                        <p className="text-xs text-neutral-400 mt-2">
                          GPS: {store.latitude}, {store.longitude} · Radio:{" "}
                          {store.radius_meters} m
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}