import { z } from "zod";
import { date, text } from "@/lib/physical/schema";

/** Igual que public.market_name_key en Supabase: sin tildes, minúsculas y espacios simples. */
export function nameKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Número obligatorio que llega del formulario como número, texto o vacío. */
const num = (min: number, max: number, { required, positive }: { required: string; positive?: boolean }) =>
  z.preprocess(
    (v) => (v === "" || v == null || (typeof v === "number" && Number.isNaN(v)) ? undefined : typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z
      .number({ required_error: required, invalid_type_error: required })
      .refine((n) => (positive ? n > 0 : n >= min), positive ? "Must be greater than 0" : `Minimum ${min}`)
      .refine((n) => n <= max, `Maximum ${max.toLocaleString("en-US")}`),
  ) as unknown as z.ZodType<number, z.ZodTypeDef, number | null>;

/** Códigos de impuesto de la factura. El % se suma al precio unitario × cantidad. */
export const TAX_CODES = {
  "6": { label: "6-Excluido", rate: 0 },
  "5": { label: "5-Exento", rate: 0 },
  C: { label: "C-5%", rate: 0.05 },
  A: { label: "A-19%", rate: 0.19 },
} as const;
export type TaxCode = keyof typeof TAX_CODES;
export const DEFAULT_TAX: TaxCode = "6";
export const taxRate = (c: string | null | undefined) => TAX_CODES[(c ?? DEFAULT_TAX) as TaxCode]?.rate ?? 0;

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Enter the product").max(120, "Maximum 120 characters"),
  quantity: num(0, 100000, { required: "Enter the quantity", positive: true }),
  unit_price: num(0, 1_000_000_000, { required: "Enter the price" }),
  tax_code: z.enum(Object.keys(TAX_CODES) as [TaxCode, ...TaxCode[]]).default(DEFAULT_TAX),
});

export const tripSchema = z
  .object({
    trip_date: date,
    store: text(120),
    notes: text(2000),
    items: z.array(itemSchema).min(1, "Add at least one product").max(300, "Maximum 300 products per market"),
  })
  .superRefine((v, ctx) => {
    const seen = new Map<string, number>();
    v.items.forEach((it, i) => {
      const k = nameKey(it.name);
      if (!k) return;
      if (seen.has(k))
        ctx.addIssue({ code: "custom", path: ["items", i, "name"], message: `Already on line ${seen.get(k)! + 1}. Add the units there.` });
      else seen.set(k, i);
    });
  });
export type TripInput = z.input<typeof tripSchema>;

export const renameSchema = z.object({ name: z.string().trim().min(1, "Enter the name").max(120, "Maximum 120 characters") });
export type RenameInput = z.input<typeof renameSchema>;

export interface TripItem {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  tax_code: TaxCode;
}

export interface Trip {
  id: string;
  trip_date: string;
  store: string | null;
  notes: string | null;
  created_at: string;
  items: TripItem[];
}

/** Precio × cantidad, antes de impuesto. */
export const lineBase = (i: { quantity: number; unit_price: number }) => i.quantity * i.unit_price;
/** Valor del impuesto de la línea. */
export const lineTax = (i: { quantity: number; unit_price: number; tax_code?: string | null }) => lineBase(i) * taxRate(i.tax_code);
/** Subtotal de la línea con el impuesto aplicado. */
export const lineTotal = (i: { quantity: number; unit_price: number; tax_code?: string | null }) => lineBase(i) + lineTax(i);
export const tripTax = (t: Trip) => t.items.reduce((a, i) => a + lineTax(i), 0);
export const tripTotal = (t: Trip) => t.items.reduce((a, i) => a + lineTotal(i), 0);

export interface PricePoint {
  date: string;
  trip_id: string;
  store: string | null;
  quantity: number;
  unit_price: number;
  tax_code: TaxCode;
}

export interface ProductStats {
  id: string;
  name: string;
  /** Veces que lo compraste (una por mercado). */
  purchases: number;
  totalQty: number;
  /** Con impuesto incluido. */
  totalSpent: number;
  /** Promedio de los precios unitarios que pagaste: cada mercado cuenta una vez. */
  avgPrice: number;
  /** Lo que pagaste en promedio por unidad antes de impuesto, según cuántas unidades llevaste cada vez. */
  avgPerUnit: number;
  minPrice: number;
  maxPrice: number;
  lastPrice: number;
  lastDate: string;
  /** Impuesto de la última compra, para proponerlo al volver a comprarlo. */
  lastTax: TaxCode;
  prevPrice: number | null;
  /** Cambio del último precio frente a la compra anterior. */
  change: number | null;
  changePct: number | null;
  /** Del más antiguo al más reciente. */
  history: PricePoint[];
}

/** Trips llegan del más reciente al más antiguo. */
export function productStats(trips: Trip[]): ProductStats[] {
  const byProduct = new Map<string, { name: string; history: PricePoint[] }>();
  for (const t of [...trips].reverse()) {
    for (const i of t.items) {
      const p = byProduct.get(i.product_id) ?? { name: i.name, history: [] };
      p.history.push({ date: t.trip_date, trip_id: t.id, store: t.store, quantity: i.quantity, unit_price: i.unit_price, tax_code: i.tax_code });
      byProduct.set(i.product_id, p);
    }
  }
  return [...byProduct.entries()].map(([id, { name, history }]) => {
    const prices = history.map((h) => h.unit_price);
    const totalQty = history.reduce((a, h) => a + h.quantity, 0);
    const totalBase = history.reduce((a, h) => a + lineBase(h), 0);
    const totalSpent = history.reduce((a, h) => a + lineTotal(h), 0);
    const last = history[history.length - 1];
    const prev = history.length > 1 ? history[history.length - 2] : null;
    const change = prev ? last.unit_price - prev.unit_price : null;
    return {
      id, name, history, purchases: history.length, totalQty, totalSpent,
      avgPrice: prices.reduce((a, p) => a + p, 0) / prices.length,
      avgPerUnit: totalQty ? totalBase / totalQty : 0,
      minPrice: Math.min(...prices), maxPrice: Math.max(...prices),
      lastPrice: last.unit_price, lastDate: last.date, lastTax: last.tax_code,
      prevPrice: prev?.unit_price ?? null, change,
      changePct: prev && change != null && prev.unit_price > 0 ? (change / prev.unit_price) * 100 : null,
    };
  });
}
