import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/format";
import type { CalEvent, DaySummary } from "@/lib/calendar/queries";
import { CATEGORY_COLORS } from "@/lib/types";
import { EventChip, type GoalOption } from "./event-dialog";

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function groupByDay(events: CalEvent[]) {
  const m = new Map<string, CalEvent[]>();
  for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
  for (const list of m.values()) list.sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start_time.localeCompare(b.start_time));
  return m;
}

function EntryMark({ s }: { s?: DaySummary }) {
  if (!s) return null;
  return (
    <span className="hidden items-center gap-1 text-[11px] text-muted sm:inline-flex" title={s.mood != null ? `Ánimo ${s.mood}/10` : "Entrada registrada"}>
      <BookOpen className="size-3" aria-hidden />
      {s.mood != null && <span className="tabular-nums">{s.mood}</span>}
      <span className="sr-only">Entrada registrada</span>
    </span>
  );
}

export function MonthView({
  days, month, today, events, summaries, goals, hrefForDay, weekStartsOn,
}: {
  days: string[]; month: string; today: string; events: CalEvent[]; summaries: Map<string, DaySummary>;
  goals: GoalOption[]; hrefForDay: (d: string) => string; weekStartsOn: number;
}) {
  const byDay = groupByDay(events);
  const headers = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStartsOn) % 7]);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-surface text-center text-[11px] uppercase tracking-wide text-muted">
        {headers.map((h) => <div key={h} className="py-2">{h}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          return (
            <div key={d} className={cn("min-h-20 border-b border-r border-border p-1 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-surface/40")}>
              <div className="mb-1 flex items-center justify-between gap-1">
                <Link
                  href={hrefForDay(d)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs tabular-nums hover:bg-card",
                    d === today && "bg-accent text-accent-foreground hover:bg-accent",
                    !inMonth && d !== today && "text-muted",
                  )}
                  aria-label={`Abrir ${formatDay(d, "EEEE d 'de' MMMM")}`}
                >
                  {Number(d.slice(8))}
                </Link>
                <EntryMark s={summaries.get(d)} />
              </div>
              <div className="hidden space-y-0.5 sm:block">
                {list.slice(0, 3).map((e) => <EventChip key={e.id} event={e} goals={goals} />)}
                {list.length > 3 && <Link href={hrefForDay(d)} className="block px-1 text-[11px] text-muted hover:text-foreground">+{list.length - 3} más</Link>}
              </div>
              {(list.length > 0 || summaries.has(d)) && (
                <Link href={hrefForDay(d)} className="flex items-center gap-0.5 px-1 sm:hidden" aria-label={`${list.length} eventos${summaries.has(d) ? ", con entrada" : ""}`}>
                  {summaries.has(d) && <BookOpen className="size-3 text-muted" aria-hidden />}
                  {list.slice(0, 3).map((e) => <span key={e.id} className="size-1.5 rounded-full" style={{ background: CATEGORY_COLORS[e.category] }} />)}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekView({
  days, today, events, summaries, goals, hrefForDay,
}: {
  days: string[]; today: string; events: CalEvent[]; summaries: Map<string, DaySummary>; goals: GoalOption[]; hrefForDay: (d: string) => string;
}) {
  const byDay = groupByDay(events);
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((d) => {
        const list = byDay.get(d) ?? [];
        return (
          <div key={d} className={cn("rounded-lg border border-border bg-card p-2 md:min-h-64", d === today && "border-accent/60")}>
            <div className="mb-2 flex items-center justify-between">
              <Link href={hrefForDay(d)} className="text-sm hover:text-accent">
                <span className="capitalize text-muted">{formatDay(d, "EEE")}</span> <span className="font-medium tabular-nums">{Number(d.slice(8))}</span>
              </Link>
              <EntryMark s={summaries.get(d)} />
            </div>
            {list.length === 0 ? (
              <p className="px-1 text-[11px] text-muted">Sin eventos</p>
            ) : (
              <div className="space-y-0.5">{list.map((e) => <EventChip key={e.id} event={e} goals={goals} wrap />)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
