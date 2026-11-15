"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";
import { addSuggestedCategories, copyBudget, deleteCategory, saveBudget, saveCategory } from "@/lib/finance/actions";
import type { Category } from "@/lib/finance/queries";
import { MoneyInput } from "./money-input";

export function BudgetEditor({
  month, prevMonth, categories, budgets, spent,
}: {
  month: string; prevMonth: string; categories: Category[]; budgets: Record<string, number>; spent: Record<string, { amount: number; n: number }>;
}) {
  const expense = categories.filter((c) => c.kind === "expense");
  const [values, setValues] = useState<Record<string, number | null>>(() => Object.fromEntries(expense.map((c) => [c.id, budgets[c.id] ?? null])));
  const [pending, setPending] = useState(false);
  const key = JSON.stringify(budgets) + expense.map((c) => c.id).join();
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setValues(Object.fromEntries(expense.map((c) => [c.id, budgets[c.id] ?? null])));
  }

  const dirty = expense.some((c) => (values[c.id] ?? null) !== (budgets[c.id] ?? null));
  const invalid = expense.some((c) => values[c.id] != null && Number.isNaN(values[c.id]));
  const totalBudget = expense.reduce((a, c) => a + (values[c.id] && !Number.isNaN(values[c.id]) ? values[c.id]! : 0), 0);
  const budgeted = expense.filter((c) => values[c.id] != null && !Number.isNaN(values[c.id]));
  const totalSpent = budgeted.reduce((a, c) => a + (spent[c.id]?.amount ?? 0), 0);

  if (!expense.length)
    return <p className="text-sm text-muted">Crea categorías de gasto (abajo) para poder asignarles un presupuesto.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted tabular-nums">
          {budgeted.length ? `Presupuestado ${formatMoney(totalBudget)} · Gastado en esas categorías ${formatMoney(totalSpent)}` : "Sin presupuesto para este mes."}
        </p>
        <Button size="sm" variant="ghost" onClick={async () => {
          const r = await copyBudget(prevMonth, month);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Presupuesto copiado del mes anterior");
        }}>
          <Copy /> Copiar del mes anterior
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {expense.map((c) => {
          const b = values[c.id];
          const s = spent[c.id] ?? { amount: 0, n: 0 };
          const has = b != null && !Number.isNaN(b);
          const over = has && b! > 0 && s.amount > b!;
          return (
            <li key={c.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_11rem] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm">{c.name}</p>
                <p className="text-[11px] text-muted tabular-nums">
                  Gastado {formatMoney(s.amount)} ({s.n} mov.)
                  {has && !over && b! > 0 && ` · quedan ${formatMoney(b! - s.amount)}`}
                </p>
                {over && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-warning">
                    <AlertTriangle className="size-3" aria-hidden /> Por encima del presupuesto en {formatMoney(s.amount - b!)}
                  </p>
                )}
                {has && b! > 0 && (
                  <div className="mt-1.5 h-1.5 rounded-full bg-surface" aria-hidden>
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (s.amount / b!) * 100)}%` }} />
                  </div>
                )}
              </div>
              <MoneyInput id={`b-${c.id}`} placeholder="Sin presupuesto" value={b} onChange={(v) => setValues({ ...values, [c.id]: v })}
                invalid={b != null && Number.isNaN(b)} />
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-xs text-muted">Cambios sin guardar</span>}
        <Button disabled={!dirty || invalid || pending} onClick={async () => {
          setPending(true);
          const r = await saveBudget({ month, items: expense.map((c) => ({ category_id: c.id, amount: values[c.id] ?? null })) });
          setPending(false);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Presupuesto guardado");
        }}>
          {pending ? "Guardando…" : "Guardar presupuesto"}
        </Button>
      </div>
    </div>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [newName, setNewName] = useState({ expense: "", income: "" });
  const [editing, setEditing] = useState<{ id: string; name: string; kind: Category["kind"] } | null>(null);
  const [pending, setPending] = useState(false);

  const add = async (kind: Category["kind"]) => {
    if (!newName[kind].trim()) return;
    const r = await saveCategory({ name: newName[kind], kind });
    if (!r.ok) return void toast.error(r.error);
    setNewName({ ...newName, [kind]: "" });
    toast.success("Categoría creada");
  };

  if (!categories.length)
    return (
      <EmptyState
        icon={Tags}
        title="Aún no tienes categorías"
        description="Crea las tuyas o empieza con unas comunes (vivienda, alimentación, transporte, salario…)."
        action={
          <Button size="sm" variant="secondary" disabled={pending} onClick={async () => {
            setPending(true);
            const r = await addSuggestedCategories();
            setPending(false);
            if (!r.ok) return void toast.error(r.error);
            toast.success("Categorías agregadas");
          }}>Agregar las sugeridas</Button>
        }
      />
    );

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {(["expense", "income"] as const).map((kind) => (
        <div key={kind} className="space-y-2">
          <h3 className="text-xs font-medium text-muted">{kind === "expense" ? "Gastos" : "Ingresos"}</h3>
          <ul className="space-y-1">
            {categories.filter((c) => c.kind === kind).map((c) => (
              <li key={c.id} className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1">
                {editing?.id === c.id ? (
                  <>
                    <Input aria-label="Nombre de la categoría" className="h-8 min-w-0 flex-1" maxLength={60} value={editing.name} autoFocus
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={async (e) => {
                        if (e.key !== "Enter") return;
                        const r = await saveCategory({ name: editing.name, kind }, c.id);
                        if (!r.ok) return void toast.error(r.error);
                        setEditing(null);
                      }} />
                    <Button size="icon" className="size-8" aria-label="Guardar nombre" onClick={async () => {
                      const r = await saveCategory({ name: editing.name, kind }, c.id);
                      if (!r.ok) return void toast.error(r.error);
                      setEditing(null);
                    }}><Check /></Button>
                    <Button size="icon" variant="ghost" className="size-8" aria-label="Cancelar" onClick={() => setEditing(null)}><X /></Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Renombrar ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name, kind })}><Pencil /></Button>
                    <ConfirmDialog
                      trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Eliminar ${c.name}`}><Trash2 /></Button>}
                      title={`¿Eliminar la categoría “${c.name}”?`}
                      description="Sus movimientos se conservan y quedan “Sin categoría”. Se eliminan los presupuestos de esta categoría."
                      onConfirm={async () => {
                        const r = await deleteCategory(c.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Categoría eliminada");
                      }}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input aria-label={`Nueva categoría de ${kind === "expense" ? "gasto" : "ingreso"}`} placeholder="Nueva categoría" maxLength={60}
              value={newName[kind]} onChange={(e) => setNewName({ ...newName, [kind]: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && add(kind)} />
            <Button size="icon" variant="secondary" aria-label={`Agregar categoría de ${kind === "expense" ? "gasto" : "ingreso"}`} onClick={() => add(kind)}><Plus /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}
