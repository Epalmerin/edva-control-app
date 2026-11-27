"use client";

import { useMemo, useState } from "react";

type CalendarIncidence = {
  id: string;
  employee_id: string;
  type: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  supervisor_status: string;
  rh_status: string;
  profiles: { name: string } | null;
};

type CalendarState = "APPROVED" | "PENDING" | "REJECTED";
type CalendarFilter = "OPERATIONAL" | "ALL" | CalendarState;

const typeLabels: Record<string, string> = {
  VACATION: "Vacaciones", PERMISSION: "Permiso", MEDICAL: "Incapacidad",
};
const typeStyles: Record<string, string> = {
  VACATION: "bg-emerald-100 text-emerald-800",
  PERMISSION: "bg-blue-100 text-blue-800",
  MEDICAL: "bg-violet-100 text-violet-800",
};
const stateLabels: Record<CalendarState, string> = {
  APPROVED: "Autorizada", PENDING: "Pendiente", REJECTED: "Rechazada",
};
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function stateOf(item: CalendarIncidence): CalendarState {
  if ([item.status, item.supervisor_status, item.rh_status].includes("REJECTED")) return "REJECTED";
  if (item.status === "APPROVED" || (item.supervisor_status === "APPROVED" && item.rh_status === "APPROVED")) return "APPROVED";
  return "PENDING";
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && dateKey(parsed) === value;
}

function rangeOf(item: CalendarIncidence) {
  const start = item.start_date;
  const end = item.end_date || start;
  return validDate(start) && validDate(end) && end >= start ? { start, end } : null;
}

function formatDate(value: string) {
  return new Date(value + "T00:00:00Z").toLocaleDateString("es-MX", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function personName(item: CalendarIncidence) {
  return item.profiles?.name || "Promotor sin nombre";
}

function searchKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function IncidenceCalendar({
  incidences, loading, scopeLabel, unavailable = false,
}: {
  incidences: CalendarIncidence[];
  loading: boolean;
  scopeLabel?: string;
  unavailable?: boolean;
}) {
  const [month, setMonth] = useState(() => todayKey().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(() => todayKey());
  const [status, setStatus] = useState<CalendarFilter>("OPERATIONAL");
  const [type, setType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(true);

  const today = todayKey();
  const monthStart = new Date(month + "-01T00:00:00Z");
  const year = monthStart.getUTCFullYear();
  const monthIndex = monthStart.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const monthTitle = monthStart.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });

  const matching = useMemo(() => incidences.filter((item) => {
    const state = stateOf(item);
    if (status === "OPERATIONAL" && state === "REJECTED") return false;
    if (status !== "OPERATIONAL" && status !== "ALL" && state !== status) return false;
    if (type !== "ALL" && item.type !== type) return false;
    return !search.trim() || searchKey(personName(item)).includes(searchKey(search.trim()));
  }), [incidences, status, type, search]);

  const byDay = useMemo(() => {
    const map: Record<string, CalendarIncidence[]> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const key = month + "-" + String(day).padStart(2, "0");
      map[key] = matching.filter((item) => {
        const range = rangeOf(item);
        return range !== null && key >= range.start && key <= range.end;
      }).sort((a, b) => personName(a).localeCompare(personName(b), "es"));
    }
    return map;
  }, [matching, month, daysInMonth]);

  const selectedItems = byDay[selectedDay] || [];
  const monthItems = new Set(Object.values(byDay).flat().map((item) => item.id)).size;
  const invalidCount = matching.filter((item) => !rangeOf(item)).length;

  function navigate(delta: number) {
    const next = dateKey(new Date(Date.UTC(year, monthIndex + delta, 1)));
    setMonth(next.slice(0, 7));
    setSelectedDay(next);
  }

  function goToday() {
    const key = todayKey();
    setMonth(key.slice(0, 7));
    setSelectedDay(key);
  }

  return (
    <section className="mb-5 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Calendario de incidencias</h2>
          <p className="mt-1 text-xs text-neutral-500">{scopeLabel || "Incidencias de tu ámbito de acceso"} · Planeación de ausencias</p>
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700">
          {open ? "Ocultar calendario" : "Ver calendario"}
        </button>
      </div>
      {open && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigate(-1)} aria-label="Mes anterior" className="rounded-lg border px-3 py-2">‹</button>
              <h3 className="min-w-[130px] text-center font-semibold capitalize text-neutral-800">{monthTitle}</h3>
              <button type="button" onClick={() => navigate(1)} aria-label="Mes siguiente" className="rounded-lg border px-3 py-2">›</button>
              <button type="button" onClick={goToday} className="rounded-lg border px-3 py-2 text-sm">Hoy</button>
            </div>
            {!loading && !unavailable && <p className="text-xs text-neutral-500">{monthItems} solicitudes en el mes</p>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-medium text-neutral-600">Estado
              <select value={status} onChange={(e) => setStatus(e.target.value as CalendarFilter)} className="mt-1 block w-full rounded-lg border border-neutral-300 p-2 text-sm">
                <option value="OPERATIONAL">Autorizadas y pendientes</option>
                <option value="APPROVED">Solo autorizadas</option>
                <option value="PENDING">Solo pendientes</option>
                <option value="REJECTED">Solo rechazadas</option>
                <option value="ALL">Todas</option>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-600">Tipo
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-300 p-2 text-sm">
                <option value="ALL">Todos los tipos</option>
                {Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-600">Promotor
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre" className="mt-1 block w-full rounded-lg border border-neutral-300 p-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {Object.entries(typeLabels).map(([key, label]) => <span key={key} className={"rounded-md px-2 py-1 " + typeStyles[key]}>{label}</span>)}
            <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800">Pendiente · No es ausencia autorizada</span>
            <span className="rounded-md bg-red-100 px-2 py-1 text-red-800">Rechazada</span>
          </div>
          {loading ? <p className="mt-4 text-sm text-neutral-500">Cargando calendario...</p> : unavailable ? (
            <p role="alert" className="mt-4 text-sm text-red-700">No fue posible confirmar los datos del calendario. Actualiza las incidencias.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-7 gap-1" aria-label={"Calendario de " + monthTitle}>
                {weekdays.map((day) => <div key={day} className="py-1 text-center text-xs font-semibold text-neutral-500">{day}</div>)}
                {Array.from({ length: cells }, (_, index) => {
                  const day = index - offset + 1;
                  if (day < 1 || day > daysInMonth) return <div key={"empty-" + index} className="min-h-12 rounded-md bg-neutral-50" />;
                  const key = month + "-" + String(day).padStart(2, "0");
                  const items = byDay[key] || [];
                  const approved = items.filter((item) => stateOf(item) === "APPROVED");
                  const pending = items.filter((item) => stateOf(item) === "PENDING").length;
                  const rejected = items.filter((item) => stateOf(item) === "REJECTED").length;
                  return (
                    <button key={key} type="button" onClick={() => setSelectedDay(key)}
                      aria-pressed={selectedDay === key} aria-current={today === key ? "date" : undefined}
                      aria-label={formatDate(key) + ", " + approved.length + " autorizadas, " + pending + " pendientes, " + rejected + " rechazadas"}
                      className={"min-h-[65px] min-w-0 rounded-lg border p-1 text-left align-top sm:min-h-24 sm:p-2 " + (selectedDay === key ? "border-neutral-800 ring-1 ring-neutral-800" : "border-neutral-200 hover:bg-neutral-50")}>
                      <span className={"block text-xs font-semibold " + (today === key ? "text-red-600" : "text-neutral-800")}>{day}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(typeLabels).map(([kind]) => {
                          const count = approved.filter((item) => item.type === kind).length;
                          return count ? <span key={kind} title={typeLabels[kind] + " autorizadas"} className={"rounded px-1 text-xs font-semibold " + typeStyles[kind]}>{count}<span className="hidden lg:inline"> {kind === "VACATION" ? "Vac." : kind === "PERMISSION" ? "Perm." : "Inc."}</span></span> : null;
                        })}
                        {approved.filter((item) => !typeLabels[item.type]).length > 0 && <span className="rounded bg-neutral-100 px-1 text-xs text-neutral-700">{approved.filter((item) => !typeLabels[item.type]).length} A</span>}
                        {pending > 0 && <span className="rounded bg-amber-100 px-1 text-xs font-semibold text-amber-800">{pending} P</span>}
                        {rejected > 0 && <span className="rounded bg-red-100 px-1 text-xs font-semibold text-red-800">{rejected} R</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border border-neutral-200 p-3 sm:p-4" aria-live="polite">
                <h3 className="font-semibold capitalize text-neutral-800">{formatDate(selectedDay)}</h3>
                <p className="mt-1 text-xs text-neutral-500">{selectedItems.length} solicitudes · {new Set(selectedItems.filter((item) => stateOf(item) === "APPROVED").map((item) => item.employee_id)).size} promotores con ausencia autorizada</p>
                {selectedItems.length === 0 ? <p className="mt-3 text-sm text-neutral-500">No hay incidencias con estos filtros para este día.</p> : (
                  <div className="mt-3 divide-y divide-neutral-100">
                    {selectedItems.map((item) => {
                      const state = stateOf(item);
                      return <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-neutral-800">{personName(item)}</p>
                          <p className="text-xs text-neutral-500">{typeLabels[item.type] || item.type} · {item.start_date}{item.end_date && item.end_date !== item.start_date ? " al " + item.end_date : ""}</p>
                        </div>
                        <span className={"rounded-md px-2 py-1 text-xs font-semibold " + (state === "APPROVED" ? "bg-emerald-100 text-emerald-800" : state === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800")}>
                          {state === "PENDING" ? (item.supervisor_status === "APPROVED" ? "Pendiente RH" : "Pendiente supervisor") : stateLabels[state]}
                        </span>
                      </div>;
                    })}
                  </div>
                )}
              </div>
              {invalidCount > 0 && <p className="mt-3 text-xs text-amber-800">{invalidCount} solicitudes con fechas inválidas no se muestran en el calendario. Se conservan en el listado.</p>}
              <p className="mt-3 text-xs text-neutral-500">Se muestran los periodos completos registrados, incluyendo fines de semana. El calendario no modifica asistencia ni calcula días laborables.</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
