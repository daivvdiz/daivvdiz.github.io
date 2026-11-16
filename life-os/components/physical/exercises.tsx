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
const measureLabel: Record<Measure, string> = { weight: "Peso máximo del día", reps: "Repeticiones máximas del día", time: "Tiempo máximo del día", distance: "Distancia máxima del día" };

export function ExerciseProgress({ exercises }: { exercises: Exercise[] }) {
  const ed = useEditor<Exercise>();
  const it = ed.item;
  const withData = exercises.filter((e) => e.sessions > 0);
  const [selected, setSelected] = useState<string | null>(withData.sort((a, b) => (b.lastOn ?? "").localeCompare(a.lastOn ?? ""))[0]?.id ?? null);
  const sel = exercises.find((e) => e.id === selected) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="space-y-3">
        <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> Nuevo ejercicio</Button>
        {!exercises.length ? (
          <EmptyState icon={TrendingUp} title="Sin ejercicios" description="Se crean al registrar un entrenamiento o aquí. Ej. dominadas, flexiones, parada de manos, sentadillas, fondos." />
        ) : (
          <ul className="max-h-[28rem] space-y-1 overflow-auto pr-1">
            {exercises.map((e) => (
              <li key={e.id} className={cn("flex items-center gap-1 rounded-md border px-2.5 py-1.5", selected === e.id ? "border-accent bg-accent-soft" : "border-border")}>
                <button type="button" className="min-w-0 flex-1 text-left" aria-pressed={selected === e.id} onClick={() => setSelected(e.id)}>
                  <p className="truncate text-sm">{e.name}</p>
                  <p className="text-[11px] text-muted">
                    {e.sessions} {e.sessions === 1 ? "sesión" : "sesiones"}
                    {e.best != null && ` · mejor ${measureFormat[e.measure](e.best)}`}
                    {e.lastOn && ` · ${formatDay(e.lastOn, "d MMM yy")}`}
                  </p>
                </button>
                <Button size="icon" variant="ghost" className="size-7" aria-label={`Editar ${e.name}`} onClick={() => ed.setEditing(e)}><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Eliminar ${e.name}`}><Trash2 /></Button>}
                  title={`¿Eliminar “${e.name}”?`}
                  description={e.sessions
                    ? `También se quitará de ${e.sessions} ${e.sessions === 1 ? "entrenamiento" : "entrenamientos"} (los entrenamientos se conservan). Si venía de Segundo Cerebro, reaparecería al volver a importar.`
                    : "Esta acción no se puede deshacer."}
                  onConfirm={async () => {
                    const r = await deleteExercise(e.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Ejercicio eliminado");
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
              <p className="text-xs text-muted">{measureLabel[sel.measure]}. Se mide en {MEASURES[sel.measure].toLowerCase()}; cámbialo con el lápiz si no corresponde.</p>
            </div>
            <ValueLine points={sel.progress} label={MEASURES[sel.measure]} format={measureKind[sel.measure]}
              ariaLabel={`Progresión de ${sel.name}`} tableExtra="Detalle" />
          </>
        ) : (
          <p className="text-sm text-muted">Elige un ejercicio para ver su progresión.</p>
        )}
      </div>
      <EntityDialog<ExerciseInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Editar ejercicio" : "Nuevo ejercicio"} description="La medida define qué valor se usa para ver tu progresión."
        schema={exerciseSchema}
        defaults={it ? { name: it.name, measure: it.measure } : { name: "", measure: "reps" }}
        fields={[
          { name: "name", label: "Nombre", kind: "text", placeholder: "Ej. Dominadas" },
          { name: "measure", label: "Progreso medido por", kind: "select", options: MEASURES },
        ]}
        onSave={(v) => saveExercise(v, it?.id)}
      />
    </div>
  );
}
