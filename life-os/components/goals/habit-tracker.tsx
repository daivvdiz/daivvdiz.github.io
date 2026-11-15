"use client";

import { useState } from "react";
import { Check, ListChecks, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { addDays } from "@/lib/dates";
import { formatDay, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteHabit, logHabit, unlogHabit } from "@/lib/goals/actions";
import { describeFrequency, habitStats, isDone, isScheduled, type Habit, type HabitLog } from "@/lib/goals/habits";
import { HabitDialog, type Option } from "./forms";

function DayHeader({ days, today }: { days: string[]; today: string }) {
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted sm:w-[17.5rem] sm:shrink-0">
      {days.map((d) => (
        <span key={d} className={cn(d === today && "font-medium text-foreground")}>
          <span className="capitalize">{formatDay(d, "EEEEE")}</span> <span className="tabular-nums">{formatDay(d, "d")}</span>
        </span>
      ))}
    </div>
  );
}

const UNIT: Record<Habit["tracking_method"], string> = { check: "", count: "", duration: " min" };

function ValueDialog({
  target, onClose,
}: { target: { habit: Habit; date: string; log?: HabitLog } | null; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<typeof target>(null);
  if (target !== last) {
    setLast(target);
    setValue(target?.log?.value != null ? String(target.log.value) : "");
    setNotes(target?.log?.notes ?? "");
  }
  if (!target) return null;
  const { habit, date, log } = target;
  const isCheck = habit.tracking_method === "check";

  const save = async () => {
    const n = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (!isCheck && (n == null || !Number.isFinite(n) || n < 0)) return void toast.error("Escribe un número válido");
    setPending(true);
    const r = await logHabit({ habit_id: habit.id, logged_on: date, value: isCheck ? null : n, notes });
    setPending(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Registrado");
    onClose();
  };
  const remove = async () => {
    setPending(true);
    const r = await unlogHabit(habit.id, date);
    setPending(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Registro quitado");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{habit.name}</DialogTitle>
          <DialogDescription>{formatDay(date, "EEEE d 'de' MMMM")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!isCheck && (
            <div className="space-y-1.5">
              <Label htmlFor="hv-value">{habit.tracking_method === "duration" ? "Minutos" : "Cantidad"}</Label>
              <Input id="hv-value" inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="hv-notes">Nota (opcional)</Label>
            <Input id="hv-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {log ? <Button variant="ghost" onClick={remove} disabled={pending}><Trash2 /> Quitar registro</Button> : <span />}
          <Button onClick={save} disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hábitos de la semana: una fila por hábito y una columna por día (los últimos 7 días).
 * Tocar una casilla registra o quita el día; para cantidades o minutos abre un cuadro para anotar el valor.
 */
export function HabitTracker({
  habits, logs, today, goals, weekStartsOn, statsFrom, statsLabel,
}: {
  habits: Habit[]; logs: HabitLog[]; today: string; goals: Option[]; weekStartsOn: number; statsFrom: string; statsLabel: string;
}) {
  const [editing, setEditing] = useState<Habit | null>(null);
  const [valueFor, setValueFor] = useState<{ habit: Habit; date: string; log?: HabitLog } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const logMap = new Map(logs.map((l) => [`${l.habit_id}|${l.logged_on}`, l]));

  const toggle = async (h: Habit, d: string) => {
    const log = logMap.get(`${h.id}|${d}`);
    if (h.tracking_method !== "check") return setValueFor({ habit: h, date: d, log });
    const key = `${h.id}|${d}`;
    setBusy(key);
    const r = log ? await unlogHabit(h.id, d) : await logHabit({ habit_id: h.id, logged_on: d, value: null, notes: "" });
    setBusy(null);
    if (!r.ok) toast.error(r.error);
  };

  if (!habits.length)
    return (
      <EmptyState
        icon={ListChecks}
        title="Aún no tienes hábitos"
        description="Crea uno con la frecuencia que te sirva: todos los días, días específicos o algunas veces por semana."
      />
    );

  return (
    <div className="space-y-2">
      <div className="hidden text-[11px] text-muted sm:flex" aria-hidden>
        <span className="flex-1">Hábito</span>
        <DayHeader days={days} today={today} />
      </div>
      <ul className="divide-y divide-border border-t border-border sm:border-t-0">
        {habits.map((h) => {
          const s = habitStats(h, logs, statsFrom, today, weekStartsOn);
          return (
            <li key={h.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-1">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{h.name}</p>
                  <p className="text-[11px] text-muted">
                    {describeFrequency(h)} · {statsLabel}: {s.expected ? `${s.done} de ${s.expected} ${s.expected === 1 ? s.unit.slice(0, -1) : s.unit}` : (s.unit === "semanas" ? "aún sin semanas completas" : "aún sin días planeados")}
                    {h.tracking_method !== "check" && s.total > 0 && ` · total ${formatNumber(s.total, 1)}${UNIT[h.tracking_method]}`}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`Editar ${h.name}`} onClick={() => setEditing(h)}><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`Eliminar ${h.name}`}><Trash2 /></Button>}
                  title={`¿Eliminar “${h.name}”?`}
                  description="Se eliminará el hábito con todo su historial. Si solo quieres pausarlo, edítalo y desmarca “Activo”."
                  onConfirm={async () => {
                    const r = await deleteHabit(h.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Hábito eliminado");
                  }}
                />
              </div>
              <div className="sm:hidden" aria-hidden><DayHeader days={days} today={today} /></div>
              <div className="grid grid-cols-7 gap-1 sm:w-[17.5rem] sm:shrink-0" role="group" aria-label={`Últimos 7 días de ${h.name}`}>
                {days.map((d) => {
                  const log = logMap.get(`${h.id}|${d}`);
                  const done = isDone(h, log);
                  const planned = isScheduled(h, d) || (h.frequency === "weekly" && d >= h.start_date);
                  const before = d < h.start_date;
                  const label = `${h.name}, ${formatDay(d, "EEEE d MMM")}: ${done ? "hecho" : log ? "registrado en 0" : before ? "antes de empezar" : planned ? "sin registrar" : "no planeado"}`;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={before || busy === `${h.id}|${d}`}
                      onClick={() => toggle(h, d)}
                      aria-label={label}
                      aria-pressed={h.tracking_method === "check" ? done : undefined}
                      title={label}
                      className={cn(
                        "mx-auto flex h-9 w-full max-w-10 items-center justify-center rounded-md border text-[11px] tabular-nums transition-colors disabled:opacity-30",
                        done ? "border-accent bg-accent-soft text-foreground" : planned ? "border-border text-muted hover:border-accent" : "border-dashed border-border/70 text-muted/60 hover:border-accent",
                      )}
                    >
                      {done && (h.tracking_method === "check" ? <Check className="size-4" /> : formatNumber(log?.value, 0))}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted">Las casillas punteadas son días no planeados; también puedes registrarlas. Sin rachas: un día sin registrar no borra nada.</p>
      <HabitDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} habit={editing ?? undefined} goals={goals} today={today} />
      <ValueDialog target={valueFor} onClose={() => setValueFor(null)} />
    </div>
  );
}
