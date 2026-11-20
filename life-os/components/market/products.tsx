"use client";

import { useMemo, useState } from "react";
import { Pencil, Search, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityDialog, useEditor } from "@/components/entity-dialog";
import { ValueLine } from "@/components/physical/charts";
import { formatDay, formatMoney, formatNumber } from "@/lib/format";
import { renameProduct } from "@/lib/market/actions";
import { nameKey, renameSchema, type ProductStats, type RenameInput } from "@/lib/market/schema";
import { cn } from "@/lib/utils";

const SORTS = {
  name: "Name",
  recent: "Last bought",
  frequent: "Most bought",
  up: "Biggest price increase",
  spent: "Total spent",
} as const;
type Sort = keyof typeof SORTS;

function Change({ p, className }: { p: ProductStats; className?: string }) {
  if (p.change == null) return <span className={cn("text-muted", className)}>—</span>;
  if (Math.round(p.change) === 0) return <span className={cn("text-muted", className)}>No change</span>;
  const up = p.change > 0;
  return (
    <span className={cn(up ? "text-danger" : "text-success", className)}>
      {up ? "+" : "−"}{formatMoney(Math.abs(p.change))}
      {p.changePct != null && <span className="text-[11px]"> ({up ? "+" : "−"}{formatNumber(Math.abs(p.changePct), 1)}%)</span>}
    </span>
  );
}

export function ProductTable({ products }: { products: ProductStats[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [selId, setSelId] = useState<string | null>(null);
  const ed = useEditor<ProductStats>();

  const rows = useMemo(() => {
    const k = nameKey(q);
    const list = products.filter((p) => !k || nameKey(p.name).includes(k));
    const by: Record<Sort, (a: ProductStats, b: ProductStats) => number> = {
      name: (a, b) => a.name.localeCompare(b.name, "es"),
      recent: (a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0),
      frequent: (a, b) => b.purchases - a.purchases,
      up: (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity),
      spent: (a, b) => b.totalSpent - a.totalSpent,
    };
    return list.sort((a, b) => by[sort](a, b) || a.name.localeCompare(b.name, "es"));
  }, [products, q, sort]);

  const sel = products.find((p) => p.id === selId) ?? null;

  if (!products.length)
    return <EmptyState icon={Tags} title="No products yet" description="Every product you log in a market shows up here with its average price." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative block min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product" className="h-8 pl-9" />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          Sort by
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 w-48">
            {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </label>
        <p className="w-full text-[11px] text-muted">
          Average price is the mean of the unit prices you paid, one per market. Change compares the last price with the purchase before it. Select a product to see its history.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] text-muted">
              <th className="px-3 py-2 font-normal">Product</th>
              <th className="px-2 py-2 text-right font-normal">Bought</th>
              <th className="px-2 py-2 text-right font-normal">Avg price</th>
              <th className="px-2 py-2 text-right font-normal">Last price</th>
              <th className="px-2 py-2 text-right font-normal">Change</th>
              <th className="px-2 py-2 text-right font-normal">Min – max</th>
              <th className="px-2 py-2 text-right font-normal">Last bought</th>
              <th className="w-10 px-2 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((p) => (
              <tr key={p.id} className={cn("border-t border-border/60 first:border-t-0", sel?.id === p.id && "bg-accent-soft")}>
                <td className="px-3 py-1.5">
                  <button type="button" onClick={() => setSelId(sel?.id === p.id ? null : p.id)} aria-pressed={sel?.id === p.id}
                    className="break-words text-left hover:text-accent">{p.name}</button>
                </td>
                <td className="px-2 py-1.5 text-right">{p.purchases}×</td>
                <td className="px-2 py-1.5 text-right font-medium">{formatMoney(p.avgPrice)}</td>
                <td className="px-2 py-1.5 text-right">{formatMoney(p.lastPrice)}</td>
                <td className="px-2 py-1.5 text-right"><Change p={p} /></td>
                <td className="px-2 py-1.5 text-right text-xs text-muted">{p.minPrice === p.maxPrice ? formatMoney(p.minPrice) : `${formatMoney(p.minPrice)} – ${formatMoney(p.maxPrice)}`}</td>
                <td className="px-2 py-1.5 text-right text-xs text-muted">{formatDay(p.lastDate)}</td>
                <td className="px-2 py-1.5">
                  <Button size="icon" variant="ghost" className="size-7" aria-label={`Rename ${p.name}`} onClick={() => ed.setEditing(p)}><Pencil /></Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-muted">No products match &quot;{q}&quot;.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sel && (
        <section className="space-y-3 rounded-md border border-border p-3" aria-labelledby="market-product-history">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="market-product-history" className="text-sm font-medium">{sel.name}</h3>
            <p className="text-xs text-muted tabular-nums">
              {formatNumber(sel.totalQty, 3)} units in total · {formatMoney(sel.totalSpent)} spent · {formatMoney(sel.avgPerUnit)} per unit on average
            </p>
          </div>
          <ValueLine
            points={sel.history.map((h) => ({ date: h.date, value: h.unit_price, detail: [`${formatNumber(h.quantity, 3)} units`, h.store].filter(Boolean).join(" · ") }))}
            label="Unit price" format="money" ariaLabel={`Unit price of ${sel.name} over time`} tableExtra="Details" />
        </section>
      )}

      <EntityDialog<RenameInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title="Rename product"
        description="If the new name matches another product, both are merged and all their purchases count toward the same average."
        schema={renameSchema}
        defaults={{ name: ed.item?.name ?? "" }}
        fields={[{ name: "name", label: "Name", kind: "text", suggestions: products.filter((p) => p.id !== ed.item?.id).map((p) => p.name) }]}
        successMessage="Product updated"
        onSave={(v) => renameProduct(ed.item!.id, v)}
      />
    </div>
  );
}
