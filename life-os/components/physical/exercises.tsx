"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityDialog, useEditor } from "@/components/entity-dialog";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MEASURES, exerciseSchema, type ExerciseInput, type Measure } from "@/lib/physical/schema";
import { deleteExercise, saveExercise } from "@/lib/physical/actions";
import type { Exercise } from "@/lib/physical/queries";
import { FORMATS, ValueLine, type FormatKind } from "./charts";

const measureKind: Record<Measure, FormatKind> = { weight: "kg1", reps: "reps", time: "time", distance: "km" };
const measureFormat = Object.fromEntries(Object.entries(measureKind).map(([k, v]) => [k, FORMATS[v]])) as Record<Measure, (v: number) => string>;
const measureLabel: Record<Measure, string> = { weight: "Max weight of the day", reps: "Max reps of the day", time: "Max time of the day", distance: "Max distance of the day" };

export function ExerciseProgress({ exercises }: { exercises: Exercise[] }) {
  const ed = useEditor<Exercise>();
  const it = ed.item;
  const withData = exercises.filter((e) => e.sessions > 0);
  const [selected, setSelected] = useState<string | null>(withData.sort((a, b) => (b.lastOn ?? "").localeCompare(a.lastOn ?? ""))[0]?.id ?? null);
  const sel = exercises.find((e) => e.id === selected) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="space-y-3">
        <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> New exercise</Button>
        {!exercises.length ? (
          <EmptyState icon={TrendingUp} title="No exercises" description="They're created when you log a workout, or here. E.g. pull-ups, push-ups, handstand, squats, dips." />
        ) : (
          <ul className="max-h-[28rem] space-y-1 overflow-auto pr-1">
            {exercises.map((e) => (
              <li key={e.id} className={cn("flex items-center gap-1 rounded-md border px-2.5 py-1.5", selected === e.id ? "border-accent bg-accent-soft" : "border-border")}>
                <button type="button" className="min-w-0 flex-1 text-left" aria-pressed={selected === e.id} onClick={() => setSelected(e.id)}>
                  <p className="truncate text-sm">{e.name}</p>
                  <p className="text-[11px] text-muted">
                    {e.sessions} {e.sessions === 1 ? "session" : "sessions"}
                    {e.best != null && ` · best ${measureFormat[e.measure](e.best)}`}
                    {e.lastOn && ` · ${formatDay(e.lastOn, "MMM d, yy")}`}
                  </p>
                </button>
                <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${e.name}`} onClick={() => ed.setEditing(e)}><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${e.name}`}><Trash2 /></Button>}
                  title={`Delete “${e.name}”?`}
                  description={e.sessions
                    ? `It will also be removed from ${e.sessions} ${e.sessions === 1 ? "workout" : "workouts"} (the workouts are kept). If it came from Segundo Cerebro, it would reappear when you import again.`
                    : "This can't be undone."}
                  onConfirm={async () => {
                    const r = await deleteExercise(e.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Exercise deleted");
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        {sel ? (
          <>
            <div>
              <h3 className="text-sm font-medium">{sel.name}</h3>
              <p className="text-xs text-muted">{measureLabel[sel.measure]}. Measured in {MEASURES[sel.measure].toLowerCase()}; change it with the pencil if that's not right.</p>
            </div>
            <ValueLine points={sel.progress} label={MEASURES[sel.measure]} format={measureKind[sel.measure]}
              ariaLabel={`${sel.name} progression`} tableExtra="Details" />
          </>
        ) : (
          <p className="text-sm text-muted">Choose an exercise to see its progression.</p>
        )}
      </div>
      <EntityDialog<ExerciseInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Edit exercise" : "New exercise"} description="The measure sets which value is used to show your progression."
        schema={exerciseSchema}
        defaults={it ? { name: it.name, measure: it.measure } : { name: "", measure: "reps" }}
        fields={[
          { name: "name", label: "Name", kind: "text", placeholder: "E.g. Pull-ups" },
          { name: "measure", label: "Progress measured by", kind: "select", options: MEASURES },
        ]}
        onSave={(v) => saveExercise(v, it?.id)}
      />
    </div>
  );
}
