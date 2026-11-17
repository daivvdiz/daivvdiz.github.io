// Reglas de repetición de eventos (estilo Google Calendar). Funciones puras: sirven en servidor y cliente.
// Las fechas son texto "YYYY-MM-DD" en la zona horaria del usuario.

import { addDays, daysBetween, weekday } from "@/lib/dates";

export const FREQS = { daily: "day", weekly: "week", monthly: "month", yearly: "year" } as const;
export type Freq = keyof typeof FREQS;
/** day = mismo número de día; nth = p. ej. el tercer martes; last = el último martes del mes. */
export type MonthlyMode = "day" | "nth" | "last";

export interface Recurrence {
  freq: Freq;
  interval: number;
  /** Solo semanal: 0 = domingo … 6 = sábado */
  weekdays?: number[];
  /** Solo mensual */
  monthly?: MonthlyMode;
  /** Termina después de N repeticiones (opcional) */
  count?: number | null;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDINALS = ["first", "second", "third", "fourth", "fifth"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const ymd = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Mes m (1–12) de y desplazado k meses. */
const shiftMonth = (y: number, m: number, k: number) => {
  const t = y * 12 + (m - 1) + k;
  return [Math.floor(t / 12), (t % 12) + 1] as const;
};

/** Qué semana del mes es (1–5) y si es la última aparición de ese día de la semana. */
export function nthOfMonth(date: string) {
  const [y, m, d] = ymd(date);
  return { nth: Math.ceil(d / 7), isLast: d + 7 > daysInMonth(y, m) };
}

/** El n-ésimo (o último) día de la semana `wd` del mes; null si no existe (p. ej. quinto lunes). */
function nthWeekdayOf(y: number, m: number, wd: number, nth: number | "last") {
  if (nth === "last") {
    const last = daysInMonth(y, m);
    const lastWd = weekday(iso(y, m, last));
    return iso(y, m, last - ((lastWd - wd + 7) % 7));
  }
  const firstWd = weekday(iso(y, m, 1));
  const d = 1 + ((wd - firstWd + 7) % 7) + (nth - 1) * 7;
  return d <= daysInMonth(y, m) ? iso(y, m, d) : null;
}

export function normalize(rule: Recurrence, start: string): Recurrence {
  const interval = Math.min(99, Math.max(1, Math.round(rule.interval || 1)));
  const out: Recurrence = { freq: rule.freq, interval };
  if (rule.freq === "weekly") {
    const wds = [...new Set((rule.weekdays ?? []).filter((x) => x >= 0 && x <= 6))].sort();
    out.weekdays = wds.length ? wds : [weekday(start)];
  }
  if (rule.freq === "monthly") out.monthly = rule.monthly === "last" && !nthOfMonth(start).isLast ? "nth" : rule.monthly ?? "day";
  if (rule.count) out.count = Math.min(999, Math.max(1, Math.round(rule.count)));
  return out;
}

/**
 * Todas las fechas de la serie entre `from` y `to` (inclusive), en orden.
 * La serie empieza en `start`; `until` (inclusive) y `count` la terminan; `exceptions` son fechas quitadas.
 * Las fechas quitadas siguen contando para `count`, igual que en Google Calendar.
 */
export function occurrences(start: string, ruleIn: Recurrence, opts: { until?: string | null; exceptions?: string[]; from: string; to: string }): string[] {
  const rule = normalize(ruleIn, start);
  const end = opts.until && opts.until < opts.to ? opts.until : opts.to;
  const skip = new Set(opts.exceptions ?? []);
  const out: string[] = [];
  let n = 0;
  const take = (d: string) => {
    if (d < start) return true;
    if (d > end) return false;
    if (rule.count && n >= rule.count) return false;
    n++;
    if (d >= opts.from && !skip.has(d)) out.push(d);
    return true;
  };
  const [sy, sm, sd] = ymd(start);
  const k = rule.interval;
  // Límite de seguridad: evita bucles infinitos con datos raros.
  for (let i = 0; i < 20000; i++) {
    if (rule.freq === "daily") {
      if (!take(addDays(start, i * k))) break;
    } else if (rule.freq === "weekly") {
      const weekStart = addDays(start, -weekday(start) + i * 7 * k);
      if (weekStart > end) break;
      let stop = false;
      for (const wd of rule.weekdays!) if (!take(addDays(weekStart, wd))) { stop = true; break; }
      if (stop) break;
    } else if (rule.freq === "monthly") {
      const [y, m] = shiftMonth(sy, sm, i * k);
      if (iso(y, m, 1) > end) break;
      let d: string | null;
      if (rule.monthly === "nth" || rule.monthly === "last") {
        const { nth } = nthOfMonth(start);
        d = nthWeekdayOf(y, m, weekday(start), rule.monthly === "last" ? "last" : nth);
      } else d = sd <= daysInMonth(y, m) ? iso(y, m, sd) : null; // Meses sin ese día se saltan.
      if (d && !take(d)) break;
    } else {
      const y = sy + i * k;
      if (iso(y, 1, 1) > end) break;
      if (sd <= daysInMonth(y, sm) && !take(iso(y, sm, sd))) break; // 29 de febrero solo en años bisiestos.
    }
  }
  return out;
}

/** Última fecha de una serie con `count` (para guardar el fin y poder filtrar en la base de datos). */
export function lastOccurrence(start: string, rule: Recurrence, until?: string | null) {
  if (!rule.count && !until) return null;
  const all = occurrences(start, rule, { until, from: start, to: until ?? addDays(start, 365 * 100) });
  return all[all.length - 1] ?? start;
}

/** Cuántas repeticiones hay antes de `date` (incluye las quitadas). */
export function countBefore(start: string, rule: Recurrence, date: string) {
  if (date <= start) return 0;
  return occurrences(start, { ...rule, count: null }, { from: start, to: addDays(date, -1) }).length;
}

const fmt = (date: string) => {
  const [y, m, d] = ymd(date);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
};

/** "Every 2 weeks on Mon, Wed · until Dec 31, 2026" */
export function describe(ruleIn: Recurrence, start: string, until?: string | null) {
  const rule = normalize(ruleIn, start);
  const unit = FREQS[rule.freq];
  const every = rule.interval === 1 ? (rule.freq === "daily" ? "Daily" : rule.freq === "weekly" ? "Weekly" : rule.freq === "monthly" ? "Monthly" : "Annually") : `Every ${rule.interval} ${unit}s`;
  let detail = "";
  if (rule.freq === "weekly") {
    const w = rule.weekdays!;
    detail = w.length === 5 && [1, 2, 3, 4, 5].every((x) => w.includes(x)) ? " on weekdays" : w.length === 7 ? " on every day" : ` on ${w.map((x) => WEEKDAY_SHORT[x]).join(", ")}`;
  } else if (rule.freq === "monthly") {
    const { nth } = nthOfMonth(start);
    const wd = WEEKDAY_NAMES[weekday(start)];
    detail = rule.monthly === "nth" ? ` on the ${ORDINALS[nth - 1]} ${wd}` : rule.monthly === "last" ? ` on the last ${wd}` : ` on day ${ymd(start)[2]}`;
  } else if (rule.freq === "yearly") {
    const [, m, d] = ymd(start);
    detail = ` on ${MONTHS[m - 1]} ${d}`;
  }
  const ends = rule.count ? ` · ${rule.count} ${rule.count === 1 ? "time" : "times"}` : until ? ` · until ${fmt(until)}` : "";
  return every + detail + ends;
}

/** Opciones rápidas del selector "Repeat", según la fecha del evento. */
export function presets(date: string) {
  const wd = weekday(date);
  const { nth, isLast } = nthOfMonth(date);
  const [, m, d] = ymd(date);
  const list: { key: string; label: string; rule: Recurrence | null }[] = [
    { key: "none", label: "Does not repeat", rule: null },
    { key: "daily", label: "Daily", rule: { freq: "daily", interval: 1 } },
    { key: "weekly", label: `Weekly on ${WEEKDAY_NAMES[wd]}`, rule: { freq: "weekly", interval: 1, weekdays: [wd] } },
    { key: "weekdays", label: "Every weekday (Monday to Friday)", rule: { freq: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] } },
    { key: "monthly_day", label: `Monthly on day ${d}`, rule: { freq: "monthly", interval: 1, monthly: "day" } },
  ];
  if (nth <= 4) list.push({ key: "monthly_nth", label: `Monthly on the ${ORDINALS[nth - 1]} ${WEEKDAY_NAMES[wd]}`, rule: { freq: "monthly", interval: 1, monthly: "nth" } });
  if (isLast) list.push({ key: "monthly_last", label: `Monthly on the last ${WEEKDAY_NAMES[wd]}`, rule: { freq: "monthly", interval: 1, monthly: "last" } });
  list.push({ key: "yearly", label: `Annually on ${MONTHS[m - 1]} ${d}`, rule: { freq: "yearly", interval: 1 } });
  list.push({ key: "custom", label: "Custom…", rule: null });
  return list;
}

/** Qué opción rápida corresponde a una regla guardada (sin contar el fin), o "custom". */
export function presetKey(rule: Recurrence | null, date: string) {
  if (!rule) return "none";
  const r = normalize({ ...rule, count: null }, date);
  for (const p of presets(date)) {
    if (!p.rule) continue;
    const q = normalize(p.rule, date);
    if (JSON.stringify(q) === JSON.stringify(r)) return p.key;
  }
  return "custom";
}

export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_FULL = WEEKDAY_NAMES;

/** Desplaza las fechas quitadas cuando toda la serie se mueve de día. */
export const shiftDates = (dates: string[], days: number) => (days ? dates.map((d) => addDays(d, days)) : dates);
export { daysBetween };
