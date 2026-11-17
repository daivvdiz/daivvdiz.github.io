import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDay, monthRange, todayISO } from "@/lib/format";
import type { ActivityItem, CalendarEvent, LifeAssessment } from "@/lib/types";
import { WORKOUT_TYPES } from "@/lib/types";
import { addDays } from "@/lib/dates";
import { fetchEvents } from "@/lib/calendar/queries";

const ACTIVE_STAGES = ["interested", "applied", "recruiter_screen", "technical_interview", "final_interview", "offer"];

function sum(rows: { amount: number | string }[] | null) {
  return (rows ?? []).reduce((acc, r) => acc + Number(r.amount), 0);
}

/** Todo lo que necesita el Resumen, en consultas paralelas. Cada valor viene de la base, nunca se inventa. */
export async function getOverview(supabase: SupabaseClient, timeZone: string) {
  const today = todayISO(timeZone);
  const { start, end } = monthRange(today);
  const nowIso = new Date().toISOString();
  const weekAhead = new Date(Date.now() + 14 * 864e5).toISOString();

  const [
    entry, habitsDone, events, assessments, activeGoals, income, expenses,
    applications, workouts, memories, liabilities, liabilityPayments, legacyCount, monthWorkouts,
  ] = await Promise.all([
    supabase.from("daily_entries")
      .select("id, mood, energy, stress, sleep_hours, daily_accomplishments(content, is_main, created_at)")
      .eq("entry_date", today).maybeSingle(),
    supabase.from("habit_logs").select("id", { count: "exact", head: true }).eq("logged_on", today),
    // Incluye las repeticiones de los eventos que se repiten.
    fetchEvents(supabase, { start: today, end: addDays(today, 14) }, timeZone),
    supabase.from("life_assessments")
      .select("id, assessed_on, professional, financial, physical, emotional, social, intellectual, notes")
      .order("assessed_on", { ascending: false }).order("created_at", { ascending: false }).limit(36),
    supabase.from("goals").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("transactions").select("amount").eq("type", "income").gte("occurred_on", start).lte("occurred_on", end),
    supabase.from("transactions").select("amount").eq("type", "expense").gte("occurred_on", start).lte("occurred_on", end),
    supabase.from("career_applications").select("id", { count: "exact", head: true }).in("stage", ACTIVE_STAGES),
    supabase.from("workouts").select("id, performed_on, activity_type, duration_seconds, workout_exercises(count)")
      .order("performed_on", { ascending: false }).limit(3),
    supabase.from("memories").select("id, title, occurred_on, category").order("occurred_on", { ascending: false }).limit(3),
    supabase.from("liabilities").select("id, name, original_amount").order("created_at"),
    supabase.from("transactions").select("liability_id, amount").not("liability_id", "is", null),
    supabase.rpc("preview_segundo_cerebro_import"),
    supabase.from("workouts").select("id", { count: "exact", head: true }).gte("performed_on", start).lte("performed_on", end),
  ]);

  const accomplishments = (entry.data?.daily_accomplishments ?? []) as { content: string; is_main: boolean; created_at: string }[];
  const mainAccomplishment =
    accomplishments.find((a) => a.is_main)?.content ?? accomplishments.sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.content ?? null;

  const paidByLiability = new Map<string, number>();
  for (const p of liabilityPayments.data ?? []) {
    paidByLiability.set(p.liability_id as string, (paidByLiability.get(p.liability_id as string) ?? 0) + Number(p.amount));
  }

  const monthIncome = sum(income.data);
  const monthExpenses = sum(expenses.data);

  return {
    today,
    daily: entry.data
      ? {
          mood: entry.data.mood as number | null,
          energy: entry.data.energy as number | null,
          stress: entry.data.stress as number | null,
          sleepHours: entry.data.sleep_hours == null ? null : Number(entry.data.sleep_hours),
          mainAccomplishment,
          accomplishmentCount: accomplishments.length,
        }
      : null,
    habitsDone: habitsDone.count ?? 0,
    events: events.events
      .filter((e) => e.starts_at >= nowIso && e.starts_at <= weekAhead)
      .slice(0, 6)
      .map((e) => ({ id: e.id, title: e.title, category: e.category, starts_at: e.starts_at, all_day: e.all_day })) as CalendarEvent[],
    assessments: (assessments.data ?? []) as LifeAssessment[],
    activeGoals: activeGoals.count ?? 0,
    finance: {
      income: monthIncome,
      expenses: monthExpenses,
      incomeCount: income.data?.length ?? 0,
      expenseCount: expenses.data?.length ?? 0,
      net: monthIncome - monthExpenses,
    },
    liabilities: (liabilities.data ?? []).map((l) => ({
      id: l.id as string,
      name: l.name as string,
      original: Number(l.original_amount),
      paid: paidByLiability.get(l.id as string) ?? 0,
    })),
    activeApplications: applications.count ?? 0,
    monthWorkouts: monthWorkouts.count ?? 0,
    workouts: (workouts.data ?? []).map((w) => ({
      id: w.id as string,
      date: w.performed_on as string,
      type: WORKOUT_TYPES[w.activity_type as string] ?? (w.activity_type as string),
      duration: w.duration_seconds as number | null,
      exercises: (w.workout_exercises as { count: number }[] | null)?.[0]?.count ?? 0,
    })),
    memories: (memories.data ?? []) as { id: string; title: string; occurred_on: string; category: string }[],
    // Registros de Segundo Cerebro que todavía no se copiaron a LIFE OS.
    legacyPending: legacyCount.error
      ? 0
      : ((legacyCount.data ?? []) as { total: number; ya_importados: number }[]).reduce(
          (acc, r) => acc + Number(r.total) - Number(r.ya_importados), 0),
  };
}

/** Línea de tiempo con lo último que se creó en cada módulo. */
export async function getRecentActivity(supabase: SupabaseClient): Promise<ActivityItem[]> {
  const n = 6;
  const [entries, goals, workouts, apps, memories, txs, positions, skills, assessments] = await Promise.all([
    supabase.from("daily_entries").select("id, entry_date, created_at").order("created_at", { ascending: false }).limit(n),
    supabase.from("goals").select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(n),
    supabase.from("workouts").select("id, activity_type, performed_on, created_at").order("created_at", { ascending: false }).limit(n),
    supabase.from("career_applications").select("id, company, position, created_at").order("created_at", { ascending: false }).limit(n),
    supabase.from("memories").select("id, title, created_at").order("created_at", { ascending: false }).limit(n),
    supabase.from("transactions").select("id, description, type, created_at").order("created_at", { ascending: false }).limit(n),
    supabase.from("career_positions").select("id, title, company, created_at").order("created_at", { ascending: false }).limit(n),
    supabase.from("skill_levels").select("id, level, created_at, skills(name)").order("created_at", { ascending: false }).limit(n),
    supabase.from("life_assessments").select("id, assessed_on, created_at").order("created_at", { ascending: false }).limit(n),
  ]);

  const items: ActivityItem[] = [
    ...(entries.data ?? []).map((r) => ({ id: `de-${r.id}`, kind: "daily_entry" as const, label: "Daily entry logged", detail: formatDay(r.entry_date), at: r.created_at })),
    ...(goals.data ?? []).map((r) => ({ id: `g-${r.id}`, kind: "goal" as const, label: "Goal updated", detail: r.title, at: r.updated_at })),
    ...(workouts.data ?? []).map((r) => ({ id: `w-${r.id}`, kind: "workout" as const, label: "Workout logged", detail: WORKOUT_TYPES[r.activity_type] ?? r.activity_type, at: r.created_at })),
    ...(apps.data ?? []).map((r) => ({ id: `a-${r.id}`, kind: "application" as const, label: "Application logged", detail: `${r.position} · ${r.company}`, at: r.created_at })),
    ...(memories.data ?? []).map((r) => ({ id: `m-${r.id}`, kind: "memory" as const, label: "Memory added", detail: r.title, at: r.created_at })),
    ...(txs.data ?? []).map((r) => ({ id: `t-${r.id}`, kind: "transaction" as const, label: r.type === "income" ? "Income logged" : r.type === "expense" ? "Expense logged" : "Savings contribution logged", detail: r.description, at: r.created_at })),
    ...(positions.data ?? []).map((r) => ({ id: `p-${r.id}`, kind: "position" as const, label: "Position logged", detail: [r.title, r.company].filter(Boolean).join(" · "), at: r.created_at })),
    ...(skills.data ?? []).map((r) => ({
      id: `s-${r.id}`, kind: "skill" as const, label: "Skill level logged",
      detail: `${(r.skills as unknown as { name: string } | null)?.name ?? "Skill"} · ${Number(r.level)}/10`, at: r.created_at,
    })),
    ...(assessments.data ?? []).map((r) => ({ id: `la-${r.id}`, kind: "assessment" as const, label: "Life self-assessment", detail: formatDay(r.assessed_on), at: r.created_at })),
  ];
  return items.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, 12);
}
