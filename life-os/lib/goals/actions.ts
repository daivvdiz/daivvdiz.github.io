"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import {
  goalSchema, habitLogSchema, habitSchema, milestoneSchema,
  type GoalInput, type GoalStatus, type HabitInput, type HabitLogInput, type MilestoneInput, GOAL_STATUS,
} from "./schema";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const issue = (e: z.ZodError) => ({ ok: false as const, error: e.issues[0]?.message ?? "Datos no válidos" });

function revalidate() {
  revalidatePath("/goals", "layout");
  revalidatePath("/overview");
  revalidatePath("/calendar");
}

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Reemplaza los vínculos meta↔hábito de un lado. */
async function syncLinks(supabase: Supa, userId: string, side: "goal_id" | "habit_id", id: string, others: string[]) {
  const other = side === "goal_id" ? "habit_id" : "goal_id";
  const d = await supabase.from("goal_habits").delete().eq(side, id);
  if (d.error) return false;
  if (!others.length) return true;
  const r = await supabase.from("goal_habits").insert([...new Set(others)].map((o) => ({ user_id: userId, [side]: id, [other]: o })));
  return !r.error;
}

export async function saveGoal(input: GoalInput, id?: string): Promise<Result<{ id: string }>> {
  const p = goalSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const { habit_ids, ...v } = p.data;
  const row = {
    ...v,
    description: v.description || null,
    motivation: v.motivation || null,
    start_date: v.start_date || null,
    target_date: v.target_date || null,
  };
  const r = id
    ? await supabase.from("goals").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id).select("id").single()
    : await supabase.from("goals").insert({ ...row, user_id: user.id }).select("id").single();
  if (r.error || !r.data) return { ok: false, error: "No se pudo guardar la meta." };
  const goalId = r.data.id as string;
  if (!(await syncLinks(supabase, user.id, "goal_id", goalId, habit_ids))) return { ok: false, error: "La meta se guardó, pero no sus hábitos." };
  revalidate();
  return { ok: true, id: goalId };
}

export async function setGoalStatus(id: string, status: GoalStatus): Promise<Result> {
  if (!(status in GOAL_STATUS)) return { ok: false, error: "Estado no válido" };
  const { supabase, user } = await requireUser();
  const patch: Record<string, unknown> = { status };
  if (status === "completed") patch.progress = 100;
  const r = await supabase.from("goals").update(patch).eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "No se pudo cambiar el estado." };
  revalidate();
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from("goals").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "No se pudo eliminar la meta." };
  revalidate();
  return { ok: true };
}

export async function saveMilestone(input: MilestoneInput, id?: string): Promise<Result> {
  const p = milestoneSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const row = { title: p.data.title, due_date: p.data.due_date || null };
  let r;
  if (id) {
    r = await supabase.from("milestones").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id);
  } else {
    const { count } = await supabase.from("milestones").select("id", { count: "exact", head: true }).eq("goal_id", p.data.goal_id);
    r = await supabase.from("milestones").insert({ ...row, goal_id: p.data.goal_id, user_id: user.id, position: count ?? 0 });
  }
  if (r.error) return { ok: false, error: "No se pudo guardar el hito." };
  revalidate();
  return { ok: true };
}

export async function toggleMilestone(id: string, completedOn: string | null): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase
    .from("milestones")
    .update({ completed_at: completedOn == null ? null : isoDate.parse(completedOn) })
    .eq("id", uuid.parse(id))
    .eq("user_id", user.id);
  if (r.error) return { ok: false, error: "No se pudo actualizar el hito." };
  revalidate();
  return { ok: true };
}

export async function deleteMilestone(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from("milestones").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "No se pudo eliminar el hito." };
  revalidate();
  return { ok: true };
}

export async function saveHabit(input: HabitInput, id?: string): Promise<Result<{ id: string }>> {
  const p = habitSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const { goal_ids, ...v } = p.data;
  const row = {
    ...v,
    description: v.description || null,
    category: v.category || null,
    weekdays: v.frequency === "custom" ? [...new Set(v.weekdays)].sort() : null,
    times_per_period: v.frequency === "weekly" ? v.times_per_period : 1,
  };
  const r = id
    ? await supabase.from("habits").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id).select("id").single()
    : await supabase.from("habits").insert({ ...row, user_id: user.id }).select("id").single();
  if (r.error || !r.data) return { ok: false, error: "No se pudo guardar el hábito." };
  const habitId = r.data.id as string;
  if (!(await syncLinks(supabase, user.id, "habit_id", habitId, goal_ids))) return { ok: false, error: "El hábito se guardó, pero no sus metas." };
  revalidate();
  return { ok: true, id: habitId };
}

export async function deleteHabit(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from("habits").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "No se pudo eliminar el hábito." };
  revalidate();
  return { ok: true };
}

/** Registra (o actualiza) el hábito en un día. Un registro por hábito y día. */
export async function logHabit(input: HabitLogInput): Promise<Result> {
  const p = habitLogSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const r = await supabase
    .from("habit_logs")
    .upsert({ ...p.data, notes: p.data.notes || null, user_id: user.id }, { onConflict: "habit_id,logged_on" });
  if (r.error) return { ok: false, error: "No se pudo registrar." };
  revalidate();
  return { ok: true };
}

export async function unlogHabit(habitId: string, date: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase
    .from("habit_logs")
    .delete()
    .eq("habit_id", uuid.parse(habitId))
    .eq("logged_on", isoDate.parse(date))
    .eq("user_id", user.id);
  if (r.error) return { ok: false, error: "No se pudo quitar el registro." };
  revalidate();
  return { ok: true };
}
