// Utilidades de fechas con zona horaria explícita. Las fechas "de calendario" se manejan
// como texto "YYYY-MM-DD" para que nunca cambien de día por la zona horaria.

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: string | undefined | null): s is string {
  return !!s && ISO_DATE.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, n: number) {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado */
export function weekday(iso: string) {
  return new Date(iso + "T00:00:00Z").getUTCDay();
}

export function startOfWeek(iso: string, weekStartsOn: number) {
  const diff = (weekday(iso) - weekStartsOn + 7) % 7;
  return addDays(iso, -diff);
}

export function startOfMonth(iso: string) {
  return iso.slice(0, 8) + "01";
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
}

/** Días visibles de una vista: mes (6 semanas), semana (7) o día (1). */
export function visibleRange(view: "month" | "week" | "day", date: string, weekStartsOn: number) {
  if (view === "day") return { start: date, end: date, days: [date] };
  if (view === "week") {
    const start = startOfWeek(date, weekStartsOn);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return { start, end: days[6], days };
  }
  const start = startOfWeek(startOfMonth(date), weekStartsOn);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return { start, end: days[41], days };
}

/** Desfase (minutos) de una zona horaria respecto a UTC en un instante dado. */
function tzOffsetMinutes(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/** "2026-11-14" + "08:30" en la zona del usuario → ISO UTC. */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const naive = new Date(`${date}T${time}:00Z`);
  const offset = tzOffsetMinutes(naive, timeZone);
  const guess = new Date(naive.getTime() - offset * 60000);
  const offset2 = tzOffsetMinutes(guess, timeZone);
  return new Date(naive.getTime() - offset2 * 60000).toISOString();
}

/** ISO UTC → { date: "YYYY-MM-DD", time: "HH:mm" } en la zona del usuario. */
export function utcToZoned(iso: string, timeZone: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { date, time };
}
