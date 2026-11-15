"use client";

import { useMemo, useState } from "react";
import { Receipt, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDay, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TX_TYPES } from "@/lib/finance/schema";
import type { Tx } from "@/lib/finance/queries";
import { TxDialog, type TxRefs } from "./tx-dialog";

export function TxList({ txs, refs, today }: { txs: Tx[]; refs: TxRefs; today: string }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<Tx | null>(null);

  const catName = new Map(refs.categories.map((c) => [c.id, c.name]));
  const savName = new Map(refs.savings.map((s) => [s.id, s.name]));
  const liabName = new Map(refs.liabilities.map((l) => [l.id, l.name]));

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return txs.filter(
      (t) =>
        (!type || t.type === type) &&
        (!cat || (cat === "none" ? !t.category_id && t.type !== "transfer" : t.category_id === cat)) &&
        (!term || t.description.toLowerCase().includes(term) || (t.notes ?? "").toLowerCase().includes(term)),
    );
  }, [txs, q, type, cat]);
  const totals = shown.reduce((a, t) => ({ ...a, [t.type]: a[t.type] + t.amount }), { income: 0, expense: 0, transfer: 0 });

  if (!txs.length)
    return <EmptyState icon={Receipt} title="Sin movimientos este mes" description="Registra ingresos, gastos o aportes a tus ahorros." />;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_12rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar movimientos" placeholder="Buscar" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TX_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select aria-label="Filtrar por categoría" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          <option value="none">Sin categoría</option>
          {refs.categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.kind === "income" ? "ingreso" : "gasto"})</option>)}
        </Select>
      </div>
      <p className="text-xs text-muted tabular-nums">
        {shown.length} {shown.length === 1 ? "movimiento" : "movimientos"} · Ingresos {formatMoney(totals.income)} · Gastos {formatMoney(totals.expense)}
        {totals.transfer > 0 && ` · Ahorro ${formatMoney(totals.transfer)}`}
      </p>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Ningún movimiento coincide con los filtros.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {shown.map((t) => {
            const detail = t.type === "transfer"
              ? `Ahorro · ${savName.get(t.savings_goal_id ?? "") ?? "—"}`
              : [t.category_id ? catName.get(t.category_id) : "Sin categoría", t.liability_id ? `Pago a ${liabName.get(t.liability_id) ?? "deuda"}` : null, t.payment_method]
                  .filter(Boolean).join(" · ");
            return (
              <li key={t.id}>
                <button type="button" onClick={() => setEditing(t)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface">
                  <div className="w-12 shrink-0 text-center text-[11px] leading-tight text-muted">
                    <span className="block text-sm font-medium text-foreground tabular-nums">{formatDay(t.occurred_on, "d")}</span>
                    {formatDay(t.occurred_on, "MMM")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.description}</p>
                    <p className="truncate text-[11px] text-muted">
                      {TX_TYPES[t.type]} · {detail}{t.imported && " · Importado"}
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-sm tabular-nums", t.type === "income" && "text-foreground", t.type !== "income" && "text-muted")}>
                    {t.type === "income" ? "+" : "−"}{formatMoney(t.amount)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <TxDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} tx={editing ?? undefined} today={today} refs={refs} />
    </div>
  );
}
