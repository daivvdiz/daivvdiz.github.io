// Cálculos de hábitos. Sin rachas: solo cuántas veces lo hiciste frente a cuántas lo planeaste,
// contando desde que empezó el hábito y nunca días futuros.

import { addDays, startOfWeek, weekday } from "@/lib/dates";

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  frequency: "daily" | "weekly" | "custom";
  times_per_period: number;
  weekdays: number[] | null;
  tracking_method: "check" | "count" | "duration";
  start_date: string;
  is_active: boolean;
  goal_ids: string[];
}
export interface HabitLog {
  habit_id: string;
  logged_on: string;
  value: number | null;
  notes: string | null;
}

/** Un registro cuenta como hecho si es de tipo "hecho" o si tiene una cantidad mayor que 0. */
export const isDone = (h: Habit, l: HabitLog | undefined) => !!l && (h.tracking_method === "check" || (l.value ?? 0) > 0);

/** ¿Este día está planeado? (los hábitos semanales no tienen días fijos) */
export function isScheduled(h: Habit, d: string) {
  if (d < h.start_date) return false;
  if (h.frequency === "custom") return (h.weekdays ?? []).includes(weekday(d));
  return h.frequency === "daily";
}

export function habitStats(h: Habit, logs: HabitLog[], from: string, to: string, weekStartsOn: number) {
  const own = new Map(logs.filter((l) => l.habit_id === h.id).map((l) => [l.logged_on, l]));
  const start = from < h.start_date ? h.start_date : from;
  let total = 0;
  for (const [d, l] of own) if (d >= from && d <= to && l.value != null) total += Number(l.value);

  if (start > to) return { done: 0, expected: 0, unit: h.frequency === "weekly" ? "weeks" : "days", total };

  if (h.frequency === "weekly") {
    let expected = 0, done = 0;
    for (let w = startOfWeek(start, weekStartsOn); w <= to; w = addDays(w, 7)) {
      let c = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(w, i);
        if (d >= start && d <= to && isDone(h, own.get(d))) c++;
      }
      const met = c >= h.times_per_period;
      // La semana en curso solo cuenta si ya se cumplió: no se marca como "no cumplida" antes de tiempo.
      if (addDays(w, 6) > to && !met) continue;
      // Tampoco la semana en la que empezó a mitad de semana.
      if (w < h.start_date && !met) continue;
      expected++;
      if (met) done++;
    }
    return { done, expected, unit: "weeks", total };
  }

  let expected = 0, done = 0;
  for (let d = start; d <= to; d = addDays(d, 1)) {
    if (!isScheduled(h, d)) continue;
    expected++;
    if (isDone(h, own.get(d))) done++;
  }
  return { done, expected, unit: "days", total };
}

export function describeFrequency(h: Pick<Habit, "frequency" | "times_per_period" | "weekdays">) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (h.frequency === "daily") return "Every day";
  if (h.frequency === "weekly") return `${h.times_per_period} ${h.times_per_period === 1 ? "time" : "times"} a week`;
  return (h.weekdays ?? []).slice().sort().map((d) => names[d]).join(", ");
}
