import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const text = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`).optional().or(z.literal(""));
const optUuid = z.string().uuid().optional().or(z.literal(""));

export const MEMORY_CATEGORIES = {
  personal: "Personal",
  family: "Family",
  friends: "Friends",
  relationships: "Relationships",
  career: "Career",
  education: "Education",
  travel: "Travel",
  achievements: "Achievements",
  experiences: "Experiences",
  important_moments: "Important moments",
} as const;
export type MemoryCategory = keyof typeof MEMORY_CATEGORIES;

/** Solo lo pone el usuario; nunca se calcula. */
export const IMPORTANCE = { "": "Not set", "1": "1 · Small", "2": "2", "3": "3", "4": "4", "5": "5 · Very important" } as const;

/** "a, b, , A" → ["a", "b"] sin duplicados (sin distinguir mayúsculas). */
export function splitList(s: string | null | undefined, max = 60) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (s ?? "").split(",")) {
    const v = raw.trim().replace(/\s+/g, " ").slice(0, max);
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export const memorySchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200, "Maximum 200 characters"),
  occurred_on: date,
  category: z.enum(Object.keys(MEMORY_CATEGORIES) as [MemoryCategory, ...MemoryCategory[]]),
  description: text(10000),
  location: text(200),
  people: text(1000).refine((v) => splitList(v, 100).length <= 30, "Maximum 30 people"),
  emotional_context: text(500),
  importance: z.enum(["", "1", "2", "3", "4", "5"]),
  chapter: text(100),
  tags: text(600).refine((v) => splitList(v).length <= 15, "Maximum 15 tags"),
  goal_id: optUuid,
  event_id: optUuid,
  project_id: optUuid,
  workout_id: optUuid,
  link_daily_entry: z.boolean().default(false),
});
export type MemoryInput = z.input<typeof memorySchema>;
