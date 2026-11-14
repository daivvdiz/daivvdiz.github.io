import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EventChip, NewEventButton } from "@/components/calendar/event-dialog";
import { MonthView, WeekView } from "@/components/calendar/views";
import { DailyEntryForm } from "@/components/calendar/daily-entry-form";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { getCalendarData, getDayEntry, getGoalOptions, getTagNames } from "@/lib/calendar/queries";
import { addDays, addMonths, isISODate, visibleRange } from "@/lib/dates";
import { formatDay, todayISO } from "@/lib/format";
import { CATEGORY_COLORS, EVENT_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

export const metadata: Metadata = { title: "Calendario y diario" };
export const dynamic = "force-dynamic";

type View = "month" | "week" | "day";
type SP = Promise<{ view?: string; date?: string; cats?: string }>;

export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);

  const view: View = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const date = isISODate(sp.date) ? sp.date : today;
  const cats = (sp.cats ?? "").split(",").filter((c) => c in EVENT_CATEGORIES);
  const range = visibleRange(view, date, prefs.weekStartsOn);

  const href = (p: { view?: View; date?: string; cats?: string[] }) => {
    const q = new URLSearchParams();
    q.set("view", p.view ?? view);
    q.set("date", p.date ?? date);
    const c = p.cats ?? cats;
    if (c.length) q.set("cats", c.join(","));
    return `/calendar?${q}`;
  };
  const hrefForDay = (d: string) => href({ view: "day", date: d });

  const [cal, goals, dayEntry, tagNames] = await Promise.all([
    getCalendarData(supabase, range, prefs.timeZone, cats.length ? cats : null),
    getGoalOptions(supabase),
    view === "day" ? getDayEntry(supabase, date) : Promise.resolve(null),
    view === "day" ? getTagNames(supabase) : Promise.resolve([]),
  ]);
  // Para enlazar eventos a la entrada del día se muestran todos, sin filtro de categoría.
  const dayEventsAll = view === "day" && cats.length ? (await getCalendarData(supabase, range, prefs.timeZone, null)).events : cal.events;

  const step = (dir: 1 | -1) =>
    view === "month" ? addMonths(date, dir) : addDays(date, view === "week" ? 7 * dir : dir);

  const title =
    view === "month"
      ? formatDay(date, "MMMM yyyy")
      : view === "week"
        ? `${formatDay(range.start, "d MMM")} – ${formatDay(range.end, "d MMM yyyy")}`
        : formatDay(date, "EEEE d 'de' MMMM yyyy");

  return (
    <>
      <PageHeader
        title="Calendario y diario"
        description="Tus eventos y tu entrada de cada día, en un solo lugar."
        actions={
          <>
            <Button asChild variant="secondary"><Link href={hrefForDay(today)}>Escribir hoy</Link></Button>
            <NewEventButton date={view === "day" ? date : today} goals={goals} />
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon"><Link href={href({ date: step(-1) })} aria-label="Anterior"><ChevronLeft /></Link></Button>
          <Button asChild variant="ghost" size="icon"><Link href={href({ date: step(1) })} aria-label="Siguiente"><ChevronRight /></Link></Button>
          <Button asChild variant="secondary" size="sm"><Link href={href({ date: today })}>Hoy</Link></Button>
          <h2 className="ml-1 text-base font-semibold first-letter:uppercase">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Vista" className="flex rounded-md border border-border p-0.5">
            {([["month", "Mes"], ["week", "Semana"], ["day", "Día"]] as const).map(([v, l]) => (
              <Link key={v} href={href({ view: v })} aria-current={view === v ? "page" : undefined}
                className={cn("rounded px-3 py-1 text-xs", view === v ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}>
                {l}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Filtrar por categoría">
        {Object.entries(EVENT_CATEGORIES).map(([k, l]) => {
          const on = cats.includes(k);
          return (
            <Link key={k} href={href({ cats: on ? cats.filter((c) => c !== k) : [...cats, k] })} aria-pressed={on}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", on ? "border-accent bg-accent-soft" : "border-border text-muted hover:text-foreground")}>
              <span className="size-1.5 rounded-full" style={{ background: CATEGORY_COLORS[k] }} aria-hidden /> {l}
            </Link>
          );
        })}
        {cats.length > 0 && <Link href={href({ cats: [] })} className="px-2 py-1 text-xs text-accent">Quitar filtros</Link>}
      </div>

      {cal.error && <p role="alert" className="mb-4 text-sm text-danger">No se pudo cargar el calendario. Intenta de nuevo.</p>}

      {view === "month" && (
        <MonthView days={range.days} month={date} today={today} events={cal.events} summaries={cal.days} goals={goals} hrefForDay={hrefForDay} weekStartsOn={prefs.weekStartsOn} />
      )}
      {view === "week" && (
        <WeekView days={range.days} today={today} events={cal.events} summaries={cal.days} goals={goals} hrefForDay={hrefForDay} />
      )}
      {view === "day" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <div className="order-2 lg:order-1">
            <DailyEntryForm key={date} date={date} entry={dayEntry} events={dayEventsAll} goals={goals} tagSuggestions={tagNames} userId={user!.id} />
          </div>
          <Card className="order-1 h-fit lg:sticky lg:top-6 lg:order-2">
            <CardHeader><CardTitle>Eventos del día</CardTitle></CardHeader>
            <CardContent>
              {cal.events.length === 0 ? (
                <EmptyState icon={CalendarDays} title="Sin eventos" action={<NewEventButton date={date} goals={goals} label="Agregar evento" variant="secondary" />} />
              ) : (
                <div className="space-y-1">
                  {cal.events.map((e) => (
                    <div key={e.id}>
                      <EventChip event={e} goals={goals} wrap />
                      {(e.all_day || e.end_time || e.location) && (
                        <p className="pl-4 text-[11px] text-muted">
                          {e.all_day ? "Todo el día" : e.end_time ? `${e.start_time}–${e.end_time}` : ""}
                          {e.location ? ` · ${e.location}` : ""}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
