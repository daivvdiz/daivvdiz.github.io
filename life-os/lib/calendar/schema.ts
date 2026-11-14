import { z } from "zod";
import { EVENT_CATEGORIES } from "@/lib/types";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida");

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe un título").max(200, "Máximo 200 caracteres"),
    description: z.string().trim().max(5000).optional().or(z.literal("")),
    category: z.enum(Object.keys(EVENT_CATEGORIES) as [string, ...string[]]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
    all_day: z.boolean(),
    start_time: time.optional().or(z.literal("")),
    end_time: time.optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    goal_id: z.string().uuid().optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (!v.all_day && !v.start_time) ctx.addIssue({ code: "custom", path: ["start_time"], message: "Indica la hora de inicio" });
    if (!v.all_day && v.start_time && v.end_time && v.end_time < v.start_time)
      ctx.addIssue({ code: "custom", path: ["end_time"], message: "La hora final debe ser después del inicio" });
  });

export type EventInput = z.infer<typeof eventSchema>;
