import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().trim().max(120, "Máximo 120 caracteres"),
  timezone: z.string().trim().min(1, "Elige una zona horaria").max(64),
  currency: z.enum(["COP", "USD", "EUR"]),
  week_starts_on: z.coerce.number().int().min(0).max(6),
  default_period: z.enum(["7d", "30d", "90d", "180d"]),
});

export type ProfileInput = z.infer<typeof profileSchema>;
