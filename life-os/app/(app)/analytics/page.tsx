import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SeriesChart, type Row } from "@/components/analytics/charts";
import { SalaryChart } from "@/components/career/positions";
import { LifeRadar } from "@/components/overview/life-radar";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { ANALYTICS_PERIODS, comparePresets, makeBuckets, resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { dayPoints, getRaw, getSnapshot, moodByWorkout, series, summarize, type Summary } from "@/lib/analytics/queries";
import { describeR, MIN_CORRELATION_N, pearson, METRIC_LABEL, type Metric } from "@/lib/mental/stats";
import { GOAL_STATUS } from "@/lib/goals/schema";
import { WORKOUT_TYPES, type LifeAssessment } from "@/lib/types";
import { isISODate } from "@/lib/dates";
import { formatDay, formatMoney, formatNumber, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Life analytics" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "personal", label: "Personal trends" },
  { key: "finance", label: "Finances" },
  { key: "career", label: "Career" },
  { key: "activity", label: "Activity" },
  { key: "compare", label: "Compare periods" },
  { key: "balance", label: "Life balance" },
] as const;
type Tab = (typeof TABS)[number]["key"];
type SP = { tab?: string; period?: string; from?: string; to?: string; cmp?: string; af?: string; at?: string; bf?: string; bt?: string };

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-[11px] text-muted">{detail}</p>}
    </Card>
  );
}
function ChartCard({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader><div><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</div></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
const plural = (n: number, one: string, many: string) => `${formatNumber(n, 0)} ${n === 1 ? one : many}`;
const score = (x: { value: number | null; n: number }) => (x.value == null ? "—" : `${formatNumber(x.value, 1)}/10`);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "personal";
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);
  const period = resolveAnalyticsPeriod(sp, today);
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(tab !== "personal" ? { tab } : {}), ...(period.key === "custom" ? { period: "custom", from: period.from, to: period.to } : period.key !== "6m" ? { period: period.key } : {}), ...extra });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/analytics?${s}` : "/analytics";
  };
  const tabHref = (t: Tab) => qs({ tab: t === "personal" ? "" : t });
  const usesPeriod = tab !== "compare" && tab !== "balance";

  return (
    <>
      <PageHeader title="Life analytics" description="How your life has changed according to your own entries. You decide what it means." />

      <nav aria-label="Analytics sections" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-md border border-border p-0.5">
          {TABS.map((t) => (
            <Link key={t.key} href={tabHref(t.key)} aria-current={tab === t.key ? "page" : undefined}
              className={cn("whitespace-nowrap rounded px-3 py-1.5 text-xs", tab === t.key ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {usesPeriod && (
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <nav aria-label="Period" className="flex flex-wrap gap-1.5">
            {ANALYTICS_PERIODS.map((p) => (
              <Link key={p.key} href={`/analytics?${new URLSearchParams({ ...(tab !== "personal" ? { tab } : {}), period: p.key })}`} aria-current={period.key === p.key ? "page" : undefined}
                className={cn("rounded-md border px-3 py-1.5 text-xs", period.key === p.key ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground")}>
                {p.label}
              </Link>
            ))}
          </nav>
          <form action="/analytics" className="flex flex-wrap items-end gap-2">
            {tab !== "personal" && <input type="hidden" name="tab" value={tab} />}
            <input type="hidden" name="period" value="custom" />
            <label className="space-y-1 text-[11px] text-muted">From<Input type="date" name="from" defaultValue={period.from} max={today} className="h-8 w-36" required /></label>
            <label className="space-y-1 text-[11px] text-muted">To<Input type="date" name="to" defaultValue={period.to} max={today} className="h-8 w-36" required /></label>
            <Button type="submit" size="sm" variant={period.key === "custom" ? "default" : "secondary"}>Apply</Button>
          </form>
        </div>
      )}

      {tab === "compare" ? (
        <Compare sp={sp} today={today} timeZone={prefs.timeZone} weekStartsOn={prefs.weekStartsOn} />
      ) : tab === "balance" ? (
        <Balance today={today} />
      ) : (
        <PeriodTabs tab={tab} from={period.from} to={period.to} timeZone={prefs.timeZone} weekStartsOn={prefs.weekStartsOn} />
      )}
    </>
  );
}

async function PeriodTabs({ tab, from, to, timeZone, weekStartsOn }: { tab: Tab; from: string; to: string; timeZone: string; weekStartsOn: number }) {
  const { supabase } = await getUser();
  const [raw, snap] = await Promise.all([getRaw(supabase, from, to, timeZone), getSnapshot(supabase)]);
  const { by, buckets } = makeBuckets(from, to, weekStartsOn);
  const ser = series(raw, buckets, weekStartsOn);
  const all = summarize(raw, from, to, weekStartsOn);
  const periodText = (b: { from: string; to: string }) => (by === "month" ? formatDay(b.from, "MMMM yyyy") : `Week of ${formatDay(b.from, "MMM d")}`);
  const rows = (pick: (s: Summary) => { values: Record<string, number | null>; n?: Record<string, number> }): Row[] =>
    ser.map((b) => ({ label: b.label, period: periodText(b), ...pick(b.s) }));
  const unit = by === "month" ? "per month" : "per week";

  return (
    <div className="space-y-5">
      {raw.error && (
        <Card className="flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> Some data couldn't be loaded. Try reloading the page.
        </Card>
      )}
      <p className="text-xs text-muted">{formatDay(from)} – {formatDay(to)} · grouped by {by === "month" ? "month" : "week"}. Each figure shows how many entries back it up.</p>

      {tab === "personal" && <Personal raw={raw} all={all} rows={rows} unit={unit} goals={snap.goals} />}

      {tab === "finance" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Income" value={formatMoney(all.income.value)} detail={plural(all.income.n, "transaction", "transactions")} />
            <Stat label="Expenses" value={formatMoney(all.expense.value)} detail={plural(all.expense.n, "transaction", "transactions")} />
            <Stat label="Savings contributions" value={formatMoney(all.savings.value)} detail={plural(all.savings.n, "contribution", "contributions")} />
            <Stat label="Net worth today" value={formatMoney(snap.netWorth.value)}
              detail={`${plural(snap.netWorth.nAssets, "asset", "assets")} · ${plural(snap.netWorth.nLiabilities, "debt", "debts")}`} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Income and expenses" description={`Total ${unit}. Savings contributions don't count as expenses.`}>
              <SeriesChart format="money" ariaLabel={`Bars of income and expenses ${unit}`}
                series={[{ key: "income", label: "Income" }, { key: "expense", label: "Expenses" }]}
                rows={rows((s) => ({ values: { income: s.income.n ? s.income.value : null, expense: s.expense.n ? s.expense.value : null }, n: { income: s.income.n, expense: s.expense.n } }))} />
            </ChartCard>
            <ChartCard title="Income minus expenses" description={`Income minus expenses ${unit}. Empty if there were no transactions.`}>
              <SeriesChart format="money" kind="line" ariaLabel={`Income minus expenses ${unit}`}
                series={[{ key: "net", label: "Difference" }]} rows={rows((s) => ({ values: { net: s.net.value }, n: { net: s.net.n } }))} />
            </ChartCard>
            <ChartCard title="Savings contributions" description={`Total ${unit}.`}>
              <SeriesChart format="money" ariaLabel={`Savings contributions ${unit}`} series={[{ key: "savings", label: "Contributions" }]}
                rows={rows((s) => ({ values: { savings: s.savings.n ? s.savings.value : null }, n: { savings: s.savings.n } }))} />
            </ChartCard>
            <ChartCard title="Net worth" description="Current value of your assets minus your debt balances.">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Assets</dt><dd className="tabular-nums">{formatMoney(snap.netWorth.assets)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Debt balance</dt><dd className="tabular-nums">{formatMoney(snap.netWorth.debt)}</dd></div>
                <div className="flex justify-between border-t border-border pt-1.5 font-medium"><dt>Net worth</dt><dd className="tabular-nums">{formatMoney(snap.netWorth.value)}</dd></div>
              </dl>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted"><Info className="mt-0.5 size-3 shrink-0" aria-hidden /> Assets only keep their latest value, so there's no net worth history to chart yet without making up values.</p>
            </ChartCard>
          </div>
        </>
      )}

      {tab === "career" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Applications" value={formatNumber(all.applications, 0)} detail="with an application date in the period" />
            <Stat label="Interviews" value={formatNumber(all.interviews, 0)} />
            <Stat label="Offers" value={formatNumber(all.offers, 0)} detail={`from the period's applications · ${snap.openOffers} in total`} />
            <Stat label="Projects finished" value={formatNumber(all.projectsCompleted, 0)} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Applications and interviews" description={`Count ${unit}.`}>
              <SeriesChart format="count" ariaLabel={`Applications and interviews ${unit}`}
                series={[{ key: "apps", label: "Applications" }, { key: "interviews", label: "Interviews" }]}
                rows={rows((s) => ({ values: { apps: s.applications, interviews: s.interviews } }))} />
            </ChartCard>
            <ChartCard title="Salary over time" description="All your roles with a logged salary.">
              <SalaryChart positions={snap.positions} />
            </ChartCard>
            <ChartCard title="Skill development" description="First and last level logged within the period (0 to 10).">
              <SkillChanges levels={raw.levels} names={snap.skillNames} />
            </ChartCard>
            <ChartCard title="Projects finished" description={`Count ${unit}.`}>
              <SeriesChart format="count" ariaLabel={`Projects finished ${unit}`} series={[{ key: "p", label: "Projects" }]}
                rows={rows((s) => ({ values: { p: s.projectsCompleted } }))} />
            </ChartCard>
          </div>
        </>
      )}

      {tab === "activity" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Memories" value={formatNumber(all.memories, 0)} detail={`${all.travel} travel · ${all.important} important`} />
            <Stat label="Days with a journal entry" value={formatNumber(all.journalDays, 0)} detail={plural(all.journalEntries, "separate entry", "separate entries")} />
            <Stat label="Accomplishments logged" value={formatNumber(all.accomplishments, 0)} />
            <Stat label="Social events" value={formatNumber(all.social, 0)} detail="calendar's Social category" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Memories" description={`Count ${unit}, by the memory's date.`}>
              <SeriesChart format="count" ariaLabel={`Memories ${unit}`}
                series={[{ key: "m", label: "All" }, { key: "t", label: "Travel" }, { key: "i", label: "Important" }]}
                rows={rows((s) => ({ values: { m: s.memories, t: s.travel, i: s.important } }))}
                note="“Important” means the Important moments category, or an importance of 4 or 5 that you assigned." />
            </ChartCard>
            <ChartCard title="Journal and accomplishments" description={`Count ${unit}.`}>
              <SeriesChart format="count" ariaLabel={`Journal and accomplishments ${unit}`}
                series={[{ key: "j", label: "Journal days" }, { key: "a", label: "Accomplishments" }]}
                rows={rows((s) => ({ values: { j: s.journalDays + s.journalEntries, a: s.accomplishments } }))}
                note="Journal days include the daily entry and the separate entries from Mental health." />
            </ChartCard>
            <ChartCard title="Social events" description={`Count ${unit}.`}>
              <SeriesChart format="count" ariaLabel={`Social events ${unit}`} series={[{ key: "s", label: "Social events" }]}
                rows={rows((s) => ({ values: { s: s.social } }))} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function Personal({ raw, all, rows, unit, goals }: {
  raw: Awaited<ReturnType<typeof getRaw>>; all: Summary; rows: (pick: (s: Summary) => { values: Record<string, number | null>; n?: Record<string, number> }) => Row[];
  unit: string; goals: { id: string; title: string; status: string; progress: number | null }[];
}) {
  const points = dayPoints(raw);
  const pairs: [Metric, Metric][] = [["sleep_hours", "mood"], ["sleep_hours", "energy"], ["stress", "mood"], ["energy", "mood"]];
  const mw = moodByWorkout(raw);
  const types = Object.entries(raw.workouts.reduce<Record<string, number>>((a, w) => ({ ...a, [w.type]: (a[w.type] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const active = goals.filter((g) => g.status === "active");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Average mood" value={score(all.mood)} detail={plural(all.mood.n, "day", "days")} />
        <Stat label="Average sleep" value={all.sleep.value == null ? "—" : `${formatNumber(all.sleep.value, 1)} h`} detail={plural(all.sleep.n, "night", "nights")} />
        <Stat label="Workouts" value={formatNumber(all.workouts, 0)} detail={`${plural(all.workoutDays, "active day", "active days")}`} />
        <Stat label="Habits done" value={all.habits.value == null ? "—" : `${formatNumber(all.habits.value, 0)}%`} detail={all.habits.expected ? `${all.habits.done} of ${all.habits.expected} planned` : "no habits planned"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Mood, energy and stress" description={`Average ${unit} (1 to 10).`}>
          <SeriesChart kind="line" format="score" domain={[1, 10]} ariaLabel={`Average mood, energy and stress ${unit}`}
            series={[{ key: "mood", label: "Mood" }, { key: "energy", label: "Energy" }, { key: "stress", label: "Stress" }]}
            rows={rows((s) => ({ values: { mood: s.mood.value, energy: s.energy.value, stress: s.stress.value }, n: { mood: s.mood.n, energy: s.energy.n, stress: s.stress.n } }))}
            note="Periods without entries are left empty." />
        </ChartCard>
        <ChartCard title="Sleep" description={`Average hours ${unit}.`}>
          <SeriesChart kind="line" format="hours" domain={[0, 12]} ariaLabel={`Average sleep hours ${unit}`}
            series={[{ key: "h", label: "Sleep hours" }]} rows={rows((s) => ({ values: { h: s.sleep.value }, n: { h: s.sleep.n } }))} />
        </ChartCard>
        <ChartCard title="Physical activity" description={`Workouts ${unit}.`}>
          <SeriesChart format="count" ariaLabel={`Workouts ${unit}`} series={[{ key: "w", label: "Workouts" }]}
            rows={rows((s) => ({ values: { w: s.workouts } }))}
            note={types.length ? types.map(([t, n]) => `${WORKOUT_TYPES[t] ?? t}: ${n}`).join(" · ") : undefined} />
        </ChartCard>
        <ChartCard title="Study" description={`Average mock exam accuracy ${unit}.`}>
          <SeriesChart kind="line" format="pct" domain={[0, 100]} ariaLabel={`Average mock exam accuracy ${unit}`} series={[{ key: "a", label: "Accuracy" }]}
            rows={rows((s) => ({ values: { a: s.examAccuracy.value }, n: { a: s.examAccuracy.n } }))}
            note={`${plural(all.exams, "mock exam", "mock exams")} in the period. This mixes all your mock exams; the detail for each one is in Training → Study.`} />
        </ChartCard>
        <ChartCard title="Habit consistency" description={`Times done versus planned, ${unit}.`}>
          <SeriesChart format="pct" domain={[0, 100]} ariaLabel={`Percentage of habits done ${unit}`} series={[{ key: "h", label: "Done" }]}
            rows={rows((s) => ({ values: { h: s.habits.value }, n: { h: s.habits.expected } }))}
            note="The number in parentheses in the table is how many times it was planned. No streaks or scores." />
        </ChartCard>
        <ChartCard title="Goals" description={`${plural(active.length, "active goal", "active goals")} · ${plural(all.milestones, "milestone completed", "milestones completed")} in the period.`}>
          {!active.length ? <p className="text-sm text-muted">You have no active goals.</p> : (
            <ul className="space-y-2">
              {active.slice(0, 8).map((g) => (
                <li key={g.id} className="text-sm">
                  <div className="flex justify-between gap-2"><Link href={`/goals/${g.id}`} className="min-w-0 truncate hover:underline">{g.title}</Link><span className="shrink-0 tabular-nums text-muted">{g.progress ?? 0}%</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface" aria-hidden><div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${g.progress ?? 0}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted">
            {Object.entries(GOAL_STATUS).map(([k, l]) => `${l}: ${goals.filter((g) => g.status === k).length}`).join(" · ")}
          </p>
        </ChartCard>
        <ChartCard title="Exploratory associations" description="How some entries move together. It doesn't mean one causes the other.">
          <ul className="space-y-2 text-sm">
            {pairs.map(([a, b]) => {
              const { r, n } = pearson(points, a, b);
              return (
                <li key={`${a}-${b}`} className="flex flex-col">
                  <span>{METRIC_LABEL[a]} and {METRIC_LABEL[b].toLowerCase()}</span>
                  <span className="text-muted">{r == null || n < MIN_CORRELATION_N ? `not enough data (${n} ${n === 1 ? "day" : "days"} with both)` : `${describeR(r)} · r = ${formatNumber(r, 2)} · ${n} days`}</span>
                </li>
              );
            })}
            <li className="flex flex-wrap justify-between gap-x-3 border-t border-border pt-2">
              <span>Mood on days with and without a workout</span>
              <span className="text-muted">
                {mw.with.n < 3 || mw.without.n < 3 ? `not enough data (${mw.with.n} with · ${mw.without.n} without)` : `${formatNumber(mw.with.value, 1)} (${mw.with.n} days) · ${formatNumber(mw.without.value, 1)} (${mw.without.n} days)`}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-[11px] text-muted">Only days with both entries are used; with fewer than {MIN_CORRELATION_N} it isn't calculated.</p>
        </ChartCard>
      </div>
    </>
  );
}

function SkillChanges({ levels, names }: { levels: { skill: string; level: number; date: string }[]; names: Map<string, string> }) {
  const by = new Map<string, typeof levels>();
  for (const l of levels) by.set(l.skill, [...(by.get(l.skill) ?? []), l]);
  const list = [...by.entries()].map(([id, ls]) => {
    const s = [...ls].sort((a, b) => a.date.localeCompare(b.date));
    return { id, name: names.get(id) ?? "Skill", first: s[0], last: s[s.length - 1], n: s.length };
  }).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return <p className="text-sm text-muted">No levels logged in this period.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {list.map((s) => (
        <li key={s.id} className="flex flex-wrap justify-between gap-x-3">
          <span className="min-w-0 truncate">{s.name}</span>
          <span className="tabular-nums text-muted">
            {s.n === 1 ? `${formatNumber(s.last.level, 1)} (${formatDay(s.last.date, "MMM d, yy")})` : `from ${formatNumber(s.first.level, 1)} to ${formatNumber(s.last.level, 1)} · ${s.n} entries`}
          </span>
        </li>
      ))}
    </ul>
  );
}

async function Compare({ sp, today, timeZone, weekStartsOn }: { sp: SP; today: string; timeZone: string; weekStartsOn: number }) {
  const presets = comparePresets(today);
  const custom = sp.cmp === "custom" && [sp.af, sp.at, sp.bf, sp.bt].every((x) => isISODate(x));
  const preset = presets.find((p) => p.key === sp.cmp) ?? presets[0];
  const A = custom ? { from: sp.af! <= sp.at! ? sp.af! : sp.at!, to: sp.af! <= sp.at! ? sp.at! : sp.af!, label: "" } : preset.a;
  const B = custom ? { from: sp.bf! <= sp.bt! ? sp.bf! : sp.bt!, to: sp.bf! <= sp.bt! ? sp.bt! : sp.bf!, label: "" } : preset.b;
  const name = (x: { from: string; to: string; label: string }) => x.label || `${formatDay(x.from)} – ${formatDay(x.to)}`;
  const { supabase } = await getUser();
  const [ra, rb] = await Promise.all([getRaw(supabase, A.from, A.to, timeZone), getRaw(supabase, B.from, B.to, timeZone)]);
  const a = summarize(ra, A.from, A.to, weekStartsOn), b = summarize(rb, B.from, B.to, weekStartsOn);

  type Line = { label: string; a: number | null; b: number | null; fmt: (v: number) => string; na?: number; nb?: number };
  const money = (v: number) => formatMoney(v), int = (v: number) => formatNumber(v, 0), one = (v: number) => formatNumber(v, 1);
  const sections: { title: string; lines: Line[] }[] = [
    { title: "Well-being", lines: [
      { label: "Days with an entry", a: a.daysRecorded, b: b.daysRecorded, fmt: int },
      { label: "Average mood (1–10)", a: a.mood.value, b: b.mood.value, fmt: one, na: a.mood.n, nb: b.mood.n },
      { label: "Average energy (1–10)", a: a.energy.value, b: b.energy.value, fmt: one, na: a.energy.n, nb: b.energy.n },
      { label: "Average stress (1–10)", a: a.stress.value, b: b.stress.value, fmt: one, na: a.stress.n, nb: b.stress.n },
      { label: "Average sleep hours", a: a.sleep.value, b: b.sleep.value, fmt: one, na: a.sleep.n, nb: b.sleep.n },
      { label: "Habits done (%)", a: a.habits.value, b: b.habits.value, fmt: int, na: a.habits.expected, nb: b.habits.expected },
    ] },
    { title: "Training", lines: [
      { label: "Workouts", a: a.workouts, b: b.workouts, fmt: int },
      { label: "Active days", a: a.workoutDays, b: b.workoutDays, fmt: int },
      { label: "Minutes logged", a: a.workoutMinutes.value, b: b.workoutMinutes.value, fmt: int, na: a.workoutMinutes.n, nb: b.workoutMinutes.n },
      { label: "Mock exams", a: a.exams, b: b.exams, fmt: int },
      { label: "Mock exam accuracy (%)", a: a.examAccuracy.value, b: b.examAccuracy.value, fmt: int, na: a.examAccuracy.n, nb: b.examAccuracy.n },
    ] },
    { title: "Finances", lines: [
      { label: "Income", a: a.income.n ? a.income.value : null, b: b.income.n ? b.income.value : null, fmt: money, na: a.income.n, nb: b.income.n },
      { label: "Expenses", a: a.expense.n ? a.expense.value : null, b: b.expense.n ? b.expense.value : null, fmt: money, na: a.expense.n, nb: b.expense.n },
      { label: "Savings contributions", a: a.savings.n ? a.savings.value : null, b: b.savings.n ? b.savings.value : null, fmt: money, na: a.savings.n, nb: b.savings.n },
    ] },
    { title: "Career", lines: [
      { label: "Applications", a: a.applications, b: b.applications, fmt: int },
      { label: "Interviews", a: a.interviews, b: b.interviews, fmt: int },
      { label: "Skill levels logged", a: a.skillLevels, b: b.skillLevels, fmt: int },
      { label: "Projects finished", a: a.projectsCompleted, b: b.projectsCompleted, fmt: int },
    ] },
    { title: "Life", lines: [
      { label: "Memories", a: a.memories, b: b.memories, fmt: int },
      { label: "Days with a journal entry", a: a.journalDays, b: b.journalDays, fmt: int },
      { label: "Accomplishments", a: a.accomplishments, b: b.accomplishments, fmt: int },
      { label: "Social events", a: a.social, b: b.social, fmt: int },
      { label: "Goal milestones completed", a: a.milestones, b: b.milestones, fmt: int },
    ] },
  ];
  const cell = (v: number | null, n: number | undefined, fmt: (v: number) => string) =>
    v == null ? <span className="text-muted">—{n != null && <span className="block text-[11px] sm:inline"> (0)</span>}</span>
      : <><span className="whitespace-nowrap">{fmt(v)}</span>{n != null && <span className="block text-[11px] text-muted sm:inline"> ({n})</span>}</>;
  const diff = (l: Line) => {
    if (l.a == null || l.b == null) return "—";
    // Se resta lo que se muestra (redondeado), para que la diferencia cuadre con las cifras.
    const r = (x: number) => (l.fmt === one ? Math.round(x * 10) / 10 : Math.round(x));
    const d = Math.round((r(l.a) - r(l.b)) * 10) / 10;
    return d === 0 ? "same" : `${d > 0 ? "+" : "−"}${l.fmt(Math.abs(d))}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <nav aria-label="Periods to compare" className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Link key={p.key} href={`/analytics?tab=compare&cmp=${p.key}`} aria-current={!custom && preset.key === p.key ? "page" : undefined}
              className={cn("rounded-md border px-3 py-1.5 text-xs", !custom && preset.key === p.key ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground")}>
              {p.label}
            </Link>
          ))}
        </nav>
        <form action="/analytics" className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
          <input type="hidden" name="tab" value="compare" /><input type="hidden" name="cmp" value="custom" />
          <label className="space-y-1 text-[11px] text-muted">A from<Input type="date" name="af" defaultValue={A.from} max={today} className="h-8 sm:w-36" required /></label>
          <label className="space-y-1 text-[11px] text-muted">A to<Input type="date" name="at" defaultValue={A.to} max={today} className="h-8 sm:w-36" required /></label>
          <label className="space-y-1 text-[11px] text-muted">B from<Input type="date" name="bf" defaultValue={B.from} max={today} className="h-8 sm:w-36" required /></label>
          <label className="space-y-1 text-[11px] text-muted">B to<Input type="date" name="bt" defaultValue={B.to} max={today} className="h-8 sm:w-36" required /></label>
          <Button type="submit" size="sm" variant={custom ? "default" : "secondary"} className="col-span-2">Compare</Button>
        </form>
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{name(A)} vs. {name(B)}</CardTitle>
            <CardDescription>Figures from your entries in each period. In parentheses, how many entries back up the value. It doesn't mean one period was better than the other.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 text-left font-medium">Measure</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">A · {name(A)}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">B · {name(B)}</th>
                  <th scope="col" className="hidden py-2 pl-3 text-right font-medium sm:table-cell">A − B</th>
                </tr>
              </thead>
              {sections.map((s) => (
                <tbody key={s.title}>
                  <tr><th colSpan={4} scope="colgroup" className="pb-1 pt-4 text-left text-xs font-semibold">{s.title}</th></tr>
                  {s.lines.map((l) => (
                    <tr key={l.label} className="border-t border-border">
                      <th scope="row" className="py-1.5 pr-2 text-left font-normal sm:pr-3">{l.label}</th>
                      <td className="px-1.5 py-1.5 text-right tabular-nums sm:px-3">{cell(l.a, l.na, l.fmt)}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums sm:px-3">{cell(l.b, l.nb, l.fmt)}</td>
                      <td className="hidden whitespace-nowrap py-1.5 pl-3 text-right tabular-nums text-muted sm:table-cell">{diff(l)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted">If a period is in progress, it only counts up to today. Periods can have a different number of days.<span className="sm:hidden"> On small screens the difference column is hidden.</span></p>
        </CardContent>
      </Card>
    </div>
  );
}

async function Balance({ today }: { today: string }) {
  const { supabase } = await getUser();
  const snap = await getSnapshot(supabase);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <LifeRadar assessments={snap.assessments as LifeAssessment[]} today={today} />
      <Card>
        <CardHeader><div><CardTitle>How to read it</CardTitle></div></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>Each self-assessment is your own rating from 1 to 10 in six areas. Compare two dates to see what changed.</p>
          <p>There's no overall score and no right way to split your attention. The full history is in Life archive → Life balance.</p>
          <Button asChild size="sm" variant="secondary"><Link href="/archive?tab=radar">View history</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
