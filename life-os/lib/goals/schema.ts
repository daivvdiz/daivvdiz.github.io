import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const optDate = date.optional().or(z.literal(""));

export const GOAL_CATEGORIES = {
  professional: "Professional",
  financial: "Financial",
  physical: "Physical",
  emotional: "Emotional",
  social: "Social",
  intellectual: "Intellectual",
  personal: "Personal",
} as const;
export type GoalCategory = keyof typeof GOAL_CATEGORIES;

export const GOAL_STATUS = {
  not_started: "Not started",
  active: "In progress",
  paused: "Paused",
  completed: "Completed",
  abandoned: "Let go",
} as const;
export type GoalStatus = keyof typeof GOAL_STATUS;

export const PRIORITIES = { high: "High", medium: "Medium", low: "Low" } as const;

export const FREQUENCIES = { daily: "Every day", custom: "Specific days", weekly: "Times per week" } as const;
export const TRACKING = { check: "Done / not done", count: "Amount", duration: "Minutes" } as const;
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const enumOf = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

export const goalSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(200, "Maximum 200 characters"),
    description: z.string().trim().max(5000).optional().or(z.literal("")),
    category: enumOf(GOAL_CATEGORIES),
    motivation: z.string().trim().max(2000).optional().or(z.literal("")),
    start_date: optDate,
    target_date: optDate,
    status: enumOf(GOAL_STATUS),
    priority: enumOf(PRIORITIES),
    progress: z.number({ invalid_type_error: "Enter a number" }).int().min(0, "Minimum 0").max(100, "Maximum 100"),
    habit_ids: z.array(z.string().uuid()).max(50),
  })
  .refine((v) => !v.start_date || !v.target_date || v.target_date >= v.start_date, {
    path: ["target_date"],
    message: "The target date can't be before the start",
  });
export type GoalInput = z.infer<typeof goalSchema>;

export const milestoneSchema = z.object({
  goal_id: z.string().uuid(),
  title: z.string().trim().min(1, "Enter the milestone").max(200, "Maximum 200 characters"),
  due_date: optDate,
});
export type MilestoneInput = z.infer<typeof milestoneSchema>;

export const habitSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(120, "Maximum 120 characters"),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    category: enumOf(GOAL_CATEGORIES).optional().or(z.literal("")),
    frequency: enumOf(FREQUENCIES),
    times_per_period: z.number({ invalid_type_error: "Enter a number" }).int().min(1, "Minimum 1").max(7, "Maximum 7"),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    tracking_method: enumOf(TRACKING),
    start_date: date,
    is_active: z.boolean(),
    goal_ids: z.array(z.string().uuid()).max(50),
  })
  .refine((v) => v.frequency !== "custom" || v.weekdays.length > 0, { path: ["weekdays"], message: "Choose at least one day" });
export type HabitInput = z.infer<typeof habitSchema>;

export const habitLogSchema = z.object({
  habit_id: z.string().uuid(),
  logged_on: date,
  value: z.number().min(0, "Can't be negative").max(100000).nullable(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type HabitLogInput = z.infer<typeof habitLogSchema>;
