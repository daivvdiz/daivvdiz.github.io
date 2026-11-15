import { daysBetween } from "@/lib/dates";
import { formatDay } from "@/lib/format";

export function targetText(target: string | null, today: string, status: string) {
  if (!target) return null;
  const d = daysBetween(today, target);
  if (status === "completed" || status === "abandoned") return `Fecha objetivo: ${formatDay(target)}`;
  if (d === 0) return `Fecha objetivo: hoy`;
  return `Fecha objetivo: ${formatDay(target)} (${d > 0 ? `en ${d} ${d === 1 ? "día" : "días"}` : `hace ${-d} ${d === -1 ? "día" : "días"}`})`;
}
