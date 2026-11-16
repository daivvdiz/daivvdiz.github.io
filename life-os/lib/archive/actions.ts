"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { memorySchema, splitList, type MemoryInput } from "./schema";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = z.string().uuid();
const nul = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
function revalidate() {
  revalidatePath("/archive");
  revalidatePath("/overview");
  revalidatePath("/calendar");
}

export async function saveMemory(input: MemoryInput, id?: string): Promise<Result<{ id: string }>> {
  const p = memorySchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid data" };
  const v = p.data;
  const { supabase, user } = await requireUser();

  let daily_entry_id: string | null = null;
  if (v.link_daily_entry) {
    const { data } = await supabase.from("daily_entries").select("id").eq("entry_date", v.occurred_on).maybeSingle();
    daily_entry_id = (data?.id as string | undefined) ?? null;
  }
  const row = {
    title: v.title, occurred_on: v.occurred_on, category: v.category, description: nul(v.description), location: nul(v.location),
    emotional_context: nul(v.emotional_context), importance: v.importance ? Number(v.importance) : null, chapter: nul(v.chapter),
    goal_id: v.goal_id || null, event_id: v.event_id || null, project_id: v.project_id || null, workout_id: v.workout_id || null, daily_entry_id,
  };
  const r = id
    ? await supabase.from("memories").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id).select("id").single()
    : await supabase.from("memories").insert({ ...row, user_id: user.id }).select("id").single();
  if (r.error || !r.data) return { ok: false, error: "Couldn't save the memory." };
  const memoryId = id ? uuid.parse(id) : (r.data.id as string);

  // Personas y etiquetas: se reemplazan por lo que quedó en el formulario.
  await supabase.from("memory_people").delete().eq("memory_id", memoryId).eq("user_id", user.id);
  const people = splitList(v.people, 100);
  if (people.length) {
    const ins = await supabase.from("memory_people").insert(people.map((name) => ({ user_id: user.id, memory_id: memoryId, name })));
    if (ins.error) return { ok: false, error: "The memory was saved, but not the people." };
  }
  await supabase.from("memory_tags").delete().eq("memory_id", memoryId).eq("user_id", user.id);
  const tags = splitList(v.tags);
  if (tags.length) {
    await supabase.from("tags").upsert(tags.map((name) => ({ user_id: user.id, name })), { onConflict: "user_id,name", ignoreDuplicates: true });
    const { data: rows } = await supabase.from("tags").select("id").eq("user_id", user.id).in("name", tags);
    if (rows?.length) {
      const ins = await supabase.from("memory_tags").insert(rows.map((t) => ({ user_id: user.id, memory_id: memoryId, tag_id: t.id })));
      if (ins.error) return { ok: false, error: "The memory was saved, but not the tags." };
    }
  }
  revalidate();
  return { ok: true, id: memoryId };
}

export async function deleteMemory(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const memoryId = uuid.parse(id);
  const { data: files } = await supabase.from("attachments").select("id, storage_path").eq("entity_type", "memory").eq("entity_id", memoryId);
  if (files?.length) {
    const rm = await supabase.storage.from("life-os").remove(files.map((f) => f.storage_path as string));
    if (rm.error) return { ok: false, error: "Couldn't delete its files; the memory wasn't deleted." };
    await supabase.from("attachments").delete().in("id", files.map((f) => f.id as string));
  }
  const r = await supabase.from("memories").delete().eq("id", memoryId).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "Couldn't delete the memory." };
  revalidate();
  return { ok: true };
}

/** Pasa el recuerdo escrito en el diario de un día al Archivo, sin copiarlo dos veces. */
export async function archiveDailyMemory(entryId: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const { data: e } = await supabase.from("daily_entries").select("id, entry_date, memory").eq("id", uuid.parse(entryId)).maybeSingle();
  const text = (e?.memory as string | null)?.trim();
  if (!e || !text) return { ok: false, error: "That entry has no memory." };
  const { data: linked } = await supabase.from("memories").select("id").eq("daily_entry_id", e.id).limit(1).maybeSingle();
  if (!linked) {
    const r = await supabase.from("memories").insert({
      user_id: user.id, title: text.split("\n")[0].slice(0, 120), occurred_on: e.entry_date, description: text, category: "personal", daily_entry_id: e.id,
    });
    if (r.error) return { ok: false, error: "Couldn't save it to the Archive." };
  }
  revalidate();
  return { ok: true };
}

const fileSchema = z.object({
  memoryId: z.string().uuid(),
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  mime: z.string().max(120),
  size: z.number().int().nonnegative().max(10 * 1024 * 1024),
});

/** Registra un archivo que el navegador ya subió al bucket privado. */
export async function registerMemoryAttachment(input: z.infer<typeof fileSchema>): Promise<Result> {
  const p = fileSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid file" };
  const v = p.data;
  const { supabase, user } = await requireUser();
  if (!v.path.startsWith(`${user.id}/memories/${v.memoryId}/`)) return { ok: false, error: "Invalid path" };
  const { data: m } = await supabase.from("memories").select("id").eq("id", v.memoryId).maybeSingle();
  if (!m) return { ok: false, error: "The memory doesn't exist" };
  const { error } = await supabase.from("attachments").insert({
    user_id: user.id, entity_type: "memory", entity_id: v.memoryId, bucket: "life-os",
    storage_path: v.path, file_name: v.name, mime_type: v.mime || null, size_bytes: v.size,
  });
  if (error) return { ok: false, error: "Couldn't save the file." };
  revalidatePath("/archive");
  return { ok: true };
}

export async function deleteMemoryAttachment(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: file } = await supabase.from("attachments").select("id, storage_path").eq("id", uuid.parse(id)).eq("entity_type", "memory").maybeSingle();
  if (!file) return { ok: false, error: "The file doesn't exist" };
  const rm = await supabase.storage.from("life-os").remove([file.storage_path as string]);
  if (rm.error) return { ok: false, error: "Couldn't delete the file." };
  await supabase.from("attachments").delete().eq("id", file.id);
  revalidatePath("/archive");
  return { ok: true };
}
