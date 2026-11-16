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

export const metadata: Metadata = { title: "Entrenamiento" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "summary", label: "Resumen" },
  { key: "workouts", label: "Entrenamientos" },
  { key: "study", label: "Estudio" },
  { key: "progress", label: "Progresión" },
  { key: "body", label: "Cuerpo" },
  { key: "nutrition", label: "Nutrición" },
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
      <PageHeader title="Entrenamiento" description="Entrenamiento físico y de estudio: sesiones, progresión, simulacros, medidas corporales y nutrición opcional." />

      <nav aria-label="Secciones de Entrenamiento" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
          <AlertTriangle className="size-4 text-danger" aria-hidden /> No se pudieron cargar tus datos. Intenta recargar la página.
        </Card>
      )}

      {tab === "summary" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div><CardTitle>Últimos 30 días</CardTitle><CardDescription>{d.workouts.length} entrenamientos registrados en total.</CardDescription></div>
              <NewWorkoutButton exercises={d.exercises} today={today} />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Entrenamientos" value={String(last30.length)} />
              <Stat label="Días con actividad" value={String(activeDays)} />
              <Stat label="Tiempo registrado" value={timed.length ? formatDuration(totalSec) : "—"}
                detail={last30.length ? `${timed.length} de ${last30.length} con duración` : undefined} />
              {d.workouts[0] && (
                <p className="col-span-2 text-xs text-muted sm:col-span-3">
                  Último: {ACTIVITY_TYPES[d.workouts[0].activity_type]} el {formatDay(d.workouts[0].performed_on)}.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Frecuencia</CardTitle><CardDescription>Entrenamientos por semana, últimas 12 semanas.</CardDescription></div></CardHeader>
            <CardContent>
              <WeeklyBars data={d.weeks.map((w) => ({ week: w.week, value: w.sessions }))} label="Entrenamientos" format="count"
                ariaLabel="Barras de entrenamientos por semana en las últimas 12 semanas" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Tipos de actividad</CardTitle><CardDescription>Últimos 90 días · {last90.length} entrenamientos.</CardDescription></div></CardHeader>
            <CardContent><DistributionBars items={dist} total={last90.length} /></CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Volumen de fuerza</CardTitle><CardDescription>Series × repeticiones × kg por semana.</CardDescription></div></CardHeader>
            <CardContent>
              {volumeRows ? (
                <WeeklyBars data={d.weeks.map((w) => ({ week: w.week, value: Math.round(w.volume) }))} label="Volumen" format="kg0"
                  ariaLabel="Barras de volumen de fuerza por semana en las últimas 12 semanas"
                  note={`Basado en ${volumeRows} ${volumeRows === 1 ? "registro" : "registros"} con series, repeticiones y peso. Los que no tienen los tres datos no se cuentan.`} />
              ) : (
                <p className="text-sm text-muted">Aparece cuando registras series, repeticiones y peso en un mismo ejercicio.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div><CardTitle>Peso corporal</CardTitle><CardDescription>En kg · {weights.length} {weights.length === 1 ? "registro" : "registros"}.</CardDescription></div>
              <Button asChild size="sm" variant="ghost"><Link href={href("body")}>Ver medidas</Link></Button>
            </CardHeader>
            <CardContent>
              <ValueLine points={weights} label="Peso" format="kg1" ariaLabel="Evolución del peso corporal" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div><CardTitle>Sueño y recuperación</CardTitle><CardDescription>Últimos 30 días · {sleepDays} {sleepDays === 1 ? "día" : "días"} con registro, desde tu registro diario.</CardDescription></div>
            </CardHeader>
            <CardContent><SleepChart points={d.sleep} from={d.sleepFrom} to={today} /></CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <div><CardTitle>Estudio</CardTitle><CardDescription>{st.exams.length ? `${st.exams.length} ${st.exams.length === 1 ? "simulacro registrado" : "simulacros registrados"}.` : "Simulacros y exámenes de práctica."}</CardDescription></div>
              <Button asChild size="sm" variant="ghost"><Link href={href("study")}>{st.exams.length ? "Ver estudio" : "Registrar simulacro"}</Link></Button>
            </CardHeader>
            <CardContent>
              {st.missing ? (
                <p className="text-sm text-muted">Falta ejecutar la migración de simulacros en Supabase. Más detalles en la pestaña Estudio.</p>
              ) : st.exams.length ? (
                <ul className="space-y-1.5">
                  {st.exams.slice(0, 3).map((e) => (
                    <li key={e.id} className="text-sm">
                      {e.exam}<span className="text-muted"> · {formatDay(e.taken_on)}</span>
                      <p className="text-[11px] tabular-nums text-muted">{examSummary(e).join(" · ") || "Sin cifras registradas"}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Registra tus simulacros para ver la evolución de tu puntaje y tus aciertos.</p>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <div><CardTitle>Recientes</CardTitle></div>
              <Button asChild size="sm" variant="ghost"><Link href={href("workouts")}>Ver todos</Link></Button>
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
            <CardHeader><div><CardTitle>Medidas corporales</CardTitle></div></CardHeader>
            <CardContent><BodyList metrics={d.body} today={today} /></CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Evolución del peso</CardTitle><CardDescription>En kg.</CardDescription></div></CardHeader>
            <CardContent><ValueLine points={weights} label="Peso" format="kg1" ariaLabel="Evolución del peso corporal" /></CardContent>
          </Card>
        </div>
      )}
      {tab === "nutrition" && <Card><CardContent className="pt-5"><NutritionList logs={d.nutrition} today={today} /></CardContent></Card>}
    </>
  );
}
