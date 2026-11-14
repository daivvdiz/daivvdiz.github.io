import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export const TIMEZONE = "America/Bogota";

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function formatMoney(value: number | null | undefined, currency = "COP") {
  if (value == null) return "—";
  if (currency === "COP") return cop.format(value);
  return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(value);
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: digits }).format(value);
}

/** Fecha "YYYY-MM-DD" (sin zona) → texto en español. */
export function formatDay(iso: string, pattern = "d MMM yyyy") {
  return format(parseISO(iso), pattern, { locale: es });
}

export function formatDateTime(iso: string, pattern = "EEE d MMM, HH:mm") {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIMEZONE,
    weekday: pattern.startsWith("EEE") ? "short" : undefined,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function timeAgo(iso: string | null | undefined) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h) return `${h} h ${m.toString().padStart(2, "0")} min`;
  if (m) return s ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

/** Fecha de hoy en la zona horaria del usuario, como "YYYY-MM-DD". */
export function todayISO(timeZone = TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function currentHour(timeZone = TIMEZONE) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
}

export function greeting(hour: number) {
  if (hour < 5) return "Buenas noches";
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function longToday(timeZone = TIMEZONE) {
  const s = new Intl.DateTimeFormat("es-CO", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Primer y último día del mes de una fecha ISO. */
export function monthRange(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}
