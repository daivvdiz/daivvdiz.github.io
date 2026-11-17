import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/dates";
import { occurrences, type Recurrence } from "./recurrence";

export interface CalEvent {
  /** Id del evento guardado (en una serie, el mismo para todas las repeticiones) */
  id: string;
  /** Clave única para la interfaz: id + fecha de la repetición */
  key: string;
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
  /** Repetición (null si es un evento único) */
  recurrence: Recurrence | null;
  recurrence_until: string | null;
  /** Fecha local en que empieza la serie */
  series_start: string;
}

export interface DaySummary {
  date: string;
  mood: number | null;
  hasJournal: boolean;
}

const BASE = "id, title, description, category, starts_at, ends_at, all_day, location, goal_id";
const FULL = `${BASE}, recurrence, recurrence_until, recurrence_exceptions`;
type Row = {
  id: string; title: string; description: string | null; category: string; starts_at: string; ends_at: string | null; all_day: boolean;
  location: string | null; goal_id: string | null; recurrence?: Recurrence | null; recurrence_until?: string | null; recurrence_exceptions?: string[] | null;
};
/** Si aún no se ejecutó la migración de eventos repetidos, las columnas nuevas no existen. */
const missingColumn = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42703" || e.code === "PGRST204" || /recurrence/.test(e.message ?? ""));

/**
 * Eventos (con sus repeticiones ya expandidas) entre dos fechas locales, inclusive.
 * Los eventos únicos se filtran en la base de datos; las series se traen enteras y se expanden aquí.
 */
export async function fetchEvents(
  supabase: SupabaseClient,
  range: { start: string; end: string },
  timeZone: string,
  categories: string[] | null = null,
): Promise<{ events: CalEvent[]; error: unknown; recurrenceReady: boolean }> {
  const from = zonedToUtc(range.start, "00:00", timeZone);
  const to = zonedToUtc(addDays(range.end, 1), "00:00", timeZone);
  const singles = (cols: string) => {
    let q = supabase.from("calendar_events").select(cols).gte("starts_at", from).lt("starts_at", to).order("starts_at");
    if (categories?.length) q = q.in("category", categories);
    return q;
  };
  let recurrenceReady = true;
  let first = await singles(FULL);
  if (missingColumn(first.error)) {
    recurrenceReady = false;
    first = await singles(BASE);
  }
  let series: Row[] = [];
  let seriesError: unknown = null;
  if (recurrenceReady) {
    let q = supabase.from("calendar_events").select(FULL).not("recurrence", "is", null).lt("starts_at", to);
    if (categories?.length) q = q.in("category", categories);
    const r = await q;
    seriesError = r.error;
    series = ((r.data ?? []) as unknown as Row[]).filter((e) => !e.recurrence_until || e.recurrence_until >= range.start);
  }

  const out: CalEvent[] = [];
  const toEvent = (e: Row, starts_at: string, ends_at: string | null, seriesStart: string): CalEvent => {
    const s = utcToZoned(starts_at, timeZone);
    return {
      id: e.id, key: `${e.id}:${s.date}`, title: e.title, description: e.description, category: e.category, starts_at, ends_at,
      all_day: e.all_day, location: e.location, goal_id: e.goal_id,
      date: s.date, start_time: s.time, end_time: ends_at && !e.all_day ? utcToZoned(ends_at, timeZone).time : null,
      recurrence: e.recurrence ?? null, recurrence_until: e.recurrence_until ?? null, series_start: seriesStart,
    };
  };
  for (const e of (first.data ?? []) as unknown as Row[]) {
    if (e.recurrence) continue; // las series se expanden abajo
    out.push(toEvent(e, e.starts_at, e.ends_at, utcToZoned(e.starts_at, timeZone).date));
  }
  for (const e of series) {
    const s = utcToZoned(e.starts_at, timeZone);
    const duration = e.ends_at ? Date.parse(e.ends_at) - Date.parse(e.starts_at) : null;
    const dates = occurrences(s.date, e.recurrence!, { until: e.recurrence_until, exceptions: e.recurrence_exceptions ?? [], from: range.start, to: range.end });
    for (const d of dates) {
      // Cada repetición conserva la hora local (aunque cambie el horario de verano).
      const starts_at = zonedToUtc(d, e.all_day ? "00:00" : s.time, timeZone);
      const ends_at = e.all_day
        ? zonedToUtc(addDays(d, Math.max(1, Math.round((duration ?? 864e5) / 864e5))), "00:00", timeZone)
        : duration != null ? new Date(Date.parse(starts_at) + duration).toISOString() : null;
      out.push(toEvent(e, starts_at, ends_at, s.date));
    }
  }
  out.sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.title.localeCompare(b.title));
  return { events: out, error: first.error ?? seriesError, recurrenceReady };
}

export async function getCalendarData(
  supabase: SupabaseClient,
  range: { start: string; end: string },
  timeZone: string,
  categories: string[] | null,
) {
  const [ev, entries] = await Promise.all([
    fetchEvents(supabase, range, timeZone, categories),
    supabase.from("daily_entries").select("entry_date, mood, journal").gte("entry_date", range.start).lte("entry_date", range.end),
  ]);

  const days = new Map<string, DaySummary>();
  for (const d of entries.data ?? []) {
    days.set(d.entry_date, { date: d.entry_date, mood: d.mood, hasJournal: !!d.journal });
  }
  return { events: ev.events, days, error: ev.error ?? entries.error, recurrenceReady: ev.recurrenceReady };
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
