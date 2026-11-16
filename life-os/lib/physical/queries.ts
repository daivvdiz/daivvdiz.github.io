import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, startOfWeek } from "@/lib/dates";
import type { DayPoint } from "@/lib/mental/stats";
import { isImportMarker } from "./markers";
import type { ActivityType, Measure } from "./schema";

export interface WorkoutItem {
  id: string;
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_km: number | null;
  notes: string | null;
  imported: boolean;
}
export interface Workout {
  id: string;
  performed_on: string;
  activity_type: ActivityType;
  duration_seconds: number | null;
  /** Notas del usuario (sin la marca de importación). */
  notes: string | null;
  imported: boolean;
  inCalendar: boolean;
  items: WorkoutItem[];
}
export interface ProgressPoint {
  date: string;
  value: number;
  /** Detalle del mejor registro del día (p. ej. "3 × 8"). */
  detail: string | null;
}
export interface Exercise {
  id: string;
  name: string;
  measure: Measure;
  sessions: number;
  lastOn: string | null;
  best: number | null;
  progress: ProgressPoint[];
}
export interface BodyMetric {
  id: string;
  measured_on: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  measurements: Record<string, number>;
  notes: string | null;
}
export interface NutritionLog {
  id: string;
  logged_on: string;
  meals: string | null;
  water_liters: number | null;
  protein_g: number | null;
  calories: number | null;
  notes: string | null;
}
export interface WeekStat {
  week: string;
  sessions: number;
  minutes: number;
  /** Volumen de fuerza: series × repeticiones × kg, solo de registros que tienen los tres datos. */
  volume: number;
  volumeRows: number;
}

const num = (v: unknown) => (v == null ? null : Number(v));

/** Valor que mide el progreso de un registro según el tipo de ejercicio. */
function itemValue(measure: Measure, i: WorkoutItem) {
  switch (measure) {
    case "weight": return i.weight_kg;
    case "reps": return i.reps;
    case "time": return i.duration_seconds;
    case "distance": return i.distance_km;
  }
}
function itemDetail(measure: Measure, i: WorkoutItem) {
  const sr = i.sets != null && i.reps != null ? `${i.sets} × ${i.reps}` : i.reps != null && measure !== "reps" ? `${i.reps} reps` : i.sets != null ? `${i.sets} sets` : null;
  return measure === "reps" ? (i.sets != null ? `${i.sets} sets` : null) : sr;
}

export async function getPhysicalData(supabase: SupabaseClient, today: string, weekStartsOn: number) {
  const sleepFrom = addDays(today, -29);
  const [workouts, exercises, body, nutrition, days, events] = await Promise.all([
    supabase.from("workouts")
      .select("id, performed_on, activity_type, duration_seconds, notes, created_at, workout_exercises(id, exercise_id, sets, reps, weight_kg, duration_seconds, distance_km, notes, legacy_registro_id, created_at)")
      .order("performed_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
    supabase.from("exercises").select("id, name, measure").order("name"),
    supabase.from("body_metrics").select("id, measured_on, weight_kg, height_cm, body_fat_pct, measurements, notes").order("measured_on", { ascending: false }),
    supabase.from("nutrition_logs").select("id, logged_on, meals, water_liters, protein_g, calories, notes").order("logged_on", { ascending: false }).limit(366),
    supabase.from("daily_entries").select("entry_date, mood, energy, stress, sleep_hours, sleep_quality").gte("entry_date", sleepFrom).lte("entry_date", today).order("entry_date"),
    supabase.from("calendar_events").select("workout_id").not("workout_id", "is", null),
  ]);
  const error = workouts.error || exercises.error || body.error || nutrition.error;
  const linked = new Set((events.data ?? []).map((e) => e.workout_id as string));

  type RawItem = { id: string; exercise_id: string; sets: number | null; reps: number | null; weight_kg: unknown; duration_seconds: number | null; distance_km: unknown; notes: string | null; legacy_registro_id: number | null; created_at: string | null };
  const ws: Workout[] = (workouts.data ?? []).map((w) => {
    const items = ((w.workout_exercises ?? []) as RawItem[])
      .slice()
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .map((i) => ({
        id: i.id, exercise_id: i.exercise_id, sets: i.sets, reps: i.reps, weight_kg: num(i.weight_kg), duration_seconds: i.duration_seconds,
        distance_km: num(i.distance_km), notes: i.notes, imported: i.legacy_registro_id != null,
      }));
    return {
      id: w.id, performed_on: w.performed_on, activity_type: w.activity_type as ActivityType, duration_seconds: w.duration_seconds,
      notes: isImportMarker(w.notes) ? null : w.notes, imported: isImportMarker(w.notes) || items.some((i) => i.imported),
      inCalendar: linked.has(w.id), items,
    };
  }).sort((a, b) => b.performed_on.localeCompare(a.performed_on));

  // Progreso por ejercicio: el mejor valor de cada día en que se registró.
  const exs: Exercise[] = (exercises.data ?? []).map((e) => {
    const measure = e.measure as Measure;
    const byDay = new Map<string, ProgressPoint>();
    for (const w of ws)
      for (const i of w.items) {
        if (i.exercise_id !== e.id) continue;
        const v = itemValue(measure, i);
        if (v == null) continue;
        const cur = byDay.get(w.performed_on);
        if (!cur || v > cur.value) byDay.set(w.performed_on, { date: w.performed_on, value: v, detail: itemDetail(measure, i) });
      }
    const sessions = new Set(ws.filter((w) => w.items.some((i) => i.exercise_id === e.id)).map((w) => w.id)).size;
    const lastOn = ws.find((w) => w.items.some((i) => i.exercise_id === e.id))?.performed_on ?? null;
    const progress = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    return { id: e.id, name: e.name, measure, sessions, lastOn, best: progress.length ? Math.max(...progress.map((p) => p.value)) : null, progress };
  });

  // Últimas 12 semanas (la actual incluida), con huecos en cero solo porque contar sesiones sí es un conteo real.
  const thisWeek = startOfWeek(today, weekStartsOn);
  const weeks: WeekStat[] = Array.from({ length: 12 }, (_, k) => ({ week: addDays(thisWeek, -7 * (11 - k)), sessions: 0, minutes: 0, volume: 0, volumeRows: 0 }));
  const firstWeek = weeks[0].week;
  for (const w of ws) {
    if (w.performed_on < firstWeek || w.performed_on > today) continue;
    const wk = weeks.find((x) => x.week === startOfWeek(w.performed_on, weekStartsOn));
    if (!wk) continue;
    wk.sessions++;
    if (w.duration_seconds != null) wk.minutes += w.duration_seconds / 60;
    for (const i of w.items)
      if (i.sets != null && i.reps != null && i.weight_kg != null) {
        wk.volume += i.sets * i.reps * i.weight_kg;
        wk.volumeRows++;
      }
  }

  const bm: BodyMetric[] = (body.data ?? []).map((b) => ({
    id: b.id, measured_on: b.measured_on, weight_kg: num(b.weight_kg), height_cm: num(b.height_cm), body_fat_pct: num(b.body_fat_pct),
    measurements: Object.fromEntries(Object.entries((b.measurements as Record<string, unknown> | null) ?? {}).filter(([, v]) => v != null && !Number.isNaN(Number(v))).map(([k, v]) => [k, Number(v)])),
    notes: b.notes,
  }));
  const nl: NutritionLog[] = (nutrition.data ?? []).map((n) => ({
    id: n.id, logged_on: n.logged_on, meals: n.meals, water_liters: num(n.water_liters), protein_g: num(n.protein_g), calories: n.calories, notes: n.notes,
  }));
  const sleep: DayPoint[] = (days.data ?? []).map((d) => ({
    date: d.entry_date, mood: d.mood, energy: d.energy, stress: d.stress, sleep_hours: num(d.sleep_hours), sleep_quality: d.sleep_quality,
  }));

  return { error, workouts: ws, exercises: exs, weeks, body: bm, nutrition: nl, sleep, sleepFrom };
}
