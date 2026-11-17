"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CATEGORY_COLORS, EVENT_CATEGORIES } from "@/lib/types";
import { eventSchema, type EventInput } from "@/lib/calendar/schema";
import { deleteEvent, saveEvent, type Scope } from "@/lib/calendar/actions";
import { countBefore, describe, FREQS, presetKey, presets, WEEKDAY_FULL, WEEKDAY_LETTERS, type Recurrence } from "@/lib/calendar/recurrence";
import { isISODate, weekday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CalEvent } from "@/lib/calendar/queries";

export type GoalOption = { id: string; title: string };

type ScopeAction = { kind: "save"; values: EventInput } | { kind: "delete" };

/** "¿Cambiar solo este evento, este y los siguientes, o todos?" — como en Google Calendar. */
function ScopeDialog({ action, onClose, onPick, firstOfSeries }: {
  action: ScopeAction | null; onClose: () => void; onPick: (s: Scope) => Promise<void>; firstOfSeries: boolean;
}) {
  const [scope, setScope] = useState<Scope>("this");
  const [pending, setPending] = useState(false);
  useResetOnOpen(!!action, () => setScope("this"));
  const options: [Scope, string][] = [["this", "This event"], ...(firstOfSeries ? [] : [["following", "This and following events"] as [Scope, string]]), ["all", "All events"]];
  const del = action?.kind === "delete";
  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{del ? "Delete repeating event" : "Edit repeating event"}</DialogTitle>
          <DialogDescription>{del ? "Which events do you want to delete?" : "Which events should get these changes?"}</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="sr-only">Apply to</legend>
          {options.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="radio" name="scope" className="size-4 accent-[var(--accent)]" checked={scope === k} onChange={() => setScope(k)} /> {l}
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button type="button" variant={del ? "destructive" : "default"} disabled={pending} onClick={async () => {
            setPending(true);
            try { await onPick(scope); } finally { setPending(false); }
          }}>{pending ? (del ? "Deleting…" : "Saving…") : del ? "Delete" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const endOf = (e?: CalEvent) =>
  e?.recurrence?.count ? { r_end: "count" as const, r_count: e.recurrence.count, r_until: "" }
    : e?.recurrence_until ? { r_end: "until" as const, r_count: null, r_until: e.recurrence_until }
      : { r_end: "never" as const, r_count: null, r_until: "" };

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  goals,
  recurrenceReady = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event?: CalEvent;
  defaultDate: string;
  goals: GoalOption[];
  recurrenceReady?: boolean;
}) {
  const [scopeAction, setScopeAction] = useState<ScopeAction | null>(null);
  const rule = event?.recurrence ?? null;
  const form = useForm<EventInput>({
    resolver: zodResolver(eventSchema) as unknown as Resolver<EventInput>,
    values: event
      ? {
          title: event.title,
          description: event.description ?? "",
          category: event.category,
          date: event.date,
          all_day: event.all_day,
          start_time: event.all_day ? "" : event.start_time,
          end_time: event.end_time ?? "",
          location: event.location ?? "",
          goal_id: event.goal_id ?? "",
          repeat: presetKey(rule, event.date),
          r_freq: rule?.freq ?? "weekly",
          r_interval: rule?.interval ?? 1,
          r_weekdays: rule?.weekdays ?? [weekday(event.date)],
          r_monthly: rule?.monthly ?? "day",
          ...endOf(event),
        }
      : {
          title: "", description: "", category: "personal", date: defaultDate, all_day: false, start_time: "09:00", end_time: "", location: "", goal_id: "",
          repeat: "none", r_freq: "weekly", r_interval: 1, r_weekdays: [weekday(defaultDate)], r_monthly: "day", r_end: "never", r_until: "", r_count: null,
        },
  });
  useResetOnOpen(open, () => form.reset());
  const { register, handleSubmit, watch, setValue, formState } = form;
  const allDay = watch("all_day");
  const date = watch("date") || defaultDate;
  const repeat = watch("repeat") ?? "none";
  const freq = watch("r_freq");
  const wds = (watch("r_weekdays") ?? []) as number[];
  const rEnd = watch("r_end");
  const opts = isISODate(date) ? presets(date) : presets(defaultDate);
  const errs = formState.errors;

  const finish = (msg: string) => {
    toast.success(msg);
    setScopeAction(null);
    // Cierra primero el diálogo de alcance y después este (evita que la página quede bloqueada).
    setTimeout(() => onOpenChange(false), 0);
  };

  const onSubmit = handleSubmit(async (v) => {
    if (event?.recurrence) return void setScopeAction({ kind: "save", values: v });
    const r = await saveEvent(v, event?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(event ? "Event updated" : "Event created");
    onOpenChange(false);
  });

  const preview = (() => {
    if (repeat === "none" || !isISODate(date)) return null;
    const p = opts.find((o) => o.key === repeat);
    const base: Recurrence | null = repeat === "custom"
      ? { freq: freq ?? "weekly", interval: Number(watch("r_interval")) || 1, weekdays: wds, monthly: watch("r_monthly") ?? "day" }
      : p?.rule ?? null;
    if (!base) return null;
    const count = rEnd === "count" ? Number(watch("r_count")) || null : null;
    const until = rEnd === "until" ? watch("r_until") || null : null;
    return describe({ ...base, count }, date, until);
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            {event?.recurrence ? `Repeats: ${describe(event.recurrence, event.series_start, event.recurrence_until)}.` : "Times use your time zone from Settings."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title</Label>
            <Input id="ev-title" {...register("title")} aria-invalid={!!errs.title} autoFocus />
            <FieldError message={errs.title?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date</Label>
              <Input id="ev-date" type="date" {...register("date")} />
              <FieldError message={errs.date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-cat">Category</Label>
              <Select id="ev-cat" {...register("category")}>
                {Object.entries(EVENT_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" {...register("all_day")} /> All day
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">Start</Label>
                <Input id="ev-start" type="time" {...register("start_time")} />
                <FieldError message={errs.start_time?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">End (optional)</Label>
                <Input id="ev-end" type="time" {...register("end_time")} />
                <FieldError message={errs.end_time?.message} />
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-repeat">Repeat</Label>
              <Select id="ev-repeat" disabled={!recurrenceReady} {...register("repeat")}>
                {opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </Select>
              {!recurrenceReady && <p className="text-[11px] text-muted">To use repeating events, run the migration <code>20261117000100_recurring_events.sql</code> once in Supabase → SQL Editor.</p>}
            </div>
            {repeat === "custom" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Every</span>
                  <Input aria-label="Repeat every" type="number" min={1} max={99} className="h-9 w-20" aria-invalid={!!errs.r_interval} {...register("r_interval")} />
                  <Select aria-label="Repeat unit" className="h-9 w-32" {...register("r_freq")}>
                    {Object.entries(FREQS).map(([k, u]) => <option key={k} value={k}>{u}{Number(watch("r_interval")) === 1 ? "" : "s"}</option>)}
                  </Select>
                </div>
                <FieldError message={errs.r_interval?.message} />
                {freq === "weekly" && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Repeat on">
                    {WEEKDAY_LETTERS.map((l, i) => {
                      const on = wds.includes(i);
                      return (
                        <button key={i} type="button" aria-pressed={on} aria-label={WEEKDAY_FULL[i]} title={WEEKDAY_FULL[i]}
                          onClick={() => setValue("r_weekdays", on ? wds.filter((x) => x !== i) : [...wds, i].sort(), { shouldDirty: true })}
                          className={cn("size-8 rounded-full border text-xs", on ? "border-accent bg-accent text-white" : "border-border text-muted hover:text-foreground")}>
                          {l}
                        </button>
                      );
                    })}
                  </div>
                )}
                {freq === "monthly" && isISODate(date) && (
                  <Select aria-label="Monthly on" {...register("r_monthly")}>
                    {opts.filter((o) => o.key.startsWith("monthly_")).map((o) => (
                      <option key={o.key} value={o.key.replace("monthly_", "")}>{o.label.replace("Monthly ", "")}</option>
                    ))}
                  </Select>
                )}
              </div>
            )}
            {repeat !== "none" && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Ends</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="never" className="size-4 accent-[var(--accent)]" {...register("r_end")} /> Never
                </label>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" value="until" className="size-4 accent-[var(--accent)]" {...register("r_end")} /> On
                  </label>
                  <Input aria-label="End date" type="date" min={isISODate(date) ? date : undefined} className="h-9 w-40" disabled={rEnd !== "until"} aria-invalid={!!errs.r_until} {...register("r_until")} />
                </div>
                <FieldError message={errs.r_until?.message} />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" value="count" className="size-4 accent-[var(--accent)]" {...register("r_end")} /> After
                  </label>
                  <Input aria-label="Number of times" type="number" min={1} max={999} className="h-9 w-20" disabled={rEnd !== "count"} aria-invalid={!!errs.r_count} {...register("r_count")} />
                  <span className="text-muted">times</span>
                </div>
                <FieldError message={errs.r_count?.message} />
              </fieldset>
            )}
            {preview && <p className="text-[11px] text-muted">{preview}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Location (optional)</Label>
            <Input id="ev-loc" {...register("location")} />
          </div>
          {goals.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="ev-goal">Related goal (optional)</Label>
              <Select id="ev-goal" {...register("goal_id")}>
                <option value="">None</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Notes (optional)</Label>
            <Textarea id="ev-desc" {...register("description")} />
          </div>
          <DialogFooter className="sm:justify-between">
            {event?.recurrence ? (
              <Button type="button" variant="ghost" onClick={() => setScopeAction({ kind: "delete" })}><Trash2 /> Delete</Button>
            ) : event ? (
              <ConfirmDialog
                trigger={<Button type="button" variant="ghost"><Trash2 /> Delete</Button>}
                title="Delete this event?"
                description={`"${event.title}" will be removed from the calendar. This can't be undone.`}
                onConfirm={async () => {
                  const r = await deleteEvent(event.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Event deleted");
                  // Cierra primero la confirmación y después este diálogo (evita que la página quede bloqueada).
                  setTimeout(() => onOpenChange(false), 0);
                }}
              />
            ) : <span />}
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
        {event?.recurrence && (
          <ScopeDialog
            action={scopeAction}
            firstOfSeries={countBefore(event.series_start, event.recurrence, event.date) === 0}
            onClose={() => setScopeAction(null)}
            onPick={async (scope) => {
              if (!scopeAction) return;
              if (scopeAction.kind === "delete") {
                const r = await deleteEvent(event.id, scope, event.date);
                if (!r.ok) return void toast.error(r.error);
                return finish(scope === "this" ? "Event deleted" : "Events deleted");
              }
              const r = await saveEvent(scopeAction.values, event.id, scope, event.date);
              if (!r.ok) return void toast.error(r.error);
              finish(scope === "this" ? "Event updated" : "Events updated");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botón de un evento que abre su edición. */
export function EventChip({ event, goals, compact = false, wrap = false, recurrenceReady = true }: { event: CalEvent; goals: GoalOption[]; compact?: boolean; wrap?: boolean; recurrenceReady?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`flex w-full min-w-0 gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-surface ${wrap ? "items-start" : "items-center"}`}
        title={event.title}
      >
        <span className={`size-1.5 shrink-0 rounded-full ${wrap ? "mt-1.5" : ""}`} style={{ background: CATEGORY_COLORS[event.category] }} aria-hidden />
        {!compact && !event.all_day && <span className="shrink-0 tabular-nums text-muted">{event.start_time}</span>}
        <span className={wrap ? "break-words" : "truncate"}>{event.title}</span>
        {event.recurrence && <Repeat className={`size-3 shrink-0 text-muted ${wrap ? "mt-0.5" : ""}`} aria-label="Repeats" />}
      </button>
      <EventDialog open={open} onOpenChange={setOpen} event={event} defaultDate={event.date} goals={goals} recurrenceReady={recurrenceReady} />
    </>
  );
}

export function NewEventButton({ date, goals, label = "New event", variant = "default", recurrenceReady = true }: { date: string; goals: GoalOption[]; label?: string; variant?: "default" | "secondary"; recurrenceReady?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>{label}</Button>
      <EventDialog open={open} onOpenChange={setOpen} defaultDate={date} goals={goals} recurrenceReady={recurrenceReady} />
    </>
  );
}
