"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { PAYMENT_METHODS, TX_TYPES, txSchema, type TxInput } from "@/lib/finance/schema";
import { deleteTransaction, saveTransaction } from "@/lib/finance/actions";
import type { Category, Liability, SavingsGoal, Tx } from "@/lib/finance/queries";
import { MoneyInput } from "./money-input";

export interface TxRefs {
  categories: Category[];
  savings: Pick<SavingsGoal, "id" | "name">[];
  liabilities: Pick<Liability, "id" | "name">[];
}

export function TxDialog({
  open, onOpenChange, tx, preset, today, refs,
}: { open: boolean; onOpenChange: (o: boolean) => void; tx?: Tx; preset?: Partial<TxInput>; today: string; refs: TxRefs }) {
  const { register, handleSubmit, control, formState, watch, setValue, reset } = useForm<TxInput>({
    resolver: zodResolver(txSchema),
    values: tx
      ? {
          type: tx.type, description: tx.description, amount: tx.amount, occurred_on: tx.occurred_on,
          category_id: tx.category_id ?? "", payment_method: tx.payment_method ?? "", notes: tx.notes ?? "",
          savings_goal_id: tx.savings_goal_id ?? "", liability_id: tx.liability_id ?? "",
        }
      : {
          type: "expense", description: "", amount: undefined as unknown as number, occurred_on: today, category_id: "",
          payment_method: "", notes: "", savings_goal_id: "", liability_id: "", ...preset,
        },
  });
  useResetOnOpen(open, () => reset());
  const type = watch("type");
  const cats = refs.categories.filter((c) => c.kind === (type === "income" ? "income" : "expense"));

  const onSubmit = handleSubmit(async (v) => {
    const r = await saveTransaction(v, tx?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(tx ? "Movimiento actualizado" : "Movimiento guardado");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tx ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          <DialogDescription>
            {tx?.imported ? "Importado de Segundo Cerebro. El registro original no se modifica." : "Valores en pesos colombianos (COP)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-0.5" role="radiogroup" aria-label="Tipo de movimiento">
            {(Object.keys(TX_TYPES) as (keyof typeof TX_TYPES)[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={type === k}
                onClick={() => {
                  setValue("type", k, { shouldDirty: true });
                  setValue("category_id", "");
                }}
                className={cn("rounded px-2 py-1.5 text-xs", type === k ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}
              >
                {TX_TYPES[k]}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Valor</Label>
              <Controller control={control} name="amount"
                render={({ field }) => <MoneyInput id="tx-amount" value={field.value} onChange={(v) => field.onChange(v)} invalid={!!formState.errors.amount} />} />
              <FieldError message={formState.errors.amount?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Fecha</Label>
              <Input id="tx-date" type="date" {...register("occurred_on")} />
              <FieldError message={formState.errors.occurred_on?.message} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Descripción</Label>
            <Input id="tx-desc" maxLength={200} placeholder={type === "income" ? "Ej. Salario de noviembre" : type === "transfer" ? "Ej. Ahorro del mes" : "Ej. Mercado"}
              aria-invalid={!!formState.errors.description} {...register("description")} />
            <FieldError message={formState.errors.description?.message} />
          </div>
          {type === "transfer" ? (
            <div className="space-y-1.5">
              <Label htmlFor="tx-saving">Meta de ahorro</Label>
              <Select id="tx-saving" {...register("savings_goal_id")}>
                <option value="">Elige una</option>
                {refs.savings.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <FieldError message={formState.errors.savings_goal_id?.message ?? (refs.savings.length ? undefined : "Primero crea una meta de ahorro.")} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tx-cat">Categoría</Label>
                <Select id="tx-cat" {...register("category_id")}>
                  <option value="">Sin categoría</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tx-pay">Medio de pago (opcional)</Label>
                <Input id="tx-pay" list="tx-pay-list" maxLength={60} {...register("payment_method")} />
                <datalist id="tx-pay-list">{PAYMENT_METHODS.map((m) => <option key={m} value={m} />)}</datalist>
              </div>
            </div>
          )}
          {type === "expense" && refs.liabilities.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-liab">¿Es un pago a una deuda? (opcional)</Label>
              <Select id="tx-liab" {...register("liability_id")}>
                <option value="">No</option>
                {refs.liabilities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tx-notes">Notas (opcional)</Label>
            <Textarea id="tx-notes" rows={2} {...register("notes")} />
          </div>
          <DialogFooter className="sm:justify-between">
            {tx ? (
              <ConfirmDialog
                trigger={<Button type="button" variant="ghost"><Trash2 /> Eliminar</Button>}
                title="¿Eliminar este movimiento?"
                description={tx.imported
                  ? "Se eliminará de LIFE OS. El registro original sigue en Segundo Cerebro: si vuelves a importar desde Ajustes, aparecerá de nuevo."
                  : "Esta acción no se puede deshacer."}
                onConfirm={async () => {
                  const r = await deleteTransaction(tx.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Movimiento eliminado");
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

export function NewTxButton({
  today, refs, preset, label = "Nuevo movimiento", variant = "default", size = "default",
}: { today: string; refs: TxRefs; preset?: Partial<TxInput>; label?: string; variant?: "default" | "secondary" | "ghost"; size?: "default" | "sm" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}><Plus /> {label}</Button>
      <TxDialog open={open} onOpenChange={setOpen} preset={preset} today={today} refs={refs} />
    </>
  );
}
