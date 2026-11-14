"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { dailyEntrySchema, type DailyEntryInput } from "./schema";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = z.string().uuid();

function revalidate() {
  revalidatePath("/calendar");
  revalidatePath("/overview");
}

/**
 * Guarda la entrada del día y todo lo que cuelga de ella. Los datos (ánimo, sueño, logros…)
 * viven solo aquí y los demás módulos los leen de estas tablas, sin copiarlos.
 */
export async function saveDailyEntry(input: DailyEntryInput): Promise<Result<{ id: string }>> {
  const parsed = dailyEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const v = parsed.data;
  const { supabase, user } = await requireUser();
  const fail = (msg: string) => ({ ok: false as const, error: msg });

  const { data: entry, error } = await supabase
    .from("daily_entries")
    .upsert(
      {
        user_id: user.id,
        entry_date: v.entry_date,
        mood: v.mood,
        energy: v.energy,
        stress: v.stress,
        sleep_hours: v.sleep_hours,
        sleep_quality: v.sleep_quality,
        sleep_notes: v.sleep_notes || null,
        journal: v.journal.trim() || null,
        memory: v.memory.trim() || null,
      },
      { onConflict: "user_id,entry_date" },
    )
    .select("id")
    .single();
  if (error || !entry) return fail("No se pudo guardar la entrada.");
  const entryId = entry.id as string;

  // Gratitud: se reemplaza completa (máximo 3, en orden).
  const gratitude = v.gratitude.filter(Boolean);
  const g1 = await supabase.from("daily_gratitude").delete().eq("daily_entry_id", entryId);
  if (g1.error) return fail("No se pudo guardar la gratitud.");
  if (gratitude.length) {
    const g2 = await supabase.from("daily_gratitude").insert(
      gratitude.map((content, i) => ({ user_id: user.id, daily_entry_id: entryId, position: i + 1, content })),
    );
    if (g2.error) return fail("No se pudo guardar la gratitud.");
  }

  // Solo se aceptan metas y eventos propios.
  const goalIds = [...new Set([...v.goal_ids, ...v.accomplishments.map((a) => a.goal_id).filter((x): x is string => !!x)])];
  const ownGoals = goalIds.length
    ? new Set(((await supabase.from("goals").select("id").in("id", goalIds)).data ?? []).map((g) => g.id as string))
    : new Set<string>();
  const ownEvents = v.event_ids.length
    ? ((await supabase.from("calendar_events").select("id").in("id", v.event_ids)).data ?? []).map((e) => e.id as string)
    : [];

  // Logros: actualiza los existentes, crea los nuevos y elimina los que quitaste.
  const { data: existing } = await supabase.from("daily_accomplishments").select("id").eq("daily_entry_id", entryId);
  const keep = new Set(v.accomplishments.map((a) => a.id).filter(Boolean));
  const toDelete = (existing ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
  if (toDelete.length) {
    const d = await supabase.from("daily_accomplishments").delete().in("id", toDelete);
    if (d.error) return fail("No se pudieron actualizar los logros.");
  }
  const hasMain = v.accomplishments.some((a) => a.is_main);
  for (const [i, a] of v.accomplishments.entries()) {
    const row = {
      content: a.content,
      is_main: hasMain ? a.is_main : i === 0,
      goal_id: a.goal_id && ownGoals.has(a.goal_id) ? a.goal_id : null,
    };
    const r = a.id
      ? await supabase.from("daily_accomplishments").update(row).eq("id", a.id).eq("daily_entry_id", entryId)
      : await supabase.from("daily_accomplishments").insert({ ...row, user_id: user.id, daily_entry_id: entryId });
    if (r.error) return fail("No se pudieron guardar los logros.");
  }

  // Etiquetas: se crean si no existen y se enlazan.
  const names = [...new Map(v.tag_names.map((n) => [n.toLowerCase(), n])).values()];
  await supabase.from("daily_entry_tags").delete().eq("daily_entry_id", entryId);
  if (names.length) {
    await supabase.from("tags").upsert(names.map((name) => ({ user_id: user.id, name })), { onConflict: "user_id,name", ignoreDuplicates: true });
    const { data: tags } = await supabase.from("tags").select("id").in("name", names);
    if (tags?.length) {
      const t = await supabase.from("daily_entry_tags").insert(tags.map((tg) => ({ user_id: user.id, daily_entry_id: entryId, tag_id: tg.id })));
      if (t.error) return fail("No se pudieron guardar las etiquetas.");
    }
  }

  // Metas y eventos relacionados.
  await supabase.from("goal_daily_entries").delete().eq("daily_entry_id", entryId);
  const linkedGoals = v.goal_ids.filter((id) => ownGoals.has(id));
  if (linkedGoals.length)
    await supabase.from("goal_daily_entries").insert(linkedGoals.map((goal_id) => ({ user_id: user.id, goal_id, daily_entry_id: entryId })));

  await supabase.from("daily_entry_events").delete().eq("daily_entry_id", entryId);
  if (ownEvents.length)
    await supabase.from("daily_entry_events").insert(ownEvents.map((event_id) => ({ user_id: user.id, event_id, daily_entry_id: entryId })));

  // Recuerdo del día → Archivo de vida, solo si tú lo eliges.
  const memoryText = v.memory.trim();
  if (v.preserve_memory && memoryText) {
    const { data: linked } = await supabase.from("memories").select("id").eq("daily_entry_id", entryId).limit(1).maybeSingle();
    const title = memoryText.split("\n")[0].slice(0, 120);
    const r = linked
      ? await supabase.from("memories").update({ description: memoryText }).eq("id", linked.id)
      : await supabase.from("memories").insert({
          user_id: user.id, title, occurred_on: v.entry_date, description: memoryText, category: "personal", daily_entry_id: entryId,
        });
    if (r.error) return fail("La entrada se guardó, pero no se pudo enviar el recuerdo al Archivo.");
  }

  revalidate();
  return { ok: true, id: entryId };
}

export async function deleteDailyEntry(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const entryId = uuid.parse(id);
  // Los adjuntos no tienen clave foránea: se borran aparte, incluido el archivo.
  const { data: files } = await supabase.from("attachments").select("id, bucket, storage_path").eq("entity_type", "daily_entry").eq("entity_id", entryId);
  if (files?.length) {
    await supabase.storage.from("life-os").remove(files.map((f) => f.storage_path as string));
    await supabase.from("attachments").delete().in("id", files.map((f) => f.id as string));
  }
  const { error } = await supabase.from("daily_entries").delete().eq("id", entryId).eq("user_id", user.id);
  if (error) return { ok: false, error: "No se pudo eliminar la entrada." };
  revalidate();
  return { ok: true };
}

const attachmentSchema = z.object({
  entryId: z.string().uuid(),
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  mime: z.string().max(120),
  size: z.number().int().nonnegative().max(10 * 1024 * 1024),
});

/** Registra un archivo que el navegador ya subió al bucket privado. */
export async function registerAttachment(input: z.infer<typeof attachmentSchema>): Promise<Result> {
  const v = attachmentSchema.parse(input);
  const { supabase, user } = await requireUser();
  if (!v.path.startsWith(`${user.id}/daily_entries/${v.entryId}/`)) return { ok: false, error: "Ruta no válida" };
  const { data: entry } = await supabase.from("daily_entries").select("id").eq("id", v.entryId).maybeSingle();
  if (!entry) return { ok: false, error: "La entrada no existe" };
  const { error } = await supabase.from("attachments").insert({
    user_id: user.id, entity_type: "daily_entry", entity_id: v.entryId, bucket: "life-os",
    storage_path: v.path, file_name: v.name, mime_type: v.mime || null, size_bytes: v.size,
  });
  if (error) return { ok: false, error: "No se pudo registrar el archivo." };
  revalidatePath("/calendar");
  return { ok: true };
}

export async function deleteAttachment(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: file } = await supabase.from("attachments").select("id, storage_path").eq("id", uuid.parse(id)).maybeSingle();
  if (!file) return { ok: false, error: "El archivo no existe" };
  const rm = await supabase.storage.from("life-os").remove([file.storage_path as string]);
  if (rm.error) return { ok: false, error: "No se pudo borrar el archivo." };
  await supabase.from("attachments").delete().eq("id", file.id);
  revalidatePath("/calendar");
  return { ok: true };
}
