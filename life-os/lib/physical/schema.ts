import { z } from "zod";
import { WORKOUT_TYPES } from "@/lib/types";

export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
export const text = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`).optional().or(z.literal(""));
const enumOf = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

/** Número opcional: vacío o NaN es null; nunca se rellena con un valor inventado. */
export const optNum = (min: number, max: number, opts: { int?: boolean; label?: string } = {}) =>
  z.preprocess(
    (v) => (v === "" || v == null || (typeof v === "number" && Number.isNaN(v)) ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v),
    (opts.int ? z.number({ invalid_type_error: "Enter a number" }).int("Use a whole number") : z.number({ invalid_type_error: "Enter a number" }))
      .min(min, `Minimum ${min}`)
      .max(max, `Maximum ${max}`)
      .nullable(),
  ) as unknown as z.ZodType<number | null, z.ZodTypeDef, number | null>;

export const ACTIVITY_TYPES = WORKOUT_TYPES as Record<
  "calisthenics" | "strength" | "beach_volleyball" | "running" | "mobility" | "other_sport" | "other",
  string
>;
export type ActivityType = keyof typeof ACTIVITY_TYPES;

export const MEASURES = { weight: "Weight (kg)", reps: "Reps", time: "Time", distance: "Distance (km)" } as const;
export type Measure = keyof typeof MEASURES;

export const BODY_MEASUREMENTS = {
  waist_cm: "Waist",
  chest_cm: "Chest",
  hips_cm: "Hips",
  arm_cm: "Arm",
  thigh_cm: "Thigh",
} as const;
export type BodyMeasurementKey = keyof typeof BODY_MEASUREMENTS;

/** "45" = 45 min · "1:30" = 1 min 30 s · "1:05:00" = 1 h 5 min. Vacío = null. NaN si no se entiende. */
export function parseDuration(s: string | null | undefined): number | null {
  const v = (s ?? "").trim();
  if (!v) return null;
  if (/^\d+([.,]\d+)?$/.test(v)) return Math.round(Number(v.replace(",", ".")) * 60);
  const parts = v.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return NaN;
  const n = parts.map(Number);
  if (n.slice(1).some((x) => x >= 60)) return NaN;
  return parts.length === 2 ? n[0] * 60 + n[1] : n[0] * 3600 + n[1] * 60 + n[2];
}

/** Segundos → texto editable ("1:30", "45", "1:05:00"). */
export function durationText(seconds: number | null | undefined) {
  if (seconds == null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const p = (x: number) => x.toString().padStart(2, "0");
  if (h) return `${h}:${p(m)}:${p(s)}`;
  return s ? `${m}:${p(s)}` : String(m);
}

export const durationField = z
  .string()
  .trim()
  .max(10)
  .optional()
  .or(z.literal(""))
  .refine((v) => !Number.isNaN(parseDuration(v)), "Use minutes (45), min:sec (1:30) or h:min:sec (1:30:00)")
  .refine((v) => (parseDuration(v) ?? 0) <= 24 * 3600, "Maximum 24 hours");

export const workoutItemSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    exercise_id: z.string().uuid().optional().or(z.literal("")),
    new_exercise: text(80),
    sets: optNum(1, 100, { int: true }),
    reps: optNum(0, 10000, { int: true }),
    weight_kg: optNum(0, 1000),
    time: durationField,
    distance_km: optNum(0, 1000),
    notes: text(500),
  })
  .refine((v) => !!v.exercise_id || !!v.new_exercise?.trim(), { message: "Choose or type an exercise", path: ["new_exercise"] });

export const workoutSchema = z.object({
  performed_on: date,
  activity_type: enumOf(ACTIVITY_TYPES),
  duration: durationField,
  notes: text(2000),
  add_to_calendar: z.boolean().default(false),
  items: z.array(workoutItemSchema).max(50, "Maximum 50 exercises per workout"),
});
export type WorkoutInput = z.input<typeof workoutSchema>;
export type WorkoutItemInput = z.input<typeof workoutItemSchema>;

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Enter the name").max(80, "Maximum 80 characters"),
  measure: enumOf(MEASURES),
});
export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const bodySchema = z
  .object({
    measured_on: date,
    weight_kg: optNum(20, 400),
    height_cm: optNum(50, 260),
    body_fat_pct: optNum(1, 75),
    waist_cm: optNum(10, 300),
    chest_cm: optNum(10, 300),
    hips_cm: optNum(10, 300),
    arm_cm: optNum(10, 300),
    thigh_cm: optNum(10, 300),
    notes: text(1000),
  })
  .refine(
    (v) => [v.weight_kg, v.height_cm, v.body_fat_pct, v.waist_cm, v.chest_cm, v.hips_cm, v.arm_cm, v.thigh_cm].some((x) => x != null) || !!v.notes?.trim(),
    { message: "Log at least one value or a note", path: ["weight_kg"] },
  );
export type BodyInput = z.input<typeof bodySchema>;

export const nutritionSchema = z
  .object({
    logged_on: date,
    meals: text(2000),
    water_liters: optNum(0, 20),
    protein_g: optNum(0, 1000),
    calories: optNum(0, 20000, { int: true }),
    notes: text(1000),
  })
  .refine((v) => [v.water_liters, v.protein_g, v.calories].some((x) => x != null) || !!v.meals?.trim() || !!v.notes?.trim(), {
    message: "Log at least one value or a note",
    path: ["meals"],
  });
export type NutritionInput = z.input<typeof nutritionSchema>;
