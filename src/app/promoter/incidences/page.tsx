"use client";

import { storedFileReference } from "@/lib/storage-files";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type IncidenceHistory = {
  id: string;
  type: string;
  start_date: string;
  end_date: string | null;
  reason: string | null;
  status: string | null;
  supervisor_status: string | null;
  supervisor_reviewed_at: string | null;
  supervisor_comment: string | null;
  rh_status: string | null;
  rh_reviewed_at: string | null;
  rh_comment: string | null;
  reviewed_at: string | null;
  created_at: string | null;
};

function finalStatus(item: IncidenceHistory) {
  if ([item.status, item.supervisor_status, item.rh_status].includes("REJECTED"))
    return "REJECTED";
  if (item.status === "APPROVED" ||
      (item.supervisor_status === "APPROVED" && item.rh_status === "APPROVED"))
    return "APPROVED";
  if (item.supervisor_status === "APPROVED") return "RH_PENDING";
  return "SUPERVISOR_PENDING";
}

const stateLabels = {
  APPROVED: "Autorizada",
  REJECTED: "Rechazada",
  RH_PENDING: "Pendiente de RH",
  SUPERVISOR_PENDING: "Pendiente de supervisor",
};

const stateStyles = {
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  RH_PENDING: "bg-blue-100 text-blue-800",
  SUPERVISOR_PENDING: "bg-amber-100 text-amber-800",
};

function typeLabel(type: string) {
  switch (type) {
    case "VACATION": return "Vacaciones";
    case "PERMISSION": return "Permiso";
    case "MEDICAL": return "Incapacidad";
    default: return type;
  }
}

function dateLabel(value: string | null, dateOnly = false) {
  if (!value) return "—";
  const date = new Date(dateOnly ? value + "T00:00:00Z" : value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  });
}

function reviewLabel(status: string | null, blocked = false) {
  if (status === "APPROVED") return "Validada";
  if (status === "REJECTED") return "Rechazada";
  if (blocked) return "No requiere revisión";
  return "Pendiente";
}

export default function PromoterIncidencesPage() {
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<IncidenceHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const historyRequest = useRef(0);

  const loadHistory = useCallback(async () => {
    const request = ++historyRequest.current;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("No se encontró una sesión activa.");
      const { data, error } = await supabase
        .from("incidence_requests")
        .select("id,type,start_date,end_date,reason,status,supervisor_status,supervisor_reviewed_at,supervisor_comment,rh_status,rh_reviewed_at,rh_comment,reviewed_at,created_at")
        .eq("employee_id", auth.user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error("No se pudo consultar el historial. Intenta nuevamente.");
      if (request === historyRequest.current) setHistory(data || []);
    } catch (error) {
      if (request === historyRequest.current) {
        setHistory([]);
        setHistoryError(error instanceof Error ? error.message : "No se pudo consultar el historial.");
      }
    } finally {
      if (request === historyRequest.current) setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    return () => { historyRequest.current += 1; };
  }, [loadHistory]);

  const visibleHistory = history.filter((item) => {
    const status = finalStatus(item);
    if (filter === "ALL") return true;
    if (filter === "PENDING") return status === "RH_PENDING" || status === "SUPERVISOR_PENDING";
    return status === filter;
  });

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
      if (file.size > 20 * 1024 * 1024) {
        setMessage("El archivo debe pesar como maximo 20 MB.");
        setLoading(false);
        return;
      }
      const fileExt = (file.name.split(".").pop() || "file").replace(/[^a-z0-9]/gi, "").slice(0, 12) || "file";
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("incidence-files")
        .upload(filePath, file, { cacheControl: "0" });

      if (uploadError) {
        setMessage(`Error al subir archivo: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      fileUrl = storedFileReference("incidence-files", filePath);
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
    setFilter("ALL");
    void loadHistory();
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-3 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-4xl font-bold text-neutral-800">
          Incidencias
        </h1>

        <p className="text-neutral-500 mt-2 mb-8">
          Solicita vacaciones, permisos o incapacidades y consulta el estado de tus solicitudes.
        </p>

        <div className="bg-white rounded-2xl shadow-md p-3 sm:p-6 min-w-0">
          <form onSubmit={handleSaveIncidence} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-neutral-700">
                Tipo de incidencia
              </label>
              <select
                className="w-full min-w-0 max-w-full mt-1 px-3 sm:px-4 py-3 border rounded-xl"
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
                className="w-full min-w-0 max-w-full mt-1 px-3 sm:px-4 py-3 border rounded-xl"
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
                className="w-full min-w-0 max-w-full mt-1 px-3 sm:px-4 py-3 border rounded-xl"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Motivo
              </label>
              <textarea
                className="w-full min-w-0 max-w-full mt-1 px-3 sm:px-4 py-3 border rounded-xl"
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
                  className="w-full min-w-0 max-w-full mt-1 px-3 sm:px-4 py-3 border rounded-xl"
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
                  className="w-full min-w-0 max-w-full mt-1 px-3 sm:px-4 py-3 border rounded-xl"
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

        <section className="mt-8 bg-white rounded-2xl shadow-md p-4 sm:p-6" aria-labelledby="history-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="history-heading" className="text-2xl font-bold text-neutral-800">Mis incidencias</h2>
              <p className="text-sm text-neutral-500 mt-1">Consulta las autorizaciones de tu supervisor y Recursos Humanos.</p>
            </div>
            <button type="button" onClick={() => void loadHistory()} disabled={historyLoading}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-60">
              {historyLoading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {!historyLoading && !historyError && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
              {([
                { label: "Todas", value: "ALL", count: history.length },
                { label: "Pendientes", value: "PENDING", count: history.filter((i) => ["RH_PENDING", "SUPERVISOR_PENDING"].includes(finalStatus(i))).length },
                { label: "Autorizadas", value: "APPROVED", count: history.filter((i) => finalStatus(i) === "APPROVED").length },
                { label: "Rechazadas", value: "REJECTED", count: history.filter((i) => finalStatus(i) === "REJECTED").length },
              ] as const).map((option) => (
                <button key={option.value} type="button" aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={`rounded-xl border p-3 text-left ${filter === option.value ? "border-red-500 bg-red-50" : "border-neutral-200 bg-neutral-50"}`}>
                  <span className="block text-xs font-medium text-neutral-600">{option.label}</span>
                  <span className="block text-xl font-bold text-neutral-800">{option.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 space-y-4" aria-live="polite" aria-busy={historyLoading}>
            {historyLoading ? (
              <p className="text-sm text-neutral-500">Cargando tus solicitudes...</p>
            ) : historyError ? (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{historyError}</p>
            ) : visibleHistory.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
                {history.length === 0 ? "Aún no tienes incidencias registradas." : "No hay solicitudes con este estado."}
              </p>
            ) : visibleHistory.map((item) => {
              const state = finalStatus(item);
              const rejectedBySupervisor = item.supervisor_status === "REJECTED";
              const rejectedByRH = item.rh_status === "REJECTED";
              const resolutionDate = state === "APPROVED"
                ? item.rh_reviewed_at || item.reviewed_at
                : state === "REJECTED"
                  ? (rejectedBySupervisor ? item.supervisor_reviewed_at : rejectedByRH ? item.rh_reviewed_at : null) || item.reviewed_at
                  : null;
              const rejectionComment = rejectedBySupervisor ? item.supervisor_comment : rejectedByRH ? item.rh_comment : null;

              return (
                <article key={item.id} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-neutral-800">{typeLabel(item.type)}</h3>
                      <p className="text-sm text-neutral-600">
                        {dateLabel(item.start_date, true)}
                        {item.end_date && item.end_date !== item.start_date ? " al " + dateLabel(item.end_date, true) : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stateStyles[state]}`}>
                      {stateLabels[state]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">Enviada: {dateLabel(item.created_at)}</p>
                  {item.reason && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-700"><strong>Motivo:</strong> {item.reason}</p>}
                  <div className="mt-4 grid gap-3 border-t border-neutral-100 pt-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-neutral-500">SUPERVISOR</p>
                      <p className="text-sm font-medium text-neutral-800">{reviewLabel(item.supervisor_status)}</p>
                      {item.supervisor_reviewed_at && <p className="text-xs text-neutral-500">{dateLabel(item.supervisor_reviewed_at)}</p>}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-500">RECURSOS HUMANOS</p>
                      <p className="text-sm font-medium text-neutral-800">{item.rh_status === "APPROVED" ? "Autorizada" : reviewLabel(item.rh_status, rejectedBySupervisor)}</p>
                      {item.rh_reviewed_at && <p className="text-xs text-neutral-500">{dateLabel(item.rh_reviewed_at)}</p>}
                    </div>
                  </div>
                  {resolutionDate && <p className="mt-3 text-xs text-neutral-500">Resolución: {dateLabel(resolutionDate)}</p>}
                  {state === "REJECTED" && (
                    <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 break-words">
                      <p className="font-semibold">Motivo de rechazo{rejectedBySupervisor ? " (Supervisor)" : rejectedByRH ? " (RH)" : ""}</p>
                      <p className="whitespace-pre-wrap break-words">{rejectionComment?.trim() || "No se registró un motivo de rechazo."}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}