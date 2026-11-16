import { z } from "zod";
import { EVENT_CATEGORIES } from "@/lib/types";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Invalid time");

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(200, "Maximum 200 characters"),
    description: z.string().trim().max(5000).optional().or(z.literal("")),
    category: z.enum(Object.keys(EVENT_CATEGORIES) as [string, ...string[]]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    all_day: z.boolean(),
    start_time: time.optional().or(z.literal("")),
    end_time: time.optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    goal_id: z.string().uuid().optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (!v.all_day && !v.start_time) ctx.addIssue({ code: "custom", path: ["start_time"], message: "Enter the start time" });
    if (!v.all_day && v.start_time && v.end_time && v.end_time < v.start_time)
      ctx.addIssue({ code: "custom", path: ["end_time"], message: "The end time must be after the start" });
  });

export type EventInput = z.infer<typeof eventSchema>;
