import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const optDate = date.optional().or(z.literal(""));
const optUuid = z.string().uuid().optional().or(z.literal(""));
const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`).optional().or(z.literal(""));
const money = (msg = "Indica un valor") =>
  z.number({ invalid_type_error: msg, required_error: msg }).finite(msg).max(999_999_999_999, "Valor demasiado grande");

export const TX_TYPES = { expense: "Gasto", income: "Ingreso", transfer: "Aporte a ahorro" } as const;
export type TxType = keyof typeof TX_TYPES;

export const PAYMENT_METHODS = ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia", "Nequi / Daviplata", "Otro"];

export const ASSET_KINDS = { cash: "Efectivo y cuentas", investment: "Inversiones", property: "Inmuebles", vehicle: "Vehículos", other: "Otro" } as const;
export const LIABILITY_KINDS = { vivienda: "Vivienda", credit_card: "Tarjeta de crédito", loan: "Préstamo", other: "Otra" } as const;

export const SUGGESTED_CATEGORIES = {
  expense: ["Vivienda", "Alimentación", "Transporte", "Servicios", "Salud", "Educación", "Ocio", "Ropa", "Otros gastos"],
  income: ["Salario", "Trabajo independiente", "Otros ingresos"],
};

export const txSchema = z
  .object({
    type: z.enum(["expense", "income", "transfer"]),
    description: z.string().trim().min(1, "Escribe una descripción").max(200, "Máximo 200 caracteres"),
    amount: money("Indica el valor").gt(0, "El valor debe ser mayor que 0"),
    occurred_on: date,
    category_id: optUuid,
    payment_method: text(60),
    notes: text(2000),
    savings_goal_id: optUuid,
    liability_id: optUuid,
  })
  .refine((v) => v.type !== "transfer" || !!v.savings_goal_id, { path: ["savings_goal_id"], message: "Elige a qué ahorro va el aporte" });
export type TxInput = z.infer<typeof txSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Escribe un nombre").max(60, "Máximo 60 caracteres"),
  kind: z.enum(["income", "expense"]),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Mes no válido"),
  items: z.array(z.object({ category_id: z.string().uuid(), amount: money().min(0, "No puede ser negativo").nullable() })).max(100),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const savingsSchema = z.object({
  name: z.string().trim().min(1, "Escribe un nombre").max(120, "Máximo 120 caracteres"),
  target_amount: money("Indica la meta").gt(0, "Debe ser mayor que 0"),
  target_date: optDate,
  notes: text(2000),
});
export type SavingsInput = z.infer<typeof savingsSchema>;

export const assetSchema = z.object({
  name: z.string().trim().min(1, "Escribe un nombre").max(120, "Máximo 120 caracteres"),
  kind: z.enum(Object.keys(ASSET_KINDS) as [keyof typeof ASSET_KINDS, ...(keyof typeof ASSET_KINDS)[]]),
  value: money().min(0, "No puede ser negativo"),
  valued_on: date,
  notes: text(2000),
});
export type AssetInput = z.infer<typeof assetSchema>;

export const liabilitySchema = z.object({
  name: z.string().trim().min(1, "Escribe un nombre").max(120, "Máximo 120 caracteres"),
  kind: z.string().trim().max(40),
  original_amount: money().min(0, "No puede ser negativo"),
  start_date: optDate,
  notes: text(2000),
});
export type LiabilityInput = z.infer<typeof liabilitySchema>;

/** "1.250.000" o "1250000,50" → número. Devuelve NaN si no es un número. */
export function parseMoney(s: string) {
  const t = s.replace(/[\s$]/g, "");
  if (!t) return NaN;
  // En es-CO el punto separa miles y la coma los decimales.
  const normalized = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/[.,](?=\d{3}(\D|$))/g, "");
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}
