import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalButton } from "@/components/goals/forms";
import { HabitTracker } from "@/components/goals/habit-tracker";
import { DeleteGoalButton, Milestones, ProgressBar, StatusSelect } from "@/components/goals/goal-parts";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { getGoalDetail } from "@/lib/goals/queries";
import { GOAL_CATEGORIES, PRIORITIES } from "@/lib/goals/schema";
import { targetText } from "@/lib/goals/format";
import { addDays, utcToZoned } from "@/lib/dates";
import { formatDay, todayISO } from "@/lib/format";
import { EVENT_CATEGORIES } from "@/lib/types";

export const metadata: Metadata = { title: "Meta" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);
  const d = await getGoalDetail(supabase, id, addDays(today, -36), today);
  if (!d) notFound();
  const { goal } = d;

  const habitOptions = d.allHabits.filter((h) => h.is_active || goal.habit_ids.includes(h.id)).map((h) => ({ id: h.id, label: h.name }));
  const tt = targetText(goal.target_date, today, goal.status);
  const linked = d.entries.length + d.accomplishments.length + d.events.length + d.memories.length + d.projects.length;

  return (
    <>
      <Link href="/goals" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Metas y hábitos
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{goal.title}</h1>
          <p className="text-sm text-muted">
            {GOAL_CATEGORIES[goal.category]} · Prioridad {PRIORITIES[goal.priority].toLowerCase()}
            {goal.start_date && ` · Desde ${formatDay(goal.start_date)}`}
          </p>
          {tt && <p className="text-xs text-muted">{tt}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect goal={goal} />
          <GoalButton goal={goal} habits={habitOptions} today={today} variant="secondary" size="sm" />
          <DeleteGoalButton goal={goal} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Avance</CardTitle>
              <span className="text-sm tabular-nums">{goal.progress}%</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <ProgressBar value={goal.progress} label="Avance de la meta" />
              <p className="text-[11px] text-muted">Es el avance que tú indicas. Puedes calcularlo a partir de los hitos desde “Editar”.</p>
              {goal.description && <p className="whitespace-pre-wrap break-words text-sm">{goal.description}</p>}
              {goal.motivation && (
                <div className="rounded-md bg-surface p-3">
                  <p className="text-xs text-muted">Por qué es importante</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{goal.motivation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Hitos</CardTitle>
                <CardDescription>Pasos concretos hacia la meta.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><Milestones goal={goal} today={today} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Hábitos que la apoyan</CardTitle>
                <CardDescription>Conéctalos desde “Editar” en la meta o en el hábito.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <HabitTracker habits={d.habits} logs={d.logs} today={today} goals={[{ id: goal.id, label: goal.title }]}
                weekStartsOn={prefs.weekStartsOn} statsFrom={addDays(today, -29)} statsLabel="30 días" />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <div>
              <CardTitle>Conectado con esta meta</CardTitle>
              <CardDescription>{linked} {linked === 1 ? "registro" : "registros"} de otros módulos.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {linked === 0 && (
              <div className="space-y-2 text-sm text-muted">
                <p className="flex items-start gap-2"><Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />Puedes conectar días del diario, logros y eventos con esta meta desde el calendario.</p>
                <Button asChild size="sm" variant="secondary"><Link href={`/calendar?view=day&date=${today}`}>Ir a la entrada de hoy</Link></Button>
              </div>
            )}
            {d.accomplishments.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-xs font-medium text-muted">Logros ({d.accomplishments.length})</h3>
                <ul className="space-y-1.5 text-sm">
                  {d.accomplishments.slice(0, 20).map((a) => (
                    <li key={a.id} className="break-words">
                      {a.date ? <Link className="hover:underline" href={`/calendar?view=day&date=${a.date}`}>{a.content}</Link> : a.content}
                      {a.date && <span className="block text-[11px] text-muted">{formatDay(a.date)}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {d.entries.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-xs font-medium text-muted">Días del diario ({d.entries.length})</h3>
                <ul className="space-y-1.5 text-sm">
                  {d.entries.slice(0, 20).map((e) => (
                    <li key={e.id}>
                      <Link className="hover:underline" href={`/calendar?view=day&date=${e.entry_date}`}>{formatDay(e.entry_date, "EEE d MMM yyyy")}</Link>
                      {e.journal && <span className="block truncate text-[11px] text-muted">{e.journal}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {d.events.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-xs font-medium text-muted">Eventos ({d.events.length})</h3>
                <ul className="space-y-1.5 text-sm">
                  {d.events.slice(0, 20).map((ev) => {
                    const z = utcToZoned(ev.starts_at, prefs.timeZone);
                    return (
                      <li key={ev.id}>
                        <Link className="break-words hover:underline" href={`/calendar?view=day&date=${z.date}`}>{ev.title}</Link>
                        <span className="block text-[11px] text-muted">{formatDay(z.date)}{!ev.all_day && ` · ${z.time}`} · {EVENT_CATEGORIES[ev.category] ?? ev.category}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {d.memories.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-xs font-medium text-muted">Recuerdos ({d.memories.length})</h3>
                <ul className="space-y-1 text-sm">
                  {d.memories.map((m) => <li key={m.id} className="break-words">{m.title}{m.occurred_on && <span className="text-[11px] text-muted"> · {formatDay(m.occurred_on)}</span>}</li>)}
                </ul>
              </section>
            )}
            {d.projects.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-xs font-medium text-muted">Proyectos ({d.projects.length})</h3>
                <ul className="space-y-1 text-sm">{d.projects.map((p) => <li key={p.id} className="break-words">{p.name}</li>)}</ul>
              </section>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
