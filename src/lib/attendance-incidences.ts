import { supabase } from "@/lib/supabase";

export type ApprovedIncidence = {
  id: string;
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string | null;
};

export function incidenceLabel(type: string) {
  switch (type) {
    case "VACATION": return "Vacaciones autorizadas";
    case "PERMISSION": return "Permiso autorizado";
    case "MEDICAL": return "Incapacidad autorizada";
    default: return "Incidencia autorizada";
  }
}

export function incidenceCoversDate(row: ApprovedIncidence, date: string) {
  const end = row.end_date || row.start_date;
  return row.start_date <= date && date <= end;
}

// Date-only comparisons are deliberate: the selected day is a Mexico City calendar date.
// The three statuses must agree before an absence can be treated as justified.
export async function loadApprovedIncidences(date: string, employeeIds: string[]): Promise<ApprovedIncidence[]> {
  const ids = [...new Set(employeeIds)];
  if (!ids.length) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha de asistencia inválida.");
  const result: ApprovedIncidence[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from("incidence_requests")
        .select("id,employee_id,type,start_date,end_date")
        .in("employee_id", ids.slice(offset, offset + 100))
        .in("type", ["VACATION", "PERMISSION", "MEDICAL"])
        .eq("status", "APPROVED")
        .eq("supervisor_status", "APPROVED")
        .eq("rh_status", "APPROVED")
        .lte("start_date", date)
        .or("end_date.gte." + date + ",end_date.is.null")
        .order("id")
        .range(from, from + 499);
      if (error) throw error;
      const rows = (data || []) as ApprovedIncidence[];
      result.push(...rows.filter((row) => incidenceCoversDate(row, date)));
      if (rows.length < 500) break;
      from += 500;
    }
  }
  return result;
}

export function groupApprovedIncidences(rows: ApprovedIncidence[]) {
  const map = new Map<string, ApprovedIncidence[]>();
  for (const row of rows) {
    const group = map.get(row.employee_id) || [];
    group.push(row);
    map.set(row.employee_id, group);
  }
  return map;
}

export function approvedIncidenceLabels(rows: ApprovedIncidence[]) {
  return [...new Set(rows.map((row) => incidenceLabel(row.type)))].join(" · ");
}
