import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Target } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GoalButton, NewHabitButton } from "@/components/goals/forms";
import { HabitTracker } from "@/components/goals/habit-tracker";
import { ProgressBar } from "@/components/goals/goal-parts";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { getGoalsPage } from "@/lib/goals/queries";
import { GOAL_CATEGORIES, GOAL_STATUS, PRIORITIES } from "@/lib/goals/schema";
import { addDays } from "@/lib/dates";
import { targetText } from "@/lib/goals/format";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Goals & habits" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "open", label: "In progress", statuses: ["not_started", "active"] },
  { key: "paused", label: "Paused", statuses: ["paused"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
  { key: "abandoned", label: "Let go", statuses: ["abandoned"] },
  { key: "all", label: "All", statuses: Object.keys(GOAL_STATUS) },
] as const;

type SP = Promise<{ status?: string; cat?: string }>;

export default async function GoalsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);
  const statsFrom = addDays(today, -29);
  const data = await getGoalsPage(supabase, addDays(today, -36), today);

  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const cat = sp.cat && sp.cat in GOAL_CATEGORIES ? sp.cat : "";
  const goals = data.goals.filter((g) => (filter.statuses as readonly string[]).includes(g.status) && (!cat || g.category === cat));
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, data.goals.filter((g) => (f.statuses as readonly string[]).includes(g.status)).length]));

  const habitOptions = data.habits.filter((h) => h.is_active).map((h) => ({ id: h.id, label: h.name }));
  const goalOptions = data.goals.filter((g) => g.status !== "completed" && g.status !== "abandoned").map((g) => ({ id: g.id, label: g.title }));
  const active = data.habits.filter((h) => h.is_active);
  const paused = data.habits.filter((h) => !h.is_active);
  const href = (p: { status?: string; cat?: string }) => {
    const q = new URLSearchParams();
    const s = p.status ?? filter.key;
    const c = p.cat ?? cat;
    if (s !== "open") q.set("status", s);
    if (c) q.set("cat", c);
    const qs = q.toString();
    return qs ? `/goals?${qs}` : "/goals";
  };

  return (
    <>
      <PageHeader
        title="Goals & habits"
        description="What you want to achieve and what you do to get closer. No streaks or scores."
        actions={
          <>
            <NewHabitButton goals={goalOptions} today={today} />
            <GoalButton habits={habitOptions} today={today} />
          </>
        }
      />

      {data.error && (
        <Card className="mb-5 flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> Couldn't load your data. Try reloading the page.
        </Card>
      )}

      <Card className="mb-5">
        <CardHeader>
          <div>
            <CardTitle>This week's habits</CardTitle>
            <CardDescription>Last 7 days. Tap a box to log or remove.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <HabitTracker habits={active} logs={data.logs} today={today} goals={goalOptions} weekStartsOn={prefs.weekStartsOn} statsFrom={statsFrom} statsLabel="30 days" />
          {paused.length > 0 && (
            <details className="mt-4 rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm text-muted">Paused habits ({paused.length})</summary>
              <div className="mt-3">
                <HabitTracker habits={paused} logs={data.logs} today={today} goals={goalOptions} weekStartsOn={prefs.weekStartsOn} statsFrom={statsFrom} statsLabel="30 days" />
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Goal status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href({ status: f.key })} aria-current={filter.key === f.key ? "page" : undefined}
              className={cn("rounded-md border px-3 py-1.5 text-xs transition-colors",
                filter.key === f.key ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground")}>
              {f.label} <span className="tabular-nums text-muted">{counts[f.key]}</span>
            </Link>
          ))}
        </nav>
        <nav aria-label="Area" className="flex flex-wrap gap-1.5">
          <Link href={href({ cat: "" })} className={cn("rounded-full px-2.5 py-1 text-xs", !cat ? "bg-surface text-foreground" : "text-muted hover:text-foreground")}>All areas</Link>
          {Object.entries(GOAL_CATEGORIES).map(([k, l]) => (
            <Link key={k} href={href({ cat: k })} aria-current={cat === k ? "true" : undefined}
              className={cn("rounded-full px-2.5 py-1 text-xs", cat === k ? "bg-surface text-foreground" : "text-muted hover:text-foreground")}>{l}</Link>
          ))}
        </nav>
      </div>

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            className="py-12"
            title={data.goals.length ? "No goals match these filters" : "No goals yet"}
            description={data.goals.length ? "Try another status or area." : "Create a goal and, if you like, break it into milestones and connect it to habits."}
            action={data.goals.length ? undefined : <GoalButton habits={habitOptions} today={today} label="Create the first one" size="sm" />}
          />
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => {
            const ms = g.milestones.length;
            const msDone = g.milestones.filter((m) => m.completed_at).length;
            const tt = targetText(g.target_date, today, g.status);
            return (
              <li key={g.id}>
                <Link href={`/goals/${g.id}`} className="group block h-full rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{g.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {GOAL_CATEGORIES[g.category]} · {GOAL_STATUS[g.status]} · {PRIORITIES[g.priority]} priority
                      </p>
                    </div>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted group-hover:text-foreground" aria-hidden />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Progress</span>
                      <span className="tabular-nums">{g.progress}%</span>
                    </div>
                    <ProgressBar value={g.progress} label={`Progress of ${g.title}`} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted">
                    {[ms ? `${msDone} of ${ms} milestones` : null, g.habit_ids.length ? `${g.habit_ids.length} ${g.habit_ids.length === 1 ? "habit" : "habits"}` : null, tt]
                      .filter(Boolean).join(" · ") || "No milestones or target date"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
