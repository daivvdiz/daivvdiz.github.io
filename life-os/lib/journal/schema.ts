import { z } from "zod";

const scale = z.number().int().min(1, "Mínimo 1").max(10, "Máximo 10").nullable();

export const dailyEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  mood: scale,
  energy: scale,
  stress: scale,
  sleep_hours: z.number().min(0, "No puede ser negativo").max(24, "Máximo 24 horas").nullable(),
  sleep_quality: scale,
  sleep_notes: z.string().trim().max(2000),
  journal: z.string().max(20000, "Máximo 20.000 caracteres"),
  memory: z.string().max(5000, "Máximo 5.000 caracteres"),
  preserve_memory: z.boolean(),
  gratitude: z.array(z.string().trim().max(500, "Máximo 500 caracteres")).max(3, "Hasta 3 cosas"),
  accomplishments: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        content: z.string().trim().min(1, "Escribe el logro").max(500, "Máximo 500 caracteres"),
        is_main: z.boolean(),
        goal_id: z.string().uuid().nullable(),
      }),
    )
    .max(30, "Máximo 30 logros por día"),
  tag_names: z.array(z.string().trim().min(1).max(60)).max(20, "Máximo 20 etiquetas"),
  goal_ids: z.array(z.string().uuid()).max(50),
  event_ids: z.array(z.string().uuid()).max(50),
});

export type DailyEntryInput = z.infer<typeof dailyEntrySchema>;
