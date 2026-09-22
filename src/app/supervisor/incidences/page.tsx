"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Incidence = {
  id: string;
  employee_id: string;
  type: string;
  start_date: string | null;
  end_date: string | null;
  reason: string | null;
  file_url: string | null;
  status: string;
  created_at: string;

  supervisor_status: string;
  supervisor_reviewed_by: string | null;
  supervisor_reviewed_at: string | null;
  supervisor_comment: string | null;

  rh_status: string;

  profiles: {
    name: string;
    email: string;
  } | null;
};

type Filter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const labels: Record<string, string> = {
  VACATION: "Vacaciones",
  PERMISSION: "Permiso",
  MEDICAL: "Incapacidad",
};

function formatDate(date: string | null) {
  if (!date) return "—";

  return new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string | null) {
  if (!date) return "—";

  return new Date(date).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupervisorIncidencesPage() {
  const [incidences, setIncidences] = useState<Incidence[]>([]);
  const [accountNames, setAccountNames] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("PENDING");

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [comments, setComments] = useState<Record<string, string>>({});

  const loadIncidences = async () => {
    setLoading(true);
    setMessage("");

    try {
      /*
       * 1. Identificar al supervisor autenticado
       */

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "No fue posible identificar al supervisor que inició sesión."
        );
      }

      /*
       * 2. Buscar las cuentas asignadas al supervisor
       */

      const { data: supervisorAccounts, error: accountsError } =
        await supabase
          .from("account_supervisors")
          .select(`
            account_id,
            accounts:account_id (
              name
            )
          `)
          .eq("supervisor_id", user.id)
          .eq("active", true);

      if (accountsError) {
        throw accountsError;
      }

      const accountIds = (supervisorAccounts || []).map(
        (item: any) => item.account_id
      );

      const names = (supervisorAccounts || [])
        .map((item: any) => {
          const account = Array.isArray(item.accounts)
            ? item.accounts[0]
            : item.accounts;

          return account?.name || null;
        })
        .filter(Boolean);

      setAccountNames(names);

      if (accountIds.length === 0) {
        setIncidences([]);
        setMessage(
          "No tienes cuentas asignadas para supervisar incidencias."
        );
        setLoading(false);
        return;
      }

      /*
       * 3. Buscar empleados de las cuentas asignadas
       */

      const { data: accountEmployees, error: employeesError } =
        await supabase
          .from("account_employees")
          .select("employee_id")
          .in("account_id", accountIds)
          .eq("active", true);

      if (employeesError) {
        throw employeesError;
      }

      const employeeIds = Array.from(
        new Set(
          (accountEmployees || []).map(
            (item: any) => item.employee_id
          )
        )
      );

      if (employeeIds.length === 0) {
        setIncidences([]);
        setLoading(false);
        return;
      }

      /*
       * 4. Cargar incidencias
       *
       * RLS también protege esta consulta.
       */

      const { data, error } = await supabase
        .from("incidence_requests")
        .select(`
          id,
          employee_id,
          type,
          start_date,
          end_date,
          reason,
          file_url,
          status,
          created_at,
          supervisor_status,
          supervisor_reviewed_by,
          supervisor_reviewed_at,
          supervisor_comment,
          rh_status,
          profiles:employee_id (
            name,
            email
          )
        `)
        .in("employee_id", employeeIds)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const normalized = (data || []).map((item: any) => ({
        ...item,

        supervisor_status:
          item.supervisor_status || "PENDING",

        rh_status:
          item.rh_status || "PENDING",

        profiles: Array.isArray(item.profiles)
          ? item.profiles[0] || null
          : item.profiles,
      })) as Incidence[];

      setIncidences(normalized);
    } catch (error: any) {
      console.error("Error al cargar incidencias:", error);

      setMessage(
        `Error al cargar incidencias: ${
          error.message || "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidences();
  }, []);

  /*
   * RESUMEN
   */

  const counts = useMemo(() => {
    return {
      total: incidences.length,

      pending: incidences.filter(
        (item) =>
          item.supervisor_status === "PENDING" &&
          item.status !== "REJECTED"
      ).length,

      approved: incidences.filter(
        (item) =>
          item.supervisor_status === "APPROVED"
      ).length,

      rejected: incidences.filter(
        (item) =>
          item.supervisor_status === "REJECTED"
      ).length,
    };
  }, [incidences]);

  /*
   * FILTROS
   */

  const filteredIncidences = useMemo(() => {
    if (filter === "ALL") {
      return incidences;
    }

    if (filter === "PENDING") {
      return incidences.filter(
        (item) =>
          item.supervisor_status === "PENDING" &&
          item.status !== "REJECTED"
      );
    }

    if (filter === "APPROVED") {
      return incidences.filter(
        (item) =>
          item.supervisor_status === "APPROVED"
      );
    }

    return incidences.filter(
      (item) =>
        item.supervisor_status === "REJECTED"
    );
  }, [incidences, filter]);

  /*
   * VALIDAR / RECHAZAR
   */

  const updateSupervisorStatus = async (
    incidence: Incidence,
    status: "APPROVED" | "REJECTED"
  ) => {
    setProcessingId(incidence.id);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "No fue posible identificar al supervisor."
        );
      }

      /*
       * Seguridad adicional desde la interfaz:
       * solo permitimos actuar si sigue pendiente.
       */

      if (incidence.supervisor_status !== "PENDING") {
        throw new Error(
          "Esta incidencia ya fue revisada."
        );
      }

      const comment =
        comments[incidence.id]?.trim() || null;

      const { error } = await supabase
        .from("incidence_requests")
        .update({
          supervisor_status: status,
          supervisor_reviewed_by: user.id,
          supervisor_reviewed_at:
            new Date().toISOString(),
          supervisor_comment: comment,
        })
        .eq("id", incidence.id)
        .eq("supervisor_status", "PENDING");

      if (error) {
        throw error;
      }

      if (status === "APPROVED") {
        setMessage(
          "Incidencia validada. Ahora queda pendiente de autorización por RH."
        );
      } else {
        setMessage(
          "La incidencia fue rechazada por Supervisión."
        );
      }

      setExpandedId(null);

      setComments((previous) => ({
        ...previous,
        [incidence.id]: "",
      }));

      await loadIncidences();
    } catch (error: any) {
      console.error(
        "Error al actualizar incidencia:",
        error
      );

      setMessage(
        `Error al actualizar incidencia: ${
          error.message || "Error desconocido"
        }`
      );
    } finally {
      setProcessingId(null);
    }
  };

  /*
   * ESTILO DE ESTADOS
   */

  const supervisorBadge = (status: string) => {
    if (status === "APPROVED") {
      return {
        text: "Validada",
        style:
          "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }

    if (status === "REJECTED") {
      return {
        text: "Rechazada",
        style:
          "bg-red-50 text-red-700 border-red-200",
      };
    }

    return {
      text: "Pendiente",
      style:
        "bg-amber-50 text-amber-700 border-amber-200",
    };
  };

  return (
    <main className="min-h-screen bg-neutral-100">
      <section className="px-6 py-6 xl:px-8 max-w-[1500px] mx-auto">

        {/* ENCABEZADO */}

        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">

          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400 uppercase">
              Supervisión
            </p>

            <h1 className="text-2xl xl:text-3xl font-bold text-neutral-900 mt-1">
              Incidencias
            </h1>

            <p className="text-sm text-neutral-500 mt-1">
              Validación de vacaciones, permisos e incapacidades.
            </p>

            {accountNames.length > 0 && (
              <p className="text-xs text-neutral-400 mt-2">
                {accountNames.join(" · ")}
              </p>
            )}
          </div>

          <div className="flex gap-2">

            <button
              onClick={() =>
                window.location.href =
                  "/supervisor/villarreal"
              }
              className="h-10 px-4 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-semibold"
            >
              Volver al dashboard
            </button>

            <button
              onClick={loadIncidences}
              disabled={loading}
              className="h-10 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-semibold"
            >
              Actualizar
            </button>

          </div>
        </div>

        {/* MENSAJES */}

        {message && (
          <div className="mb-5 px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-700">
            {message}
          </div>
        )}

        {/* INDICADORES */}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">

          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">
              Total
            </p>

            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {loading ? "—" : counts.total}
            </p>
          </div>

          <div className="bg-white border border-amber-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-amber-700">
              Pendientes
            </p>

            <p className="text-2xl font-bold text-amber-700 mt-1">
              {loading ? "—" : counts.pending}
            </p>
          </div>

          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-emerald-700">
              Validadas
            </p>

            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {loading ? "—" : counts.approved}
            </p>
          </div>

          <div className="bg-white border border-red-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-red-700">
              Rechazadas
            </p>

            <p className="text-2xl font-bold text-red-700 mt-1">
              {loading ? "—" : counts.rejected}
            </p>
          </div>

        </div>

        {/* FILTROS */}

        <div className="bg-white border border-neutral-200 rounded-xl mb-4 p-2 flex flex-wrap gap-2">

          {[
            {
              value: "PENDING",
              label: "Pendientes",
              count: counts.pending,
            },
            {
              value: "APPROVED",
              label: "Validadas",
              count: counts.approved,
            },
            {
              value: "REJECTED",
              label: "Rechazadas",
              count: counts.rejected,
            },
            {
              value: "ALL",
              label: "Todas",
              count: counts.total,
            },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() =>
                setFilter(item.value as Filter)
              }
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                filter === item.value
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {item.label} · {item.count}
            </button>
          ))}

        </div>

        {/* TABLA */}

        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">

          <div className="hidden xl:grid grid-cols-[1.4fr_150px_210px_180px_42px] gap-4 px-4 py-2.5 bg-neutral-50 border-b border-neutral-100 text-[11px] font-bold tracking-wide text-neutral-400 uppercase">

            <span>Promotor</span>
            <span>Tipo</span>
            <span>Periodo</span>
            <span>Estado</span>
            <span />

          </div>

          {loading ? (
            <div className="px-4 py-10 text-sm text-neutral-500">
              Cargando incidencias...
            </div>
          ) : filteredIncidences.length === 0 ? (
            <div className="px-4 py-10 text-sm text-neutral-500">
              No hay incidencias en este filtro.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">

              {filteredIncidences.map((incidence) => {
                const isOpen =
                  expandedId === incidence.id;

                const badge = supervisorBadge(
                  incidence.supervisor_status
                );

                const canReview =
                  incidence.supervisor_status ===
                    "PENDING" &&
                  incidence.status !== "REJECTED";

                return (
                  <div key={incidence.id}>

                    {/* FILA */}

                    <button
                      onClick={() =>
                        setExpandedId(
                          isOpen ? null : incidence.id
                        )
                      }
                      className="w-full grid grid-cols-1 xl:grid-cols-[1.4fr_150px_210px_180px_42px] gap-2 xl:gap-4 items-center px-4 py-3 text-left hover:bg-neutral-50 transition"
                    >

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">
                          {incidence.profiles?.name ||
                            "Sin nombre"}
                        </p>

                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          {incidence.profiles?.email ||
                            ""}
                        </p>
                      </div>

                      <p className="text-sm text-neutral-700">
                        {labels[incidence.type] ||
                          incidence.type}
                      </p>

                      <p className="text-sm text-neutral-600">
                        {formatDate(
                          incidence.start_date
                        )}

                        {incidence.end_date &&
                        incidence.end_date !==
                          incidence.start_date
                          ? ` — ${formatDate(
                              incidence.end_date
                            )}`
                          : ""}
                      </p>

                      <span
                        className={`w-fit inline-flex border px-2.5 py-1 rounded-full text-xs font-semibold ${badge.style}`}
                      >
                        {badge.text}
                      </span>

                      <span className="text-neutral-400 text-lg">
                        {isOpen ? "−" : "+"}
                      </span>

                    </button>

                    {/* DETALLE */}

                    {isOpen && (
                      <div className="bg-neutral-50 border-t border-neutral-100 px-4 py-4">

                        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">

                          {/* INFORMACIÓN */}

                          <div className="space-y-3">

                            <div className="bg-white border border-neutral-200 rounded-xl p-4">

                              <p className="text-xs font-bold text-neutral-400 uppercase">
                                Motivo
                              </p>

                              <p className="text-sm text-neutral-700 mt-2 whitespace-pre-wrap">
                                {incidence.reason ||
                                  "Sin motivo registrado"}
                              </p>

                              <div className="mt-4 pt-4 border-t border-neutral-100">

                                <p className="text-xs text-neutral-400">
                                  Solicitud registrada
                                </p>

                                <p className="text-sm text-neutral-700 mt-1">
                                  {formatDateTime(
                                    incidence.created_at
                                  )}
                                </p>

                              </div>

                              {incidence.file_url && (
                                <a
                                  href={
                                    incidence.file_url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex mt-4 px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold"
                                >
                                  Ver archivo adjunto
                                </a>
                              )}

                            </div>

                            {/* REVISIÓN YA REALIZADA */}

                            {incidence.supervisor_status !==
                              "PENDING" && (
                              <div className="bg-white border border-neutral-200 rounded-xl p-4">

                                <p className="text-xs font-bold text-neutral-400 uppercase">
                                  Revisión de Supervisión
                                </p>

                                <p className="text-sm font-semibold text-neutral-800 mt-2">
                                  {incidence.supervisor_status ===
                                  "APPROVED"
                                    ? "Validada"
                                    : "Rechazada"}
                                </p>

                                <p className="text-xs text-neutral-400 mt-1">
                                  {formatDateTime(
                                    incidence.supervisor_reviewed_at
                                  )}
                                </p>

                                {incidence.supervisor_comment && (
                                  <div className="mt-3 p-3 bg-neutral-50 rounded-lg">

                                    <p className="text-xs text-neutral-400">
                                      Comentario
                                    </p>

                                    <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">
                                      {
                                        incidence.supervisor_comment
                                      }
                                    </p>

                                  </div>
                                )}

                              </div>
                            )}

                          </div>

                          {/* ACCIONES */}

                          <div>

                            {canReview ? (
                              <div className="bg-white border border-neutral-200 rounded-xl p-4">

                                <p className="text-sm font-bold text-neutral-900">
                                  Validación de Supervisor
                                </p>

                                <p className="text-xs text-neutral-500 mt-1">
                                  Revisa la solicitud antes de
                                  enviarla a Recursos Humanos.
                                </p>

                                <textarea
                                  value={
                                    comments[
                                      incidence.id
                                    ] || ""
                                  }
                                  onChange={(event) =>
                                    setComments(
                                      (previous) => ({
                                        ...previous,
                                        [incidence.id]:
                                          event.target
                                            .value,
                                      })
                                    )
                                  }
                                  placeholder="Comentario opcional"
                                  rows={4}
                                  className="w-full mt-4 px-3 py-2 border border-neutral-200 rounded-lg text-sm outline-none focus:border-neutral-400 resize-none"
                                />

                                <div className="grid grid-cols-2 gap-2 mt-3">

                                  <button
                                    onClick={() =>
                                      updateSupervisorStatus(
                                        incidence,
                                        "APPROVED"
                                      )
                                    }
                                    disabled={
                                      processingId ===
                                      incidence.id
                                    }
                                    className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold"
                                  >
                                    {processingId ===
                                    incidence.id
                                      ? "Procesando..."
                                      : "Validar"}
                                  </button>

                                  <button
                                    onClick={() =>
                                      updateSupervisorStatus(
                                        incidence,
                                        "REJECTED"
                                      )
                                    }
                                    disabled={
                                      processingId ===
                                      incidence.id
                                    }
                                    className="h-10 rounded-lg border border-red-200 bg-white hover:bg-red-50 disabled:opacity-50 text-red-600 text-sm font-semibold"
                                  >
                                    Rechazar
                                  </button>

                                </div>

                                <p className="text-[11px] text-neutral-400 mt-3">
                                  Al validar, la solicitud
                                  continuará pendiente de
                                  autorización por RH.
                                </p>

                              </div>
                            ) : (
                              <div className="bg-white border border-neutral-200 rounded-xl p-4">

                                <p className="text-sm font-semibold text-neutral-800">
                                  Revisión completada
                                </p>

                                <p className="text-xs text-neutral-500 mt-1">
                                  Esta solicitud ya fue revisada
                                  por Supervisión.
                                </p>

                                {incidence.supervisor_status ===
                                  "APPROVED" &&
                                  incidence.rh_status ===
                                    "PENDING" && (
                                    <div className="mt-4 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">

                                      <p className="text-xs font-semibold text-blue-700">
                                        Pendiente de autorización
                                        por RH
                                      </p>

                                    </div>
                                  )}

                                {incidence.rh_status ===
                                  "APPROVED" && (
                                  <div className="mt-4 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">

                                    <p className="text-xs font-semibold text-emerald-700">
                                      Autorizada por RH
                                    </p>

                                  </div>
                                )}

                              </div>
                            )}

                          </div>

                        </div>

                      </div>
                    )}

                  </div>
                );
              })}

            </div>
          )}

        </div>

      </section>
    </main>
  );
}