"use client";

import { useMemo } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/finance/money-input";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { formatMoney, formatNumber } from "@/lib/format";
import { saveTrip } from "@/lib/market/actions";
import { DEFAULT_TAX, TAX_CODES, lineBase, lineTax, nameKey, tripSchema, type ProductStats, type TaxCode, type Trip, type TripInput } from "@/lib/market/schema";

const emptyItem = () => ({ name: "", quantity: 1 as number | null, unit_price: null as number | null, tax_code: DEFAULT_TAX as TaxCode });
const GRID = "sm:grid-cols-[minmax(0,1fr)_5rem_8rem_7.5rem_7rem_2rem]";

export function TripDialog({
  open, onOpenChange, trip, today, products,
}: { open: boolean; onOpenChange: (o: boolean) => void; trip?: Trip; today: string; products: ProductStats[] }) {
  const defaults: TripInput = trip
    ? { trip_date: trip.trip_date, store: trip.store ?? "", notes: trip.notes ?? "", items: trip.items.map((i) => ({ name: i.name, quantity: i.quantity, unit_price: i.unit_price, tax_code: i.tax_code })) }
    : { trip_date: today, store: "", notes: "", items: [emptyItem()] };
  const { register, handleSubmit, control, formState, reset, setValue, getValues } = useForm<TripInput>({
    resolver: zodResolver(tripSchema) as unknown as Resolver<TripInput>,
    defaultValues: defaults,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  useResetOnOpen(open, () => reset(defaults));
  const items = useWatch({ control, name: "items" }) ?? [];
  const known = useMemo(() => new Map(products.map((p) => [nameKey(p.name), p])), [products]);
  const num = (i: (typeof items)[number] | undefined) => ({ quantity: Number(i?.quantity) || 0, unit_price: Number(i?.unit_price) || 0, tax_code: i?.tax_code });
  const base = items.reduce((a, i) => a + lineBase(num(i)), 0);
  const tax = items.reduce((a, i) => a + lineTax(num(i)), 0);
  const total = base + tax;
  const errors = formState.errors;
  const itemErrors = errors.items as unknown as ({ name?: { message?: string }; quantity?: { message?: string }; unit_price?: { message?: string } } | undefined)[] | undefined;

  const onSubmit = handleSubmit(async (v) => {
    const r = await saveTrip(v, trip?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(trip ? "Market updated" : "Market saved");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{trip ? "Edit market" : "Log market"}</DialogTitle>
          <DialogDescription>
            Add each product with the price of one unit before tax, how many you bought and its tax code from the receipt. Products you&apos;ve bought before are recognized by name, even with different capitals or accents.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="trip-date">Date</Label>
              <Input id="trip-date" type="date" aria-invalid={!!errors.trip_date} {...register("trip_date")} />
              <FieldError message={errors.trip_date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-store">Store (optional)</Label>
              <Input id="trip-store" placeholder="E.g. D1, Éxito, local market" {...register("store")} />
              <FieldError message={errors.store?.message} />
            </div>
          </div>

          <datalist id="market-products">{products.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-medium text-muted">Products · {fields.length}</legend>
            <div className={`hidden gap-2 px-1 text-[11px] text-muted sm:grid ${GRID}`}>
              <span>Product</span><span>Quantity</span><span>Unit price</span><span>Tax</span><span className="text-right">Subtotal</span><span />
            </div>
            <ul className="space-y-2">
              {fields.map((f, i) => {
                const it = items[i];
                const e = itemErrors?.[i];
                const match = it?.name ? known.get(nameKey(it.name)) : undefined;
                const sub = lineBase(num(it)) + lineTax(num(it));
                const subTax = lineTax(num(it));
                const diff = match && it?.unit_price != null ? Number(it.unit_price) - match.lastPrice : null;
                return (
                  <li key={f.id} className="rounded-md border border-border p-2 sm:border-0 sm:p-0">
                    <div className={`grid grid-cols-3 gap-2 sm:items-start ${GRID}`}>
                      <div className="col-span-3 sm:col-span-1">
                        <Input aria-label={`Product ${i + 1}`} placeholder="E.g. Avena en hojuelas 500 g" list="market-products" autoComplete="off"
                          aria-invalid={!!e?.name} {...register(`items.${i}.name`, {
                            // Al reconocer un producto ya comprado, propone el impuesto de la última vez.
                            onBlur: (ev) => {
                              const m = known.get(nameKey(ev.target.value));
                              if (m && getValues(`items.${i}.tax_code`) === DEFAULT_TAX && m.lastTax !== DEFAULT_TAX) setValue(`items.${i}.tax_code`, m.lastTax);
                            },
                          })} />
                        {match && (
                          <p className="mt-0.5 text-[11px] text-muted">
                            Bought {match.purchases}× · avg {formatMoney(match.avgPrice)} · last {formatMoney(match.lastPrice)}
                            {diff != null && diff !== 0 && (
                              <span className={diff > 0 ? "text-danger" : "text-success"}> · {diff > 0 ? "+" : "−"}{formatMoney(Math.abs(diff))} vs last</span>
                            )}
                          </p>
                        )}
                        <FieldError message={e?.name?.message} />
                      </div>
                      <div>
                        <span className="mb-0.5 block text-[11px] text-muted sm:hidden">Quantity</span>
                        <Controller control={control} name={`items.${i}.quantity`}
                          render={({ field }) => (
                            <Input type="number" inputMode="decimal" min={0} step="any" aria-label={`Quantity of product ${i + 1}`} aria-invalid={!!e?.quantity}
                              value={field.value == null || Number.isNaN(field.value) ? "" : String(field.value)}
                              onChange={(ev) => field.onChange(ev.target.value === "" ? null : Number(ev.target.value))} />
                          )} />
                        <FieldError message={e?.quantity?.message} />
                      </div>
                      <div>
                        <span className="mb-0.5 block text-[11px] text-muted sm:hidden">Unit price</span>
                        <Controller control={control} name={`items.${i}.unit_price`}
                          render={({ field }) => <MoneyInput id={`item-${f.id}-price`} value={field.value as number | null} onChange={field.onChange} invalid={!!e?.unit_price} />} />
                        <FieldError message={e?.unit_price?.message} />
                      </div>
                      <div>
                        <span className="mb-0.5 block text-[11px] text-muted sm:hidden">Tax</span>
                        <Select aria-label={`Tax of product ${i + 1}`} className="px-2 sm:px-3" {...register(`items.${i}.tax_code`)}>
                          {Object.entries(TAX_CODES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                        </Select>
                      </div>
                      <p className="col-span-2 self-center text-xs tabular-nums text-muted sm:col-span-1 sm:flex sm:min-h-9 sm:items-center sm:justify-end sm:self-start sm:text-sm sm:text-foreground">
                        <span className="sm:hidden">Subtotal&nbsp;</span>
                        <span className="sm:flex sm:flex-col sm:items-end sm:leading-tight">
                          {formatMoney(sub)}
                          {subTax > 0 && <span className="text-[11px] text-muted"> incl. {formatMoney(subTax)} tax</span>}
                        </span>
                      </p>
                      <Button type="button" size="icon" variant="ghost" className="size-8 justify-self-end sm:size-9" aria-label={`Remove product ${i + 1}`}
                        disabled={fields.length === 1} onClick={() => remove(i)}><Trash2 /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {typeof errors.items?.message === "string" && <FieldError message={errors.items.message} />}
            <Button type="button" size="sm" variant="secondary" onClick={() => append(emptyItem())}><Plus /> Add product</Button>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="trip-notes">Notes (optional)</Label>
            <Textarea id="trip-notes" rows={2} placeholder="Big monthly shop, promotions…" {...register("notes")} />
          </div>

          <DialogFooter className="sm:items-center sm:justify-between">
            <p className="text-sm">
              {tax > 0 && <span className="text-muted tabular-nums">Before tax {formatMoney(base)} · Tax {formatMoney(tax)} · </span>}
              Total <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
              <span className="text-muted"> · {formatNumber(items.reduce((a, i) => a + (Number(i?.quantity) || 0), 0), 2)} units</span>
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving…" : "Save"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
