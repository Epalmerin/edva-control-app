"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type AssignedStore = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  chain_name: string | null;
  brand_name: string | null;
};

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

export default function AttendancePage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [photo, setPhoto] = useState<File | null>(null);
  const [attendanceType, setAttendanceType] = useState("");

  const [nearestStore, setNearestStore] = useState<AssignedStore | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [insideRange, setInsideRange] = useState(false);

  const [currentLatitude, setCurrentLatitude] = useState<number | null>(null);
  const [currentLongitude, setCurrentLongitude] = useState<number | null>(null);

  const handleValidateLocation = async () => {
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

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se encontró sesión activa. Vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setCurrentLatitude(lat);
        setCurrentLongitude(lng);

        const { data, error } = await supabase
          .from("employee_store_assignments")
          .select(
            `
            stores:store_id (
              id,
              name,
              latitude,
              longitude,
              radius_meters,
              chain_name,
              brand_name
            )
          `
          )
          .eq("employee_id", userId)
          .eq("active", true);

        if (error) {
          setMessage(`Error al consultar tiendas asignadas: ${error.message}`);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setMessage("No tienes tiendas asignadas.");
          setLoading(false);
          return;
        }

        const assignedStores = data
          .map((item: any) => item.stores)
          .filter(Boolean) as AssignedStore[];

        if (assignedStores.length === 0) {
          setMessage("No se encontraron tiendas asignadas válidas.");
          setLoading(false);
          return;
        }

        const storesWithDistance = assignedStores.map((store) => ({
          store,
          distance: calculateDistanceMeters(
            lat,
            lng,
            Number(store.latitude),
            Number(store.longitude)
          ),
        }));

        storesWithDistance.sort((a, b) => a.distance - b.distance);

        const closestStore = storesWithDistance[0].store;
        const closestDistance = storesWithDistance[0].distance;

        const allowedRadius = Number(closestStore.radius_meters || 200);
        const isInside = closestDistance <= allowedRadius;

        setNearestStore(closestStore);
        setDistance(closestDistance);
        setInsideRange(isInside);

        if (!isInside) {
          setMessage(
            `Estás fuera del rango permitido de la tienda.

Tienda más cercana: ${closestStore.name}
Distancia aproximada: ${Math.round(closestDistance)} m
Radio permitido: ${allowedRadius} m`
          );
          setLoading(false);
          return;
        }

        setMessage(
          `Ubicación validada correctamente.

Tienda detectada: ${closestStore.name}
Cadena/Marca: ${closestStore.chain_name || ""} / ${
            closestStore.brand_name || ""
          }
Distancia aproximada: ${Math.round(closestDistance)} m

Ahora selecciona el tipo de asistencia y toma la foto del punto de venta.`
        );

        setLoading(false);
      },
      () => {
        setMessage("No se pudo obtener la ubicación.");
        setLoading(false);
      }
    );
  };

  const handleRegisterAttendance = async (e: React.FormEvent) => {
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

    if (!insideRange || !nearestStore || currentLatitude === null || currentLongitude === null) {
      setMessage("Primero valida tu ubicación dentro del rango permitido.");
      setLoading(false);
      return;
    }

    if (!attendanceType) {
      setMessage("Selecciona el tipo de asistencia.");
      setLoading(false);
      return;
    }

    if (!photo) {
      setMessage("Debes tomar o subir una foto del punto de venta.");
      setLoading(false);
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayRecords, error: recordsError } = await supabase
      .from("attendance_records")
      .select("type, created_at")
      .eq("employee_id", userId)
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: true });

    if (recordsError) {
      setMessage(`Error al validar secuencia: ${recordsError.message}`);
      setLoading(false);
      return;
    }

    const completedTypes = todayRecords?.map((record) => record.type) || [];

    let expectedType = "ENTRY";

    if (completedTypes.includes("ENTRY")) {
      expectedType = "BREAK_OUT";
    }

    if (completedTypes.includes("BREAK_OUT")) {
      expectedType = "BREAK_IN";
    }

    if (completedTypes.includes("BREAK_IN")) {
      expectedType = "EXIT";
    }

    if (completedTypes.includes("EXIT")) {
      setMessage("Ya completaste todos tus registros de asistencia del día.");
      setLoading(false);
      return;
    }

    if (attendanceType !== expectedType) {
      const labels: Record<string, string> = {
        ENTRY: "Entrada",
        BREAK_OUT: "Salida comida",
        BREAK_IN: "Regreso comida",
        EXIT: "Salida",
      };

      setMessage(
        `No puedes registrar esta opción todavía.

Siguiente registro permitido: ${labels[expectedType]}`
      );
      setLoading(false);
      return;
    }

    const fileExt = photo.name.split(".").pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("attendance-photos")
      .upload(filePath, photo);

    if (uploadError) {
      setMessage(`Error al subir foto: ${uploadError.message}`);
      setLoading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(filePath);

    const photoUrl = publicUrlData.publicUrl;

    const { error: insertError } = await supabase
      .from("attendance_records")
      .insert({
        employee_id: userId,
        store_id: nearestStore.id,
        type: attendanceType,
        latitude: currentLatitude,
        longitude: currentLongitude,
        photo_url: photoUrl,
      });

    if (insertError) {
      setMessage(`Error al registrar asistencia: ${insertError.message}`);
      setLoading(false);
      return;
    }

    setMessage("Asistencia registrada correctamente.");
    setAttendanceType("");
    setPhoto(null);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-neutral-800">Asistencia</h1>

        <p className="text-neutral-500 mt-2 mb-8">
          Registro de entrada, comida y salida.
        </p>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-neutral-800 mb-6">
            Validación GPS
          </h2>

          <button
            onClick={handleValidateLocation}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-60"
          >
            {loading ? "Validando..." : "Validar ubicación"}
          </button>

          {nearestStore && distance !== null && (
            <div className="mt-6 border rounded-xl p-4 bg-neutral-50">
              <h3 className="font-semibold text-neutral-800">Resultado GPS</h3>

              <p className="text-sm text-neutral-600 mt-2">
                Tienda: {nearestStore.name}
              </p>

              <p className="text-sm text-neutral-600">
                Distancia: {Math.round(distance)} metros
              </p>

              <p
                className={`text-sm font-semibold mt-2 ${
                  insideRange ? "text-green-600" : "text-red-600"
                }`}
              >
                {insideRange
                  ? "Dentro del rango permitido"
                  : "Fuera del rango permitido"}
              </p>
            </div>
          )}

          {insideRange && (
            <form onSubmit={handleRegisterAttendance} className="mt-8 space-y-5">
              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Tipo de asistencia
                </label>
                <select
                  className="w-full mt-1 px-4 py-3 border rounded-xl"
                  value={attendanceType}
                  onChange={(e) => setAttendanceType(e.target.value)}
                  required
                >
                  <option value="">Selecciona opción</option>
                  <option value="ENTRY">Entrada</option>
                  <option value="BREAK_OUT">Salida comida</option>
                  <option value="BREAK_IN">Regreso comida</option>
                  <option value="EXIT">Salida</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Foto del punto de venta
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="w-full mt-1 px-4 py-3 border rounded-xl"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-60"
              >
                {loading ? "Registrando..." : "Registrar asistencia"}
              </button>
            </form>
          )}

          {message && (
            <div className="mt-6 bg-neutral-100 rounded-xl p-4 whitespace-pre-line text-sm text-neutral-700">
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}