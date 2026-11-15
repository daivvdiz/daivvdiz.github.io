import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths } from "@/lib/dates";
import { monthRange } from "@/lib/format";
import type { TxType } from "./schema";

export interface Category { id: string; name: string; kind: "income" | "expense" }
export interface Tx {
  id: string; type: TxType; description: string; amount: number; occurred_on: string;
  category_id: string | null; payment_method: string | null; notes: string | null;
  savings_goal_id: string | null; liability_id: string | null; imported: boolean;
}
export interface SavingsGoal { id: string; name: string; target_amount: number; target_date: string | null; notes: string | null; saved: number; contributions: number }
export interface Asset { id: string; name: string; kind: string | null; value: number; valued_on: string; notes: string | null }
export interface Liability {
  id: string; name: string; kind: string | null; original_amount: number; start_date: string | null; notes: string | null;
  paid: number; payments: number; lastPayment: string | null;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Todo lo de Finanzas para un mes ("YYYY-MM-01"). Los totales de ahorro y deudas son de todo el historial. */
export async function getFinanceData(supabase: SupabaseClient, month: string) {
  const { start, end } = monthRange(month);
  const trendStart = addMonths(month, -5);

  const [cats, txs, trend, budgets, savings, assets, liabilities, linked] = await Promise.all([
    supabase.from("financial_categories").select("id, name, kind").order("name"),
    supabase.from("transactions")
      .select("id, type, description, amount, occurred_on, category_id, payment_method, notes, savings_goal_id, liability_id, legacy_registro_id")
      .gte("occurred_on", start).lte("occurred_on", end)
      .order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("transactions").select("type, amount, occurred_on").gte("occurred_on", trendStart).lte("occurred_on", end).in("type", ["income", "expense"]),
    supabase.from("budgets").select("category_id, amount").eq("month", month),
    supabase.from("savings_goals").select("id, name, target_amount, target_date, notes").order("created_at"),
    supabase.from("assets").select("id, name, kind, value, valued_on, notes").order("value", { ascending: false }),
    supabase.from("liabilities").select("id, name, kind, original_amount, start_date, notes").order("created_at"),
    supabase.from("transactions").select("savings_goal_id, liability_id, amount, occurred_on").or("savings_goal_id.not.is.null,liability_id.not.is.null"),
  ]);

  const savedBy = new Map<string, { sum: number; n: number }>();
  const paidBy = new Map<string, { sum: number; n: number; last: string | null }>();
  for (const t of linked.data ?? []) {
    if (t.savings_goal_id) {
      const s = savedBy.get(t.savings_goal_id) ?? { sum: 0, n: 0 };
      savedBy.set(t.savings_goal_id, { sum: s.sum + num(t.amount), n: s.n + 1 });
    }
    if (t.liability_id) {
      const s = paidBy.get(t.liability_id) ?? { sum: 0, n: 0, last: null };
      paidBy.set(t.liability_id, { sum: s.sum + num(t.amount), n: s.n + 1, last: !s.last || t.occurred_on > s.last ? t.occurred_on : s.last });
    }
  }

  // Ingresos y gastos de los últimos 6 meses (incluye meses sin movimientos, en 0 y marcados).
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
  const byMonth = new Map(months.map((m) => [m.slice(0, 7), { income: 0, expense: 0, n: 0 }]));
  for (const t of trend.data ?? []) {
    const m = byMonth.get((t.occurred_on as string).slice(0, 7));
    if (!m) continue;
    m[t.type as "income" | "expense"] += num(t.amount);
    m.n++;
  }

  return {
    error: cats.error ?? txs.error ?? linked.error,
    categories: (cats.data ?? []) as Category[],
    txs: (txs.data ?? []).map((t) => ({ ...t, amount: num(t.amount), imported: t.legacy_registro_id != null })) as Tx[],
    trend: months.map((m) => ({ month: m, ...byMonth.get(m.slice(0, 7))! })),
    budgets: new Map((budgets.data ?? []).map((b) => [b.category_id as string, num(b.amount)])),
    savings: (savings.data ?? []).map((s) => ({
      ...s, target_amount: num(s.target_amount), saved: savedBy.get(s.id)?.sum ?? 0, contributions: savedBy.get(s.id)?.n ?? 0,
    })) as SavingsGoal[],
    assets: (assets.data ?? []).map((a) => ({ ...a, value: num(a.value) })) as Asset[],
    liabilities: (liabilities.data ?? []).map((l) => ({
      ...l, original_amount: num(l.original_amount),
      paid: paidBy.get(l.id)?.sum ?? 0, payments: paidBy.get(l.id)?.n ?? 0, lastPayment: paidBy.get(l.id)?.last ?? null,
    })) as Liability[],
  };
}
