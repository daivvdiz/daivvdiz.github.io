"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useEditor } from "@/components/entity-dialog";
import { formatDay, formatMoney, formatNumber } from "@/lib/format";
import { deleteTrip } from "@/lib/market/actions";
import { lineTotal, productStats, tripTotal, type ProductStats, type Trip } from "@/lib/market/schema";
import { cn } from "@/lib/utils";
import { TripDialog } from "./trip-dialog";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function NewTripButton({ today, products, size = "sm" }: { today: string; products: ProductStats[]; size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}><Plus /> Log market</Button>
      <TripDialog open={open} onOpenChange={setOpen} today={today} products={products} />
    </>
  );
}

export function TripList({ trips, today, products }: { trips: Trip[]; today: string; products: ProductStats[] }) {
  const ed = useEditor<Trip>();
  const [openId, setOpenId] = useState<string | null>(trips[0]?.id ?? null);
  const priceOf = new Map(products.map((p) => [p.id, p]));
  // Al editar un mercado, las sugerencias de precio se comparan con los demás mercados, no consigo mismo.
  const editId = ed.item?.id;
  const editStats = useMemo(() => (editId ? productStats(trips.filter((t) => t.id !== editId)) : products), [editId, trips, products]);

  if (!trips.length)
    return (
      <EmptyState icon={ShoppingCart} title="No markets logged"
        description="Log your grocery shopping with each product, its unit price and how many you bought. Prices are compared every time you buy a product again."
        action={<NewTripButton today={today} products={products} />} />
    );

  return (
    <>
      <ul className="divide-y divide-border rounded-md border border-border">
        {trips.map((t) => {
          const open = openId === t.id;
          const units = t.items.reduce((a, i) => a + i.quantity, 0);
          return (
            <li key={t.id}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setOpenId(open ? null : t.id)} aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", !open && "-rotate-90")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{formatDay(t.trip_date)}{t.store && <span className="text-muted"> · {t.store}</span>}</span>
                    <span className="block text-[11px] text-muted">{plural(t.items.length, "product", "products")} · {formatNumber(units, 2)} units</span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatMoney(tripTotal(t))}</span>
                </button>
                <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit market from ${formatDay(t.trip_date)}`} onClick={() => ed.setEditing(t)}><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete market from ${formatDay(t.trip_date)}`}><Trash2 /></Button>}
                  title="Delete this market?" description={`It removes the ${plural(t.items.length, "product", "products")} logged on ${formatDay(t.trip_date)} and their prices from the averages. This can't be undone.`}
                  onConfirm={async () => {
                    const r = await deleteTrip(t.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Market deleted");
                  }}
                />
              </div>
              {open && (
                <div className="border-t border-border bg-surface/50 px-3 py-2">
                  {t.notes && <p className="mb-2 whitespace-pre-line break-words text-xs text-muted">{t.notes}</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[30rem] text-sm">
                      <thead>
                        <tr className="text-left text-[11px] text-muted">
                          <th className="py-1 font-normal">Product</th>
                          <th className="py-1 text-right font-normal">Qty</th>
                          <th className="py-1 text-right font-normal">Unit price</th>
                          <th className="py-1 text-right font-normal">vs avg</th>
                          <th className="py-1 text-right font-normal">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {t.items.map((i) => {
                          const p = priceOf.get(i.product_id);
                          const diff = p && p.purchases > 1 ? i.unit_price - p.avgPrice : null;
                          return (
                            <tr key={i.id} className="border-t border-border/60">
                              <td className="py-1.5 pr-2 break-words">{i.name}</td>
                              <td className="py-1.5 text-right">{formatNumber(i.quantity, 3)}</td>
                              <td className="py-1.5 text-right">{formatMoney(i.unit_price)}</td>
                              <td className={cn("py-1.5 text-right text-xs", diff == null || Math.round(diff) === 0 ? "text-muted" : diff > 0 ? "text-danger" : "text-success")}>
                                {diff == null ? "—" : Math.round(diff) === 0 ? "=" : `${diff > 0 ? "+" : "−"}${formatMoney(Math.abs(diff))}`}
                              </td>
                              <td className="py-1.5 text-right">{formatMoney(lineTotal(i))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-medium">
                          <td className="py-1.5" colSpan={4}>Total</td>
                          <td className="py-1.5 text-right tabular-nums">{formatMoney(tripTotal(t))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <TripDialog open={ed.open} onOpenChange={(o) => !o && ed.close()} trip={ed.item} today={today} products={editStats} />
    </>
  );
}
