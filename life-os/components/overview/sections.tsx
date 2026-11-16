import Link from "next/link";
import {
  Activity, Archive, Briefcase, CalendarDays, CheckCircle2, Dumbbell, Moon, Smile, Sparkles, Target, Wallet, Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatDay, formatDuration, formatMoney, formatNumber, timeAgo } from "@/lib/format";
import type { ActivityItem, CalendarEvent } from "@/lib/types";
import { EVENT_CATEGORIES } from "@/lib/types";

type Overview = Awaited<ReturnType<typeof import("@/lib/overview/queries").getOverview>>;

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Smile; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 text-muted" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function DailySummary({ data }: { data: Overview }) {
  const d = data.daily;
  const scale = (v: number | null | undefined) => (v == null ? "Not logged" : `${v}/10`);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Today</CardTitle>
          <CardDescription>{formatDay(data.today, "EEEE, MMMM d")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        <Metric icon={Smile} label="Mood" value={scale(d?.mood)} />
        <Metric icon={Zap} label="Energy" value={scale(d?.energy)} />
        <Metric icon={Moon} label="Sleep" value={d?.sleepHours != null ? `${formatNumber(d.sleepHours)} h` : "Not logged"} />
        <Metric icon={Sparkles} label="Main accomplishment" value={d?.mainAccomplishment ?? "Not logged"}
          hint={d && d.accomplishmentCount > 1 ? `${d.accomplishmentCount} accomplishments today` : undefined} />
        <Metric icon={CheckCircle2} label="Habits completed" value={String(data.habitsDone)} />
        <Metric icon={CalendarDays} label="Upcoming events" value={String(data.events.length)} hint="in the next 14 days" />
      </CardContent>
      {!d && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          No entry for today yet.{" "}
          <Link href={`/calendar?view=day&date=${data.today}`} className="text-accent hover:underline">Log how your day is going</Link>
        </p>
      )}
    </Card>
  );
}

function Stat({ href, icon: Icon, label, value, hint }: { href: string; icon: typeof Smile; label: string; value: string; hint?: string }) {
  return (
    <Link href={href} className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted/40">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon className="size-3.5" aria-hidden /> {label}
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Link>
  );
}

export function LifeCards({ data }: { data: Overview }) {
  const f = data.finance;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat href="/goals" icon={Target} label="Active goals" value={String(data.activeGoals)} />
      <Stat href="/finances" icon={Wallet} label="Income this month" value={formatMoney(f.income)} hint={`${f.incomeCount} ${f.incomeCount === 1 ? "transaction" : "transactions"}`} />
      <Stat href="/finances" icon={Wallet} label="Expenses this month" value={formatMoney(f.expenses)} hint={`${f.expenseCount} ${f.expenseCount === 1 ? "transaction" : "transactions"}`} />
      <Stat href="/finances" icon={Wallet} label="Saved this month" value={formatMoney(f.net)} hint="Income minus expenses" />
      <Stat href="/career" icon={Briefcase} label="Active applications" value={String(data.activeApplications)} />
      <Stat href="/physical" icon={Dumbbell} label="Workouts this month" value={String(data.monthWorkouts)} />
    </div>
  );
}

export function LiabilitiesCard({ data }: { data: Overview }) {
  if (!data.liabilities.length) return null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Active debts</CardTitle>
          <CardDescription>The amount paid is calculated from your logged payments.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.liabilities.map((l) => {
          const pct = l.original > 0 ? Math.min(100, (l.paid / l.original) * 100) : null;
          return (
            <div key={l.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{l.name}</span>
                <span className="text-xs text-muted tabular-nums">
                  {formatMoney(l.paid)} {l.original > 0 && <>of {formatMoney(l.original)}</>}
                </span>
              </div>
              {pct != null ? (
                <div className="h-1.5 rounded-full bg-surface" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Paid toward ${l.name}`}>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              ) : (
                <p className="text-xs text-muted">No total amount logged.</p>
              )}
              {pct != null && <p className="text-xs text-muted">{formatNumber(pct)}% paid · {formatMoney(Math.max(0, l.original - l.paid))} left</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function UpcomingEvents({ events }: { events: CalendarEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming events</CardTitle>
        <Link href="/calendar" className="text-xs text-accent hover:underline">View calendar</Link>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nothing in the next 14 days" description="Calendar events and deadlines will show up here." />
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.title}</span>
                  <span className="text-xs text-muted">{EVENT_CATEGORIES[e.category] ?? e.category}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{e.all_day ? formatDay(e.starts_at.slice(0, 10), "EEE, MMM d") : formatDateTime(e.starts_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentWorkouts({ workouts }: { workouts: Overview["workouts"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Recent physical activity</CardTitle></CardHeader>
      <CardContent>
        {workouts.length === 0 ? (
          <EmptyState icon={Dumbbell} title="No workouts logged" description="Your sessions will show up here, including the ones you import from Segundo Cerebro." />
        ) : (
          <ul className="space-y-3">
            {workouts.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="block font-medium">{w.type}</span>
                  <span className="text-xs text-muted">
                    {w.duration != null ? formatDuration(w.duration) : `${w.exercises} ${w.exercises === 1 ? "exercise" : "exercises"}`}
                  </span>
                </span>
                <span className="text-xs text-muted">{formatDay(w.date, "MMM d")}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentMemories({ memories }: { memories: Overview["memories"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Recent memories</CardTitle></CardHeader>
      <CardContent>
        {memories.length === 0 ? (
          <EmptyState icon={Archive} title="No memories yet" description="The moments you want to keep will live in your Life archive." />
        ) : (
          <ul className="space-y-3">
            {memories.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{m.title}</span>
                <span className="shrink-0 text-xs text-muted">{formatDay(m.occurred_on)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>The latest things you logged across all modules.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={Activity} title="No activity yet" description="Every new entry, in any module, will show up on this timeline." />
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-4">
            {items.map((i) => (
              <li key={i.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-accent" aria-hidden />
                <p className="text-sm">{i.label}</p>
                <p className="text-xs text-muted">
                  {i.detail && <span>{i.detail} · </span>}
                  <time dateTime={i.at}>{timeAgo(i.at)}</time>
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
