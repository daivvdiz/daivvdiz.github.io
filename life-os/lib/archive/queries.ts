import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeAssessment } from "@/lib/types";
import { WORKOUT_TYPES } from "@/lib/types";
import { utcToZoned } from "@/lib/dates";
import type { AttachmentFile } from "@/components/calendar/attachments";
import type { MemoryCategory } from "./schema";

export interface Memory {
  id: string;
  title: string;
  occurred_on: string;
  description: string | null;
  category: MemoryCategory;
  location: string | null;
  emotional_context: string | null;
  importance: number | null;
  chapter: string | null;
  goal_id: string | null;
  event_id: string | null;
  project_id: string | null;
  workout_id: string | null;
  daily_entry_id: string | null;
  people: string[];
  tags: string[];
  files: AttachmentFile[];
}
/** Recuerdo escrito en el diario que aún no está en el Archivo. */
export interface DailyMemory {
  entryId: string;
  date: string;
  text: string;
}
export type Option = { id: string; label: string };

export async function getArchiveData(supabase: SupabaseClient, timeZone: string) {
  const [memories, files, daily, assessments, goals, projects, events, workouts] = await Promise.all([
    supabase.from("memories")
      .select("id, title, occurred_on, description, category, location, emotional_context, importance, chapter, goal_id, event_id, project_id, workout_id, daily_entry_id, created_at, memory_people(name), memory_tags(tags(name))")
      .order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("attachments").select("id, entity_id, file_name, mime_type, storage_path, created_at").eq("entity_type", "memory").order("created_at"),
    supabase.from("daily_entries").select("id, entry_date, memory").not("memory", "is", null).order("entry_date", { ascending: false }),
    supabase.from("life_assessments")
      .select("id, assessed_on, professional, financial, physical, emotional, social, intellectual, notes")
      .order("assessed_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("goals").select("id, title").order("title"),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("calendar_events").select("id, title, starts_at").order("starts_at", { ascending: false }).limit(500),
    supabase.from("workouts").select("id, performed_on, activity_type").order("performed_on", { ascending: false }).limit(500),
  ]);
  const error = memories.error || files.error;

  // URLs firmadas de corta duración: el bucket es privado.
  const paths = (files.data ?? []).map((f) => f.storage_path as string);
  const signed = paths.length ? (await supabase.storage.from("life-os").createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const filesBy = new Map<string, AttachmentFile[]>();
  for (const f of files.data ?? []) {
    const list = filesBy.get(f.entity_id as string) ?? [];
    list.push({ id: f.id, name: f.file_name, mime: f.mime_type, url: urlOf.get(f.storage_path as string) ?? null });
    filesBy.set(f.entity_id as string, list);
  }

  type Raw = Omit<Memory, "people" | "tags" | "files"> & { memory_people: { name: string }[] | null; memory_tags: { tags: { name: string } | null }[] | null };
  const ms: Memory[] = ((memories.data ?? []) as unknown as Raw[]).map(({ memory_people, memory_tags, ...m }) => ({
    ...m,
    people: (memory_people ?? []).map((p) => p.name),
    tags: (memory_tags ?? []).map((t) => t.tags?.name).filter((x): x is string => !!x),
    files: filesBy.get(m.id) ?? [],
  })).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));

  const archivedEntries = new Set(ms.map((m) => m.daily_entry_id).filter(Boolean));
  const dailyMemories: DailyMemory[] = (daily.data ?? [])
    .filter((d) => (d.memory as string | null)?.trim() && !archivedEntries.has(d.id))
    .map((d) => ({ entryId: d.id, date: d.entry_date, text: (d.memory as string).trim() }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const options = {
    goals: (goals.data ?? []).map((g) => ({ id: g.id, label: g.title })) as Option[],
    projects: (projects.data ?? []).map((p) => ({ id: p.id, label: p.name })) as Option[],
    events: (events.data ?? []).map((e) => ({ id: e.id, label: `${utcToZoned(e.starts_at as string, timeZone).date} · ${e.title}` })) as Option[],
    workouts: (workouts.data ?? []).map((w) => ({ id: w.id, label: `${w.performed_on} · ${WORKOUT_TYPES[w.activity_type as string] ?? w.activity_type}` })) as Option[],
  };

  return {
    error,
    memories: ms,
    dailyMemories,
    assessments: (assessments.data ?? []) as LifeAssessment[],
    options,
  };
}
