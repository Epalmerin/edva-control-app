export type AttendanceState = "reported" | "rest" | "pending";

// The selected date is a calendar date, not an instant in the browser's timezone.
// rest_days uses ISO weekdays: Monday = 1, Sunday = 7. Null means unconfigured.
export function isRestDay(date: string, restDays: number[] | null | undefined) {
  if (!restDays?.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const calendarDate = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== date) {
    return false;
  }
  const weekday = calendarDate.getUTCDay() || 7;
  return restDays.includes(weekday);
}

export function getAttendanceState(
  date: string,
  restDays: number[] | null | undefined,
  hasEntry: boolean
): AttendanceState {
  // Keep real entries visible even when someone works on their scheduled rest day.
  if (hasEntry) return "reported";
  return isRestDay(date, restDays) ? "rest" : "pending";
}
