// Analítica de vida: lee los registros reales de cada módulo y los resume por periodo.
// Nunca rellena valores: un promedio sin registros es null y cada cifra dice con cuántos se calculó.

import type { SupabaseClient } from "@supabase/supabase-js";
import { utcToZoned } from "@/lib/dates";
import { habitStats, type Habit, type HabitLog } from "@/lib/goals/habits";
import { mean, type DayPoint } from "@/lib/mental/stats";
import type { Bucket } from "./period";

const num = (v: unknown) => (v == null ? null : Number(v));
const inRange = (d: string, from: string, to: string) => d >= from && d <= to;

export async function getRaw(supabase: SupabaseClient, from: string, to: string, timeZone: string) {
  // Margen de un día en las fechas con hora, para convertirlas luego a tu zona horaria.
  const fromTs = `${from}T00:00:00-14:00`, toTs = `${to}T23:59:59+14:00`;
  const [days, workouts, habits, logs, txs, apps, interviews, levels, projects, memories, journal, accs, events, milestones] = await Promise.all([
    supabase.from("daily_entries").select("entry_date, mood, energy, stress, sleep_hours, sleep_quality, journal").gte("entry_date", from).lte("entry_date", to),
    supabase.from("workouts").select("performed_on, duration_seconds, activity_type").gte("performed_on", from).lte("performed_on", to),
    supabase.from("habits").select("id, name, description, category, frequency, times_per_period, weekdays, tracking_method, start_date, is_active"),
    supabase.from("habit_logs").select("habit_id, logged_on, value, notes").gte("logged_on", from).lte("logged_on", to),
    supabase.from("transactions").select("type, amount, occurred_on, savings_goal_id").gte("occurred_on", from).lte("occurred_on", to),
    supabase.from("career_applications").select("applied_on, stage").gte("applied_on", from).lte("applied_on", to),
    supabase.from("application_interviews").select("scheduled_at").gte("scheduled_at", fromTs).lte("scheduled_at", toTs),
    supabase.from("skill_levels").select("skill_id, level, assessed_on").gte("assessed_on", from).lte("assessed_on", to),
    supabase.from("projects").select("name, completed_on").gte("completed_on", from).lte("completed_on", to),
    supabase.from("memories").select("occurred_on, category, importance").gte("occurred_on", from).lte("occurred_on", to),
    supabase.from("journal_entries").select("entry_date").gte("entry_date", from).lte("entry_date", to),
    supabase.from("daily_accomplishments").select("id, daily_entries!inner(entry_date)").gte("daily_entries.entry_date", from).lte("daily_entries.entry_date", to),
    supabase.from("calendar_events").select("starts_at, category").gte("starts_at", fromTs).lte("starts_at", toTs),
    supabase.from("milestones").select("completed_at").gte("completed_at", fromTs).lte("completed_at", toTs),
  ]);
  const error = days.error || workouts.error || txs.error;
  const zoned = (iso: string) => utcToZoned(iso, timeZone).date;
  return {
    error,
    from, to,
    days: (days.data ?? []).map((d) => ({
      date: d.entry_date as string, mood: d.mood, energy: d.energy, stress: d.stress, sleep_hours: num(d.sleep_hours), sleep_quality: d.sleep_quality,
      hasJournal: !!(d.journal as string | null)?.trim(),
    })),
    workouts: (workouts.data ?? []).map((w) => ({ date: w.performed_on as string, seconds: w.duration_seconds as number | null, type: w.activity_type as string })),
    habits: (habits.data ?? []).map((h) => ({ ...h, goal_ids: [] })) as Habit[],
    logs: (logs.data ?? []) as HabitLog[],
    txs: (txs.data ?? []).map((t) => ({ type: t.type as "income" | "expense" | "transfer", amount: Number(t.amount), date: t.occurred_on as string, savings: !!t.savings_goal_id })),
    apps: (apps.data ?? []).map((a) => ({ date: a.applied_on as string, stage: a.stage as string })),
    interviews: (interviews.data ?? []).map((i) => ({ date: zoned(i.scheduled_at as string) })).filter((i) => inRange(i.date, from, to)),
    levels: (levels.data ?? []).map((l) => ({ skill: l.skill_id as string, level: Number(l.level), date: l.assessed_on as string })),
    projects: (projects.data ?? []).map((p) => ({ name: p.name as string, date: p.completed_on as string })),
    memories: (memories.data ?? []).map((m) => ({ date: m.occurred_on as string, category: m.category as string, importance: m.importance as number | null })),
    journal: (journal.data ?? []).map((j) => ({ date: j.entry_date as string })),
    accomplishments: ((accs.data ?? []) as unknown as { daily_entries: { entry_date: string } | null }[]).map((a) => ({ date: a.daily_entries?.entry_date ?? "" })).filter((a) => a.date),
    events: (events.data ?? []).map((e) => ({ date: zoned(e.starts_at as string), category: e.category as string })).filter((e) => inRange(e.date, from, to)),
    milestones: (milestones.data ?? []).map((m) => ({ date: zoned(m.completed_at as string) })).filter((m) => inRange(m.date, from, to)),
  };
}
export type Raw = Awaited<ReturnType<typeof getRaw>>;

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return { value: mean(v), n: v.length };
};

/** Todas las cifras de un rango de fechas (dentro de lo que trae `raw`). */
export function summarize(raw: Raw, from: string, to: string, weekStartsOn: number) {
  const f = <T extends { date: string }>(xs: T[]) => xs.filter((x) => inRange(x.date, from, to));
  const days = f(raw.days);
  const workouts = f(raw.workouts);
  const timed = workouts.filter((w) => w.seconds != null);
  const txs = f(raw.txs);
  const sum = (type: string, pred: (t: (typeof txs)[number]) => boolean = () => true) => {
    const list = txs.filter((t) => t.type === type && pred(t));
    return { value: list.reduce((a, t) => a + t.amount, 0), n: list.length };
  };
  let done = 0, expected = 0;
  for (const h of raw.habits) {
    const s = habitStats(h, raw.logs, from, to, weekStartsOn);
    done += s.done;
    expected += s.expected;
  }
  const memories = f(raw.memories);
  const income = sum("income"), expense = sum("expense");
  return {
    daysRecorded: days.length,
    mood: avg(days.map((d) => d.mood)),
    energy: avg(days.map((d) => d.energy)),
    stress: avg(days.map((d) => d.stress)),
    sleep: avg(days.map((d) => d.sleep_hours)),
    sleepQuality: avg(days.map((d) => d.sleep_quality)),
    workouts: workouts.length,
    workoutDays: new Set(workouts.map((w) => w.date)).size,
    workoutMinutes: { value: timed.length ? timed.reduce((a, w) => a + w.seconds!, 0) / 60 : null, n: timed.length },
    habits: { value: expected ? (done / expected) * 100 : null, done, expected },
    income, expense,
    net: { value: income.n || expense.n ? income.value - expense.value : null, n: income.n + expense.n },
    savings: sum("transfer", (t) => t.savings),
    applications: f(raw.apps).length,
    offers: f(raw.apps).filter((a) => a.stage === "offer").length,
    interviews: f(raw.interviews).length,
    skillLevels: f(raw.levels).length,
    projectsCompleted: f(raw.projects).length,
    milestones: f(raw.milestones).length,
    memories: memories.length,
    travel: memories.filter((m) => m.category === "travel").length,
    important: memories.filter((m) => m.category === "important_moments" || (m.importance ?? 0) >= 4).length,
    journalDays: days.filter((d) => d.hasJournal).length,
    journalEntries: f(raw.journal).length,
    accomplishments: f(raw.accomplishments).length,
    social: f(raw.events).filter((e) => e.category === "social").length,
  };
}
export type Summary = ReturnType<typeof summarize>;

export function series(raw: Raw, buckets: Bucket[], weekStartsOn: number) {
  return buckets.map((b) => ({ ...b, s: summarize(raw, b.from, b.to, weekStartsOn) }));
}

/** Ánimo en días con y sin entrenamiento: solo como asociación exploratoria. */
export function moodByWorkout(raw: Raw) {
  const wd = new Set(raw.workouts.map((w) => w.date));
  const withW = raw.days.filter((d) => d.mood != null && wd.has(d.date)).map((d) => d.mood!);
  const without = raw.days.filter((d) => d.mood != null && !wd.has(d.date)).map((d) => d.mood!);
  return { with: { value: mean(withW), n: withW.length }, without: { value: mean(without), n: without.length } };
}

export const dayPoints = (raw: Raw): DayPoint[] =>
  raw.days.map(({ date, mood, energy, stress, sleep_hours, sleep_quality }) => ({ date, mood, energy, stress, sleep_hours, sleep_quality }));

/** Lo que no depende del periodo: patrimonio actual, metas, skills y salarios. */
export async function getSnapshot(supabase: SupabaseClient) {
  const [assets, liabilities, payments, goals, skills, positions, assessments, offers] = await Promise.all([
    supabase.from("assets").select("value"),
    supabase.from("liabilities").select("id, original_amount"),
    supabase.from("transactions").select("liability_id, amount").not("liability_id", "is", null),
    supabase.from("goals").select("id, title, status, progress, category").order("updated_at", { ascending: false }),
    supabase.from("skills").select("id, name"),
    supabase.from("career_positions").select("id, title, company, started_on, ended_on, monthly_salary, notes, legacy_registro_id").order("started_on", { ascending: false }),
    supabase.from("life_assessments")
      .select("id, assessed_on, professional, financial, physical, emotional, social, intellectual, notes")
      .order("assessed_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("career_applications").select("id", { count: "exact", head: true }).eq("stage", "offer"),
  ]);
  const paid = new Map<string, number>();
  for (const p of payments.data ?? []) paid.set(p.liability_id as string, (paid.get(p.liability_id as string) ?? 0) + Number(p.amount));
  const assetTotal = (assets.data ?? []).reduce((a, x) => a + Number(x.value), 0);
  const debt = (liabilities.data ?? []).reduce((a, l) => a + Math.max(0, Number(l.original_amount) - (paid.get(l.id) ?? 0)), 0);
  return {
    netWorth: { assets: assetTotal, debt, value: assetTotal - debt, nAssets: assets.data?.length ?? 0, nLiabilities: liabilities.data?.length ?? 0 },
    goals: (goals.data ?? []) as { id: string; title: string; status: string; progress: number | null; category: string | null }[],
    skillNames: new Map((skills.data ?? []).map((s) => [s.id as string, s.name as string])),
    positions: (positions.data ?? []).map((p) => ({ ...p, monthly_salary: num(p.monthly_salary), imported: p.legacy_registro_id != null })),
    assessments: assessments.data ?? [],
    openOffers: offers.count ?? 0,
  };
}
