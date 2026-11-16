import { addDays, daysBetween, isISODate } from "@/lib/dates";

export const PERIODS = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "180d", label: "6 months", days: 182 },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"] | "custom";

/** Resuelve el periodo de los filtros. El rango personalizado se limita a 3 años. */
export function resolvePeriod(sp: { period?: string; from?: string; to?: string }, today: string, fallback: string) {
  if (sp.period === "custom" && isISODate(sp.from) && isISODate(sp.to)) {
    let [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    if (daysBetween(from, to) > 1095) from = addDays(to, -1095);
    return { key: "custom" as PeriodKey, from, to };
  }
  const p = PERIODS.find((x) => x.key === sp.period) ?? PERIODS.find((x) => x.key === fallback) ?? PERIODS[1];
  return { key: p.key as PeriodKey, from: addDays(today, -(p.days - 1)), to: today };
}
