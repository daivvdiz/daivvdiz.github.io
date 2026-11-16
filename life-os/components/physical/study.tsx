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
  const scores = asc.filter((e) => e.score != null).map((e) => ({ date: e.taken_on, value: e.score!, detail: e.level ? `Level ${e.level}` : e.subject }));
  const acc = asc.map((e) => ({ e, a: examStats(e).accuracy })).filter((x) => x.a != null)
    .map(({ e, a }) => ({ date: e.taken_on, value: Math.round(a! * 10) / 10, detail: `${e.correct} of ${e.total_questions}` }));
  const timed = list.filter((e) => e.duration_seconds != null);
  const avgAcc = acc.length ? acc.reduce((s, x) => s + x.value, 0) / acc.length : null;
  const avgTime = timed.length ? timed.reduce((s, e) => s + e.duration_seconds!, 0) / timed.length : null;
  const last = list[0];

  if (missing)
    return (
      <div className="rounded-md border border-warning/40 p-4 text-sm">
        <p className="font-medium">One step is missing in Supabase</p>
        <p className="mt-1 text-muted">
          To save mock exams, run the migration <code className="text-xs">supabase/migrations/20261116000100_study_exams.sql</code> once in
          Supabase → SQL Editor. It only creates a new table; it doesn't change your data.
        </p>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          {names.length > 1 && (
            <label className="block space-y-1 text-xs text-muted">
              Mock exam
              <Select value={current} onChange={(e) => setSel(e.target.value)} className="h-8 w-64 max-w-full">
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </label>
          )}
          <p className="max-w-prose text-xs text-muted">Log only what the mock exam shows you. Scores are only compared within the same mock exam.</p>
        </div>
        <Button size="sm" onClick={() => ed.setEditing("new")}><Plus /> Log mock exam</Button>
      </div>

      {!exams.length ? (
        <EmptyState icon={GraduationCap} title="No mock exams logged"
          description="Note the score, level, total questions, correct, incorrect and time for each mock exam to see your progress." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Mock exams" value={String(list.length)} detail={last ? `Last: ${formatDay(last.taken_on)}` : undefined} />
            <Stat label="Last score" value={last?.score != null ? score(last.score) : "—"}
              detail={last?.score != null ? [last.max_score != null && `of ${score(last.max_score)}`, last.level && `Level ${last.level}`].filter(Boolean).join(" · ") || undefined : "No score on the last one"} />
            <Stat label="Average accuracy" value={avgAcc != null ? `${n0(avgAcc)}%` : "—"} detail={plural(acc.length, "mock exam", "mock exams") + " with questions and correct answers"} />
            <Stat label="Average time" value={avgTime != null ? formatDuration(Math.round(avgTime)) : "—"} detail={plural(timed.length, "timed mock exam", "timed mock exams")} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="space-y-2" aria-labelledby="study-score">
              <h3 id="study-score" className="text-sm font-medium">Score</h3>
              <ValueLine points={scores} label="Score" format="score" ariaLabel={`Score over time in ${current}`} tableExtra="Details" />
            </section>
            <section className="space-y-2" aria-labelledby="study-acc">
              <h3 id="study-acc" className="text-sm font-medium">Accuracy</h3>
              <ValueLine points={acc} label="Accuracy" format="pct" domain={[0, 100]} ariaLabel={`Accuracy over time in ${current}`} tableExtra="Correct" />
            </section>
          </div>
        </>
      )}

      {exams.length > 0 && (
        <section className="space-y-2" aria-labelledby="study-all">
          <h3 id="study-all" className="text-sm font-medium">All mock exams <span className="font-normal text-muted">· {exams.length}</span></h3>
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
                  <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${e.exam} from ${formatDay(e.taken_on)}`} onClick={() => ed.setEditing(e)}><Pencil /></Button>
                  <ConfirmDialog
                    trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${e.exam} from ${formatDay(e.taken_on)}`}><Trash2 /></Button>}
                    title="Delete this mock exam?" description="This can't be undone."
                    onConfirm={async () => {
                      const r = await deleteExam(e.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Mock exam deleted");
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
        title={it ? "Edit mock exam" : "Log mock exam"} description="Only the name is required. Leave empty what the mock exam doesn't measure."
        schema={examSchema}
        defaults={it
          ? { taken_on: it.taken_on, exam: it.exam, subject: it.subject ?? "", score: it.score, max_score: it.max_score, level: it.level ?? "",
              total_questions: it.total_questions, correct: it.correct, incorrect: it.incorrect, duration: durationText(it.duration_seconds), notes: it.notes ?? "" }
          : { taken_on: today, exam: current, subject: "", score: null, max_score: list[0]?.max_score ?? null, level: "",
              total_questions: list[0]?.total_questions ?? null, correct: null, incorrect: null, duration: "", notes: "" }}
        fields={[
          { name: "exam", label: "Mock exam", kind: "text", placeholder: "E.g. Saber Pro mock exam", suggestions: names, half: true },
          { name: "taken_on", label: "Date", kind: "date", half: true },
          { name: "subject", label: "Area or subject (optional)", kind: "text", placeholder: "E.g. Quantitative reasoning", suggestions: subjects, half: true },
          { name: "level", label: "Level", kind: "text", placeholder: "E.g. 3, B2, Advanced", half: true },
          { name: "score", label: "Score", kind: "number", step: 0.01, half: true },
          { name: "max_score", label: "Max score (optional)", kind: "number", step: 0.01, half: true },
          { name: "total_questions", label: "Total questions", kind: "number", step: 1, half: true },
          { name: "correct", label: "Correct", kind: "number", step: 1, half: true },
          { name: "incorrect", label: "Incorrect", kind: "number", step: 1, half: true },
          { name: "duration", label: "Time", kind: "text", placeholder: "90 or 1:30:00", hint: "Minutes (90) or h:min:sec (1:30:00).", half: true },
          { name: "notes", label: "Notes (optional)", kind: "textarea", placeholder: "Topics to review, how you felt…" },
        ]}
        onSave={(v) => saveExam(v, it?.id)}
      />
    </div>
  );
}
