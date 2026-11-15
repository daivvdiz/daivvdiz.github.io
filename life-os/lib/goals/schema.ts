import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const optDate = date.optional().or(z.literal(""));

export const GOAL_CATEGORIES = {
  professional: "Profesional",
  financial: "Financiera",
  physical: "Física",
  emotional: "Emocional",
  social: "Social",
  intellectual: "Intelectual",
  personal: "Personal",
} as const;
export type GoalCategory = keyof typeof GOAL_CATEGORIES;

export const GOAL_STATUS = {
  not_started: "Sin empezar",
  active: "En curso",
  paused: "En pausa",
  completed: "Completada",
  abandoned: "Soltada",
} as const;
export type GoalStatus = keyof typeof GOAL_STATUS;

export const PRIORITIES = { high: "Alta", medium: "Media", low: "Baja" } as const;

export const FREQUENCIES = { daily: "Todos los días", custom: "Días específicos", weekly: "Veces por semana" } as const;
export const TRACKING = { check: "Hecho / no hecho", count: "Cantidad", duration: "Minutos" } as const;
export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const enumOf = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

export const goalSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe un título").max(200, "Máximo 200 caracteres"),
    description: z.string().trim().max(5000).optional().or(z.literal("")),
    category: enumOf(GOAL_CATEGORIES),
    motivation: z.string().trim().max(2000).optional().or(z.literal("")),
    start_date: optDate,
    target_date: optDate,
    status: enumOf(GOAL_STATUS),
    priority: enumOf(PRIORITIES),
    progress: z.number({ invalid_type_error: "Indica un número" }).int().min(0, "Mínimo 0").max(100, "Máximo 100"),
    habit_ids: z.array(z.string().uuid()).max(50),
  })
  .refine((v) => !v.start_date || !v.target_date || v.target_date >= v.start_date, {
    path: ["target_date"],
    message: "La fecha objetivo no puede ser anterior al inicio",
  });
export type GoalInput = z.infer<typeof goalSchema>;

export const milestoneSchema = z.object({
  goal_id: z.string().uuid(),
  title: z.string().trim().min(1, "Escribe el hito").max(200, "Máximo 200 caracteres"),
  due_date: optDate,
});
export type MilestoneInput = z.infer<typeof milestoneSchema>;

export const habitSchema = z
  .object({
    name: z.string().trim().min(1, "Escribe un nombre").max(120, "Máximo 120 caracteres"),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    category: enumOf(GOAL_CATEGORIES).optional().or(z.literal("")),
    frequency: enumOf(FREQUENCIES),
    times_per_period: z.number({ invalid_type_error: "Indica un número" }).int().min(1, "Mínimo 1").max(7, "Máximo 7"),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    tracking_method: enumOf(TRACKING),
    start_date: date,
    is_active: z.boolean(),
    goal_ids: z.array(z.string().uuid()).max(50),
  })
  .refine((v) => v.frequency !== "custom" || v.weekdays.length > 0, { path: ["weekdays"], message: "Elige al menos un día" });
export type HabitInput = z.infer<typeof habitSchema>;

export const habitLogSchema = z.object({
  habit_id: z.string().uuid(),
  logged_on: date,
  value: z.number().min(0, "No puede ser negativo").max(100000).nullable(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type HabitLogInput = z.infer<typeof habitLogSchema>;
