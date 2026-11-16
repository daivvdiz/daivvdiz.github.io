import { daysBetween } from "@/lib/dates";
import { formatDay } from "@/lib/format";

export function targetText(target: string | null, today: string, status: string) {
  if (!target) return null;
  const d = daysBetween(today, target);
  if (status === "completed" || status === "abandoned") return `Target date: ${formatDay(target)}`;
  if (d === 0) return `Target date: today`;
  return `Target date: ${formatDay(target)} (${d > 0 ? `in ${d} ${d === 1 ? "day" : "days"}` : `${-d} ${d === -1 ? "day" : "days"} ago`})`;
}
