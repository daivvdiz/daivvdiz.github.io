import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DayPoint } from "./stats";

export async function getMentalData(supabase: SupabaseClient, from: string, to: string, today: string) {
  const [days, emotions, factors, journal, strategies, logs, todayEntry, emotionNames] = await Promise.all([
    supabase.from("daily_entries").select("entry_date, mood, energy, stress, sleep_hours, sleep_quality")
      .gte("entry_date", from).lte("entry_date", to).order("entry_date"),
    supabase.from("daily_entry_emotions").select("intensity, emotional_tags(name), daily_entries!inner(entry_date)")
      .gte("daily_entries.entry_date", from).lte("daily_entries.entry_date", to),
    supabase.from("stress_factors").select("description, daily_entries!inner(entry_date)")
      .gte("daily_entries.entry_date", from).lte("daily_entries.entry_date", to),
    supabase.from("journal_entries").select("id, entry_date, kind, title, content, created_at")
      .gte("entry_date", from).lte("entry_date", to).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    supabase.from("coping_strategies").select("id, name, description, is_active").order("name"),
    supabase.from("coping_strategy_logs").select("id, coping_strategy_id, used_on, helped, notes")
      .gte("used_on", from).lte("used_on", to).order("used_on", { ascending: false }),
    supabase.from("daily_entries").select("id, daily_entry_emotions(intensity, emotional_tags(name)), stress_factors(description)")
      .eq("entry_date", today).maybeSingle(),
    supabase.from("emotional_tags").select("name").order("name").limit(100),
  ]);

  type Emo = { intensity: number | null; emotional_tags: { name: string } | null };
  const points: DayPoint[] = (days.data ?? []).map((d) => ({
    date: d.entry_date,
    mood: d.mood,
    energy: d.energy,
    stress: d.stress,
    sleep_hours: d.sleep_hours == null ? null : Number(d.sleep_hours),
    sleep_quality: d.sleep_quality,
  }));

  // Emociones más frecuentes del periodo
  const emotionCount = new Map<string, { days: number; intensity: number[] }>();
  for (const e of (emotions.data ?? []) as unknown as Emo[]) {
    const name = e.emotional_tags?.name;
    if (!name) continue;
    const c = emotionCount.get(name) ?? { days: 0, intensity: [] };
    c.days++;
    if (e.intensity != null) c.intensity.push(e.intensity);
    emotionCount.set(name, c);
  }
  const factorCount = new Map<string, number>();
  for (const f of (factors.data ?? []) as { description: string }[]) {
    const k = f.description.trim();
    factorCount.set(k, (factorCount.get(k) ?? 0) + 1);
  }

  const t = todayEntry.data as unknown as { daily_entry_emotions: Emo[]; stress_factors: { description: string }[] } | null;

  return {
    points,
    error: days.error,
    emotions: [...emotionCount.entries()]
      .map(([name, c]) => ({ name, days: c.days, avgIntensity: c.intensity.length ? c.intensity.reduce((a, b) => a + b, 0) / c.intensity.length : null }))
      .sort((a, b) => b.days - a.days),
    factors: [...factorCount.entries()].map(([description, days]) => ({ description, days })).sort((a, b) => b.days - a.days),
    journal: (journal.data ?? []) as { id: string; entry_date: string; kind: string; title: string | null; content: string }[],
    strategies: (strategies.data ?? []) as { id: string; name: string; description: string | null; is_active: boolean }[],
    logs: (logs.data ?? []) as { id: string; coping_strategy_id: string; used_on: string; helped: number | null; notes: string | null }[],
    today: {
      emotions: (t?.daily_entry_emotions ?? []).map((e) => ({ name: e.emotional_tags?.name ?? "", intensity: e.intensity })).filter((e) => e.name),
      stress_factors: (t?.stress_factors ?? []).map((f) => f.description),
    },
    emotionNames: (emotionNames.data ?? []).map((e) => e.name as string),
  };
}
