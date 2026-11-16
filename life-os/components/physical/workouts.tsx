"use client";

import { useState } from "react";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck, Dumbbell, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEditor } from "@/components/entity-dialog";
import { formatDay, formatDuration, formatNumber } from "@/lib/format";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES, durationText, workoutSchema, type WorkoutInput } from "@/lib/physical/schema";
import { deleteWorkout, saveWorkout } from "@/lib/physical/actions";
import type { Exercise, Workout, WorkoutItem } from "@/lib/physical/queries";

/** "3 × 8 · 60 kg", "1:30", "5 km"… solo con los datos que existen. */
export function itemSummary(i: WorkoutItem) {
  const parts = [
    i.sets != null && i.reps != null ? `${i.sets} × ${i.reps}` : i.sets != null ? `${i.sets} sets` : i.reps != null ? `${i.reps} reps` : null,
    i.weight_kg != null ? `${formatNumber(i.weight_kg, 1)} kg` : null,
    i.duration_seconds != null ? formatDuration(i.duration_seconds) : null,
    i.distance_km != null ? `${formatNumber(i.distance_km, 2)} km` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

const emptyItem = (): WorkoutInput["items"][number] => ({ id: "", exercise_id: "", new_exercise: "", sets: null, reps: null, weight_kg: null, time: "", distance_km: null, notes: "" });

function WorkoutDialog({ open, onOpenChange, workout, exercises, today }: {
  open: boolean; onOpenChange: (o: boolean) => void; workout: Workout | undefined; exercises: Exercise[]; today: string;
}) {
  const defaults: WorkoutInput = workout
    ? {
        performed_on: workout.performed_on, activity_type: workout.activity_type, duration: durationText(workout.duration_seconds), notes: workout.notes ?? "", add_to_calendar: false,
        items: workout.items.map((i) => ({
          id: i.id, exercise_id: i.exercise_id, new_exercise: "", sets: i.sets, reps: i.reps, weight_kg: i.weight_kg,
          time: durationText(i.duration_seconds), distance_km: i.distance_km, notes: i.notes ?? "",
        })),
      }
    : { performed_on: today, activity_type: "strength", duration: "", notes: "", add_to_calendar: false, items: [] };
  const { register, handleSubmit, control, formState, reset, watch } = useForm<WorkoutInput>({
    resolver: zodResolver(workoutSchema) as unknown as Resolver<WorkoutInput>,
    values: defaults,
  });
  useResetOnOpen(open, () => reset(defaults));
  const items = useFieldArray({ control, name: "items" });
  const e = formState.errors;
  const numOpts = { setValueAs: (v: string) => (v === "" ? null : Number(String(v).replace(",", "."))) };

  const onSubmit = handleSubmit(async (v) => {
    const r = await saveWorkout(v, workout?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(workout ? "Workout updated" : "Workout logged");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{workout ? "Edit workout" : "New workout"}</DialogTitle>
          <DialogDescription>Log what you did; every detail is optional.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="w-date">Date</Label>
              <Input id="w-date" type="date" aria-invalid={!!e.performed_on} {...register("performed_on")} />
              <FieldError message={e.performed_on?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-type">Actividad</Label>
              <Select id="w-type" {...register("activity_type")}>
                {Object.entries(ACTIVITY_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-duration">Duration in minutes (optional)</Label>
              <Input id="w-duration" placeholder="E.g. 45 or 1:15:00" aria-invalid={!!e.duration} {...register("duration")} />
              <FieldError message={e.duration?.message} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Exercises ({items.fields.length})</legend>
            {items.fields.length === 0 && <p className="text-xs text-muted">Optional. For a match or a mobility session, the duration and notes are enough.</p>}
            <ul className="space-y-2">
              {items.fields.map((f, idx) => {
                const ie = e.items?.[idx];
                const isNew = !watch(`items.${idx}.exercise_id`);
                return (
                  <li key={f.id} className="space-y-2 rounded-md border border-border p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                        <Select aria-label={`Exercise ${idx + 1}`} {...register(`items.${idx}.exercise_id`)}>
                          <option value="">New exercise…</option>
                          {exercises.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </Select>
                        {isNew && (
                          <div>
                            <Input aria-label={`New exercise name ${idx + 1}`} placeholder="Name, e.g. Pull-ups" maxLength={80} aria-invalid={!!ie?.new_exercise} {...register(`items.${idx}.new_exercise`)} />
                            <FieldError message={ie?.new_exercise?.message} />
                          </div>
                        )}
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" aria-label={`Remove exercise ${idx + 1}`} onClick={() => items.remove(idx)}><X /></Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {([
                        ["sets", "Sets", "1"], ["reps", "Reps", "1"], ["weight_kg", "Kg", "0.5"], ["time", "Time", ""], ["distance_km", "Km", "0.01"],
                      ] as const).map(([k, l, step]) => (
                        <div key={k} className="space-y-1">
                          <Label htmlFor={`w-${idx}-${k}`} className="text-[11px] text-muted">{l}</Label>
                          {k === "time" ? (
                            <Input id={`w-${idx}-${k}`} placeholder="min:sec" aria-invalid={!!ie?.time} {...register(`items.${idx}.time`)} />
                          ) : (
                            <Input id={`w-${idx}-${k}`} type="number" inputMode="decimal" step={step} min={0} aria-invalid={!!ie?.[k]} {...register(`items.${idx}.${k}`, numOpts)} />
                          )}
                        </div>
                      ))}
                    </div>
                    {ie && (["sets", "reps", "weight_kg", "time", "distance_km"] as const).map((k) => ie[k]?.message && <FieldError key={k} message={ie[k]?.message} />)}
                    <Input aria-label={`Exercise notes ${idx + 1}`} placeholder="Notes (optional), e.g. with band, overhand grip" maxLength={500} {...register(`items.${idx}.notes`)} />
                  </li>
                );
              })}
            </ul>
            <Button type="button" size="sm" variant="secondary" onClick={() => items.append(emptyItem())}><Plus /> Add exercise</Button>
            <FieldError message={e.items?.message ?? e.items?.root?.message} />
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="w-notes">Notes (optional)</Label>
            <Textarea id="w-notes" rows={2} placeholder="How you felt, who you played with…" {...register("notes")} />
            <FieldError message={e.notes?.message} />
          </div>
          {!workout && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" {...register("add_to_calendar")} />
              Also add to the calendar
            </label>
          )}
          <DialogFooter className="sm:justify-between">
            {workout ? (
              <ConfirmDialog
                trigger={<Button type="button" variant="ghost"><Trash2 /> Delete</Button>}
                title="Delete this workout?"
                description={workout.imported
                  ? "It will be deleted with its exercises. It comes from Segundo Cerebro: the original isn't changed and would reappear if you import again."
                  : "It will be deleted with its exercises. This can't be undone."}
                onConfirm={async () => {
                  const r = await deleteWorkout(workout.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Workout deleted");
                  setTimeout(() => onOpenChange(false), 0);
                }}
              />
            ) : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving…" : "Save"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewWorkoutButton({ exercises, today, size = "sm" }: { exercises: Exercise[]; today: string; size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}><Plus /> Log workout</Button>
      <WorkoutDialog open={open} onOpenChange={setOpen} workout={undefined} exercises={exercises} today={today} />
    </>
  );
}

export function WorkoutList({ workouts, exercises, today, limit }: { workouts: Workout[]; exercises: Exercise[]; today: string; limit?: number }) {
  const ed = useEditor<Workout>();
  const [type, setType] = useState("");
  const [shownN, setShownN] = useState(limit ?? 30);
  const it = ed.item ? workouts.find((w) => w.id === ed.item!.id) ?? ed.item : undefined;
  const exName = new Map(exercises.map((x) => [x.id, x.name]));
  const filtered = workouts.filter((w) => !type || w.activity_type === type);
  const shown = filtered.slice(0, shownN);

  return (
    <div className="space-y-3">
      {!limit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select aria-label="Filter by activity" className="h-8 w-52" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All activities</option>
            {Object.entries(ACTIVITY_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <NewWorkoutButton exercises={exercises} today={today} />
        </div>
      )}
      {!workouts.length ? (
        <EmptyState icon={Dumbbell} title="No workouts" description="Log calisthenics, strength, beach volleyball, running, mobility or other sports. What you imported from Segundo Cerebro shows up here." />
      ) : !filtered.length ? (
        <p className="py-4 text-center text-sm text-muted">No workouts of this type.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {shown.map((w) => (
              <li key={w.id}>
                <button type="button" onClick={() => ed.setEditing(w)} className="w-full rounded-md border border-border p-3 text-left hover:bg-surface/60">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-medium">{ACTIVITY_TYPES[w.activity_type] ?? w.activity_type}</p>
                    <p className="text-xs text-muted">{formatDay(w.performed_on, "EEE, MMM d, yyyy")}</p>
                  </div>
                  <p className="text-[11px] text-muted">
                    {[w.duration_seconds != null && formatDuration(w.duration_seconds), w.items.length > 0 && `${w.items.length} ${w.items.length === 1 ? "exercise" : "exercises"}`, w.imported && "Imported"]
                      .filter(Boolean).join(" · ") || "No details"}
                    {w.inCalendar && <span className="ml-1 inline-flex items-center gap-0.5 align-middle"> · <CalendarCheck className="size-3" aria-hidden /> In the calendar</span>}
                  </p>
                  {w.items.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {w.items.slice(0, 6).map((i) => (
                        <li key={i.id} className="flex min-w-0 gap-2 text-xs">
                          <span className="min-w-0 truncate">{exName.get(i.exercise_id) ?? "Exercise"}</span>
                          <span className="shrink-0 tabular-nums text-muted">{itemSummary(i)}</span>
                        </li>
                      ))}
                      {w.items.length > 6 && <li className="text-xs text-muted">and {w.items.length - 6} more</li>}
                    </ul>
                  )}
                  {w.notes && <p className={cn("mt-1.5 line-clamp-2 break-words text-xs text-muted")}>{w.notes}</p>}
                </button>
              </li>
            ))}
          </ul>
          {!limit && filtered.length > shownN && (
            <div className="flex justify-center">
              <Button size="sm" variant="ghost" onClick={() => setShownN(shownN + 30)}>Show more ({filtered.length - shownN} left)</Button>
            </div>
          )}
        </>
      )}
      <WorkoutDialog open={ed.open} onOpenChange={(o) => !o && ed.close()} workout={it} exercises={exercises} today={today} />
    </div>
  );
}
