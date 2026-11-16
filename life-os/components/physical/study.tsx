"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityDialog, useEditor } from "@/components/entity-dialog";
import { formatDay, formatDuration, formatNumber } from "@/lib/format";
import { durationText } from "@/lib/physical/schema";
import { examSchema, examStats, examSummary, type Exam, type ExamInput } from "@/lib/study/schema";
import { deleteExam, saveExam } from "@/lib/study/actions";
import { ValueLine } from "./charts";

const n0 = (v: number) => formatNumber(v, 0);
const score = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-[11px] text-muted">{detail}</p>}
    </div>
  );
}

export function StudyView({ exams, today, missing }: { exams: Exam[]; today: string; missing: boolean }) {
  const ed = useEditor<Exam>();
  const it = ed.item;
  const names = useMemo(() => [...new Set(exams.map((e) => e.exam))], [exams]);
  const subjects = useMemo(() => [...new Set(exams.map((e) => e.subject).filter((x): x is string => !!x))], [exams]);
  const [sel, setSel] = useState<string>(names[0] ?? "");
  const current = names.includes(sel) ? sel : names[0] ?? "";
  // Los puntajes solo se comparan dentro del mismo simulacro.
  const list = exams.filter((e) => e.exam === current);
  const asc = [...list].reverse();
  const scores = asc.filter((e) => e.score != null).map((e) => ({ date: e.taken_on, value: e.score!, detail: e.level ? `Nivel ${e.level}` : e.subject }));
  const acc = asc.map((e) => ({ e, a: examStats(e).accuracy })).filter((x) => x.a != null)
    .map(({ e, a }) => ({ date: e.taken_on, value: Math.round(a! * 10) / 10, detail: `${e.correct} de ${e.total_questions}` }));
  const timed = list.filter((e) => e.duration_seconds != null);
  const avgAcc = acc.length ? acc.reduce((s, x) => s + x.value, 0) / acc.length : null;
  const avgTime = timed.length ? timed.reduce((s, e) => s + e.duration_seconds!, 0) / timed.length : null;
  const last = list[0];

  if (missing)
    return (
      <div className="rounded-md border border-warning/40 p-4 text-sm">
        <p className="font-medium">Falta un paso en Supabase</p>
        <p className="mt-1 text-muted">
          Para guardar simulacros, ejecuta una vez la migración <code className="text-xs">supabase/migrations/20261116000100_study_exams.sql</code> en
          Supabase → SQL Editor. Solo crea una tabla nueva; no cambia tus datos.
        </p>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          {names.length > 1 && (
            <label className="block space-y-1 text-xs text-muted">
              Simulacro
              <Select value={current} onChange={(e) => setSel(e.target.value)} className="h-8 w-64 max-w-full">
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </label>
          )}
          <p className="max-w-prose text-xs text-muted">Registra solo lo que el simulacro te muestre. Los puntajes se comparan solo dentro del mismo simulacro.</p>
        </div>
        <Button size="sm" onClick={() => ed.setEditing("new")}><Plus /> Registrar simulacro</Button>
      </div>

      {!exams.length ? (
        <EmptyState icon={GraduationCap} title="Sin simulacros registrados"
          description="Anota puntaje, nivel, preguntas totales, correctas, incorrectas y tiempo de cada simulacro para ver tu evolución." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Simulacros" value={String(list.length)} detail={last ? `Último: ${formatDay(last.taken_on)}` : undefined} />
            <Stat label="Último puntaje" value={last?.score != null ? score(last.score) : "—"}
              detail={last?.score != null ? [last.max_score != null && `de ${score(last.max_score)}`, last.level && `Nivel ${last.level}`].filter(Boolean).join(" · ") || undefined : "Sin puntaje en el último"} />
            <Stat label="Aciertos promedio" value={avgAcc != null ? `${n0(avgAcc)}%` : "—"} detail={plural(acc.length, "simulacro", "simulacros") + " con preguntas y correctas"} />
            <Stat label="Tiempo promedio" value={avgTime != null ? formatDuration(Math.round(avgTime)) : "—"} detail={plural(timed.length, "simulacro con tiempo", "simulacros con tiempo")} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="space-y-2" aria-labelledby="study-score">
              <h3 id="study-score" className="text-sm font-medium">Puntaje</h3>
              <ValueLine points={scores} label="Puntaje" format="score" ariaLabel={`Evolución del puntaje en ${current}`} tableExtra="Detalle" />
            </section>
            <section className="space-y-2" aria-labelledby="study-acc">
              <h3 id="study-acc" className="text-sm font-medium">Porcentaje de aciertos</h3>
              <ValueLine points={acc} label="Aciertos" format="pct" domain={[0, 100]} ariaLabel={`Evolución del porcentaje de aciertos en ${current}`} tableExtra="Correctas" />
            </section>
          </div>
        </>
      )}

      {exams.length > 0 && (
        <section className="space-y-2" aria-labelledby="study-all">
          <h3 id="study-all" className="text-sm font-medium">Todos los simulacros <span className="font-normal text-muted">· {exams.length}</span></h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {exams.map((e) => {
              const parts = examSummary(e);
              return (
                <li key={e.id} className="flex items-start gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm">{e.exam}{e.subject && <span className="text-muted"> · {e.subject}</span>}</p>
                    <p className="text-[11px] tabular-nums text-muted">{formatDay(e.taken_on)}{parts.length > 0 && ` · ${parts.join(" · ")}`}</p>
                    {e.notes && <p className="mt-0.5 whitespace-pre-line break-words text-xs text-muted">{e.notes}</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="size-7" aria-label={`Editar ${e.exam} del ${formatDay(e.taken_on)}`} onClick={() => ed.setEditing(e)}><Pencil /></Button>
                  <ConfirmDialog
                    trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Eliminar ${e.exam} del ${formatDay(e.taken_on)}`}><Trash2 /></Button>}
                    title="¿Eliminar este simulacro?" description="Esta acción no se puede deshacer."
                    onConfirm={async () => {
                      const r = await deleteExam(e.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Simulacro eliminado");
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <EntityDialog<ExamInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()} wide
        title={it ? "Editar simulacro" : "Registrar simulacro"} description="Solo el nombre es obligatorio. Deja vacío lo que el simulacro no mida."
        schema={examSchema}
        defaults={it
          ? { taken_on: it.taken_on, exam: it.exam, subject: it.subject ?? "", score: it.score, max_score: it.max_score, level: it.level ?? "",
              total_questions: it.total_questions, correct: it.correct, incorrect: it.incorrect, duration: durationText(it.duration_seconds), notes: it.notes ?? "" }
          : { taken_on: today, exam: current, subject: "", score: null, max_score: list[0]?.max_score ?? null, level: "",
              total_questions: list[0]?.total_questions ?? null, correct: null, incorrect: null, duration: "", notes: "" }}
        fields={[
          { name: "exam", label: "Simulacro", kind: "text", placeholder: "Ej.: Simulacro Saber Pro", suggestions: names, half: true },
          { name: "taken_on", label: "Fecha", kind: "date", half: true },
          { name: "subject", label: "Área o materia (opcional)", kind: "text", placeholder: "Ej.: Razonamiento cuantitativo", suggestions: subjects, half: true },
          { name: "level", label: "Nivel", kind: "text", placeholder: "Ej.: 3, B2, Avanzado", half: true },
          { name: "score", label: "Puntaje", kind: "number", step: 0.01, half: true },
          { name: "max_score", label: "Puntaje máximo (opcional)", kind: "number", step: 0.01, half: true },
          { name: "total_questions", label: "Preguntas totales", kind: "number", step: 1, half: true },
          { name: "correct", label: "Correctas", kind: "number", step: 1, half: true },
          { name: "incorrect", label: "Incorrectas", kind: "number", step: 1, half: true },
          { name: "duration", label: "Tiempo", kind: "text", placeholder: "90 o 1:30:00", hint: "Minutos (90) o h:min:seg (1:30:00).", half: true },
          { name: "notes", label: "Notas (opcional)", kind: "textarea", placeholder: "Temas a repasar, cómo te sentiste…" },
        ]}
        onSave={(v) => saveExam(v, it?.id)}
      />
    </div>
  );
}
