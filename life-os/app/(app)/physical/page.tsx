import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SleepChart } from "@/components/mental/charts";
import { DistributionBars, ValueLine, WeeklyBars } from "@/components/physical/charts";
import { NewWorkoutButton, WorkoutList } from "@/components/physical/workouts";
import { ExerciseProgress } from "@/components/physical/exercises";
import { BodyList, NutritionList } from "@/components/physical/body-nutrition";
import { StudyView } from "@/components/physical/study";
import { examSummary } from "@/lib/study/schema";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { getPhysicalData } from "@/lib/physical/queries";
import { getExams } from "@/lib/study/queries";
import { ACTIVITY_TYPES } from "@/lib/physical/schema";
import { addDays } from "@/lib/dates";
import { formatDay, formatDuration, formatNumber, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Training" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "summary", label: "Overview" },
  { key: "workouts", label: "Workouts" },
  { key: "study", label: "Study" },
  { key: "progress", label: "Progression" },
  { key: "body", label: "Body" },
  { key: "nutrition", label: "Nutrition" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-[11px] text-muted">{detail}</p>}
    </div>
  );
}

export default async function PhysicalPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "summary";
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);
  const [d, st] = await Promise.all([getPhysicalData(supabase, today, prefs.weekStartsOn), getExams(supabase)]);
  const href = (t: Tab) => (t === "summary" ? "/physical" : `/physical?tab=${t}`);

  const last30 = d.workouts.filter((w) => w.performed_on > addDays(today, -30) && w.performed_on <= today);
  const timed = last30.filter((w) => w.duration_seconds != null);
  const totalSec = timed.reduce((a, w) => a + w.duration_seconds!, 0);
  const activeDays = new Set(last30.map((w) => w.performed_on)).size;
  const last90 = d.workouts.filter((w) => w.performed_on > addDays(today, -90) && w.performed_on <= today);
  const dist = (Object.keys(ACTIVITY_TYPES) as (keyof typeof ACTIVITY_TYPES)[])
    .map((k) => ({ label: ACTIVITY_TYPES[k], n: last90.filter((w) => w.activity_type === k).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);
  const volumeRows = d.weeks.reduce((a, w) => a + w.volumeRows, 0);
  const weights = d.body.filter((b) => b.weight_kg != null).map((b) => ({ date: b.measured_on, value: b.weight_kg! })).reverse();
  const sleepDays = d.sleep.filter((p) => p.sleep_hours != null || p.sleep_quality != null).length;

  return (
    <>
      <PageHeader title="Training" description="Physical and study training: sessions, progression, mock exams, body measurements and optional nutrition." />

      <nav aria-label="Training sections" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-md border border-border p-0.5">
          {TABS.map((t) => (
            <Link key={t.key} href={href(t.key)} aria-current={tab === t.key ? "page" : undefined}
              className={cn("whitespace-nowrap rounded px-3 py-1.5 text-xs", tab === t.key ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {(d.error || st.error) && (
        <Card className="mb-5 flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> Couldn't load your data. Try reloading the page.
        </Card>
      )}

      {tab === "summary" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div><CardTitle>Last 30 days</CardTitle><CardDescription>{d.workouts.length} {d.workouts.length === 1 ? "workout" : "workouts"} logged in total.</CardDescription></div>
              <NewWorkoutButton exercises={d.exercises} today={today} />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Workouts" value={String(last30.length)} />
              <Stat label="Active days" value={String(activeDays)} />
              <Stat label="Time logged" value={timed.length ? formatDuration(totalSec) : "—"}
                detail={last30.length ? `${timed.length} of ${last30.length} with duration` : undefined} />
              {d.workouts[0] && (
                <p className="col-span-2 text-xs text-muted sm:col-span-3">
                  Last: {ACTIVITY_TYPES[d.workouts[0].activity_type]} on {formatDay(d.workouts[0].performed_on)}.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Frequency</CardTitle><CardDescription>Workouts per week, last 12 weeks.</CardDescription></div></CardHeader>
            <CardContent>
              <WeeklyBars data={d.weeks.map((w) => ({ week: w.week, value: w.sessions }))} label="Workouts" format="count"
                ariaLabel="Bars of workouts per week over the last 12 weeks" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Activity types</CardTitle><CardDescription>Last 90 days · {last90.length} {last90.length === 1 ? "workout" : "workouts"}.</CardDescription></div></CardHeader>
            <CardContent><DistributionBars items={dist} total={last90.length} /></CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Strength volume</CardTitle><CardDescription>Sets × reps × kg per week.</CardDescription></div></CardHeader>
            <CardContent>
              {volumeRows ? (
                <WeeklyBars data={d.weeks.map((w) => ({ week: w.week, value: Math.round(w.volume) }))} label="Volume" format="kg0"
                  ariaLabel="Bars of strength volume per week over the last 12 weeks"
                  note={`Based on ${volumeRows} ${volumeRows === 1 ? "entry" : "entries"} with sets, reps and weight. Entries missing any of the three aren't counted.`} />
              ) : (
                <p className="text-sm text-muted">Shows up when you log sets, reps and weight on the same exercise.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div><CardTitle>Body weight</CardTitle><CardDescription>In kg · {weights.length} {weights.length === 1 ? "entry" : "entries"}.</CardDescription></div>
              <Button asChild size="sm" variant="ghost"><Link href={href("body")}>View measurements</Link></Button>
            </CardHeader>
            <CardContent>
              <ValueLine points={weights} label="Weight" format="kg1" ariaLabel="Body weight over time" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div><CardTitle>Sleep and recovery</CardTitle><CardDescription>Last 30 days · {sleepDays} {sleepDays === 1 ? "day" : "days"} with an entry, from your daily entry.</CardDescription></div>
            </CardHeader>
            <CardContent><SleepChart points={d.sleep} from={d.sleepFrom} to={today} /></CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <div><CardTitle>Study</CardTitle><CardDescription>{st.exams.length ? `${st.exams.length} ${st.exams.length === 1 ? "mock exam logged" : "mock exams logged"}.` : "Mock exams and practice tests."}</CardDescription></div>
              <Button asChild size="sm" variant="ghost"><Link href={href("study")}>{st.exams.length ? "View study" : "Log mock exam"}</Link></Button>
            </CardHeader>
            <CardContent>
              {st.missing ? (
                <p className="text-sm text-muted">The mock exam migration still needs to run in Supabase. More details in the Study tab.</p>
              ) : st.exams.length ? (
                <ul className="space-y-1.5">
                  {st.exams.slice(0, 3).map((e) => (
                    <li key={e.id} className="text-sm">
                      {e.exam}<span className="text-muted"> · {formatDay(e.taken_on)}</span>
                      <p className="text-[11px] tabular-nums text-muted">{examSummary(e).join(" · ") || "No figures logged"}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Log your mock exams to see how your score and accuracy change.</p>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <div><CardTitle>Recent</CardTitle></div>
              <Button asChild size="sm" variant="ghost"><Link href={href("workouts")}>View all</Link></Button>
            </CardHeader>
            <CardContent><WorkoutList workouts={d.workouts} exercises={d.exercises} today={today} limit={5} /></CardContent>
          </Card>
        </div>
      )}

      {tab === "workouts" && <Card><CardContent className="pt-5"><WorkoutList workouts={d.workouts} exercises={d.exercises} today={today} /></CardContent></Card>}
      {tab === "study" && <Card><CardContent className="pt-5"><StudyView exams={st.exams} today={today} missing={st.missing} /></CardContent></Card>}
      {tab === "progress" && <Card><CardContent className="pt-5"><ExerciseProgress exercises={d.exercises} /></CardContent></Card>}
      {tab === "body" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><div><CardTitle>Body measurements</CardTitle></div></CardHeader>
            <CardContent><BodyList metrics={d.body} today={today} /></CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Weight over time</CardTitle><CardDescription>In kg.</CardDescription></div></CardHeader>
            <CardContent><ValueLine points={weights} label="Weight" format="kg1" ariaLabel="Body weight over time" /></CardContent>
          </Card>
        </div>
      )}
      {tab === "nutrition" && <Card><CardContent className="pt-5"><NutritionList logs={d.nutrition} today={today} /></CardContent></Card>}
    </>
  );
}
