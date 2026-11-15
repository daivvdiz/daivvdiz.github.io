"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import {
  FREQUENCIES, GOAL_CATEGORIES, GOAL_STATUS, PRIORITIES, TRACKING, WEEKDAY_LABELS,
  goalSchema, habitSchema, type GoalInput, type HabitInput,
} from "@/lib/goals/schema";
import { saveGoal, saveHabit } from "@/lib/goals/actions";
import type { Habit } from "@/lib/goals/habits";
import type { Goal } from "@/lib/goals/queries";

export type Option = { id: string; label: string };

/** Lista de opciones que se activan o desactivan (vínculos entre metas y hábitos). */
function TogglePicker({ options, value, onChange, label }: { options: Option[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
            className={cn(
              "max-w-full truncate rounded-full border px-2.5 py-1 text-xs transition-colors",
              on ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Metas

function GoalDialog({
  open, onOpenChange, goal, habits, today,
}: { open: boolean; onOpenChange: (o: boolean) => void; goal?: Goal; habits: Option[]; today: string }) {
  const { register, handleSubmit, control, formState, setValue, watch, reset } = useForm<GoalInput>({
    resolver: zodResolver(goalSchema),
    values: goal
      ? {
          title: goal.title, description: goal.description ?? "", category: goal.category, motivation: goal.motivation ?? "",
          start_date: goal.start_date ?? "", target_date: goal.target_date ?? "", status: goal.status, priority: goal.priority,
          progress: goal.progress, habit_ids: goal.habit_ids,
        }
      : {
          title: "", description: "", category: "personal", motivation: "", start_date: today, target_date: "",
          status: "active", priority: "medium", progress: 0, habit_ids: [],
        },
  });
  useResetOnOpen(open, () => reset());
  const progress = watch("progress");
  const ms = goal?.milestones ?? [];
  const msDone = ms.filter((m) => m.completed_at).length;

  const onSubmit = handleSubmit(async (v) => {
    const r = await saveGoal(v, goal?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(goal ? "Meta actualizada" : "Meta creada");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nueva meta"}</DialogTitle>
          <DialogDescription>Solo el título es obligatorio.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="g-title">Título</Label>
            <Input id="g-title" maxLength={200} aria-invalid={!!formState.errors.title} {...register("title")} />
            <FieldError message={formState.errors.title?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-cat">Área</Label>
              <Select id="g-cat" {...register("category")}>
                {Object.entries(GOAL_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-status">Estado</Label>
              <Select id="g-status" {...register("status")}>
                {Object.entries(GOAL_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-prio">Prioridad</Label>
              <Select id="g-prio" {...register("priority")}>
                {Object.entries(PRIORITIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-start">Inicio (opcional)</Label>
              <Input id="g-start" type="date" {...register("start_date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-target">Fecha objetivo (opcional)</Label>
              <Input id="g-target" type="date" aria-invalid={!!formState.errors.target_date} {...register("target_date")} />
              <FieldError message={formState.errors.target_date?.message} />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="g-progress">Avance</Label>
              <span className="text-xs tabular-nums">{Number.isFinite(progress) ? progress : 0}%</span>
            </div>
            <input id="g-progress" type="range" min={0} max={100} step={5} className="w-full accent-[var(--accent)]"
              {...register("progress", { valueAsNumber: true })} />
            {ms.length > 0 && (
              <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                {msDone} de {ms.length} hitos completados.
                <button type="button" className="text-accent hover:underline"
                  onClick={() => setValue("progress", Math.round((msDone / ms.length) * 100), { shouldDirty: true })}>
                  Usar ese avance ({Math.round((msDone / ms.length) * 100)}%)
                </button>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Descripción (opcional)</Label>
            <Textarea id="g-desc" rows={3} {...register("description")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-mot">¿Por qué es importante para ti? (opcional)</Label>
            <Textarea id="g-mot" rows={2} {...register("motivation")} />
          </div>
          {habits.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted">Hábitos que la apoyan</span>
              <Controller control={control} name="habit_ids"
                render={({ field }) => <TogglePicker label="Hábitos que la apoyan" options={habits} value={field.value} onChange={field.onChange} />} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GoalButton({
  goal, habits, today, label, variant = "default", size = "default",
}: { goal?: Goal; habits: Option[]; today: string; label?: string; variant?: "default" | "secondary" | "ghost"; size?: "default" | "sm" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {goal ? <Pencil /> : <Plus />} {label ?? (goal ? "Editar" : "Nueva meta")}
      </Button>
      <GoalDialog open={open} onOpenChange={setOpen} goal={goal} habits={habits} today={today} />
    </>
  );
}

// ---------------------------------------------------------------- Hábitos

export function HabitDialog({
  open, onOpenChange, habit, goals, today,
}: { open: boolean; onOpenChange: (o: boolean) => void; habit?: Habit; goals: Option[]; today: string }) {
  const { register, handleSubmit, control, formState, watch, reset } = useForm<HabitInput>({
    resolver: zodResolver(habitSchema),
    values: habit
      ? {
          name: habit.name, description: habit.description ?? "", category: (habit.category ?? "") as HabitInput["category"],
          frequency: habit.frequency, times_per_period: habit.times_per_period, weekdays: habit.weekdays ?? [],
          tracking_method: habit.tracking_method, start_date: habit.start_date, is_active: habit.is_active, goal_ids: habit.goal_ids,
        }
      : {
          name: "", description: "", category: "", frequency: "daily", times_per_period: 3, weekdays: [1, 3, 5],
          tracking_method: "check", start_date: today, is_active: true, goal_ids: [],
        },
  });
  useResetOnOpen(open, () => reset());
  const frequency = watch("frequency");

  const onSubmit = handleSubmit(async (v) => {
    const r = await saveHabit(v, habit?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(habit ? "Hábito actualizado" : "Hábito creado");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{habit ? "Editar hábito" : "Nuevo hábito"}</DialogTitle>
          <DialogDescription>Sin rachas: se cuenta cuántas veces lo hiciste frente a lo que planeaste.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="h-name">Nombre</Label>
            <Input id="h-name" maxLength={120} placeholder="Ej. Leer, Estirar, Tomar agua" aria-invalid={!!formState.errors.name} {...register("name")} />
            <FieldError message={formState.errors.name?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="h-freq">Frecuencia</Label>
              <Select id="h-freq" {...register("frequency")}>
                {Object.entries(FREQUENCIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-track">Cómo lo registras</Label>
              <Select id="h-track" {...register("tracking_method")}>
                {Object.entries(TRACKING).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
          </div>
          {frequency === "weekly" && (
            <div className="space-y-1.5">
              <Label htmlFor="h-times">Veces por semana</Label>
              <Input id="h-times" type="number" min={1} max={7} className="w-28" {...register("times_per_period", { valueAsNumber: true })} />
              <FieldError message={formState.errors.times_per_period?.message} />
            </div>
          )}
          {frequency === "custom" && (
            <Controller control={control} name="weekdays"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted">Días</span>
                  <TogglePicker label="Días de la semana" options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ id: String(d), label: WEEKDAY_LABELS[d] }))}
                    value={field.value.map(String)} onChange={(v) => field.onChange(v.map(Number))} />
                  <FieldError message={formState.errors.weekdays?.message} />
                </div>
              )} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="h-start">Desde</Label>
              <Input id="h-start" type="date" {...register("start_date")} />
              <FieldError message={formState.errors.start_date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-cat">Área (opcional)</Label>
              <Select id="h-cat" {...register("category")}>
                <option value="">Ninguna</option>
                {Object.entries(GOAL_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-desc">Descripción (opcional)</Label>
            <Textarea id="h-desc" rows={2} {...register("description")} />
          </div>
          {goals.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted">Metas que apoya</span>
              <Controller control={control} name="goal_ids"
                render={({ field }) => <TogglePicker label="Metas que apoya" options={goals} value={field.value} onChange={field.onChange} />} />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" {...register("is_active")} />
            Activo (desmárcalo para pausarlo sin perder su historial)
          </label>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewHabitButton({ goals, today, variant = "secondary" }: { goals: Option[]; today: string; variant?: "default" | "secondary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}><Plus /> Nuevo hábito</Button>
      <HabitDialog open={open} onOpenChange={setOpen} goals={goals} today={today} />
    </>
  );
}
