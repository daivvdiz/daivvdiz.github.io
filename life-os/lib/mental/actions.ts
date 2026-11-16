"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import {
  emotionsSchema, journalSchema, strategyLogSchema, strategySchema, SUGGESTED_STRATEGIES,
  type EmotionsInput, type JournalInput, type StrategyInput, type StrategyLogInput,
} from "./schema";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();
const done = (): Result => {
  revalidatePath("/mental-health");
  return { ok: true };
};
const issue = (e: z.ZodError) => ({ ok: false as const, error: e.issues[0]?.message ?? "Invalid data" });

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Devuelve el id de la entrada de ese día, creándola vacía si no existe (sin tocar sus datos). */
async function ensureEntry(supabase: Supa, userId: string, date: string) {
  await supabase.from("daily_entries").upsert({ user_id: userId, entry_date: date }, { onConflict: "user_id,entry_date", ignoreDuplicates: true });
  const { data } = await supabase.from("daily_entries").select("id").eq("entry_date", date).single();
  return (data?.id as string | undefined) ?? null;
}

export async function saveDayEmotions(input: EmotionsInput): Promise<Result> {
  const p = emotionsSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const entryId = await ensureEntry(supabase, user.id, p.data.date);
  if (!entryId) return { ok: false, error: "Couldn't prepare today's entry." };

  const byName = new Map(p.data.emotions.map((e) => [e.name.toLowerCase(), e]));
  const emotions = [...byName.values()];
  await supabase.from("daily_entry_emotions").delete().eq("daily_entry_id", entryId);
  if (emotions.length) {
    await supabase.from("emotional_tags").upsert(emotions.map((e) => ({ user_id: user.id, name: e.name })), { onConflict: "user_id,name", ignoreDuplicates: true });
    const { data: tags } = await supabase.from("emotional_tags").select("id, name").in("name", emotions.map((e) => e.name));
    const rows = (tags ?? []).map((t) => ({
      user_id: user.id, daily_entry_id: entryId, emotional_tag_id: t.id, intensity: byName.get((t.name as string).toLowerCase())?.intensity ?? null,
    }));
    if (rows.length) {
      const r = await supabase.from("daily_entry_emotions").insert(rows);
      if (r.error) return { ok: false, error: "Couldn't save the emotions." };
    }
  }

  await supabase.from("stress_factors").delete().eq("daily_entry_id", entryId);
  if (p.data.stress_factors.length) {
    const r = await supabase.from("stress_factors").insert(p.data.stress_factors.map((description) => ({ user_id: user.id, daily_entry_id: entryId, description })));
    if (r.error) return { ok: false, error: "Couldn't save the stress factors." };
  }
  revalidatePath("/calendar");
  return done();
}

export async function saveJournalEntry(input: JournalInput, id?: string): Promise<Result> {
  const p = journalSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const { data: entry } = await supabase.from("daily_entries").select("id").eq("entry_date", p.data.entry_date).maybeSingle();
  const row = { ...p.data, title: p.data.title || null, daily_entry_id: (entry?.id as string | undefined) ?? null };
  const r = id
    ? await supabase.from("journal_entries").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("journal_entries").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: "Couldn't save the entry." };
  return done();
}

export async function deleteJournalEntry(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from("journal_entries").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "Couldn't delete it." };
  return done();
}

export async function saveStrategy(input: StrategyInput, id?: string): Promise<Result> {
  const p = strategySchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const row = { ...p.data, description: p.data.description || null };
  const r = id
    ? await supabase.from("coping_strategies").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("coping_strategies").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: r.error.code === "23505" ? "You already have a strategy with that name." : "Couldn't save the strategy." };
  return done();
}

export async function addSuggestedStrategies(): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase
    .from("coping_strategies")
    .upsert(SUGGESTED_STRATEGIES.map((name) => ({ user_id: user.id, name })), { onConflict: "user_id,name", ignoreDuplicates: true });
  if (r.error) return { ok: false, error: "Couldn't add them." };
  return done();
}

export async function deleteStrategy(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from("coping_strategies").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "Couldn't delete it." };
  return done();
}

export async function saveStrategyLog(input: StrategyLogInput, id?: string): Promise<Result> {
  const p = strategyLogSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const { data: own } = await supabase.from("coping_strategies").select("id").eq("id", p.data.coping_strategy_id).maybeSingle();
  if (!own) return { ok: false, error: "Strategy not found." };
  const { data: entry } = await supabase.from("daily_entries").select("id").eq("entry_date", p.data.used_on).maybeSingle();
  const row = { ...p.data, notes: p.data.notes || null, daily_entry_id: (entry?.id as string | undefined) ?? null };
  const r = id
    ? await supabase.from("coping_strategy_logs").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("coping_strategy_logs").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: "Couldn't save the entry." };
  return done();
}

export async function deleteStrategyLog(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from("coping_strategy_logs").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "Couldn't delete it." };
  return done();
}
