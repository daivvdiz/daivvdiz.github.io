import { z } from "zod";
import { EVENT_CATEGORIES } from "@/lib/types";
import { FREQS, normalize, presets, type Recurrence } from "./recurrence";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Invalid time");
const optNum = z.preprocess((v) => (v === "" || v == null || Number.isNaN(v) ? null : Number(v)), z.number().nullable());

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
    // Repetición
    repeat: z.string().default("none"),
    r_freq: z.enum(Object.keys(FREQS) as [keyof typeof FREQS, ...(keyof typeof FREQS)[]]).default("weekly"),
    r_interval: optNum,
    r_weekdays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
    r_monthly: z.enum(["day", "nth", "last"]).default("day"),
    r_end: z.enum(["never", "until", "count"]).default("never"),
    r_until: z.string().optional().or(z.literal("")),
    r_count: optNum,
  })
  .superRefine((v, ctx) => {
    if (!v.all_day && !v.start_time) ctx.addIssue({ code: "custom", path: ["start_time"], message: "Enter the start time" });
    if (!v.all_day && v.start_time && v.end_time && v.end_time < v.start_time)
      ctx.addIssue({ code: "custom", path: ["end_time"], message: "The end time must be after the start" });
    if (v.repeat === "none") return;
    if (v.repeat === "custom" && (v.r_interval == null || v.r_interval < 1 || v.r_interval > 99 || !Number.isInteger(v.r_interval)))
      ctx.addIssue({ code: "custom", path: ["r_interval"], message: "Use a whole number from 1 to 99" });
    if (v.r_end === "until") {
      if (!v.r_until || !/^\d{4}-\d{2}-\d{2}$/.test(v.r_until)) ctx.addIssue({ code: "custom", path: ["r_until"], message: "Choose the end date" });
      else if (v.r_until < v.date) ctx.addIssue({ code: "custom", path: ["r_until"], message: "The end date can't be before the event" });
    }
    if (v.r_end === "count" && (v.r_count == null || v.r_count < 1 || v.r_count > 999 || !Number.isInteger(v.r_count)))
      ctx.addIssue({ code: "custom", path: ["r_count"], message: "Use a whole number from 1 to 999" });
  });

export type EventInput = z.input<typeof eventSchema>;
export type EventValues = z.output<typeof eventSchema>;

/** Regla de repetición a partir del formulario; null si no se repite. */
export function ruleFromInput(v: EventValues): { rule: Recurrence; until: string | null } | null {
  if (v.repeat === "none") return null;
  let rule: Recurrence | null;
  if (v.repeat === "custom") {
    rule = { freq: v.r_freq, interval: v.r_interval ?? 1, weekdays: v.r_weekdays, monthly: v.r_monthly };
  } else {
    rule = presets(v.date).find((p) => p.key === v.repeat)?.rule ?? null;
    if (!rule) return null;
  }
  if (v.r_end === "count") rule = { ...rule, count: v.r_count };
  return { rule: normalize(rule, v.date), until: v.r_end === "until" ? v.r_until || null : null };
}
