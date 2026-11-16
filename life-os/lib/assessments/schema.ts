import { z } from "zod";

const level = z.coerce.number({ invalid_type_error: "Choose a value" }).int().min(1, "Minimum 1").max(10, "Maximum 10");

export const assessmentSchema = z.object({
  assessed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  professional: level,
  financial: level,
  physical: level,
  emotional: level,
  social: level,
  intellectual: level,
  notes: z.string().trim().max(2000, "Maximum 2000 characters").optional().or(z.literal("")),
});

export type AssessmentInput = z.infer<typeof assessmentSchema>;
