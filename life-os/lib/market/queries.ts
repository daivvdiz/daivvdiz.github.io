import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TAX, TAX_CODES, type TaxCode, type Trip } from "./schema";

const columns = (tax: boolean) =>
  `id, trip_date, store, notes, created_at, market_items(id, quantity, unit_price, ${tax ? "tax_code, " : ""}position, product:market_products(id, name))`;
export const isMissing = (code?: string) => code === "42P01" || code === "PGRST205" || code === "PGRST202" || code === "42883";

type Row = {
  id: string; trip_date: string; store: string | null; notes: string | null; created_at: string;
  market_items: { id: string; quantity: unknown; unit_price: unknown; tax_code?: string | null; position: number; product: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
};

/** Mercados del más reciente al más antiguo, con sus productos en el orden en que los anotaste. */
export async function getMarket(supabase: SupabaseClient) {
  const first = await loadTrips(supabase, true);
  // 42703: la columna tax_code aún no existe (falta la migración 6). Se cargan los mercados sin impuesto.
  if (first.error?.code === "42703") {
    const r = await loadTrips(supabase, false);
    return { ...r, taxMissing: !r.missing && !r.error };
  }
  return { ...first, taxMissing: false };
}

async function loadTrips(supabase: SupabaseClient, tax: boolean) {
  const trips: Trip[] = [];
  let error: { code?: string; message: string } | null = null;
  for (let from = 0; ; from += 1000) {
    const r = await supabase.from("market_trips").select(columns(tax))
      .order("trip_date", { ascending: false }).order("created_at", { ascending: false }).range(from, from + 999);
    if (r.error) { error = r.error; break; }
    const rows = (r.data ?? []) as unknown as Row[];
    for (const t of rows) {
      trips.push({
        id: t.id, trip_date: t.trip_date, store: t.store, notes: t.notes, created_at: t.created_at,
        items: (t.market_items ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .flatMap((i) => {
            const p = Array.isArray(i.product) ? i.product[0] : i.product;
            return p ? [{ id: i.id, product_id: p.id, name: p.name, quantity: Number(i.quantity), unit_price: Number(i.unit_price),
              tax_code: (i.tax_code && i.tax_code in TAX_CODES ? i.tax_code : DEFAULT_TAX) as TaxCode }] : [];
          }),
      });
    }
    if (rows.length < 1000) break;
  }
  const missing = isMissing(error?.code);
  return { trips, missing, error: missing ? null : error };
}
