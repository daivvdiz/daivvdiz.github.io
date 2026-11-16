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

export const metadata: Metadata = { title: "Analítica de vida" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "personal", label: "Tendencias personales" },
  { key: "finance", label: "Finanzas" },
  { key: "career", label: "Carrera" },
  { key: "activity", label: "Actividad" },
  { key: "compare", label: "Comparar periodos" },
  { key: "balance", label: "Balance de vida" },
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
      <PageHeader title="Analítica de vida" description="Cómo ha cambiado tu vida según tus propios registros. Tú interpretas lo que significa." />

      <nav aria-label="Secciones de Analítica" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
          <nav aria-label="Periodo" className="flex flex-wrap gap-1.5">
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
            <label className="space-y-1 text-[11px] text-muted">Desde<Input type="date" name="from" defaultValue={period.from} max={today} className="h-8 w-36" required /></label>
            <label className="space-y-1 text-[11px] text-muted">Hasta<Input type="date" name="to" defaultValue={period.to} max={today} className="h-8 w-36" required /></label>
            <Button type="submit" size="sm" variant={period.key === "custom" ? "default" : "secondary"}>Aplicar</Button>
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
  const periodText = (b: { from: string; to: string }) => (by === "month" ? formatDay(b.from, "MMMM yyyy") : `Semana del ${formatDay(b.from, "d MMM")}`);
  const rows = (pick: (s: Summary) => { values: Record<string, number | null>; n?: Record<string, number> }): Row[] =>
    ser.map((b) => ({ label: b.label, period: periodText(b), ...pick(b.s) }));
  const unit = by === "month" ? "por mes" : "por semana";

  return (
    <div className="space-y-5">
      {raw.error && (
        <Card className="flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> Algunos datos no se pudieron cargar. Intenta recargar la página.
        </Card>
      )}
      <p className="text-xs text-muted">{formatDay(from)} – {formatDay(to)} · agrupado {unit}. Cada cifra indica cuántos registros la respaldan.</p>

      {tab === "personal" && <Personal raw={raw} all={all} rows={rows} unit={unit} goals={snap.goals} />}

      {tab === "finance" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Ingresos" value={formatMoney(all.income.value)} detail={plural(all.income.n, "movimiento", "movimientos")} />
            <Stat label="Gastos" value={formatMoney(all.expense.value)} detail={plural(all.expense.n, "movimiento", "movimientos")} />
            <Stat label="Aportes a ahorro" value={formatMoney(all.savings.value)} detail={plural(all.savings.n, "aporte", "aportes")} />
            <Stat label="Patrimonio neto hoy" value={formatMoney(snap.netWorth.value)}
              detail={`${plural(snap.netWorth.nAssets, "activo", "activos")} · ${plural(snap.netWorth.nLiabilities, "deuda", "deudas")}`} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Ingresos y gastos" description={`Suma ${unit}. Los aportes a ahorro no cuentan como gasto.`}>
              <SeriesChart format="money" ariaLabel={`Barras de ingresos y gastos ${unit}`}
                series={[{ key: "income", label: "Ingresos" }, { key: "expense", label: "Gastos" }]}
                rows={rows((s) => ({ values: { income: s.income.n ? s.income.value : null, expense: s.expense.n ? s.expense.value : null }, n: { income: s.income.n, expense: s.expense.n } }))} />
            </ChartCard>
            <ChartCard title="Diferencia entre ingresos y gastos" description={`Ingresos menos gastos ${unit}. Vacío si no hubo movimientos.`}>
              <SeriesChart format="money" kind="line" ariaLabel={`Diferencia entre ingresos y gastos ${unit}`}
                series={[{ key: "net", label: "Diferencia" }]} rows={rows((s) => ({ values: { net: s.net.value }, n: { net: s.net.n } }))} />
            </ChartCard>
            <ChartCard title="Aportes a ahorro" description={`Suma ${unit}.`}>
              <SeriesChart format="money" ariaLabel={`Aportes a ahorro ${unit}`} series={[{ key: "savings", label: "Aportes" }]}
                rows={rows((s) => ({ values: { savings: s.savings.n ? s.savings.value : null }, n: { savings: s.savings.n } }))} />
            </ChartCard>
            <ChartCard title="Patrimonio neto" description="Valor actual de tus activos menos el saldo de tus deudas.">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Activos</dt><dd className="tabular-nums">{formatMoney(snap.netWorth.assets)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Saldo de deudas</dt><dd className="tabular-nums">{formatMoney(snap.netWorth.debt)}</dd></div>
                <div className="flex justify-between border-t border-border pt-1.5 font-medium"><dt>Patrimonio neto</dt><dd className="tabular-nums">{formatMoney(snap.netWorth.value)}</dd></div>
              </dl>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted"><Info className="mt-0.5 size-3 shrink-0" aria-hidden /> Los activos guardan solo su valor más reciente, así que aún no hay historial de patrimonio para graficar sin inventar valores.</p>
            </ChartCard>
          </div>
        </>
      )}

      {tab === "career" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Aplicaciones" value={formatNumber(all.applications, 0)} detail="con fecha de aplicación en el periodo" />
            <Stat label="Entrevistas" value={formatNumber(all.interviews, 0)} />
            <Stat label="Ofertas" value={formatNumber(all.offers, 0)} detail={`de las aplicaciones del periodo · ${snap.openOffers} en total`} />
            <Stat label="Proyectos terminados" value={formatNumber(all.projectsCompleted, 0)} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Aplicaciones y entrevistas" description={`Conteo ${unit}.`}>
              <SeriesChart format="count" ariaLabel={`Aplicaciones y entrevistas ${unit}`}
                series={[{ key: "apps", label: "Aplicaciones" }, { key: "interviews", label: "Entrevistas" }]}
                rows={rows((s) => ({ values: { apps: s.applications, interviews: s.interviews } }))} />
            </ChartCard>
            <ChartCard title="Evolución del salario" description="Todos tus cargos con salario registrado.">
              <SalaryChart positions={snap.positions} />
            </ChartCard>
            <ChartCard title="Desarrollo de skills" description="Primer y último nivel registrados dentro del periodo (0 a 10).">
              <SkillChanges levels={raw.levels} names={snap.skillNames} />
            </ChartCard>
            <ChartCard title="Proyectos terminados" description={`Conteo ${unit}.`}>
              <SeriesChart format="count" ariaLabel={`Proyectos terminados ${unit}`} series={[{ key: "p", label: "Proyectos" }]}
                rows={rows((s) => ({ values: { p: s.projectsCompleted } }))} />
            </ChartCard>
          </div>
        </>
      )}

      {tab === "activity" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Recuerdos" value={formatNumber(all.memories, 0)} detail={`${all.travel} de viajes · ${all.important} importantes`} />
            <Stat label="Días con diario escrito" value={formatNumber(all.journalDays, 0)} detail={plural(all.journalEntries, "escrito aparte", "escritos aparte")} />
            <Stat label="Logros registrados" value={formatNumber(all.accomplishments, 0)} />
            <Stat label="Eventos sociales" value={formatNumber(all.social, 0)} detail="categoría Social del calendario" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Recuerdos" description={`Conteo ${unit}, por la fecha del recuerdo.`}>
              <SeriesChart format="count" ariaLabel={`Recuerdos ${unit}`}
                series={[{ key: "m", label: "Todos" }, { key: "t", label: "Viajes" }, { key: "i", label: "Importantes" }]}
                rows={rows((s) => ({ values: { m: s.memories, t: s.travel, i: s.important } }))}
                note="“Importantes” son los de la categoría Momentos importantes o con importancia 4 o 5 que tú asignaste." />
            </ChartCard>
            <ChartCard title="Diario y logros" description={`Conteo ${unit}.`}>
              <SeriesChart format="count" ariaLabel={`Diario y logros ${unit}`}
                series={[{ key: "j", label: "Días con diario" }, { key: "a", label: "Logros" }]}
                rows={rows((s) => ({ values: { j: s.journalDays + s.journalEntries, a: s.accomplishments } }))}
                note="Días con diario incluye la entrada del día y los escritos aparte de Salud mental." />
            </ChartCard>
            <ChartCard title="Eventos sociales" description={`Conteo ${unit}.`}>
              <SeriesChart format="count" ariaLabel={`Eventos sociales ${unit}`} series={[{ key: "s", label: "Eventos sociales" }]}
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
        <Stat label="Ánimo promedio" value={score(all.mood)} detail={plural(all.mood.n, "día", "días")} />
        <Stat label="Sueño promedio" value={all.sleep.value == null ? "—" : `${formatNumber(all.sleep.value, 1)} h`} detail={plural(all.sleep.n, "noche", "noches")} />
        <Stat label="Entrenamientos" value={formatNumber(all.workouts, 0)} detail={`${plural(all.workoutDays, "día", "días")} con actividad`} />
        <Stat label="Hábitos cumplidos" value={all.habits.value == null ? "—" : `${formatNumber(all.habits.value, 0)}%`} detail={all.habits.expected ? `${all.habits.done} de ${all.habits.expected} planeados` : "sin hábitos planeados"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Ánimo, energía y estrés" description={`Promedio ${unit} (1 a 10).`}>
          <SeriesChart kind="line" format="score" domain={[1, 10]} ariaLabel={`Promedios de ánimo, energía y estrés ${unit}`}
            series={[{ key: "mood", label: "Ánimo" }, { key: "energy", label: "Energía" }, { key: "stress", label: "Estrés" }]}
            rows={rows((s) => ({ values: { mood: s.mood.value, energy: s.energy.value, stress: s.stress.value }, n: { mood: s.mood.n, energy: s.energy.n, stress: s.stress.n } }))}
            note="Periodos sin registros quedan vacíos." />
        </ChartCard>
        <ChartCard title="Sueño" description={`Horas promedio ${unit}.`}>
          <SeriesChart kind="line" format="hours" domain={[0, 12]} ariaLabel={`Horas de sueño promedio ${unit}`}
            series={[{ key: "h", label: "Horas de sueño" }]} rows={rows((s) => ({ values: { h: s.sleep.value }, n: { h: s.sleep.n } }))} />
        </ChartCard>
        <ChartCard title="Actividad física" description={`Entrenamientos ${unit}.`}>
          <SeriesChart format="count" ariaLabel={`Entrenamientos ${unit}`} series={[{ key: "w", label: "Entrenamientos" }]}
            rows={rows((s) => ({ values: { w: s.workouts } }))}
            note={types.length ? types.map(([t, n]) => `${WORKOUT_TYPES[t] ?? t}: ${n}`).join(" · ") : undefined} />
        </ChartCard>
        <ChartCard title="Estudio" description={`Aciertos promedio en simulacros ${unit}.`}>
          <SeriesChart kind="line" format="pct" domain={[0, 100]} ariaLabel={`Porcentaje de aciertos promedio en simulacros ${unit}`} series={[{ key: "a", label: "Aciertos" }]}
            rows={rows((s) => ({ values: { a: s.examAccuracy.value }, n: { a: s.examAccuracy.n } }))}
            note={`${plural(all.exams, "simulacro", "simulacros")} en el periodo. Mezcla todos tus simulacros; el detalle por simulacro está en Entrenamiento → Estudio.`} />
        </ChartCard>
        <ChartCard title="Constancia en hábitos" description={`Veces cumplidas frente a planeadas, ${unit}.`}>
          <SeriesChart format="pct" domain={[0, 100]} ariaLabel={`Porcentaje de hábitos cumplidos ${unit}`} series={[{ key: "h", label: "Cumplidos" }]}
            rows={rows((s) => ({ values: { h: s.habits.value }, n: { h: s.habits.expected } }))}
            note="El número entre paréntesis en la tabla es cuántas veces estaba planeado. Sin rachas ni puntajes." />
        </ChartCard>
        <ChartCard title="Metas" description={`${plural(active.length, "meta activa", "metas activas")} · ${plural(all.milestones, "hito completado", "hitos completados")} en el periodo.`}>
          {!active.length ? <p className="text-sm text-muted">No tienes metas activas.</p> : (
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
        <ChartCard title="Asociaciones exploratorias" description="Cómo se mueven juntos algunos registros. No indica que uno cause el otro.">
          <ul className="space-y-2 text-sm">
            {pairs.map(([a, b]) => {
              const { r, n } = pearson(points, a, b);
              return (
                <li key={`${a}-${b}`} className="flex flex-col">
                  <span>{METRIC_LABEL[a]} y {METRIC_LABEL[b].toLowerCase()}</span>
                  <span className="text-muted">{r == null || n < MIN_CORRELATION_N ? `pocos datos (${n} días con ambos)` : `${describeR(r)} · r = ${formatNumber(r, 2)} · ${n} días`}</span>
                </li>
              );
            })}
            <li className="flex flex-wrap justify-between gap-x-3 border-t border-border pt-2">
              <span>Ánimo en días con y sin entrenamiento</span>
              <span className="text-muted">
                {mw.with.n < 3 || mw.without.n < 3 ? `pocos datos (${mw.with.n} con · ${mw.without.n} sin)` : `${formatNumber(mw.with.value, 1)} (${mw.with.n} días) · ${formatNumber(mw.without.value, 1)} (${mw.without.n} días)`}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-[11px] text-muted">Se usan solo días que tienen ambos registros; con menos de {MIN_CORRELATION_N} no se calcula.</p>
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
  if (!list.length) return <p className="text-sm text-muted">Sin niveles registrados en este periodo.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {list.map((s) => (
        <li key={s.id} className="flex flex-wrap justify-between gap-x-3">
          <span className="min-w-0 truncate">{s.name}</span>
          <span className="tabular-nums text-muted">
            {s.n === 1 ? `${formatNumber(s.last.level, 1)} (${formatDay(s.last.date, "d MMM yy")})` : `de ${formatNumber(s.first.level, 1)} a ${formatNumber(s.last.level, 1)} · ${s.n} registros`}
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
    { title: "Bienestar", lines: [
      { label: "Días con registro", a: a.daysRecorded, b: b.daysRecorded, fmt: int },
      { label: "Ánimo promedio (1–10)", a: a.mood.value, b: b.mood.value, fmt: one, na: a.mood.n, nb: b.mood.n },
      { label: "Energía promedio (1–10)", a: a.energy.value, b: b.energy.value, fmt: one, na: a.energy.n, nb: b.energy.n },
      { label: "Estrés promedio (1–10)", a: a.stress.value, b: b.stress.value, fmt: one, na: a.stress.n, nb: b.stress.n },
      { label: "Horas de sueño promedio", a: a.sleep.value, b: b.sleep.value, fmt: one, na: a.sleep.n, nb: b.sleep.n },
      { label: "Hábitos cumplidos (%)", a: a.habits.value, b: b.habits.value, fmt: int, na: a.habits.expected, nb: b.habits.expected },
    ] },
    { title: "Entrenamiento", lines: [
      { label: "Entrenamientos", a: a.workouts, b: b.workouts, fmt: int },
      { label: "Días con actividad", a: a.workoutDays, b: b.workoutDays, fmt: int },
      { label: "Minutos registrados", a: a.workoutMinutes.value, b: b.workoutMinutes.value, fmt: int, na: a.workoutMinutes.n, nb: b.workoutMinutes.n },
      { label: "Simulacros", a: a.exams, b: b.exams, fmt: int },
      { label: "Aciertos en simulacros (%)", a: a.examAccuracy.value, b: b.examAccuracy.value, fmt: int, na: a.examAccuracy.n, nb: b.examAccuracy.n },
    ] },
    { title: "Finanzas", lines: [
      { label: "Ingresos", a: a.income.n ? a.income.value : null, b: b.income.n ? b.income.value : null, fmt: money, na: a.income.n, nb: b.income.n },
      { label: "Gastos", a: a.expense.n ? a.expense.value : null, b: b.expense.n ? b.expense.value : null, fmt: money, na: a.expense.n, nb: b.expense.n },
      { label: "Aportes a ahorro", a: a.savings.n ? a.savings.value : null, b: b.savings.n ? b.savings.value : null, fmt: money, na: a.savings.n, nb: b.savings.n },
    ] },
    { title: "Carrera", lines: [
      { label: "Aplicaciones", a: a.applications, b: b.applications, fmt: int },
      { label: "Entrevistas", a: a.interviews, b: b.interviews, fmt: int },
      { label: "Niveles de skill registrados", a: a.skillLevels, b: b.skillLevels, fmt: int },
      { label: "Proyectos terminados", a: a.projectsCompleted, b: b.projectsCompleted, fmt: int },
    ] },
    { title: "Vida", lines: [
      { label: "Recuerdos", a: a.memories, b: b.memories, fmt: int },
      { label: "Días con diario escrito", a: a.journalDays, b: b.journalDays, fmt: int },
      { label: "Logros", a: a.accomplishments, b: b.accomplishments, fmt: int },
      { label: "Eventos sociales", a: a.social, b: b.social, fmt: int },
      { label: "Hitos de metas completados", a: a.milestones, b: b.milestones, fmt: int },
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
    return d === 0 ? "igual" : `${d > 0 ? "+" : "−"}${l.fmt(Math.abs(d))}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <nav aria-label="Periodos a comparar" className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Link key={p.key} href={`/analytics?tab=compare&cmp=${p.key}`} aria-current={!custom && preset.key === p.key ? "page" : undefined}
              className={cn("rounded-md border px-3 py-1.5 text-xs", !custom && preset.key === p.key ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground")}>
              {p.label}
            </Link>
          ))}
        </nav>
        <form action="/analytics" className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
          <input type="hidden" name="tab" value="compare" /><input type="hidden" name="cmp" value="custom" />
          <label className="space-y-1 text-[11px] text-muted">A desde<Input type="date" name="af" defaultValue={A.from} max={today} className="h-8 sm:w-36" required /></label>
          <label className="space-y-1 text-[11px] text-muted">A hasta<Input type="date" name="at" defaultValue={A.to} max={today} className="h-8 sm:w-36" required /></label>
          <label className="space-y-1 text-[11px] text-muted">B desde<Input type="date" name="bf" defaultValue={B.from} max={today} className="h-8 sm:w-36" required /></label>
          <label className="space-y-1 text-[11px] text-muted">B hasta<Input type="date" name="bt" defaultValue={B.to} max={today} className="h-8 sm:w-36" required /></label>
          <Button type="submit" size="sm" variant={custom ? "default" : "secondary"} className="col-span-2">Comparar</Button>
        </form>
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{name(A)} frente a {name(B)}</CardTitle>
            <CardDescription>Cifras de tus registros en cada periodo. Entre paréntesis, cuántos registros respaldan el valor. No significa que un periodo haya sido mejor que otro.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 text-left font-medium">Dato</th>
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
          <p className="mt-3 text-[11px] text-muted">Si un periodo está en curso, solo cuenta hasta hoy. Los periodos pueden tener distinta cantidad de días.<span className="sm:hidden"> En pantallas pequeñas se oculta la columna de diferencia.</span></p>
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
        <CardHeader><div><CardTitle>Cómo leerlo</CardTitle></div></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>Cada autoevaluación es tu propia valoración de 1 a 10 en seis áreas. Compara dos fechas para ver qué cambió.</p>
          <p>No hay un puntaje global ni una forma correcta de distribuir tu atención. El historial completo está en Archivo de vida → Balance de vida.</p>
          <Button asChild size="sm" variant="secondary"><Link href="/archive?tab=radar">Ver historial</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
