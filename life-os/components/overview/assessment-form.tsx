"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { DIMENSIONS, type LifeAssessment } from "@/lib/types";
import { assessmentSchema, type AssessmentInput } from "@/lib/assessments/schema";
import { saveAssessment } from "@/lib/assessments/actions";

export function AssessmentForm({
  initial,
  today,
  onDone,
}: {
  initial?: LifeAssessment;
  today: string;
  onDone: () => void;
}) {
  const form = useForm<AssessmentInput>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: initial
      ? { ...initial, notes: initial.notes ?? "" }
      : { assessed_on: today, professional: 5, financial: 5, physical: 5, emotional: 5, social: 5, intellectual: 5, notes: "" },
  });
  const { register, handleSubmit, watch, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    const res = await saveAssessment(values, initial?.id);
    if (!res.ok) return toast.error(res.error);
    toast.success(initial ? "Autoevaluación actualizada" : "Autoevaluación guardada");
    onDone();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="assessed_on">Fecha</Label>
        <Input id="assessed_on" type="date" {...register("assessed_on")} aria-invalid={!!formState.errors.assessed_on} />
        <FieldError message={formState.errors.assessed_on?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {DIMENSIONS.map((d) => (
          <div key={d.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={d.key}>{d.label}</Label>
              <span className="text-xs tabular-nums text-foreground">{watch(d.key)}/10</span>
            </div>
            <input
              id={d.key}
              type="range"
              min={1}
              max={10}
              step={1}
              className="w-full accent-[var(--accent)]"
              {...register(d.key, { valueAsNumber: true })}
            />
            <FieldError message={formState.errors[d.key]?.message} />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" placeholder="¿Qué hay detrás de estos valores hoy?" {...register("notes")} />
        <FieldError message={formState.errors.notes?.message} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
