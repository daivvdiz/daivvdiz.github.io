"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LifeBuoy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDay, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import {
  HELPED_LABELS, strategyLogSchema, strategySchema, SUGGESTED_STRATEGIES, type StrategyInput, type StrategyLogInput,
} from "@/lib/mental/schema";
import { addSuggestedStrategies, deleteStrategy, deleteStrategyLog, saveStrategy, saveStrategyLog } from "@/lib/mental/actions";

export type Strategy = { id: string; name: string; description: string | null; is_active: boolean };
export type StrategyLog = { id: string; coping_strategy_id: string; used_on: string; helped: number | null; notes: string | null };

function StrategyDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item?: Strategy }) {
  const { register, handleSubmit, formState, reset } = useForm<StrategyInput>({
    resolver: zodResolver(strategySchema),
    values: item ? { name: item.name, description: item.description ?? "", is_active: item.is_active } : { name: "", description: "", is_active: true },
  });
  useResetOnOpen(open, () => reset());
  const onSubmit = handleSubmit(async (v) => {
    const r = await saveStrategy(v, item?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(item ? "Estrategia actualizada" : "Estrategia creada");
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar estrategia" : "Nueva estrategia"}</DialogTitle>
          <DialogDescription>Algo que haces para cuidarte cuando lo necesitas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="st-name">Nombre</Label>
            <Input id="st-name" maxLength={80} aria-invalid={!!formState.errors.name} {...register("name")} />
            <FieldError message={formState.errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-desc">Descripción (opcional)</Label>
            <Textarea id="st-desc" rows={3} {...register("description")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" {...register("is_active")} />
            La uso actualmente
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

function LogDialog({
  open, onOpenChange, strategies, log, defaultStrategy, today,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; strategies: Strategy[]; log?: StrategyLog; defaultStrategy?: string; today: string;
}) {
  const { register, handleSubmit, control, formState, reset } = useForm<StrategyLogInput>({
    resolver: zodResolver(strategyLogSchema),
    values: log
      ? { coping_strategy_id: log.coping_strategy_id, used_on: log.used_on, helped: log.helped, notes: log.notes ?? "" }
      : { coping_strategy_id: defaultStrategy ?? strategies.find((s) => s.is_active)?.id ?? strategies[0]?.id ?? "", used_on: today, helped: null, notes: "" },
  });
  useResetOnOpen(open, () => reset());
  const onSubmit = handleSubmit(async (v) => {
    const r = await saveStrategyLog(v, log?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(log ? "Registro actualizado" : "Uso registrado");
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{log ? "Editar registro" : "Registrar uso"}</DialogTitle>
          <DialogDescription>Anotar si te ayudó es opcional.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lg-st">Estrategia</Label>
              <Select id="lg-st" {...register("coping_strategy_id")}>
                {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <FieldError message={formState.errors.coping_strategy_id?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lg-date">Fecha</Label>
              <Input id="lg-date" type="date" max={today} {...register("used_on")} />
              <FieldError message={formState.errors.used_on?.message} />
            </div>
          </div>
          <Controller
            control={control}
            name="helped"
            render={({ field }) => (
              <div className="space-y-1.5">
                <span id="lg-helped" className="text-sm font-medium">¿Te ayudó?</span>
                <div role="radiogroup" aria-labelledby="lg-helped" className="grid grid-cols-1 gap-1 sm:grid-cols-5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={field.value === n}
                      onClick={() => field.onChange(field.value === n ? null : n)}
                      className={cn("rounded-md border px-2 py-1.5 text-xs",
                        field.value === n ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground")}>
                      {HELPED_LABELS[n]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted">{field.value == null ? "Sin valorar" : "Toca de nuevo para quitar la valoración."}</p>
              </div>
            )}
          />
          <div className="space-y-1.5">
            <Label htmlFor="lg-notes">Notas (opcional)</Label>
            <Textarea id="lg-notes" rows={3} {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={formState.isSubmitting || !strategies.length}>{formState.isSubmitting ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Strategies({ strategies, logs, today }: { strategies: Strategy[]; logs: StrategyLog[]; today: string }) {
  const [editing, setEditing] = useState<Strategy | "new" | null>(null);
  const [logging, setLogging] = useState<{ log?: StrategyLog; strategy?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const name = new Map(strategies.map((s) => [s.id, s.name]));

  const stats = (id: string) => {
    const ls = logs.filter((l) => l.coping_strategy_id === id);
    const rated = ls.filter((l) => l.helped != null).map((l) => l.helped as number);
    return { uses: ls.length, rated: rated.length, avg: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null };
  };
  const sorted = [...strategies].sort((a, b) => Number(b.is_active) - Number(a.is_active) || stats(b.id).uses - stats(a.id).uses || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setLogging({})} disabled={!strategies.length}><Plus /> Registrar uso</Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing("new")}><Plus /> Nueva estrategia</Button>
      </div>

      {!strategies.length ? (
        <EmptyState
          icon={LifeBuoy}
          title="Aún no tienes estrategias"
          description={`Puedes crear las tuyas o empezar con algunas comunes: ${SUGGESTED_STRATEGIES.join(", ").toLowerCase()}.`}
          action={
            <Button size="sm" variant="secondary" disabled={pending} onClick={async () => {
              setPending(true);
              const r = await addSuggestedStrategies();
              setPending(false);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Estrategias agregadas");
            }}>
              Agregar las sugeridas
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {sorted.map((s) => {
            const st = stats(s.id);
            return (
              <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium break-words", !s.is_active && "text-muted")}>
                    {s.name}{!s.is_active && <span className="ml-2 text-xs font-normal">(sin usar ahora)</span>}
                  </p>
                  {s.description && <p className="text-xs text-muted break-words">{s.description}</p>}
                  <p className="mt-0.5 text-xs text-muted tabular-nums">
                    {st.uses} {st.uses === 1 ? "uso" : "usos"} en el periodo
                    {st.rated > 0 && <> · ayudó en promedio {formatNumber(st.avg, 1)}/5 ({st.rated} {st.rated === 1 ? "valoración" : "valoraciones"})</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setLogging({ strategy: s.id })}>Usé esta</Button>
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Editar ${s.name}`} onClick={() => setEditing(s)}><Pencil /></Button>
                  <ConfirmDialog
                    trigger={<Button size="icon" variant="ghost" className="size-8" aria-label={`Eliminar ${s.name}`}><Trash2 /></Button>}
                    title={`¿Eliminar “${s.name}”?`}
                    description="También se eliminarán todos sus registros de uso. Si solo ya no la usas, puedes editarla y desmarcar “La uso actualmente”."
                    onConfirm={async () => {
                      const r = await deleteStrategy(s.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Estrategia eliminada");
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {logs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted">Usos registrados en el periodo ({logs.length})</h3>
          <ul className="max-h-72 space-y-1.5 overflow-auto">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="break-words">
                    <span className="font-medium">{name.get(l.coping_strategy_id) ?? "Estrategia"}</span>
                    <span className="text-muted"> · {formatDay(l.used_on, "EEE d MMM")} · {l.helped ? HELPED_LABELS[l.helped] : "Sin valorar"}</span>
                  </p>
                  {l.notes && <p className="text-xs text-muted break-words">{l.notes}</p>}
                </div>
                <Button size="icon" variant="ghost" className="size-7" aria-label="Editar registro" onClick={() => setLogging({ log: l })}><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="icon" variant="ghost" className="size-7" aria-label="Eliminar registro"><Trash2 /></Button>}
                  title="¿Eliminar este registro?"
                  description="Se eliminará este uso. La estrategia se mantiene."
                  onConfirm={async () => {
                    const r = await deleteStrategyLog(l.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Registro eliminado");
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <StrategyDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} item={editing && editing !== "new" ? editing : undefined} />
      <LogDialog open={logging !== null} onOpenChange={(o) => !o && setLogging(null)} strategies={strategies} log={logging?.log} defaultStrategy={logging?.strategy} today={today} />
    </div>
  );
}
