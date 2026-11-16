"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import {
  assetSchema, budgetSchema, categorySchema, liabilitySchema, savingsSchema, SUGGESTED_CATEGORIES, txSchema,
  type AssetInput, type BudgetInput, type CategoryInput, type LiabilityInput, type SavingsInput, type TxInput,
} from "./schema";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();
const issue = (e: z.ZodError) => ({ ok: false as const, error: e.issues[0]?.message ?? "Invalid data" });
const done = (): Result => {
  revalidatePath("/finances");
  revalidatePath("/overview");
  return { ok: true };
};
const orNull = (s: string | undefined) => (s ? s : null);

type Table = "transactions" | "financial_categories" | "savings_goals" | "assets" | "liabilities";

async function remove(table: Table, id: string, msg: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from(table).delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: msg };
  return done();
}

export async function saveTransaction(input: TxInput, id?: string): Promise<Result> {
  const p = txSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const v = p.data;
  const { supabase, user } = await requireUser();
  const row = {
    type: v.type,
    description: v.description,
    amount: v.amount,
    occurred_on: v.occurred_on,
    category_id: v.type === "transfer" ? null : orNull(v.category_id),
    payment_method: orNull(v.payment_method),
    notes: orNull(v.notes),
    savings_goal_id: v.type === "transfer" ? orNull(v.savings_goal_id) : null,
    liability_id: v.type === "expense" ? orNull(v.liability_id) : null,
  };
  const r = id
    ? await supabase.from("transactions").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("transactions").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: "Couldn't save the transaction." };
  return done();
}

export async function deleteTransaction(id: string) {
  return remove("transactions", id, "Couldn't delete the transaction.");
}

export async function saveCategory(input: CategoryInput, id?: string): Promise<Result> {
  const p = categorySchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const r = id
    ? await supabase.from("financial_categories").update({ name: p.data.name }).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("financial_categories").insert({ ...p.data, user_id: user.id });
  if (r.error) return { ok: false, error: r.error.code === "23505" ? "You already have a category with that name." : "Couldn't save the category." };
  return done();
}

export async function addSuggestedCategories(): Promise<Result> {
  const { supabase, user } = await requireUser();
  const rows = (["expense", "income"] as const).flatMap((kind) =>
    SUGGESTED_CATEGORIES[kind].map((name) => ({ user_id: user.id, name, kind, is_default: true })),
  );
  const r = await supabase.from("financial_categories").upsert(rows, { onConflict: "user_id,kind,name", ignoreDuplicates: true });
  if (r.error) return { ok: false, error: "Couldn't add the categories." };
  return done();
}

/** Los movimientos de la categoría se conservan, quedan "Uncategorized". */
export async function deleteCategory(id: string) {
  return remove("financial_categories", id, "Couldn't delete the category.");
}

/** Guarda el presupuesto del mes: los valores vacíos quitan el presupuesto de esa categoría. */
export async function saveBudget(input: BudgetInput): Promise<Result> {
  const p = budgetSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const set = p.data.items.filter((i) => i.amount != null);
  const unset = p.data.items.filter((i) => i.amount == null).map((i) => i.category_id);
  if (unset.length) {
    const d = await supabase.from("budgets").delete().eq("month", p.data.month).in("category_id", unset);
    if (d.error) return { ok: false, error: "Couldn't save the budget." };
  }
  if (set.length) {
    const r = await supabase.from("budgets").upsert(
      set.map((i) => ({ user_id: user.id, month: p.data.month, category_id: i.category_id, amount: i.amount })),
      { onConflict: "user_id,month,category_id" },
    );
    if (r.error) return { ok: false, error: "Couldn't save the budget." };
  }
  return done();
}

/** Copia el presupuesto de un mes a otro sin pisar lo que ya exista. */
export async function copyBudget(fromMonth: string, toMonth: string): Promise<Result> {
  const m = z.string().regex(/^\d{4}-\d{2}-01$/);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("budgets").select("category_id, amount").eq("month", m.parse(fromMonth));
  if (error) return { ok: false, error: "Couldn't read the previous budget." };
  if (!data?.length) return { ok: false, error: "Last month has no budget." };
  const r = await supabase.from("budgets").upsert(
    data.map((b) => ({ user_id: user.id, month: m.parse(toMonth), category_id: b.category_id, amount: b.amount })),
    { onConflict: "user_id,month,category_id", ignoreDuplicates: true },
  );
  if (r.error) return { ok: false, error: "Couldn't copy the budget." };
  return done();
}

export async function saveSavingsGoal(input: SavingsInput, id?: string): Promise<Result> {
  const p = savingsSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const row = { ...p.data, target_date: orNull(p.data.target_date), notes: orNull(p.data.notes) };
  const r = id
    ? await supabase.from("savings_goals").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("savings_goals").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: "Couldn't save the savings goal." };
  return done();
}

export async function deleteSavingsGoal(id: string) {
  return remove("savings_goals", id, "Couldn't delete the savings goal.");
}

export async function saveAsset(input: AssetInput, id?: string): Promise<Result> {
  const p = assetSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const row = { ...p.data, notes: orNull(p.data.notes) };
  const r = id
    ? await supabase.from("assets").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("assets").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: "Couldn't save the asset." };
  return done();
}

export async function deleteAsset(id: string) {
  return remove("assets", id, "Couldn't delete the asset.");
}

export async function saveLiability(input: LiabilityInput, id?: string): Promise<Result> {
  const p = liabilitySchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const row = { ...p.data, kind: orNull(p.data.kind), start_date: orNull(p.data.start_date), notes: orNull(p.data.notes) };
  const r = id
    ? await supabase.from("liabilities").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("liabilities").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: "Couldn't save the debt." };
  return done();
}

/** Los pagos registrados se conservan como gastos; solo pierden el vínculo con la deuda. */
export async function deleteLiability(id: string) {
  return remove("liabilities", id, "Couldn't delete the debt.");
}
