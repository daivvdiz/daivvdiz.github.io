import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const JOURNAL_KINDS = {
  emotional: "Emotions",
  thought: "Thoughts",
  difficult: "Difficult experience",
  reflection: "Reflection",
  helped: "What helped me",
} as const;

export const emotionsSchema = z.object({
  date,
  emotions: z
    .array(z.object({ name: z.string().trim().min(1).max(40), intensity: z.number().int().min(1).max(10).nullable() }))
    .max(15, "Maximum 15 emotions"),
  stress_factors: z.array(z.string().trim().min(1).max(200)).max(10, "Maximum 10 factors"),
});
export type EmotionsInput = z.infer<typeof emotionsSchema>;

export const journalSchema = z.object({
  entry_date: date,
  kind: z.enum(Object.keys(JOURNAL_KINDS) as [keyof typeof JOURNAL_KINDS, ...(keyof typeof JOURNAL_KINDS)[]]),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  content: z.string().trim().min(1, "Write something").max(20000, "Maximum 20,000 characters"),
});
export type JournalInput = z.infer<typeof journalSchema>;

export const strategySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80, "Maximum 80 characters"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  is_active: z.boolean(),
});
export type StrategyInput = z.infer<typeof strategySchema>;

export const strategyLogSchema = z.object({
  coping_strategy_id: z.string().uuid("Choose a strategy"),
  used_on: date,
  helped: z.number().int().min(1).max(5).nullable(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type StrategyLogInput = z.infer<typeof strategyLogSchema>;

export const HELPED_LABELS: Record<number, string> = {
  1: "Didn't help",
  2: "Helped a little",
  3: "Helped somewhat",
  4: "Helped quite a bit",
  5: "Helped a lot",
};

export const SUGGESTED_STRATEGIES = ["Exercise", "Walk", "Talk to someone", "Meditate", "Write", "Rest"];
