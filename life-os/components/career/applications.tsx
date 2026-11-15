"use client";

import { useState } from "react";
import { CalendarClock, ExternalLink, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityDialog, useEditor } from "@/components/entity-dialog";
import { formatDay, formatMoney } from "@/lib/format";
import { utcToZoned } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { applicationSchema, OPEN_STAGES, STAGES, WORK_MODES, type ApplicationInput, type Stage } from "@/lib/career/schema";
import { deleteApplication, deleteInterview, saveApplication, saveInterview, setApplicationStage } from "@/lib/career/actions";
import type { Application } from "@/lib/career/queries";

function Interviews({ app, today, timeZone }: { app: Application; today: string; timeZone: string }) {
  const [form, setForm] = useState({ kind: "", date: today, time: "09:00" });
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-medium text-muted">Entrevistas ({app.interviews.length})</p>
      {app.interviews.length > 0 && (
        <ul className="space-y-1">
          {app.interviews.map((i) => {
            const z = utcToZoned(i.scheduled_at, timeZone);
            return (
              <li key={i.id} className="flex items-center gap-2 text-sm">
                <CalendarClock className="size-3.5 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{formatDay(z.date, "EEE d MMM yyyy")} · {z.time}{i.kind && ` · ${i.kind}`}</span>
                <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Eliminar entrevista" onClick={async () => {
                  const r = await deleteInterview(i.id);
                  if (!r.ok) toast.error(r.error);
                }}><Trash2 /></Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_9rem_6rem_auto]">
        <Input aria-label="Tipo de entrevista" placeholder="Ej. Técnica" className="col-span-2 sm:col-span-1" value={form.kind} maxLength={100} onChange={(e) => setForm({ ...form, kind: e.target.value })} />
        <Input aria-label="Fecha de la entrevista" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <Input aria-label="Hora de la entrevista" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <Button type="button" variant="secondary" className="col-span-2 sm:col-span-1" disabled={pending} onClick={async () => {
          setPending(true);
          const r = await saveInterview({ application_id: app.id, ...form, notes: "" });
          setPending(false);
          if (!r.ok) return void toast.error(r.error);
          setForm({ ...form, kind: "" });
          toast.success("Entrevista agregada");
        }}><Plus /> Agregar</Button>
      </div>
    </div>
  );
}

export function Applications({ apps, today, timeZone }: { apps: Application[]; today: string; timeZone: string }) {
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");
  const ed = useEditor<Application>();
  const it = ed.item ? apps.find((a) => a.id === ed.item!.id) ?? ed.item : undefined;

  const isOpen = (a: Application) => OPEN_STAGES.includes(a.stage);
  const shown = apps.filter((a) => filter === "all" || (filter === "open" ? isOpen(a) : !isOpen(a)));
  const byStage = (Object.keys(STAGES) as Stage[]).map((s) => ({ stage: s, items: shown.filter((a) => a.stage === s) })).filter((g) => g.items.length);
  const counts = { open: apps.filter(isOpen).length, closed: apps.filter((a) => !isOpen(a)).length, all: apps.length };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar aplicaciones">
          {([["open", "Abiertas"], ["closed", "Cerradas"], ["all", "Todas"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
              className={cn("rounded-md border px-3 py-1.5 text-xs", filter === k ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground")}>
              {l} <span className="tabular-nums text-muted">{counts[k]}</span>
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> Nueva aplicación</Button>
      </div>

      {!apps.length ? (
        <EmptyState icon={Send} title="Sin aplicaciones" description="Lleva el seguimiento de cada proceso: etapa, entrevistas, prueba técnica y retroalimentación." />
      ) : !shown.length ? (
        <p className="py-4 text-center text-sm text-muted">No hay aplicaciones en este filtro.</p>
      ) : (
        <div className="space-y-4">
          {byStage.map((g) => (
            <section key={g.stage}>
              <h3 className="mb-1.5 text-xs font-medium text-muted">{STAGES[g.stage]} ({g.items.length})</h3>
              <ul className="space-y-2">
                {g.items.map((a) => {
                  const next = a.interviews.map((i) => utcToZoned(i.scheduled_at, timeZone)).find((z) => z.date >= today);
                  return (
                    <li key={a.id} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => ed.setEditing(a)}>
                        <p className="break-words text-sm font-medium hover:underline">{a.position} · {a.company}</p>
                        <p className="text-[11px] text-muted">
                          {[a.applied_on && `Aplicaste el ${formatDay(a.applied_on)}`, a.work_mode && WORK_MODES[a.work_mode], a.location, a.salary_expectation != null && `Aspiración ${formatMoney(a.salary_expectation)}`]
                            .filter(Boolean).join(" · ") || "Sin detalles"}
                        </p>
                        {next && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-foreground"><CalendarClock className="size-3" aria-hidden /> Próxima entrevista: {formatDay(next.date, "EEE d MMM")} · {next.time}</p>}
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        {a.job_url && (
                          <Button asChild size="icon" variant="ghost" className="size-8" aria-label="Abrir la vacante">
                            <a href={a.job_url} target="_blank" rel="noopener noreferrer"><ExternalLink /></a>
                          </Button>
                        )}
                        <Select aria-label={`Etapa de ${a.company}`} className="h-8 w-48 text-xs" value={a.stage} onChange={async (e) => {
                          const r = await setApplicationStage(a.id, e.target.value as Stage);
                          if (!r.ok) return void toast.error(r.error);
                          toast.success("Etapa actualizada");
                        }}>
                          {Object.entries(STAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </Select>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <EntityDialog<ApplicationInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()} wide
        title={it ? `${it.position} · ${it.company}` : "Nueva aplicación"}
        schema={applicationSchema}
        defaults={it
          ? {
              company: it.company, position: it.position, location: it.location ?? "", work_mode: it.work_mode, salary_expectation: it.salary_expectation,
              applied_on: it.applied_on ?? "", stage: it.stage, contact_person: it.contact_person ?? "", job_url: it.job_url ?? "",
              technical_test: it.technical_test ?? "", feedback: it.feedback ?? "", notes: it.notes ?? "",
            }
          : {
              company: "", position: "", location: "", work_mode: "", salary_expectation: null, applied_on: today, stage: "applied",
              contact_person: "", job_url: "", technical_test: "", feedback: "", notes: "",
            }}
        fields={[
          { name: "company", label: "Empresa", kind: "text", half: true },
          { name: "position", label: "Cargo", kind: "text", half: true },
          { name: "stage", label: "Etapa", kind: "select", options: STAGES, half: true },
          { name: "applied_on", label: "Fecha de aplicación", kind: "date", half: true },
          { name: "work_mode", label: "Modalidad", kind: "select", options: WORK_MODES, half: true },
          { name: "location", label: "Ubicación", kind: "text", half: true },
          { name: "salary_expectation", label: "Aspiración salarial mensual", kind: "money", half: true },
          { name: "contact_person", label: "Contacto", kind: "text", half: true },
          { name: "job_url", label: "Enlace a la vacante", kind: "url", placeholder: "https://…" },
          { name: "technical_test", label: "Prueba técnica", kind: "textarea" },
          { name: "feedback", label: "Retroalimentación recibida", kind: "textarea" },
          { name: "notes", label: "Notas", kind: "textarea" },
        ]}
        onSave={(v) => saveApplication(v, it?.id)}
        footer={it && (
          <ConfirmDialog
            trigger={<Button type="button" variant="ghost"><Trash2 /> Eliminar</Button>}
            title="¿Eliminar esta aplicación?"
            description="Se eliminarán la aplicación y sus entrevistas. Si el proceso terminó, puedes marcarlo como “No continuó” o “Me retiré”."
            onConfirm={async () => {
              const r = await deleteApplication(it.id);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Aplicación eliminada");
              setTimeout(() => ed.close(), 0);
            }}
          />
        )}
      >
        {it ? <Interviews app={it} today={today} timeZone={timeZone} /> : <p className="text-[11px] text-muted">Podrás agregar entrevistas después de guardarla.</p>}
      </EntityDialog>
    </div>
  );
}
