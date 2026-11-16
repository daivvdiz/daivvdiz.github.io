import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Brain, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendChart, SleepChart, DistributionChart } from "@/components/mental/charts";
import { MoodCalendar } from "@/components/mental/mood-calendar";
import { AveragesTable } from "@/components/mental/averages";
import { EmotionsToday } from "@/components/mental/emotions-today";
import { JournalList, NewJournalButton } from "@/components/mental/journal";
import { Strategies } from "@/components/mental/strategies";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { getMentalData } from "@/lib/mental/queries";
import { PERIODS, resolvePeriod } from "@/lib/mental/period";
import { describeR, METRIC_LABEL, MIN_CORRELATION_N, pearson, summary, type Metric } from "@/lib/mental/stats";
import { daysBetween } from "@/lib/dates";
import { formatDay, formatNumber, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mental health" };
export const dynamic = "force-dynamic";

type SP = Promise<{ period?: string; from?: string; to?: string }>;

const PAIRS: [Metric, Metric][] = [
  ["sleep_hours", "mood"],
  ["sleep_hours", "energy"],
  ["sleep_hours", "stress"],
  ["stress", "mood"],
  ["energy", "mood"],
];

export default async function MentalHealthPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);
  const period = resolvePeriod(sp, today, prefs.defaultPeriod);
  const data = await getMentalData(supabase, period.from, period.to, today);
  const totalDays = daysBetween(period.from, period.to) + 1;
  const recorded = data.points.filter((p) => p.mood != null || p.energy != null || p.stress != null || p.sleep_hours != null || p.sleep_quality != null);

  const tiles: { key: Metric; unit: string; scale: string }[] = [
    { key: "mood", unit: "", scale: "/10" },
    { key: "energy", unit: "", scale: "/10" },
    { key: "stress", unit: "", scale: "/10" },
    { key: "sleep_hours", unit: " h", scale: "" },
  ];

  return (
    <>
      <PageHeader
        title="Mental health"
        description="How you've been feeling, based on what you log. No scores or diagnoses."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/calendar?view=day&date=${today}`}>Log today's mood</Link>
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Period" className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/mental-health?period=${p.key}`}
              aria-current={period.key === p.key ? "page" : undefined}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition-colors",
                period.key === p.key ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <form action="/mental-health" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="period" value="custom" />
          <label className="space-y-1 text-[11px] text-muted">
            From
            <Input type="date" name="from" defaultValue={period.from} max={today} className="h-8 w-36" required />
          </label>
          <label className="space-y-1 text-[11px] text-muted">
            To
            <Input type="date" name="to" defaultValue={period.to} max={today} className="h-8 w-36" required />
          </label>
          <Button type="submit" size="sm" variant={period.key === "custom" ? "default" : "secondary"}>Apply</Button>
        </form>
      </div>

      {data.error && (
        <Card className="mb-5 flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> Couldn't load your entries. Try reloading the page.
        </Card>
      )}

      <p className="mb-3 text-xs text-muted">
        {formatDay(period.from)} – {formatDay(period.to)} · {recorded.length} of {totalDays} days with an entry
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const s = summary(data.points, t.key);
          return (
            <Card key={t.key} className="px-4 py-3">
              <p className="text-xs text-muted">Average {METRIC_LABEL[t.key].toLowerCase()}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {s.n ? <>{formatNumber(s.avg, 1)}{t.unit}<span className="text-sm font-normal text-muted">{t.scale}</span></> : <span className="text-muted">—</span>}
              </p>
              <p className="text-[11px] text-muted tabular-nums">
                {s.n ? `${s.n} ${s.n === 1 ? "day" : "days"} · range ${formatNumber(s.min, 1)}–${formatNumber(s.max, 1)}` : "No entries"}
              </p>
            </Card>
          );
        })}
      </div>

      {recorded.length === 0 ? (
        <Card className="mb-5">
          <EmptyState
            icon={Brain}
            className="py-12"
            title="No entries in this period yet"
            description="Log your mood, energy, stress and sleep in the calendar's daily entry. You'll see how they change over time here."
            action={<Button asChild size="sm"><Link href={`/calendar?view=day&date=${today}`}>Go to today's entry</Link></Button>}
          />
        </Card>
      ) : (
        <div className="mb-5 grid gap-5 xl:grid-cols-2">
          <Card className="xl:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Mood, energy and stress</CardTitle>
                <CardDescription>1 to 10 scale, just as you logged it each day.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><TrendChart points={data.points} from={period.from} to={period.to} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Mood calendar</CardTitle>
                <CardDescription>More intense = higher value. Tap a day to open its entry.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><MoodCalendar points={data.points} from={period.from} to={period.to} weekStartsOn={prefs.weekStartsOn} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Sleep</CardTitle>
                <CardDescription>Hours slept and perceived quality.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><SleepChart points={data.points} from={period.from} to={period.to} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Distribution</CardTitle>
                <CardDescription>How many days you logged each value.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><DistributionChart points={data.points} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Averages</CardTitle>
                <CardDescription>By week or by month, using only logged days.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><AveragesTable points={data.points} weekStartsOn={prefs.weekStartsOn} /></CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Exploratory relationships</CardTitle>
                <CardDescription>Whether two measures tend to rise or fall together on your logged days.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PAIRS.map(([a, b]) => {
                  const { r, n } = pearson(data.points, a, b);
                  const enough = r != null && n >= MIN_CORRELATION_N;
                  return (
                    <li key={`${a}-${b}`} className="rounded-md border border-border p-3">
                      <p className="text-sm font-medium">{METRIC_LABEL[a]} and {METRIC_LABEL[b].toLowerCase()}</p>
                      {enough ? (
                        <p className="mt-1 text-xs text-muted">
                          <span className="text-foreground">{describeR(r)}</span> · r = {formatNumber(r, 2)} · {n} days
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted">
                          Not enough data: {n} {n === 1 ? "day has" : "days have"} both values (at least {MIN_CORRELATION_N} are needed, and they must vary).
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                This is only exploratory: a relationship doesn't imply causation, and with few days it may be chance.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Today's emotions</CardTitle>
              <CardDescription>{formatDay(today, "EEEE, MMMM d")}. Everything is optional.</CardDescription>
            </div>
          </CardHeader>
          <CardContent><EmotionsToday key={today} date={today} initial={data.today} known={data.emotionNames} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Most frequent this period</CardTitle>
              <CardDescription>Emotions and stress factors you logged.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-medium text-muted">Emotions</h3>
              {data.emotions.length ? (
                <ul className="space-y-1 text-sm">
                  {data.emotions.slice(0, 10).map((e) => (
                    <li key={e.name} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{e.name}</span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {e.days} {e.days === 1 ? "day" : "days"}{e.avgIntensity != null && ` · int. ${formatNumber(e.avgIntensity, 1)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No emotions logged.</p>}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium text-muted">Stress factors</h3>
              {data.factors.length ? (
                <ul className="space-y-1 text-sm">
                  {data.factors.slice(0, 10).map((f) => (
                    <li key={f.description} className="flex justify-between gap-2">
                      <span className="min-w-0 break-words">{f.description}</span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">{f.days} {f.days === 1 ? "time" : "times"}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No factors logged.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Emotional journal</CardTitle>
              <CardDescription>Emotions, thoughts, difficult experiences and what helped you.</CardDescription>
            </div>
            <NewJournalButton today={today} />
          </CardHeader>
          <CardContent><JournalList items={data.journal} today={today} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Strategies that help you</CardTitle>
              <CardDescription>What you do to take care of yourself and how much it helped, in your own words.</CardDescription>
            </div>
          </CardHeader>
          <CardContent><Strategies strategies={data.strategies} logs={data.logs} today={today} /></CardContent>
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-muted">
        LIFE OS doesn't replace a mental health professional. If you're going through a hard time, reaching out for support is a good choice.
      </p>
    </>
  );
}
