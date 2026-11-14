import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/dates";

export interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  goal_id: string | null;
  /** Fecha y hora locales (zona del usuario) */
  date: string;
  start_time: string;
  end_time: string | null;
}

export interface DaySummary {
  date: string;
  mood: number | null;
  hasJournal: boolean;
}

export async function getCalendarData(
  supabase: SupabaseClient,
  range: { start: string; end: string },
  timeZone: string,
  categories: string[] | null,
) {
  const from = zonedToUtc(range.start, "00:00", timeZone);
  const to = zonedToUtc(addDays(range.end, 1), "00:00", timeZone);

  let q = supabase
    .from("calendar_events")
    .select("id, title, description, category, starts_at, ends_at, all_day, location, goal_id")
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at");
  if (categories?.length) q = q.in("category", categories);

  const [events, entries] = await Promise.all([
    q,
    supabase.from("daily_entries").select("entry_date, mood, journal").gte("entry_date", range.start).lte("entry_date", range.end),
  ]);

  const list: CalEvent[] = (events.data ?? []).map((e) => {
    const s = utcToZoned(e.starts_at, timeZone);
    return {
      ...(e as Omit<CalEvent, "date" | "start_time" | "end_time">),
      date: s.date,
      start_time: s.time,
      end_time: e.ends_at && !e.all_day ? utcToZoned(e.ends_at, timeZone).time : null,
    };
  });

  const days = new Map<string, DaySummary>();
  for (const d of entries.data ?? []) {
    days.set(d.entry_date, { date: d.entry_date, mood: d.mood, hasJournal: !!d.journal });
  }
  return { events: list, days, error: events.error ?? entries.error };
}

export interface DayEntry {
  id: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  sleep_notes: string | null;
  journal: string | null;
  memory: string | null;
  gratitude: string[];
  accomplishments: { id: string; content: string; is_main: boolean; goal_id: string | null; imported: boolean }[];
  tags: string[];
  goal_ids: string[];
  event_ids: string[];
  memoryInArchive: boolean;
  attachments: { id: string; name: string; mime: string | null; url: string | null }[];
}

/** Todo lo de un día para el editor de la entrada diaria. */
export async function getDayEntry(supabase: SupabaseClient, date: string): Promise<DayEntry | null> {
  const { data: e } = await supabase
    .from("daily_entries")
    .select(`id, mood, energy, stress, sleep_hours, sleep_quality, sleep_notes, journal, memory,
      daily_gratitude(position, content),
      daily_accomplishments(id, content, is_main, goal_id, legacy_registro_id, created_at),
      daily_entry_tags(tags(name)),
      goal_daily_entries(goal_id),
      daily_entry_events(event_id)`)
    .eq("entry_date", date)
    .maybeSingle();
  if (!e) return null;

  const [mem, files] = await Promise.all([
    supabase.from("memories").select("id").eq("daily_entry_id", e.id).limit(1),
    supabase.from("attachments").select("id, file_name, mime_type, storage_path").eq("entity_type", "daily_entry").eq("entity_id", e.id).order("created_at"),
  ]);
  const paths = (files.data ?? []).map((f) => f.storage_path as string);
  const signed = paths.length ? (await supabase.storage.from("life-os").createSignedUrls(paths, 600)).data ?? [] : [];

  type Acc = { id: string; content: string; is_main: boolean; goal_id: string | null; legacy_registro_id: number | null; created_at: string };
  return {
    id: e.id,
    mood: e.mood,
    energy: e.energy,
    stress: e.stress,
    sleep_hours: e.sleep_hours == null ? null : Number(e.sleep_hours),
    sleep_quality: e.sleep_quality,
    sleep_notes: e.sleep_notes,
    journal: e.journal,
    memory: e.memory,
    gratitude: ((e.daily_gratitude ?? []) as { position: number; content: string }[]).sort((a, b) => a.position - b.position).map((g) => g.content),
    accomplishments: ((e.daily_accomplishments ?? []) as Acc[])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((a) => ({ id: a.id, content: a.content, is_main: a.is_main, goal_id: a.goal_id, imported: a.legacy_registro_id != null })),
    tags: ((e.daily_entry_tags ?? []) as unknown as { tags: { name: string } | null }[]).map((t) => t.tags?.name).filter((x): x is string => !!x),
    goal_ids: ((e.goal_daily_entries ?? []) as { goal_id: string }[]).map((g) => g.goal_id),
    event_ids: ((e.daily_entry_events ?? []) as { event_id: string }[]).map((x) => x.event_id),
    memoryInArchive: (mem.data?.length ?? 0) > 0,
    attachments: (files.data ?? []).map((f) => ({
      id: f.id,
      name: f.file_name,
      mime: f.mime_type,
      url: signed.find((s) => s.path === f.storage_path)?.signedUrl ?? null,
    })),
  };
}

export async function getGoalOptions(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("goals")
    .select("id, title, status")
    .in("status", ["not_started", "active", "paused"])
    .order("title");
  return (data ?? []) as { id: string; title: string; status: string }[];
}

export async function getTagNames(supabase: SupabaseClient) {
  const { data } = await supabase.from("tags").select("name").order("name").limit(200);
  return (data ?? []).map((t) => t.name as string);
}
