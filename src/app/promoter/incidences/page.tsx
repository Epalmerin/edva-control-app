"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PromoterIncidencesPage() {
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSaveIncidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se encontró sesión activa.");
      setLoading(false);
      return;
    }

    if (!type || !startDate || !reason) {
      setMessage("Completa los campos obligatorios.");
      setLoading(false);
      return;
    }

    if (type === "MEDICAL" && !file) {
      setMessage("Para incapacidad es obligatorio subir PDF o fotografía.");
      setLoading(false);
      return;
    }

    let fileUrl = "";

    if (file) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("incidence-files")
        .upload(filePath, file);

      if (uploadError) {
        setMessage(`Error al subir archivo: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("incidence-files")
        .getPublicUrl(filePath);

      fileUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase.from("incidence_requests").insert({
      employee_id: userId,
      type,
      start_date: startDate,
      end_date: endDate || startDate,
      reason,
      file_url: fileUrl || null,
      status: "PENDING",
    });

    if (error) {
      setMessage(`Error al registrar incidencia: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Incidencia enviada correctamente.");
    setType("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setFile(null);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-neutral-800">
          Incidencias
        </h1>

        <p className="text-neutral-500 mt-2 mb-8">
          Solicita vacaciones, permisos o incapacidades.
        </p>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <form onSubmit={handleSaveIncidence} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-neutral-700">
                Tipo de incidencia
              </label>
              <select
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
              >
                <option value="">Selecciona opción</option>
                <option value="VACATION">Vacaciones</option>
                <option value="PERMISSION">Permiso</option>
                <option value="MEDICAL">Incapacidad</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Fecha inicio
              </label>
              <input
                type="date"
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Fecha fin
              </label>
              <input
                type="date"
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Motivo
              </label>
              <textarea
                className="w-full mt-1 px-4 py-3 border rounded-xl"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe el motivo"
                required
              />
            </div>

            {type === "MEDICAL" && (
              <div>
                <label className="text-sm font-medium text-neutral-700">
                  PDF o fotografía de incapacidad
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="w-full mt-1 px-4 py-3 border rounded-xl"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
            )}

            {type !== "MEDICAL" && (
              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Archivo opcional
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="w-full mt-1 px-4 py-3 border rounded-xl"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar incidencia"}
            </button>
          </form>

          {message && (
            <div className="mt-5 bg-neutral-100 rounded-xl p-4 text-sm font-medium text-neutral-700">
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}