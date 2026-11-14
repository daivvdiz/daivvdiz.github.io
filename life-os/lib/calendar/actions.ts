"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { addDays, zonedToUtc } from "@/lib/dates";
import { eventSchema, type EventInput } from "./schema";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();

export async function saveEvent(input: EventInput, id?: string): Promise<Result> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const v = parsed.data;
  const { supabase, user } = await requireUser();
  const { timeZone } = await getPrefs(supabase, user.id);

  // Un evento de todo el día va de 00:00 a 00:00 del día siguiente en tu zona horaria.
  const starts_at = zonedToUtc(v.date, v.all_day ? "00:00" : v.start_time!, timeZone);
  const ends_at = v.all_day
    ? zonedToUtc(addDays(v.date, 1), "00:00", timeZone)
    : v.end_time
      ? zonedToUtc(v.date, v.end_time, timeZone)
      : null;

  const row = {
    title: v.title,
    description: v.description || null,
    category: v.category,
    starts_at,
    ends_at,
    all_day: v.all_day,
    location: v.location || null,
    goal_id: v.goal_id || null,
  };

  const { error } = id
    ? await supabase.from("calendar_events").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("calendar_events").insert({ ...row, user_id: user.id });
  if (error) return { ok: false, error: "No se pudo guardar el evento." };

  revalidatePath("/calendar");
  revalidatePath("/overview");
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("calendar_events").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (error) return { ok: false, error: "No se pudo eliminar el evento." };
  revalidatePath("/calendar");
  revalidatePath("/overview");
  return { ok: true };
}
