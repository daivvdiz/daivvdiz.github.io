import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Habit, HabitLog } from "./habits";
import type { GoalCategory, GoalStatus } from "./schema";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  motivation: string | null;
  start_date: string | null;
  target_date: string | null;
  status: GoalStatus;
  priority: "low" | "medium" | "high";
  progress: number;
  updated_at: string;
  milestones: { id: string; title: string; due_date: string | null; completed_at: string | null; position: number }[];
  habit_ids: string[];
}

const GOAL_COLS = "id, title, description, category, motivation, start_date, target_date, status, priority, progress, updated_at, milestones(id, title, due_date, completed_at, position), goal_habits(habit_id)";

type RawGoal = Omit<Goal, "habit_ids"> & { goal_habits: { habit_id: string }[] | null };
const toGoal = (g: RawGoal): Goal => {
  const { goal_habits, ...rest } = g;
  return {
    ...rest,
    milestones: [...(g.milestones ?? [])].sort((a, b) => a.position - b.position || a.title.localeCompare(b.title)),
    habit_ids: (goal_habits ?? []).map((x) => x.habit_id),
  };
};

type RawHabit = Omit<Habit, "goal_ids"> & { goal_habits: { goal_id: string }[] | null };
const toHabit = (h: RawHabit): Habit => {
  const { goal_habits, ...rest } = h;
  return { ...rest, goal_ids: (goal_habits ?? []).map((x) => x.goal_id) };
};
const HABIT_COLS = "id, name, description, category, frequency, times_per_period, weekdays, tracking_method, start_date, is_active, goal_habits(goal_id)";

export async function getGoalsPage(supabase: SupabaseClient, from: string, to: string) {
  const [goals, habits, logs] = await Promise.all([
    supabase.from("goals").select(GOAL_COLS).order("updated_at", { ascending: false }),
    supabase.from("habits").select(HABIT_COLS).order("name"),
    supabase.from("habit_logs").select("habit_id, logged_on, value, notes").gte("logged_on", from).lte("logged_on", to),
  ]);
  return {
    error: goals.error ?? habits.error ?? logs.error,
    goals: ((goals.data ?? []) as unknown as RawGoal[]).map(toGoal),
    habits: ((habits.data ?? []) as unknown as RawHabit[]).map(toHabit),
    logs: ((logs.data ?? []) as HabitLog[]).map((l) => ({ ...l, value: l.value == null ? null : Number(l.value) })),
  };
}

export async function getGoalDetail(supabase: SupabaseClient, id: string, from: string, to: string) {
  const goal = await supabase.from("goals").select(GOAL_COLS).eq("id", id).maybeSingle();
  if (!goal.data) return null;
  const g = toGoal(goal.data as unknown as RawGoal);

  const [habits, logs, entries, accomplishments, events, memories, projects] = await Promise.all([
    supabase.from("habits").select(HABIT_COLS).order("name"),
    supabase.from("habit_logs").select("habit_id, logged_on, value, notes").gte("logged_on", from).lte("logged_on", to),
    supabase.from("goal_daily_entries").select("daily_entries(id, entry_date, journal, mood)").eq("goal_id", id),
    supabase.from("daily_accomplishments").select("id, content, is_main, daily_entries(entry_date)").eq("goal_id", id).limit(200),
    supabase.from("calendar_events").select("id, title, starts_at, all_day, category").eq("goal_id", id).order("starts_at", { ascending: false }).limit(100),
    supabase.from("memories").select("id, title, occurred_on").eq("goal_id", id).order("occurred_on", { ascending: false }).limit(50),
    supabase.from("projects").select("id, name, status").eq("goal_id", id).limit(50),
  ]);

  type Entry = { id: string; entry_date: string; journal: string | null; mood: number | null };
  const allHabits = ((habits.data ?? []) as unknown as RawHabit[]).map(toHabit);
  return {
    goal: g,
    allHabits,
    habits: allHabits.filter((h) => g.habit_ids.includes(h.id)),
    logs: ((logs.data ?? []) as HabitLog[]).map((l) => ({ ...l, value: l.value == null ? null : Number(l.value) })),
    entries: ((entries.data ?? []) as unknown as { daily_entries: Entry | null }[])
      .map((e) => e.daily_entries)
      .filter((e): e is Entry => !!e)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    accomplishments: ((accomplishments.data ?? []) as unknown as { id: string; content: string; is_main: boolean; daily_entries: { entry_date: string } | null }[])
      .map((a) => ({ id: a.id, content: a.content, is_main: a.is_main, date: a.daily_entries?.entry_date ?? null }))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    events: (events.data ?? []) as { id: string; title: string; starts_at: string; all_day: boolean; category: string }[],
    memories: (memories.data ?? []) as { id: string; title: string | null; occurred_on: string | null }[],
    projects: (projects.data ?? []) as { id: string; name: string; status: string | null }[],
  };
}
