"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CATEGORY_COLORS, EVENT_CATEGORIES } from "@/lib/types";
import { eventSchema, type EventInput } from "@/lib/calendar/schema";
import { deleteEvent, saveEvent } from "@/lib/calendar/actions";
import type { CalEvent } from "@/lib/calendar/queries";

export type GoalOption = { id: string; title: string };

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  goals,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event?: CalEvent;
  defaultDate: string;
  goals: GoalOption[];
}) {
  const form = useForm<EventInput>({
    resolver: zodResolver(eventSchema),
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
        }
      : { title: "", description: "", category: "personal", date: defaultDate, all_day: false, start_time: "09:00", end_time: "", location: "", goal_id: "" },
  });
  const { register, handleSubmit, watch, formState } = form;
  const allDay = watch("all_day");

  const onSubmit = handleSubmit(async (v) => {
    const r = await saveEvent(v, event?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(event ? "Evento actualizado" : "Evento creado");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Editar evento" : "Nuevo evento"}</DialogTitle>
          <DialogDescription>Las horas usan tu zona horaria de Ajustes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Título</Label>
            <Input id="ev-title" {...register("title")} aria-invalid={!!formState.errors.title} autoFocus />
            <FieldError message={formState.errors.title?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Fecha</Label>
              <Input id="ev-date" type="date" {...register("date")} />
              <FieldError message={formState.errors.date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-cat">Categoría</Label>
              <Select id="ev-cat" {...register("category")}>
                {Object.entries(EVENT_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" {...register("all_day")} /> Todo el día
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">Inicio</Label>
                <Input id="ev-start" type="time" {...register("start_time")} />
                <FieldError message={formState.errors.start_time?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">Fin (opcional)</Label>
                <Input id="ev-end" type="time" {...register("end_time")} />
                <FieldError message={formState.errors.end_time?.message} />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Lugar (opcional)</Label>
            <Input id="ev-loc" {...register("location")} />
          </div>
          {goals.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="ev-goal">Meta relacionada (opcional)</Label>
              <Select id="ev-goal" {...register("goal_id")}>
                <option value="">Ninguna</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Notas (opcional)</Label>
            <Textarea id="ev-desc" {...register("description")} />
          </div>
          <DialogFooter className="sm:justify-between">
            {event ? (
              <ConfirmDialog
                trigger={<Button type="button" variant="ghost"><Trash2 /> Eliminar</Button>}
                title="¿Eliminar este evento?"
                description={`"${event.title}" se eliminará del calendario. Esta acción no se puede deshacer.`}
                onConfirm={async () => {
                  const r = await deleteEvent(event.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Evento eliminado");
                  // Cierra primero la confirmación y después este diálogo (evita que la página quede bloqueada).
                  setTimeout(() => onOpenChange(false), 0);
                }}
              />
            ) : <span />}
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/** Botón de un evento que abre su edición. */
export function EventChip({ event, goals, compact = false, wrap = false }: { event: CalEvent; goals: GoalOption[]; compact?: boolean; wrap?: boolean }) {
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
      </button>
      <EventDialog open={open} onOpenChange={setOpen} event={event} defaultDate={event.date} goals={goals} />
    </>
  );
}

export function NewEventButton({ date, goals, label = "Nuevo evento", variant = "default" }: { date: string; goals: GoalOption[]; label?: string; variant?: "default" | "secondary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>{label}</Button>
      <EventDialog open={open} onOpenChange={setOpen} defaultDate={date} goals={goals} />
    </>
  );
}
