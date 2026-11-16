import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const optDate = date.optional().or(z.literal(""));
const optUuid = z.string().uuid().optional().or(z.literal(""));
const text = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`).optional().or(z.literal(""));
const money = (msg = "Enter a value") =>
  z.number({ invalid_type_error: msg, required_error: msg }).finite(msg).max(999_999_999_999, "Value too large");

export const TX_TYPES = { expense: "Expense", income: "Income", transfer: "Savings contribution" } as const;
export type TxType = keyof typeof TX_TYPES;

export const PAYMENT_METHODS = ["Cash", "Debit card", "Credit card", "Bank transfer", "Nequi / Daviplata", "Other"];

export const ASSET_KINDS = { cash: "Cash and accounts", investment: "Investments", property: "Real estate", vehicle: "Vehicles", other: "Other" } as const;
export const LIABILITY_KINDS = { vivienda: "Mortgage", credit_card: "Credit card", loan: "Loan", other: "Other" } as const;

export const SUGGESTED_CATEGORIES = {
  expense: ["Housing", "Food", "Transportation", "Utilities", "Health", "Education", "Leisure", "Clothing", "Other expenses"],
  income: ["Salary", "Freelance work", "Other income"],
};

export const txSchema = z
  .object({
    type: z.enum(["expense", "income", "transfer"]),
    description: z.string().trim().min(1, "Enter a description").max(200, "Maximum 200 characters"),
    amount: money("Enter the amount").gt(0, "The amount must be greater than 0"),
    occurred_on: date,
    category_id: optUuid,
    payment_method: text(60),
    notes: text(2000),
    savings_goal_id: optUuid,
    liability_id: optUuid,
  })
  .refine((v) => v.type !== "transfer" || !!v.savings_goal_id, { path: ["savings_goal_id"], message: "Choose which savings goal the contribution goes to" });
export type TxInput = z.infer<typeof txSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60, "Maximum 60 characters"),
  kind: z.enum(["income", "expense"]),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Invalid month"),
  items: z.array(z.object({ category_id: z.string().uuid(), amount: money().min(0, "Can't be negative").nullable() })).max(100),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const savingsSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120, "Maximum 120 characters"),
  target_amount: money("Enter the target").gt(0, "Must be greater than 0"),
  target_date: optDate,
  notes: text(2000),
});
export type SavingsInput = z.infer<typeof savingsSchema>;

export const assetSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120, "Maximum 120 characters"),
  kind: z.enum(Object.keys(ASSET_KINDS) as [keyof typeof ASSET_KINDS, ...(keyof typeof ASSET_KINDS)[]]),
  value: money().min(0, "Can't be negative"),
  valued_on: date,
  notes: text(2000),
});
export type AssetInput = z.infer<typeof assetSchema>;

export const liabilitySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120, "Maximum 120 characters"),
  kind: z.string().trim().max(40),
  original_amount: money().min(0, "Can't be negative"),
  start_date: optDate,
  notes: text(2000),
});
export type LiabilityInput = z.infer<typeof liabilitySchema>;

/** "1,250,000" or "1250000.50" → number. Returns NaN if it isn't a number. */
export function parseMoney(s: string) {
  const t = s.replace(/[\s$]/g, "");
  if (!t) return NaN;
  // Commas separate thousands and the dot marks decimals. Several dots are treated as thousands separators.
  const noCommas = t.replace(/,/g, "");
  const normalized = (noCommas.match(/\./g) ?? []).length > 1 ? noCommas.replace(/\./g, "") : noCommas;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}
