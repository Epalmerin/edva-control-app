"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
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
  rh_reviewed_by: string | null;
  rh_reviewed_at: string | null;
  rh_comment: string | null;

  profiles: {
    name: string;
    email: string;
  } | null;
};

type Filter =
  | "ALL"
  | "SUPERVISOR_PENDING"
  | "RH_PENDING"
  | "APPROVED"
  | "REJECTED";

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

function finalStatus(incidence: Incidence) {
  if (
    incidence.status === "REJECTED" ||
    incidence.supervisor_status === "REJECTED" ||
    incidence.rh_status === "REJECTED"
  ) {
    return "REJECTED";
  }

  if (
    incidence.status === "APPROVED" ||
    (incidence.supervisor_status === "APPROVED" &&
      incidence.rh_status === "APPROVED")
  ) {
    return "APPROVED";
  }

  if (incidence.supervisor_status === "APPROVED") {
    return "RH_PENDING";
  }

  return "SUPERVISOR_PENDING";
}

export default function RhIncidencesPage() {
  const [incidences, setIncidences] = useState<Incidence[]>([]);
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
const [accounts, setAccounts] = useState<
    { id: string; name: string }[]
  >([]);

  const [selectedAccount, setSelectedAccount] = useState("ALL");
  const [accountEmployeeIds, setAccountEmployeeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("RH_PENDING");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const loadAccounts = async () => {
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error al cargar cuentas:", error);
      return;
    }

    setAccounts(data || []);
  };

  const loadAccountEmployees = async (accountId: string) => {
    if (accountId === "ALL") {
      setAccountEmployeeIds([]);
      return;
    }

    const { data, error } = await supabase
      .from("account_employees")
      .select("employee_id")
      .eq("account_id", accountId)
      .eq("active", true);

    if (error) {
      console.error("Error al cargar empleados de la cuenta:", error);
      setAccountEmployeeIds([]);
      return;
    }

    setAccountEmployeeIds((data || []).map((item) => item.employee_id));
  };

  const loadIncidences = async () => {
    setLoading(true);
    setMessage("");

    try {
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
          rh_reviewed_by,
          rh_reviewed_at,
          rh_comment,

          profiles:employee_id (
            name,
            email
          )
        `)
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

      /*
       * Cargamos los nombres de las personas que
       * realizaron las revisiones.
       */

      const reviewerIds = Array.from(
        new Set(
          normalized
            .flatMap((item) => [
              item.supervisor_reviewed_by,
              item.rh_reviewed_by,
            ])
            .filter(Boolean) as string[]
        )
      );

      if (reviewerIds.length === 0) {
        setReviewers({});
        return;
      }

      const { data: reviewerData, error: reviewerError } =
        await supabase
          .from("profiles")
          .select("id, name")
          .in("id", reviewerIds);

      if (reviewerError) {
        throw reviewerError;
      }

      const reviewerMap: Record<string, string> = {};

      (reviewerData || []).forEach((reviewer: any) => {
        reviewerMap[reviewer.id] = reviewer.name;
      });

      setReviewers(reviewerMap);
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
    loadAccounts();
    loadIncidences();
  }, []);

  useEffect(() => {
    loadAccountEmployees(selectedAccount);
  }, [selectedAccount]);

  const accountIncidences = useMemo(() => {
    if (selectedAccount === "ALL") {
      return incidences;
    }

    return incidences.filter((item) =>
      accountEmployeeIds.includes(item.employee_id)
    );
  }, [incidences, selectedAccount, accountEmployeeIds]);

  /*
   * CONTADORES
   */

  const counts = useMemo(() => {
    return {
      total: accountIncidences.length,

      supervisorPending: accountIncidences.filter(
        (item) =>
          finalStatus(item) === "SUPERVISOR_PENDING"
      ).length,

      rhPending: accountIncidences.filter(
        (item) =>
          finalStatus(item) === "RH_PENDING"
      ).length,

      approved: accountIncidences.filter(
        (item) =>
          finalStatus(item) === "APPROVED"
      ).length,

      rejected: accountIncidences.filter(
        (item) =>
          finalStatus(item) === "REJECTED"
      ).length,
    };
  }, [accountIncidences]);

  /*
   * FILTRO
   */

  const filteredIncidences = useMemo(() => {
    if (filter === "ALL") {
      return accountIncidences;
    }

    return accountIncidences.filter(
      (item) => finalStatus(item) === filter
    );
  }, [accountIncidences, filter]);

  /*
   * AUTORIZACIÓN RH
   */

  const updateRhStatus = async (
    incidence: Incidence,
    status: "APPROVED" | "REJECTED"
  ) => {
    setProcessingId(incidence.id);
    setMessage("");

    try {
      /*
       * No permitimos saltar la validación
       * del supervisor.
       */

      if (incidence.supervisor_status !== "APPROVED") {
        throw new Error(
          "La incidencia todavía no ha sido validada por Supervisión."
        );
      }

      if (incidence.rh_status !== "PENDING") {
        throw new Error(
          "Esta incidencia ya fue revisada por Recursos Humanos."
        );
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "No fue posible identificar al usuario de Recursos Humanos."
        );
      }

      const comment =
        comments[incidence.id]?.trim() || null;

      const { error } = await supabase
        .from("incidence_requests")
        .update({
          rh_status: status,
          rh_reviewed_by: user.id,
          rh_reviewed_at: new Date().toISOString(),
          rh_comment: comment,
        })
        .eq("id", incidence.id)
        .eq("rh_status", "PENDING")
        .eq("supervisor_status", "APPROVED");

      if (error) {
        throw error;
      }

      setMessage(
        status === "APPROVED"
          ? "Incidencia autorizada correctamente."
          : "Incidencia rechazada por Recursos Humanos."
      );

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

  const getSupervisorBadge = (incidence: Incidence) => {
    if (incidence.supervisor_status === "APPROVED") {
      return {
        text: "Validada",
        style:
          "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }

    if (incidence.supervisor_status === "REJECTED") {
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

  const getRhBadge = (incidence: Incidence) => {
    const state = finalStatus(incidence);

    if (state === "APPROVED") {
      return {
        text: "Autorizada",
        style:
          "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }

    if (state === "REJECTED") {
      return {
        text: "Rechazada",
        style:
          "bg-red-50 text-red-700 border-red-200",
      };
    }

    if (state === "RH_PENDING") {
      return {
        text: "Pendiente RH",
        style:
          "bg-blue-50 text-blue-700 border-blue-200",
      };
    }

    return {
      text: "Espera supervisor",
      style:
        "bg-neutral-100 text-neutral-600 border-neutral-200",
    };
  };

  const filterButtons: {
    value: Filter;
    label: string;
    count: number;
  }[] = [
    {
      value: "RH_PENDING",
      label: "Pendientes RH",
      count: counts.rhPending,
    },
    {
      value: "SUPERVISOR_PENDING",
      label: "Pend. supervisor",
      count: counts.supervisorPending,
    },
    {
      value: "APPROVED",
      label: "Autorizadas",
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
  ];

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Recursos Humanos" role="RH" />

      <section className="flex-1 min-w-0 px-6 py-6 xl:px-8">

        {/* ENCABEZADO */}

        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">

          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400 uppercase">
              Recursos Humanos
            </p>

            <h1 className="text-2xl xl:text-3xl font-bold text-neutral-900 mt-1">
              Incidencias
            </h1>

            <p className="text-sm text-neutral-500 mt-1">
              Autorización de vacaciones, permisos e incapacidades.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedAccount}
              onChange={(event) => setSelectedAccount(event.target.value)}
              className="h-10 min-w-[250px] px-3 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-sm font-semibold outline-none focus:border-neutral-500"
            >
              <option value="ALL">Todas las cuentas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                window.location.href = "/rh"
              }
              className="h-10 px-4 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-semibold"
            >
              Volver
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

        {/* MENSAJE */}

        {message && (
          <div className="mb-4 px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-700">
            {message}
          </div>
        )}

        {/* INDICADORES */}

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">

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
              Pend. supervisor
            </p>

            <p className="text-2xl font-bold text-amber-700 mt-1">
              {loading
                ? "—"
                : counts.supervisorPending}
            </p>
          </div>

          <div className="bg-white border border-blue-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-blue-700">
              Pendientes RH
            </p>

            <p className="text-2xl font-bold text-blue-700 mt-1">
              {loading ? "—" : counts.rhPending}
            </p>
          </div>

          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-emerald-700">
              Autorizadas
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

          {filterButtons.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
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

          <div className="hidden xl:grid grid-cols-[1.3fr_140px_190px_170px_170px_42px] gap-4 px-4 py-2.5 bg-neutral-50 border-b border-neutral-100 text-[11px] font-bold tracking-wide text-neutral-400 uppercase">

            <span>Promotor</span>
            <span>Tipo</span>
            <span>Periodo</span>
            <span>Supervisor</span>
            <span>RH</span>
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

                const supervisorBadge =
                  getSupervisorBadge(incidence);

                const rhBadge =
                  getRhBadge(incidence);

                const canReview =
                  incidence.supervisor_status ===
                    "APPROVED" &&
                  incidence.rh_status === "PENDING" &&
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
                      className="w-full grid grid-cols-1 xl:grid-cols-[1.3fr_140px_190px_170px_170px_42px] gap-2 xl:gap-4 items-center px-4 py-3 text-left hover:bg-neutral-50 transition"
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
                        className={`w-fit inline-flex border px-2.5 py-1 rounded-full text-xs font-semibold ${supervisorBadge.style}`}
                      >
                        {supervisorBadge.text}
                      </span>

                      <span
                        className={`w-fit inline-flex border px-2.5 py-1 rounded-full text-xs font-semibold ${rhBadge.style}`}
                      >
                        {rhBadge.text}
                      </span>

                      <span className="text-neutral-400 text-lg">
                        {isOpen ? "−" : "+"}
                      </span>

                    </button>

                    {/* DETALLE */}

                    {isOpen && (
                      <div className="bg-neutral-50 border-t border-neutral-100 px-4 py-4">

                        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">

                          {/* HISTORIAL */}

                          <div className="space-y-3">

                            <div className="bg-white border border-neutral-200 rounded-xl p-4">

                              <p className="text-xs font-bold text-neutral-400 uppercase">
                                Motivo
                              </p>

                              <p className="text-sm text-neutral-700 mt-2 whitespace-pre-wrap">
                                {incidence.reason ||
                                  "Sin motivo registrado"}
                              </p>

                              <p className="text-xs text-neutral-400 mt-4">
                                Solicitud registrada
                              </p>

                              <p className="text-sm text-neutral-700 mt-1">
                                {formatDateTime(
                                  incidence.created_at
                                )}
                              </p>

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

                            {/* SUPERVISIÓN */}

                            <div className="bg-white border border-neutral-200 rounded-xl p-4">

                              <p className="text-xs font-bold text-neutral-400 uppercase">
                                Supervisión
                              </p>

                              <p className="text-sm font-semibold text-neutral-800 mt-2">
                                {incidence.supervisor_status ===
                                "APPROVED"
                                  ? "Validada"
                                  : incidence.supervisor_status ===
                                    "REJECTED"
                                  ? "Rechazada"
                                  : "Pendiente"}
                              </p>

                              {incidence.supervisor_reviewed_by && (
                                <p className="text-xs text-neutral-500 mt-2">
                                  Por{" "}
                                  {reviewers[
                                    incidence
                                      .supervisor_reviewed_by
                                  ] || "Usuario"}
                                </p>
                              )}

                              {incidence.supervisor_reviewed_at && (
                                <p className="text-xs text-neutral-400 mt-1">
                                  {formatDateTime(
                                    incidence
                                      .supervisor_reviewed_at
                                  )}
                                </p>
                              )}

                              {incidence.supervisor_comment && (
                                <div className="mt-3 p-3 bg-neutral-50 rounded-lg">

                                  <p className="text-xs text-neutral-400">
                                    Comentario
                                  </p>

                                  <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">
                                    {
                                      incidence
                                        .supervisor_comment
                                    }
                                  </p>

                                </div>
                              )}

                            </div>

                            {/* RH YA REVISADO */}

                            {incidence.rh_status !==
                              "PENDING" && (
                              <div className="bg-white border border-neutral-200 rounded-xl p-4">

                                <p className="text-xs font-bold text-neutral-400 uppercase">
                                  Recursos Humanos
                                </p>

                                <p className="text-sm font-semibold text-neutral-800 mt-2">
                                  {incidence.rh_status ===
                                  "APPROVED"
                                    ? "Autorizada"
                                    : "Rechazada"}
                                </p>

                                {incidence.rh_reviewed_by && (
                                  <p className="text-xs text-neutral-500 mt-2">
                                    Por{" "}
                                    {reviewers[
                                      incidence
                                        .rh_reviewed_by
                                    ] || "Usuario"}
                                  </p>
                                )}

                                {incidence.rh_reviewed_at && (
                                  <p className="text-xs text-neutral-400 mt-1">
                                    {formatDateTime(
                                      incidence
                                        .rh_reviewed_at
                                    )}
                                  </p>
                                )}

                                {incidence.rh_comment && (
                                  <div className="mt-3 p-3 bg-neutral-50 rounded-lg">

                                    <p className="text-xs text-neutral-400">
                                      Comentario
                                    </p>

                                    <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">
                                      {
                                        incidence
                                          .rh_comment
                                      }
                                    </p>

                                  </div>
                                )}

                              </div>
                            )}

                          </div>

                          {/* ACCIONES RH */}

                          <div>

                            {canReview ? (
                              <div className="bg-white border border-blue-200 rounded-xl p-4">

                                <p className="text-sm font-bold text-neutral-900">
                                  Autorización de RH
                                </p>

                                <p className="text-xs text-neutral-500 mt-1">
                                  Supervisión ya validó esta
                                  solicitud. Revisa la información
                                  antes de autorizarla.
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
                                      updateRhStatus(
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
                                      : "Autorizar"}
                                  </button>

                                  <button
                                    onClick={() =>
                                      updateRhStatus(
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

                              </div>
                            ) : (
                              <div className="bg-white border border-neutral-200 rounded-xl p-4">

                                {incidence.supervisor_status ===
                                  "PENDING" && (
                                  <>
                                    <p className="text-sm font-semibold text-neutral-800">
                                      Pendiente de Supervisión
                                    </p>

                                    <p className="text-xs text-neutral-500 mt-1">
                                      RH podrá autorizar esta
                                      solicitud cuando el supervisor
                                      termine su validación.
                                    </p>
                                  </>
                                )}

                                {incidence.supervisor_status ===
                                  "REJECTED" && (
                                  <>
                                    <p className="text-sm font-semibold text-red-700">
                                      Rechazada por Supervisión
                                    </p>

                                    <p className="text-xs text-neutral-500 mt-1">
                                      Esta solicitud ya no requiere
                                      autorización de RH.
                                    </p>
                                  </>
                                )}

                                {incidence.rh_status ===
                                  "APPROVED" && (
                                  <>
                                    <p className="text-sm font-semibold text-emerald-700">
                                      Incidencia autorizada
                                    </p>

                                    <p className="text-xs text-neutral-500 mt-1">
                                      El proceso de autorización está
                                      completo.
                                    </p>
                                  </>
                                )}

                                {incidence.rh_status ===
                                  "REJECTED" && (
                                  <>
                                    <p className="text-sm font-semibold text-red-700">
                                      Rechazada por RH
                                    </p>

                                    <p className="text-xs text-neutral-500 mt-1">
                                      El proceso de esta solicitud
                                      está finalizado.
                                    </p>
                                  </>
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