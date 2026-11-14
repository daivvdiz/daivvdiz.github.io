import { z } from "zod";

const level = z.coerce.number({ invalid_type_error: "Elige un valor" }).int().min(1, "Mínimo 1").max(10, "Máximo 10");

export const assessmentSchema = z.object({
  assessed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  professional: level,
  financial: level,
  physical: level,
  emotional: level,
  social: level,
  intellectual: level,
  notes: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
});

export type AssessmentInput = z.infer<typeof assessmentSchema>;
