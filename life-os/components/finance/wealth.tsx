"use client";

import { useState } from "react";
import { Controller, useForm, type FieldValues, type DefaultValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark, Pencil, PiggyBank, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { ZodTypeAny } from "zod";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/goals/goal-parts";
import { formatDay, formatMoney } from "@/lib/format";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import {
  ASSET_KINDS, LIABILITY_KINDS, assetSchema, liabilitySchema, savingsSchema,
  type AssetInput, type LiabilityInput, type SavingsInput,
} from "@/lib/finance/schema";
import { deleteAsset, deleteLiability, deleteSavingsGoal, saveAsset, saveLiability, saveSavingsGoal } from "@/lib/finance/actions";
import type { Asset, Liability, SavingsGoal } from "@/lib/finance/queries";
import { MoneyInput } from "./money-input";
import { NewTxButton, type TxRefs } from "./tx-dialog";

type Field = { name: string; label: string; kind: "text" | "money" | "date" | "textarea" | "select"; options?: Record<string, string>; placeholder?: string };

/** Diálogo genérico para las entidades simples de Finanzas (ahorro, activos, deudas). */
function EntityDialog<T extends FieldValues>({
  open, onOpenChange, title, description, schema, defaults, fields, onSave,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; schema: ZodTypeAny;
  defaults: T; fields: Field[]; onSave: (v: T) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const { register, handleSubmit, control, formState, reset } = useForm<T>({
    resolver: zodResolver(schema) as unknown as Resolver<T>,
    values: defaults,
    defaultValues: defaults as DefaultValues<T>,
  });
  useResetOnOpen(open, () => reset());
  const errors = formState.errors as Record<string, { message?: string } | undefined>;
  const onSubmit = handleSubmit(async (v) => {
    const r = await onSave(v);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Guardado");
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {fields.map((f) => {
            const id = `ent-${f.name}`;
            return (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={id}>{f.label}</Label>
                {f.kind === "money" ? (
                  <Controller control={control} name={f.name as never}
                    render={({ field }) => <MoneyInput id={id} value={field.value as number | null} onChange={field.onChange} invalid={!!errors[f.name]} />} />
                ) : f.kind === "textarea" ? (
                  <Textarea id={id} rows={2} {...register(f.name as never)} />
                ) : f.kind === "select" ? (
                  <Select id={id} {...register(f.name as never)}>
                    {Object.entries(f.options ?? {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                ) : (
                  <Input id={id} type={f.kind === "date" ? "date" : "text"} placeholder={f.placeholder} aria-invalid={!!errors[f.name]} {...register(f.name as never)} />
                )}
                <FieldError message={errors[f.name]?.message} />
              </div>
            );
          })}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useEditor<T>() {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  return { editing, open: editing !== null, item: editing && editing !== "new" ? (editing as T) : undefined, setEditing, close: () => setEditing(null) };
}

// ---------------------------------------------------------------- Ahorro

export function SavingsList({ goals, today, refs }: { goals: SavingsGoal[]; today: string; refs: TxRefs }) {
  const ed = useEditor<SavingsGoal>();
  const it = ed.item;
  return (
    <div className="space-y-3">
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> Nueva meta de ahorro</Button>
      {!goals.length ? (
        <EmptyState icon={PiggyBank} title="Sin metas de ahorro" description="Crea una y registra aportes. Los aportes no cuentan como gasto." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.saved / g.target_amount) * 100));
            return (
              <li key={g.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{g.name}</p>
                    <p className="text-[11px] text-muted">
                      {g.contributions} {g.contributions === 1 ? "aporte" : "aportes"}{g.target_date && ` · para el ${formatDay(g.target_date)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Editar ${g.name}`} onClick={() => ed.setEditing(g)}><Pencil /></Button>
                    <ConfirmDialog
                      trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Eliminar ${g.name}`}><Trash2 /></Button>}
                      title={`¿Eliminar “${g.name}”?`}
                      description="Los aportes se conservan como movimientos, pero quedan sin meta. Esta acción no se puede deshacer."
                      onConfirm={async () => {
                        const r = await deleteSavingsGoal(g.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Meta de ahorro eliminada");
                      }}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm tabular-nums">{formatMoney(g.saved)} <span className="text-xs text-muted">de {formatMoney(g.target_amount)} · {pct}%</span></p>
                <div className="mt-1.5"><ProgressBar value={pct} label={`Ahorro de ${g.name}`} /></div>
                <div className="mt-3">
                  <NewTxButton today={today} refs={refs} size="sm" variant="secondary" label="Registrar aporte"
                    preset={{ type: "transfer", savings_goal_id: g.id, description: `Aporte a ${g.name}` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <EntityDialog<SavingsInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Editar meta de ahorro" : "Nueva meta de ahorro"} description="Lo ahorrado se calcula con los aportes que registres."
        schema={savingsSchema}
        defaults={it ? { name: it.name, target_amount: it.target_amount, target_date: it.target_date ?? "", notes: it.notes ?? "" } : { name: "", target_amount: undefined as unknown as number, target_date: "", notes: "" }}
        fields={[
          { name: "name", label: "Nombre", kind: "text", placeholder: "Ej. Fondo de emergencia" },
          { name: "target_amount", label: "Meta", kind: "money" },
          { name: "target_date", label: "Fecha objetivo (opcional)", kind: "date" },
          { name: "notes", label: "Notas (opcional)", kind: "textarea" },
        ]}
        onSave={(v) => saveSavingsGoal(v, it?.id)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Patrimonio

export function AssetsList({ assets, today }: { assets: Asset[]; today: string }) {
  const ed = useEditor<Asset>();
  const it = ed.item;
  return (
    <div className="space-y-3">
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> Nuevo activo</Button>
      {!assets.length ? (
        <EmptyState icon={Wallet} title="Sin activos" description="Cuentas, inversiones, inmuebles o vehículos, con su valor actual." className="py-4" />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{a.name}</p>
                <p className="text-[11px] text-muted">{ASSET_KINDS[a.kind as keyof typeof ASSET_KINDS] ?? a.kind ?? "Activo"} · valor al {formatDay(a.valued_on)}</p>
              </div>
              <span className="shrink-0 text-sm tabular-nums">{formatMoney(a.value)}</span>
              <Button size="icon" variant="ghost" className="size-7" aria-label={`Editar ${a.name}`} onClick={() => ed.setEditing(a)}><Pencil /></Button>
              <ConfirmDialog
                trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Eliminar ${a.name}`}><Trash2 /></Button>}
                title={`¿Eliminar “${a.name}”?`} description="Esta acción no se puede deshacer."
                onConfirm={async () => {
                  const r = await deleteAsset(a.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Activo eliminado");
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <EntityDialog<AssetInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Editar activo" : "Nuevo activo"} description="Actualiza el valor cuando cambie; la fecha indica a cuándo corresponde."
        schema={assetSchema}
        defaults={it ? { name: it.name, kind: (it.kind ?? "other") as AssetInput["kind"], value: it.value, valued_on: today, notes: it.notes ?? "" } : { name: "", kind: "cash", value: undefined as unknown as number, valued_on: today, notes: "" }}
        fields={[
          { name: "name", label: "Nombre", kind: "text", placeholder: "Ej. Cuenta de ahorros" },
          { name: "kind", label: "Tipo", kind: "select", options: ASSET_KINDS },
          { name: "value", label: "Valor", kind: "money" },
          { name: "valued_on", label: "Valor a la fecha", kind: "date" },
          { name: "notes", label: "Notas (opcional)", kind: "textarea" },
        ]}
        onSave={(v) => saveAsset(v, it?.id)}
      />
    </div>
  );
}

export function LiabilitiesList({ liabilities, today, refs }: { liabilities: Liability[]; today: string; refs: TxRefs }) {
  const ed = useEditor<Liability>();
  const it = ed.item;
  return (
    <div className="space-y-3">
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> Nueva deuda</Button>
      {!liabilities.length ? (
        <EmptyState icon={Landmark} title="Sin deudas registradas" description="Préstamos, tarjetas o vivienda. Los pagos se registran como gastos vinculados." className="py-4" />
      ) : (
        <ul className="space-y-3">
          {liabilities.map((l) => {
            const balance = Math.max(0, l.original_amount - l.paid);
            const pct = l.original_amount > 0 ? Math.min(100, Math.round((l.paid / l.original_amount) * 100)) : 0;
            return (
              <li key={l.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{l.name}</p>
                    <p className="text-[11px] text-muted">
                      {LIABILITY_KINDS[l.kind as keyof typeof LIABILITY_KINDS] ?? l.kind ?? "Deuda"} · {l.payments} {l.payments === 1 ? "pago" : "pagos"}
                      {l.lastPayment && ` · último el ${formatDay(l.lastPayment)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Editar ${l.name}`} onClick={() => ed.setEditing(l)}><Pencil /></Button>
                    <ConfirmDialog
                      trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Eliminar ${l.name}`}><Trash2 /></Button>}
                      title={`¿Eliminar “${l.name}”?`}
                      description="Los pagos se conservan como gastos, pero quedan sin deuda vinculada. Esta acción no se puede deshacer."
                      onConfirm={async () => {
                        const r = await deleteLiability(l.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Deuda eliminada");
                      }}
                    />
                  </div>
                </div>
                {l.original_amount > 0 ? (
                  <>
                    <p className="mt-2 text-sm tabular-nums">
                      Saldo {formatMoney(balance)} <span className="text-xs text-muted">· pagado {formatMoney(l.paid)} de {formatMoney(l.original_amount)} ({pct}%)</span>
                    </p>
                    <div className="mt-1.5"><ProgressBar value={pct} label={`Pagado de ${l.name}`} /></div>
                  </>
                ) : (
                  <p className="mt-2 text-sm tabular-nums">
                    Pagado {formatMoney(l.paid)} <span className="text-xs text-muted">· falta indicar el valor total para calcular el saldo</span>
                  </p>
                )}
                <div className="mt-3">
                  <NewTxButton today={today} refs={refs} size="sm" variant="secondary" label="Registrar pago"
                    preset={{ type: "expense", liability_id: l.id, description: `Pago ${l.name}`, category_id: refs.categories.find((c) => c.kind === "expense" && c.name === "Vivienda" && l.kind === "vivienda")?.id ?? "" }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <EntityDialog<LiabilityInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Editar deuda" : "Nueva deuda"} description="El saldo es el valor total menos los pagos registrados."
        schema={liabilitySchema}
        defaults={it ? { name: it.name, kind: it.kind ?? "other", original_amount: it.original_amount, start_date: it.start_date ?? "", notes: it.notes ?? "" } : { name: "", kind: "loan", original_amount: undefined as unknown as number, start_date: "", notes: "" }}
        fields={[
          { name: "name", label: "Nombre", kind: "text", placeholder: "Ej. Crédito del carro" },
          { name: "kind", label: "Tipo", kind: "select", options: LIABILITY_KINDS },
          { name: "original_amount", label: "Valor total", kind: "money" },
          { name: "start_date", label: "Inicio (opcional)", kind: "date" },
          { name: "notes", label: "Notas (opcional)", kind: "textarea" },
        ]}
        onSave={(v) => saveLiability(v, it?.id)}
      />
    </div>
  );
}
