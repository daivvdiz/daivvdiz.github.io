import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");

export const JOURNAL_KINDS = {
  emotional: "Emociones",
  thought: "Pensamientos",
  difficult: "Experiencia difícil",
  reflection: "Reflexión",
  helped: "Lo que me ayudó",
} as const;

export const emotionsSchema = z.object({
  date,
  emotions: z
    .array(z.object({ name: z.string().trim().min(1).max(40), intensity: z.number().int().min(1).max(10).nullable() }))
    .max(15, "Máximo 15 emociones"),
  stress_factors: z.array(z.string().trim().min(1).max(200)).max(10, "Máximo 10 factores"),
});
export type EmotionsInput = z.infer<typeof emotionsSchema>;

export const journalSchema = z.object({
  entry_date: date,
  kind: z.enum(Object.keys(JOURNAL_KINDS) as [keyof typeof JOURNAL_KINDS, ...(keyof typeof JOURNAL_KINDS)[]]),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  content: z.string().trim().min(1, "Escribe algo").max(20000, "Máximo 20.000 caracteres"),
});
export type JournalInput = z.infer<typeof journalSchema>;

export const strategySchema = z.object({
  name: z.string().trim().min(1, "Escribe un nombre").max(80, "Máximo 80 caracteres"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  is_active: z.boolean(),
});
export type StrategyInput = z.infer<typeof strategySchema>;

export const strategyLogSchema = z.object({
  coping_strategy_id: z.string().uuid("Elige una estrategia"),
  used_on: date,
  helped: z.number().int().min(1).max(5).nullable(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type StrategyLogInput = z.infer<typeof strategyLogSchema>;

export const HELPED_LABELS: Record<number, string> = {
  1: "No ayudó",
  2: "Ayudó poco",
  3: "Ayudó algo",
  4: "Ayudó bastante",
  5: "Ayudó mucho",
};

export const SUGGESTED_STRATEGIES = ["Hacer ejercicio", "Caminar", "Hablar con alguien", "Meditar", "Escribir", "Descansar"];
