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

export const metadata: Metadata = { title: "Salud mental" };
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
        title="Salud mental"
        description="Cómo te has sentido, según lo que registras. Sin puntajes ni diagnósticos."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/calendar?view=day&date=${today}`}>Registrar ánimo de hoy</Link>
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Periodo" className="flex flex-wrap gap-1.5">
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
            Desde
            <Input type="date" name="from" defaultValue={period.from} max={today} className="h-8 w-36" required />
          </label>
          <label className="space-y-1 text-[11px] text-muted">
            Hasta
            <Input type="date" name="to" defaultValue={period.to} max={today} className="h-8 w-36" required />
          </label>
          <Button type="submit" size="sm" variant={period.key === "custom" ? "default" : "secondary"}>Aplicar</Button>
        </form>
      </div>

      {data.error && (
        <Card className="mb-5 flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> No se pudieron cargar tus registros. Intenta recargar la página.
        </Card>
      )}

      <p className="mb-3 text-xs text-muted">
        {formatDay(period.from)} – {formatDay(period.to)} · {recorded.length} de {totalDays} días con algún registro
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const s = summary(data.points, t.key);
          return (
            <Card key={t.key} className="px-4 py-3">
              <p className="text-xs text-muted">{METRIC_LABEL[t.key]} promedio</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {s.n ? <>{formatNumber(s.avg, 1)}{t.unit}<span className="text-sm font-normal text-muted">{t.scale}</span></> : <span className="text-muted">—</span>}
              </p>
              <p className="text-[11px] text-muted tabular-nums">
                {s.n ? `${s.n} ${s.n === 1 ? "día" : "días"} · rango ${formatNumber(s.min, 1)}–${formatNumber(s.max, 1)}` : "Sin registros"}
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
            title="Aún no hay registros en este periodo"
            description="Registra tu ánimo, energía, estrés y sueño en la entrada diaria del calendario. Aquí verás cómo cambian con el tiempo."
            action={<Button asChild size="sm"><Link href={`/calendar?view=day&date=${today}`}>Ir a la entrada de hoy</Link></Button>}
          />
        </Card>
      ) : (
        <div className="mb-5 grid gap-5 xl:grid-cols-2">
          <Card className="xl:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Ánimo, energía y estrés</CardTitle>
                <CardDescription>Escala de 1 a 10, tal como lo registraste cada día.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><TrendChart points={data.points} from={period.from} to={period.to} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Calendario de ánimo</CardTitle>
                <CardDescription>Más intenso = valor más alto. Toca un día para abrir su entrada.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><MoodCalendar points={data.points} from={period.from} to={period.to} weekStartsOn={prefs.weekStartsOn} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Sueño</CardTitle>
                <CardDescription>Horas dormidas y calidad percibida.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><SleepChart points={data.points} from={period.from} to={period.to} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Distribución</CardTitle>
                <CardDescription>Cuántos días registraste cada valor.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><DistributionChart points={data.points} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Promedios</CardTitle>
                <CardDescription>Por semana o por mes, solo con los días registrados.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><AveragesTable points={data.points} weekStartsOn={prefs.weekStartsOn} /></CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Relaciones exploratorias</CardTitle>
                <CardDescription>Si dos medidas tienden a subir o bajar juntas en tus días registrados.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PAIRS.map(([a, b]) => {
                  const { r, n } = pearson(data.points, a, b);
                  const enough = r != null && n >= MIN_CORRELATION_N;
                  return (
                    <li key={`${a}-${b}`} className="rounded-md border border-border p-3">
                      <p className="text-sm font-medium">{METRIC_LABEL[a]} y {METRIC_LABEL[b].toLowerCase()}</p>
                      {enough ? (
                        <p className="mt-1 text-xs text-muted">
                          <span className="text-foreground">{describeR(r)}</span> · r = {formatNumber(r, 2)} · {n} días
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted">
                          Datos insuficientes: {n} {n === 1 ? "día tiene" : "días tienen"} ambos valores (se necesitan al menos {MIN_CORRELATION_N} y que varíen).
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                Es solo exploratorio: una relación no implica causalidad, y con pocos días puede ser casualidad.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Emociones de hoy</CardTitle>
              <CardDescription>{formatDay(today, "EEEE d 'de' MMMM")}. Todo es opcional.</CardDescription>
            </div>
          </CardHeader>
          <CardContent><EmotionsToday key={today} date={today} initial={data.today} known={data.emotionNames} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Lo más frecuente del periodo</CardTitle>
              <CardDescription>Emociones y factores de estrés que registraste.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-medium text-muted">Emociones</h3>
              {data.emotions.length ? (
                <ul className="space-y-1 text-sm">
                  {data.emotions.slice(0, 10).map((e) => (
                    <li key={e.name} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{e.name}</span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {e.days} {e.days === 1 ? "día" : "días"}{e.avgIntensity != null && ` · int. ${formatNumber(e.avgIntensity, 1)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Sin emociones registradas.</p>}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium text-muted">Factores de estrés</h3>
              {data.factors.length ? (
                <ul className="space-y-1 text-sm">
                  {data.factors.slice(0, 10).map((f) => (
                    <li key={f.description} className="flex justify-between gap-2">
                      <span className="min-w-0 break-words">{f.description}</span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">{f.days} {f.days === 1 ? "vez" : "veces"}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Sin factores registrados.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Diario emocional</CardTitle>
              <CardDescription>Emociones, pensamientos, experiencias difíciles y lo que te ayudó.</CardDescription>
            </div>
            <NewJournalButton today={today} />
          </CardHeader>
          <CardContent><JournalList items={data.journal} today={today} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Estrategias que te ayudan</CardTitle>
              <CardDescription>Lo que haces para cuidarte y cuánto te sirvió, según tú.</CardDescription>
            </div>
          </CardHeader>
          <CardContent><Strategies strategies={data.strategies} logs={data.logs} today={today} /></CardContent>
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-muted">
        LIFE OS no reemplaza a un profesional de salud mental. Si estás pasando por un momento difícil, buscar apoyo es una buena decisión.
      </p>
    </>
  );
}
