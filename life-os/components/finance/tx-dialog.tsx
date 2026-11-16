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
    toast.success(tx ? "Transaction updated" : "Transaction saved");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tx ? "Edit transaction" : "New transaction"}</DialogTitle>
          <DialogDescription>
            {tx?.imported ? "Imported from Segundo Cerebro. The original record isn't changed." : "Amounts in Colombian pesos (COP)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-0.5" role="radiogroup" aria-label="Transaction type">
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
              <Label htmlFor="tx-amount">Amount</Label>
              <Controller control={control} name="amount"
                render={({ field }) => <MoneyInput id="tx-amount" value={field.value} onChange={(v) => field.onChange(v)} invalid={!!formState.errors.amount} />} />
              <FieldError message={formState.errors.amount?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Date</Label>
              <Input id="tx-date" type="date" {...register("occurred_on")} />
              <FieldError message={formState.errors.occurred_on?.message} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Description</Label>
            <Input id="tx-desc" maxLength={200} placeholder={type === "income" ? "E.g. November salary" : type === "transfer" ? "E.g. This month's savings" : "E.g. Groceries"}
              aria-invalid={!!formState.errors.description} {...register("description")} />
            <FieldError message={formState.errors.description?.message} />
          </div>
          {type === "transfer" ? (
            <div className="space-y-1.5">
              <Label htmlFor="tx-saving">Savings goal</Label>
              <Select id="tx-saving" {...register("savings_goal_id")}>
                <option value="">Choose one</option>
                {refs.savings.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <FieldError message={formState.errors.savings_goal_id?.message ?? (refs.savings.length ? undefined : "Create a savings goal first.")} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tx-cat">Category</Label>
                <Select id="tx-cat" {...register("category_id")}>
                  <option value="">Uncategorized</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tx-pay">Payment method (optional)</Label>
                <Input id="tx-pay" list="tx-pay-list" maxLength={60} {...register("payment_method")} />
                <datalist id="tx-pay-list">{PAYMENT_METHODS.map((m) => <option key={m} value={m} />)}</datalist>
              </div>
            </div>
          )}
          {type === "expense" && refs.liabilities.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-liab">Is it a debt payment? (optional)</Label>
              <Select id="tx-liab" {...register("liability_id")}>
                <option value="">No</option>
                {refs.liabilities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tx-notes">Notes (optional)</Label>
            <Textarea id="tx-notes" rows={2} {...register("notes")} />
          </div>
          <DialogFooter className="sm:justify-between">
            {tx ? (
              <ConfirmDialog
                trigger={<Button type="button" variant="ghost"><Trash2 /> Delete</Button>}
                title="Delete this transaction?"
                description={tx.imported
                  ? "It will be deleted from LIFE OS. The original record stays in Segundo Cerebro: if you import again from Settings, it will reappear."
                  : "This can't be undone."}
                onConfirm={async () => {
                  const r = await deleteTransaction(tx.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Transaction deleted");
                  setTimeout(() => onOpenChange(false), 0);
                }}
              />
            ) : <span />}
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewTxButton({
  today, refs, preset, label = "New transaction", variant = "default", size = "default",
}: { today: string; refs: TxRefs; preset?: Partial<TxInput>; label?: string; variant?: "default" | "secondary" | "ghost"; size?: "default" | "sm" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}><Plus /> {label}</Button>
      <TxDialog open={open} onOpenChange={setOpen} preset={preset} today={today} refs={refs} />
    </>
  );
}
