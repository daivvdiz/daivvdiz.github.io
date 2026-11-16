"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { addDays, zonedToUtc } from "@/lib/dates";
import { WORKOUT_TYPES } from "@/lib/types";
import {
  BODY_MEASUREMENTS, bodySchema, exerciseSchema, nutritionSchema, parseDuration, workoutSchema,
  type BodyInput, type ExerciseInput, type Measure, type NutritionInput, type WorkoutInput,
} from "./schema";
import { isImportMarker } from "./markers";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();
const issue = (e: z.ZodError) => ({ ok: false as const, error: e.issues[0]?.message ?? "Invalid data" });
const done = (): Result => {
  revalidatePath("/physical");
  revalidatePath("/overview");
  revalidatePath("/calendar");
  return { ok: true };
};
const nul = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

type Table = "workouts" | "exercises" | "body_metrics" | "nutrition_logs";

async function remove(table: Table, id: string, msg: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from(table).delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: msg };
  return done();
}

// ---------------------------------------------------------------- Entrenamientos

export async function saveWorkout(input: WorkoutInput, id?: string): Promise<Result> {
  const p = workoutSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const v = p.data;
  const { supabase, user } = await requireUser();

  // Ejercicios nuevos escritos a mano: se crean (o se reutilizan si ya existe uno con ese nombre).
  const exerciseIds: string[] = [];
  for (const it of v.items) {
    if (it.exercise_id) {
      exerciseIds.push(it.exercise_id);
      continue;
    }
    const name = it.new_exercise!.trim();
    const measure: Measure = it.weight_kg != null ? "weight" : it.distance_km != null ? "distance" : parseDuration(it.time) != null ? "time" : "reps";
    await supabase.from("exercises").upsert({ user_id: user.id, name, measure }, { onConflict: "user_id,name", ignoreDuplicates: true });
    const ex = await supabase.from("exercises").select("id").eq("user_id", user.id).eq("name", name).single();
    if (ex.error || !ex.data) return { ok: false, error: `Couldn't create the exercise “${name}”.` };
    exerciseIds.push(ex.data.id);
  }

  let notes = nul(v.notes);
  if (id && !notes) {
    // Conserva la marca de importación para que volver a importar no duplique la sesión.
    const prev = await supabase.from("workouts").select("notes").eq("id", uuid.parse(id)).eq("user_id", user.id).maybeSingle();
    if (isImportMarker(prev.data?.notes)) notes = prev.data!.notes as string;
  }
  const row = { performed_on: v.performed_on, activity_type: v.activity_type, duration_seconds: parseDuration(v.duration), notes };
  const w = id
    ? await supabase.from("workouts").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id).select("id").single()
    : await supabase.from("workouts").insert({ ...row, user_id: user.id }).select("id").single();
  if (w.error || !w.data) return { ok: false, error: "Couldn't save the workout." };
  const workoutId = id ? uuid.parse(id) : (w.data.id as string);

  // Ejercicios del entrenamiento: actualiza los que siguen, agrega los nuevos y quita los eliminados.
  const existing = await supabase.from("workout_exercises").select("id").eq("workout_id", workoutId);
  const keep = new Set(v.items.map((i) => i.id).filter(Boolean) as string[]);
  const toDelete = (existing.data ?? []).map((r) => r.id as string).filter((x) => !keep.has(x));
  if (toDelete.length) {
    const d = await supabase.from("workout_exercises").delete().in("id", toDelete).eq("user_id", user.id);
    if (d.error) return { ok: false, error: "Couldn't update the exercises." };
  }
  for (const [i, it] of v.items.entries()) {
    const r = {
      exercise_id: exerciseIds[i],
      sets: it.sets,
      reps: it.reps,
      weight_kg: it.weight_kg,
      duration_seconds: parseDuration(it.time),
      distance_km: it.distance_km,
      notes: nul(it.notes),
    };
    const res = it.id
      ? await supabase.from("workout_exercises").update(r).eq("id", it.id).eq("user_id", user.id)
      : await supabase.from("workout_exercises").insert({ ...r, workout_id: workoutId, user_id: user.id });
    if (res.error) return { ok: false, error: "Couldn't save the exercises." };
  }

  if (!id && v.add_to_calendar) {
    const { timeZone } = await getPrefs(supabase, user.id);
    await supabase.from("calendar_events").insert({
      user_id: user.id,
      title: WORKOUT_TYPES[v.activity_type] ?? "Workout",
      category: "fitness",
      starts_at: zonedToUtc(v.performed_on, "00:00", timeZone),
      ends_at: zonedToUtc(addDays(v.performed_on, 1), "00:00", timeZone),
      all_day: true,
      workout_id: workoutId,
    });
  }
  return done();
}

export async function deleteWorkout(id: string) {
  return remove("workouts", id, "Couldn't delete the workout.");
}

// ---------------------------------------------------------------- Ejercicios

export async function saveExercise(input: ExerciseInput, id?: string): Promise<Result> {
  const p = exerciseSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const r = id
    ? await supabase.from("exercises").update(p.data).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("exercises").insert({ ...p.data, user_id: user.id });
  if (r.error) return { ok: false, error: r.error.code === "23505" ? "You already have an exercise with that name." : "Couldn't save the exercise." };
  return done();
}

export async function deleteExercise(id: string) {
  return remove("exercises", id, "Couldn't delete the exercise.");
}

// ---------------------------------------------------------------- Cuerpo

export async function saveBodyMetric(input: BodyInput, id?: string): Promise<Result> {
  const p = bodySchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const v = p.data;
  const { supabase, user } = await requireUser();

  // Conserva otras medidas guardadas antes que este formulario no muestra.
  let measurements: Record<string, unknown> = {};
  if (id) {
    const prev = await supabase.from("body_metrics").select("measurements").eq("id", uuid.parse(id)).eq("user_id", user.id).maybeSingle();
    measurements = { ...((prev.data?.measurements as Record<string, unknown> | null) ?? {}) };
  }
  for (const k of Object.keys(BODY_MEASUREMENTS) as (keyof typeof BODY_MEASUREMENTS)[]) {
    if (v[k] == null) delete measurements[k];
    else measurements[k] = v[k];
  }
  const row = { measured_on: v.measured_on, weight_kg: v.weight_kg, height_cm: v.height_cm, body_fat_pct: v.body_fat_pct, measurements, notes: nul(v.notes) };
  const r = id
    ? await supabase.from("body_metrics").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("body_metrics").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: "Couldn't save the entry." };
  return done();
}

export async function deleteBodyMetric(id: string) {
  return remove("body_metrics", id, "Couldn't delete the entry.");
}

// ---------------------------------------------------------------- Nutrición

export async function saveNutrition(input: NutritionInput, id?: string): Promise<Result> {
  const p = nutritionSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const v = p.data;
  const { supabase, user } = await requireUser();
  const row = { logged_on: v.logged_on, meals: nul(v.meals), water_liters: v.water_liters, protein_g: v.protein_g, calories: v.calories, notes: nul(v.notes) };
  const r = id
    ? await supabase.from("nutrition_logs").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("nutrition_logs").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: r.error.code === "23505" ? "You already have an entry for that day; edit it from the list." : "Couldn't save the entry." };
  return done();
}

export async function deleteNutrition(id: string) {
  return remove("nutrition_logs", id, "Couldn't delete the entry.");
}
