"use client";

import { Landmark, Pencil, PiggyBank, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EntityDialog, useEditor } from "@/components/entity-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/goals/goal-parts";
import { formatDay, formatMoney } from "@/lib/format";
import {
  ASSET_KINDS, LIABILITY_KINDS, assetSchema, liabilitySchema, savingsSchema,
  type AssetInput, type LiabilityInput, type SavingsInput,
} from "@/lib/finance/schema";
import { deleteAsset, deleteLiability, deleteSavingsGoal, saveAsset, saveLiability, saveSavingsGoal } from "@/lib/finance/actions";
import type { Asset, Liability, SavingsGoal } from "@/lib/finance/queries";
import { NewTxButton, type TxRefs } from "./tx-dialog";

// ---------------------------------------------------------------- Ahorro

export function SavingsList({ goals, today, refs }: { goals: SavingsGoal[]; today: string; refs: TxRefs }) {
  const ed = useEditor<SavingsGoal>();
  const it = ed.item;
  return (
    <div className="space-y-3">
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> New savings goal</Button>
      {!goals.length ? (
        <EmptyState icon={PiggyBank} title="No savings goals" description="Create one and log contributions. Contributions don't count as expenses." />
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
                      {g.contributions} {g.contributions === 1 ? "contribution" : "contributions"}{g.target_date && ` · by ${formatDay(g.target_date)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${g.name}`} onClick={() => ed.setEditing(g)}><Pencil /></Button>
                    <ConfirmDialog
                      trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${g.name}`}><Trash2 /></Button>}
                      title={`Delete “${g.name}”?`}
                      description="Contributions are kept as transactions, but without a goal. This can't be undone."
                      onConfirm={async () => {
                        const r = await deleteSavingsGoal(g.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Savings goal deleted");
                      }}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm tabular-nums">{formatMoney(g.saved)} <span className="text-xs text-muted">de {formatMoney(g.target_amount)} · {pct}%</span></p>
                <div className="mt-1.5"><ProgressBar value={pct} label={`Savings for ${g.name}`} /></div>
                <div className="mt-3">
                  <NewTxButton today={today} refs={refs} size="sm" variant="secondary" label="Log contribution"
                    preset={{ type: "transfer", savings_goal_id: g.id, description: `Contribution to ${g.name}` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <EntityDialog<SavingsInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Edit savings goal" : "New savings goal"} description="The amount saved is calculated from the contributions you log."
        schema={savingsSchema}
        defaults={it ? { name: it.name, target_amount: it.target_amount, target_date: it.target_date ?? "", notes: it.notes ?? "" } : { name: "", target_amount: undefined as unknown as number, target_date: "", notes: "" }}
        fields={[
          { name: "name", label: "Name", kind: "text", placeholder: "E.g. Emergency fund" },
          { name: "target_amount", label: "Target", kind: "money" },
          { name: "target_date", label: "Target date (optional)", kind: "date" },
          { name: "notes", label: "Notes (optional)", kind: "textarea" },
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
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> New asset</Button>
      {!assets.length ? (
        <EmptyState icon={Wallet} title="No assets" description="Accounts, investments, real estate or vehicles, with their current value." className="py-4" />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{a.name}</p>
                <p className="text-[11px] text-muted">{ASSET_KINDS[a.kind as keyof typeof ASSET_KINDS] ?? a.kind ?? "Asset"} · value as of {formatDay(a.valued_on)}</p>
              </div>
              <span className="shrink-0 text-sm tabular-nums">{formatMoney(a.value)}</span>
              <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${a.name}`} onClick={() => ed.setEditing(a)}><Pencil /></Button>
              <ConfirmDialog
                trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${a.name}`}><Trash2 /></Button>}
                title={`Delete “${a.name}”?`} description="This can't be undone."
                onConfirm={async () => {
                  const r = await deleteAsset(a.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Asset deleted");
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <EntityDialog<AssetInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Edit asset" : "New asset"} description="Update the value when it changes; the date shows when it applies."
        schema={assetSchema}
        defaults={it ? { name: it.name, kind: (it.kind ?? "other") as AssetInput["kind"], value: it.value, valued_on: today, notes: it.notes ?? "" } : { name: "", kind: "cash", value: undefined as unknown as number, valued_on: today, notes: "" }}
        fields={[
          { name: "name", label: "Name", kind: "text", placeholder: "E.g. Savings account" },
          { name: "kind", label: "Type", kind: "select", options: ASSET_KINDS },
          { name: "value", label: "Value", kind: "money" },
          { name: "valued_on", label: "Value as of", kind: "date" },
          { name: "notes", label: "Notes (optional)", kind: "textarea" },
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
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> New debt</Button>
      {!liabilities.length ? (
        <EmptyState icon={Landmark} title="No debts logged" description="Loans, cards or a mortgage. Payments are logged as linked expenses." className="py-4" />
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
                      {LIABILITY_KINDS[l.kind as keyof typeof LIABILITY_KINDS] ?? l.kind ?? "Debt"} · {l.payments} {l.payments === 1 ? "payment" : "payments"}
                      {l.lastPayment && ` · last on ${formatDay(l.lastPayment)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${l.name}`} onClick={() => ed.setEditing(l)}><Pencil /></Button>
                    <ConfirmDialog
                      trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${l.name}`}><Trash2 /></Button>}
                      title={`Delete “${l.name}”?`}
                      description="Payments are kept as expenses, but without a linked debt. This can't be undone."
                      onConfirm={async () => {
                        const r = await deleteLiability(l.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Debt deleted");
                      }}
                    />
                  </div>
                </div>
                {l.original_amount > 0 ? (
                  <>
                    <p className="mt-2 text-sm tabular-nums">
                      Balance {formatMoney(balance)} <span className="text-xs text-muted">· paid {formatMoney(l.paid)} of {formatMoney(l.original_amount)} ({pct}%)</span>
                    </p>
                    <div className="mt-1.5"><ProgressBar value={pct} label={`Paid toward ${l.name}`} /></div>
                  </>
                ) : (
                  <p className="mt-2 text-sm tabular-nums">
                    Paid {formatMoney(l.paid)} <span className="text-xs text-muted">· add the total amount to calculate the balance</span>
                  </p>
                )}
                <div className="mt-3">
                  <NewTxButton today={today} refs={refs} size="sm" variant="secondary" label="Log payment"
                    preset={{ type: "expense", liability_id: l.id, description: `Payment ${l.name}`, category_id: refs.categories.find((c) => c.kind === "expense" && (c.name === "Vivienda" || c.name === "Housing") && l.kind === "vivienda")?.id ?? "" }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <EntityDialog<LiabilityInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Edit debt" : "New debt"} description="The balance is the total amount minus logged payments."
        schema={liabilitySchema}
        defaults={it ? { name: it.name, kind: it.kind ?? "other", original_amount: it.original_amount, start_date: it.start_date ?? "", notes: it.notes ?? "" } : { name: "", kind: "loan", original_amount: undefined as unknown as number, start_date: "", notes: "" }}
        fields={[
          { name: "name", label: "Name", kind: "text", placeholder: "E.g. Car loan" },
          { name: "kind", label: "Type", kind: "select", options: LIABILITY_KINDS },
          { name: "original_amount", label: "Total amount", kind: "money" },
          { name: "start_date", label: "Start (optional)", kind: "date" },
          { name: "notes", label: "Notes (optional)", kind: "textarea" },
        ]}
        onSave={(v) => saveLiability(v, it?.id)}
      />
    </div>
  );
}
