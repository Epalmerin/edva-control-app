"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AssignedStore = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number | null;
  chain_name: string | null;
  brand_name: string | null;
};

const TARGET_CHAIN = "MUEBLERIAS VILLARREAL";

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxWidth = 720;
      const maxHeight = 720;

      let width = image.width;
      let height = image.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("No se pudo procesar la imagen."));
        return;
      }

      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo comprimir la imagen."));
            return;
          }

          resolve(
            new File([blob], `store-visit-${Date.now()}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.5
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("La imagen no se pudo cargar."));
    };

    image.src = objectUrl;
  });
}

export default function StoreVisitsPage() {
  const [stores, setStores] = useState<AssignedStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [visitType, setVisitType] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [comments, setComments] = useState("");

  const [currentLatitude, setCurrentLatitude] = useState<number | null>(null);
  const [currentLongitude, setCurrentLongitude] = useState<number | null>(null);

  const [nearestStore, setNearestStore] = useState<AssignedStore | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [insideRange, setInsideRange] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadAssignedStores = async () => {
    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se encontró sesión activa. Vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("employee_store_assignments")
      .select(`
        stores:store_id (
          id,
          name,
          latitude,
          longitude,
          radius_meters,
          chain_name,
          brand_name
        )
      `)
      .eq("employee_id", userId)
      .eq("active", true);

    if (error) {
      setMessage(`Error al cargar tiendas: ${error.message}`);
      setLoading(false);
      return;
    }

    const assignedStores = ((data || [])
      .map((item: any) => item.stores)
      .filter(Boolean) as AssignedStore[]).filter(
      (store) => normalizeText(store.chain_name) === TARGET_CHAIN
    );

    setStores(assignedStores);

    if (assignedStores.length === 1) {
      setSelectedStoreId(assignedStores[0].id);
    }

    if (assignedStores.length === 0) {
      setMessage(
        "No tienes tiendas de Mueblerías Villarreal asignadas para ruta diaria."
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadAssignedStores();
  }, []);

  const validateLocation = async () => {
    setLoading(true);
    setMessage("");
    setNearestStore(null);
    setDistance(null);
    setInsideRange(false);
    setCurrentLatitude(null);
    setCurrentLongitude(null);

    if (!navigator.geolocation) {
      setMessage("Tu navegador no soporta geolocalización.");
      setLoading(false);
      return;
    }

    if (!selectedStoreId) {
      setMessage("Selecciona la tienda que estás visitando.");
      setLoading(false);
      return;
    }

    const selectedStore = stores.find((store) => store.id === selectedStoreId);

    if (!selectedStore) {
      setMessage("No se encontró la tienda seleccionada.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setCurrentLatitude(lat);
        setCurrentLongitude(lng);

        const calculatedDistance = calculateDistanceMeters(
          lat,
          lng,
          Number(selectedStore.latitude),
          Number(selectedStore.longitude)
        );

        const allowedRadius = Number(selectedStore.radius_meters || 300);
        const isInside = calculatedDistance <= allowedRadius;

        setNearestStore(selectedStore);
        setDistance(calculatedDistance);
        setInsideRange(isInside);

        if (!isInside) {
          setMessage(
            `Estás fuera del rango permitido.

Tienda seleccionada: ${selectedStore.name}
Distancia aproximada: ${Math.round(calculatedDistance)} m
Radio permitido: ${allowedRadius} m`
          );
          setLoading(false);
          return;
        }

        setMessage(
          `Ubicación validada correctamente.

Tienda: ${selectedStore.name}
Distancia aproximada: ${Math.round(calculatedDistance)} m

Ahora registra llegada o salida de tienda.`
        );

        setLoading(false);
      },
      () => {
        setMessage("No se pudo obtener la ubicación.");
        setLoading(false);
      }
    );
  };

  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se encontró sesión activa. Vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }

    if (!selectedStoreId || !nearestStore) {
      setMessage("Selecciona una tienda y valida ubicación.");
      setLoading(false);
      return;
    }

    if (!insideRange || currentLatitude === null || currentLongitude === null) {
      setMessage("Primero valida tu ubicación dentro del rango permitido.");
      setLoading(false);
      return;
    }

    if (!visitType) {
      setMessage("Selecciona si llegaste o saliste de la tienda.");
      setLoading(false);
      return;
    }

    let photoUrl: string | null = null;

    if (photo) {
      try {
        setMessage("Procesando foto...");
        const compressedPhoto = await compressImage(photo);

        const fileName = `${userId}-${Date.now()}.jpg`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("attendance-photos")
          .upload(filePath, compressedPhoto, {
            contentType: "image/jpeg",
          });

        if (uploadError) {
          setMessage(`Error al subir foto: ${uploadError.message}`);
          setLoading(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("attendance-photos")
          .getPublicUrl(filePath);

        photoUrl = publicUrlData.publicUrl;
      } catch (error: any) {
        setMessage(
          error?.message ||
            "No se pudo procesar la foto. Intenta con otra imagen."
        );
        setLoading(false);
        return;
      }
    }

    const { error: insertError } = await supabase
      .from("store_visit_records")
      .insert({
        employee_id: userId,
        store_id: selectedStoreId,
        visit_type: visitType,
        latitude: currentLatitude,
        longitude: currentLongitude,
        photo_url: photoUrl,
        comments: comments.trim() || null,
      });

    if (insertError) {
      setMessage(`Error al registrar visita: ${insertError.message}`);
      setLoading(false);
      return;
    }

    setMessage("Visita de tienda registrada correctamente.");
    setVisitType("");
    setPhoto(null);
    setComments("");
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-5 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-neutral-900 text-white rounded-3xl p-6 shadow-xl">
          <h1 className="text-3xl font-black">Ruta diaria</h1>
          <p className="text-neutral-300 mt-2">
            Módulo exclusivo para ruta de Mueblerías Villarreal.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-md p-5">
          <h2 className="text-xl font-bold text-neutral-800 mb-5">
            Tienda visitada
          </h2>

          <select
            value={selectedStoreId}
            onChange={(e) => {
              setSelectedStoreId(e.target.value);
              setInsideRange(false);
              setNearestStore(null);
              setDistance(null);
              setVisitType("");
            }}
            className="w-full px-4 py-4 border rounded-2xl"
          >
            <option value="">Selecciona tienda</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} - {store.chain_name} / {store.brand_name}
              </option>
            ))}
          </select>

          {stores.length === 0 && !loading && (
            <p className="text-sm text-red-500 mt-3">
              No tienes tiendas de Mueblerías Villarreal asignadas para ruta
              diaria.
            </p>
          )}

          <button
            onClick={validateLocation}
            disabled={loading || !selectedStoreId}
            className="w-full mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
          >
            {loading ? "Validando..." : "Validar ubicación"}
          </button>

          {nearestStore && distance !== null && (
            <div className="mt-5 bg-neutral-100 rounded-2xl p-4">
              <p className="font-bold text-neutral-800">{nearestStore.name}</p>
              <p className="text-sm text-neutral-500 mt-1">
                Distancia: {Math.round(distance)} metros
              </p>
              <p
                className={`text-sm font-bold mt-2 ${
                  insideRange ? "text-green-600" : "text-red-600"
                }`}
              >
                {insideRange
                  ? "Dentro del rango permitido"
                  : "Fuera del rango permitido"}
              </p>
            </div>
          )}
        </div>

        {insideRange && (
          <div className="bg-white rounded-3xl shadow-md p-5">
            <h2 className="text-xl font-bold text-neutral-800 mb-5">
              Registro de visita
            </h2>

            <form onSubmit={handleSaveVisit} className="space-y-4">
              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value)}
                className="w-full px-4 py-4 border rounded-2xl"
                required
              >
                <option value="">Selecciona movimiento</option>
                <option value="ARRIVAL">Llegué a tienda</option>
                <option value="DEPARTURE">Salí de tienda</option>
              </select>

              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Comentario opcional"
                className="w-full px-4 py-4 border rounded-2xl min-h-24"
              />

              <div>
                <label className="text-sm font-semibold text-neutral-700">
                  Foto opcional
                </label>

                <input
                  type="file"
                  accept="image/*"
                  className="w-full mt-1 px-4 py-3 border rounded-2xl"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Guardar visita"}
              </button>
            </form>
          </div>
        )}

        {message && (
          <div className="bg-white rounded-3xl shadow-md p-5 whitespace-pre-line text-sm text-neutral-700">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}