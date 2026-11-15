import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Applications } from "@/components/career/applications";
import { PositionsList, SalaryChart } from "@/components/career/positions";
import { Skills } from "@/components/career/skills";
import { LearningList, Projects } from "@/components/career/projects-learning";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { getCareerData } from "@/lib/career/queries";
import { OPEN_STAGES, STAGES } from "@/lib/career/schema";
import { utcToZoned } from "@/lib/dates";
import { formatDay, formatMoney, formatNumber, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Carrera" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "summary", label: "Resumen" },
  { key: "applications", label: "Aplicaciones" },
  { key: "skills", label: "Skills" },
  { key: "projects", label: "Proyectos" },
  { key: "learning", label: "Aprendizaje" },
  { key: "positions", label: "Cargos y salario" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function CareerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "summary";
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);
  const d = await getCareerData(supabase);
  const href = (t: Tab) => (t === "summary" ? "/career" : `/career?tab=${t}`);

  const current = d.positions.find((p) => !p.ended_on) ?? null;
  const lastSalary = d.positions.find((p) => p.monthly_salary != null) ?? null;
  const openApps = d.applications.filter((a) => OPEN_STAGES.includes(a.stage));
  const upcoming = d.applications
    .flatMap((a) => a.interviews.map((i) => ({ ...i, app: a, z: utcToZoned(i.scheduled_at, prefs.timeZone) })))
    .filter((i) => i.z.date >= today)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 5);
  const topSkills = d.skills.filter((s) => s.current != null).sort((a, b) => b.current! - a.current!).slice(0, 6);

  return (
    <>
      <PageHeader title="Carrera" description="Tu trayectoria, procesos de selección, skills, proyectos y aprendizaje." />

      <nav aria-label="Secciones de Carrera" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-md border border-border p-0.5">
          {TABS.map((t) => (
            <Link key={t.key} href={href(t.key)} aria-current={tab === t.key ? "page" : undefined}
              className={cn("whitespace-nowrap rounded px-3 py-1.5 text-xs", tab === t.key ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {d.error && (
        <Card className="mb-5 flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> No se pudieron cargar tus datos. Intenta recargar la página.
        </Card>
      )}

      {tab === "summary" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><div><CardTitle>Hoy</CardTitle><CardDescription>Tu cargo y salario más recientes.</CardDescription></div></CardHeader>
            <CardContent className="space-y-1">
              {current || lastSalary ? (
                <>
                  <p className="text-lg font-semibold">{(current ?? lastSalary)!.title}</p>
                  <p className="text-sm text-muted">{(current ?? lastSalary)!.company ?? "Sin empresa"} · desde {formatDay((current ?? lastSalary)!.started_on)}</p>
                  {lastSalary && <p className="pt-2 text-sm">Salario mensual más reciente: <span className="font-medium tabular-nums">{formatMoney(lastSalary.monthly_salary)}</span> <span className="text-xs text-muted">({formatDay(lastSalary.started_on)})</span></p>}
                </>
              ) : (
                <p className="text-sm text-muted">Sin cargos registrados. <Link className="text-accent hover:underline" href={href("positions")}>Agregar uno</Link></p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Evolución del salario</CardTitle><CardDescription>Según los cargos y salarios que registraste.</CardDescription></div></CardHeader>
            <CardContent><SalaryChart positions={d.positions} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div><CardTitle>Procesos abiertos</CardTitle><CardDescription>{openApps.length} de {d.applications.length} aplicaciones.</CardDescription></div>
              <Button asChild size="sm" variant="ghost"><Link href={href("applications")}>Ver todas</Link></Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {openApps.length ? (
                <ul className="space-y-1 text-sm">
                  {OPEN_STAGES.map((s) => ({ s, n: openApps.filter((a) => a.stage === s).length })).filter((x) => x.n).map((x) => (
                    <li key={x.s} className="flex justify-between"><span>{STAGES[x.s]}</span><span className="tabular-nums text-muted">{x.n}</span></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No tienes procesos abiertos.</p>}
              {upcoming.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-medium text-muted">Próximas entrevistas</h3>
                  <ul className="space-y-1 text-sm">
                    {upcoming.map((i) => (
                      <li key={i.id} className="flex items-start gap-1.5">
                        <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
                        <span className="min-w-0 break-words">{formatDay(i.z.date, "EEE d MMM")} · {i.z.time} — {i.app.position} · {i.app.company}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div><CardTitle>Skills</CardTitle><CardDescription>{d.skills.length} registradas · nivel más reciente de 0 a 10.</CardDescription></div>
              <Button asChild size="sm" variant="ghost"><Link href={href("skills")}>Ver todas</Link></Button>
            </CardHeader>
            <CardContent>
              {topSkills.length ? (
                <ul className="space-y-1.5 text-sm">
                  {topSkills.map((s) => (
                    <li key={s.id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{s.name}</span>
                      <span className="shrink-0 tabular-nums">{formatNumber(s.current, 1)}<span className="text-xs text-muted">{s.target_level != null ? ` / meta ${s.target_level}` : ""}</span></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Sin niveles registrados.</p>}
              <p className="mt-3 text-xs text-muted">
                {d.projects.length} {d.projects.length === 1 ? "proyecto" : "proyectos"} · {d.learning.filter((l) => !l.completed_on).length} cursos o recursos en curso
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "applications" && (
        <Card><CardContent className="pt-5"><Applications apps={d.applications} today={today} timeZone={prefs.timeZone} /></CardContent></Card>
      )}
      {tab === "skills" && <Card><CardContent className="pt-5"><Skills skills={d.skills} today={today} /></CardContent></Card>}
      {tab === "projects" && <Card><CardContent className="pt-5"><Projects projects={d.projects} skills={d.skills} goals={d.goals} today={today} /></CardContent></Card>}
      {tab === "learning" && <Card><CardContent className="pt-5"><LearningList items={d.learning} skills={d.skills} today={today} /></CardContent></Card>}
      {tab === "positions" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><div><CardTitle>Cargos y salarios</CardTitle><CardDescription>Incluye lo importado de Segundo Cerebro.</CardDescription></div></CardHeader>
            <CardContent><PositionsList positions={d.positions} today={today} /></CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Evolución del salario</CardTitle></div></CardHeader>
            <CardContent><SalaryChart positions={d.positions} /></CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
