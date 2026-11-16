// Cálculos puros para Salud mental. Nunca rellenan días sin datos: un día sin registro
// simplemente no cuenta, y cada promedio dice con cuántos registros se calculó.

import { addDays, startOfWeek } from "@/lib/dates";

export interface DayPoint {
  date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
}

export type Metric = "mood" | "energy" | "stress" | "sleep_hours";

export function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function summary(points: DayPoint[], key: Metric) {
  const v = points.map((p) => p[key]).filter((x): x is number => x != null);
  return { avg: mean(v), n: v.length, min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null };
}

/** Promedios por semana o por mes, con el número de días registrados en cada uno. */
export function groupAverages(points: DayPoint[], by: "week" | "month", weekStartsOn: number) {
  const groups = new Map<string, DayPoint[]>();
  for (const p of points) {
    const k = by === "week" ? startOfWeek(p.date, weekStartsOn) : p.date.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ps]) => ({
      key,
      end: by === "week" ? addDays(key, 6) : null,
      mood: summary(ps, "mood"),
      energy: summary(ps, "energy"),
      stress: summary(ps, "stress"),
      sleep: summary(ps, "sleep_hours"),
    }));
}

/** Cuántos días tuvieron cada valor de 1 a 10. */
export function distribution(points: DayPoint[], key: "mood" | "energy" | "stress") {
  const counts = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, days: 0 }));
  for (const p of points) {
    const v = p[key];
    if (v != null && v >= 1 && v <= 10) counts[v - 1].days++;
  }
  return counts;
}

/** Correlación de Pearson usando solo los días que tienen ambos valores. */
export function pearson(points: DayPoint[], a: Metric, b: Metric) {
  const pairs = points.filter((p) => p[a] != null && p[b] != null).map((p) => [p[a] as number, p[b] as number]);
  const n = pairs.length;
  if (n < 3) return { r: null, n };
  const ma = mean(pairs.map((x) => x[0]))!;
  const mb = mean(pairs.map((x) => x[1]))!;
  let num = 0, da = 0, db = 0;
  for (const [x, y] of pairs) {
    num += (x - ma) * (y - mb);
    da += (x - ma) ** 2;
    db += (y - mb) ** 2;
  }
  if (da === 0 || db === 0) return { r: null, n };
  return { r: num / Math.sqrt(da * db), n };
}

export const MIN_CORRELATION_N = 7;

export function describeR(r: number) {
  const a = Math.abs(r);
  const strength = a < 0.1 ? "no clear relationship" : a < 0.3 ? "weak relationship" : a < 0.5 ? "moderate relationship" : "strong relationship";
  if (a < 0.1) return strength;
  return `${strength} ${r > 0 ? "in the same direction" : "in opposite directions"}`;
}

export const METRIC_LABEL: Record<Metric, string> = {
  mood: "Mood",
  energy: "Energy",
  stress: "Stress",
  sleep_hours: "Sleep hours",
};
