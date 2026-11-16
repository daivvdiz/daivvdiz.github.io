import { addDays, addMonths, daysBetween, isISODate, startOfMonth, startOfWeek } from "@/lib/dates";
import { formatDay } from "@/lib/format";

export const ANALYTICS_PERIODS = [
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "12m", label: "12 months" },
  { key: "ytd", label: "This year" },
] as const;
export type AnalyticsPeriodKey = (typeof ANALYTICS_PERIODS)[number]["key"] | "custom";

const MAX_DAYS = 365 * 5;

/** Periodo de los filtros. Los meses cuentan completos hasta hoy; el personalizado se limita a 5 años. */
export function resolveAnalyticsPeriod(sp: { period?: string; from?: string; to?: string }, today: string) {
  if (sp.period === "custom" && isISODate(sp.from) && isISODate(sp.to)) {
    let [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    if (to > today) to = today;
    if (from > to) from = to;
    if (daysBetween(from, to) > MAX_DAYS) from = addDays(to, -MAX_DAYS);
    return { key: "custom" as AnalyticsPeriodKey, from, to };
  }
  const key = (ANALYTICS_PERIODS.find((p) => p.key === sp.period)?.key ?? "6m") as AnalyticsPeriodKey;
  const month = startOfMonth(today);
  const from = key === "ytd" ? `${today.slice(0, 4)}-01-01` : addMonths(month, key === "3m" ? -2 : key === "6m" ? -5 : -11);
  return { key, from, to: today };
}

export type Bucket = { key: string; from: string; to: string; label: string };

/** Semanas si el periodo es corto (≤ 92 días); meses si es más largo. */
export function makeBuckets(from: string, to: string, weekStartsOn: number): { by: "week" | "month"; buckets: Bucket[] } {
  const by = daysBetween(from, to) <= 92 ? "week" : "month";
  const buckets: Bucket[] = [];
  if (by === "week") {
    for (let w = startOfWeek(from, weekStartsOn); w <= to; w = addDays(w, 7))
      buckets.push({ key: w, from: w < from ? from : w, to: addDays(w, 6) > to ? to : addDays(w, 6), label: formatDay(w, "MMM d") });
  } else {
    for (let m = startOfMonth(from); m <= to; m = addMonths(m, 1)) {
      const end = addDays(addMonths(m, 1), -1);
      buckets.push({ key: m.slice(0, 7), from: m < from ? from : m, to: end > to ? to : end, label: formatDay(m, "MMM yy") });
    }
  }
  return { by, buckets };
}

/** Periodos predefinidos para comparar. */
export function comparePresets(today: string) {
  const m = startOfMonth(today);
  const prev = addMonths(m, -1);
  const y = today.slice(0, 4);
  const py = String(Number(y) - 1);
  const lastYearSame = `${py}${m.slice(4)}`;
  const monthEnd = (s: string) => addDays(addMonths(s, 1), -1);
  const label = (s: string) => formatDay(s, "MMMM yyyy");
  return [
    { key: "month", label: "This month vs. last month", a: { from: m, to: today, label: `${label(m)} (to date)` }, b: { from: prev, to: monthEnd(prev), label: label(prev) } },
    { key: "month-ly", label: "This month vs. the same month last year", a: { from: m, to: today, label: `${label(m)} (to date)` }, b: { from: lastYearSame, to: monthEnd(lastYearSame), label: label(lastYearSame) } },
    { key: "year", label: "This year vs. last year", a: { from: `${y}-01-01`, to: today, label: `${y} (to date)` }, b: { from: `${py}-01-01`, to: `${py}-12-31`, label: py } },
    { key: "jan-dec", label: `January ${y} vs. December ${py}`, a: { from: `${y}-01-01`, to: `${y}-01-31` < today ? `${y}-01-31` : today, label: `January ${y}` }, b: { from: `${py}-12-01`, to: `${py}-12-31`, label: `December ${py}` } },
  ] as const;
}
