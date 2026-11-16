import { z } from "zod";

const scale = z.number().int().min(1, "Minimum 1").max(10, "Maximum 10").nullable();

export const dailyEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  mood: scale,
  energy: scale,
  stress: scale,
  sleep_hours: z.number().min(0, "Can't be negative").max(24, "Maximum 24 hours").nullable(),
  sleep_quality: scale,
  sleep_notes: z.string().trim().max(2000),
  journal: z.string().max(20000, "Maximum 20,000 characters"),
  memory: z.string().max(5000, "Maximum 5,000 characters"),
  preserve_memory: z.boolean(),
  gratitude: z.array(z.string().trim().max(500, "Maximum 500 characters")).max(3, "Up to 3 things"),
  accomplishments: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        content: z.string().trim().min(1, "Write the accomplishment").max(500, "Maximum 500 characters"),
        is_main: z.boolean(),
        goal_id: z.string().uuid().nullable(),
      }),
    )
    .max(30, "Maximum 30 accomplishments per day"),
  tag_names: z.array(z.string().trim().min(1).max(60)).max(20, "Maximum 20 tags"),
  goal_ids: z.array(z.string().uuid()).max(50),
  event_ids: z.array(z.string().uuid()).max(50),
});

export type DailyEntryInput = z.infer<typeof dailyEntrySchema>;
