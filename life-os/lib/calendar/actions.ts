"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { addDays, daysBetween, isISODate, utcToZoned, zonedToUtc } from "@/lib/dates";
import { eventSchema, ruleFromInput, type EventInput } from "./schema";
import { countBefore, lastOccurrence, occurrences, shiftDates, type Recurrence } from "./recurrence";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();
/** Alcance al cambiar un evento que se repite, como en Google Calendar. */
export type Scope = "this" | "following" | "all";

const MIGRATION_HINT = "To save repeating events, first run the migration supabase/migrations/20261117000100_recurring_events.sql in Supabase → SQL Editor.";
const missingColumn = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42703" || e.code === "PGRST204" || /recurrence/.test(e.message ?? ""));

type Master = {
  id: string; starts_at: string; ends_at: string | null; all_day: boolean;
  recurrence: Recurrence | null; recurrence_until: string | null; recurrence_exceptions: string[] | null;
};

async function loadMaster(supabase: SupabaseClient, id: string, userId: string) {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, starts_at, ends_at, all_day, recurrence, recurrence_until, recurrence_exceptions")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  return { master: (data as Master | null) ?? null, error };
}

function done(): Result {
  revalidatePath("/calendar");
  revalidatePath("/overview");
  revalidatePath("/analytics");
  return { ok: true };
}

export async function saveEvent(input: EventInput, id?: string, scope: Scope = "all", occurrence?: string): Promise<Result> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const v = parsed.data;
  const { supabase, user } = await requireUser();
  const { timeZone } = await getPrefs(supabase, user.id);
  const repeat = ruleFromInput(v);

  /** Fila para un evento que empieza en `date` (fecha local). */
  const rowFor = (date: string, rec: { rule: Recurrence; until: string | null } | null, exceptions: string[] = []) => {
    const starts_at = zonedToUtc(date, v.all_day ? "00:00" : v.start_time!, timeZone);
    // Un evento de todo el día va de 00:00 a 00:00 del día siguiente en tu zona horaria.
    const ends_at = v.all_day ? zonedToUtc(addDays(date, 1), "00:00", timeZone) : v.end_time ? zonedToUtc(date, v.end_time, timeZone) : null;
    const base = {
      title: v.title, description: v.description || null, category: v.category, starts_at, ends_at, all_day: v.all_day,
      location: v.location || null, goal_id: v.goal_id || null,
    };
    if (!rec) return { ...base, recurrence: null, recurrence_until: null, recurrence_exceptions: [] as string[] };
    const until = rec.rule.count ? lastOccurrence(date, rec.rule, rec.until) : rec.until;
    return { ...base, recurrence: rec.rule, recurrence_until: until, recurrence_exceptions: exceptions.filter((d) => d >= date && (!until || d <= until)) };
  };
  /** Sin la migración, un evento sin repetición se guarda como siempre. */
  const plain = <T extends Record<string, unknown>>(r: T) => {
    const { recurrence: _a, recurrence_until: _b, recurrence_exceptions: _c, ...rest } = r;
    return rest;
  };
  const write = async (op: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>, row: Record<string, unknown>) => {
    let { error } = await op(row);
    if (missingColumn(error)) {
      if (row.recurrence) return { ok: false as const, error: MIGRATION_HINT };
      ({ error } = await op(plain(row)));
    }
    return error ? { ok: false as const, error: "Couldn't save the event." } : null;
  };
  const insert = (row: Record<string, unknown>) => write((r) => supabase.from("calendar_events").insert({ ...r, user_id: user.id }), row);
  const update = (eventId: string, row: Record<string, unknown>) =>
    write((r) => supabase.from("calendar_events").update(r).eq("id", eventId).eq("user_id", user.id), row);

  if (!id) return (await insert(rowFor(v.date, repeat))) ?? done();

  const eventId = uuid.parse(id);
  const { master, error: loadError } = await loadMaster(supabase, eventId, user.id);
  // Sin la migración (o si no se repite): edición normal.
  if (loadError || !master?.recurrence) {
    if (loadError && !missingColumn(loadError)) return { ok: false, error: "Couldn't save the event." };
    return (await update(eventId, rowFor(v.date, repeat))) ?? done();
  }

  const seriesStart = utcToZoned(master.starts_at, timeZone).date;
  const occ = occurrence && isISODate(occurrence) ? occurrence : seriesStart;
  const exceptions = master.recurrence_exceptions ?? [];

  if (scope === "this") {
    // Se quita ese día de la serie y se guarda como evento aparte (sin repetición).
    const ex = await update(eventId, { recurrence_exceptions: [...new Set([...exceptions, occ])].sort() });
    if (ex) return ex;
    return (await insert(rowFor(v.date, null))) ?? done();
  }

  if (scope === "following" && countBefore(seriesStart, master.recurrence, occ) > 0) {
    // La serie original termina el día anterior; desde aquí empieza una serie nueva con los cambios.
    const oldRule = { ...master.recurrence, count: null };
    const cut = await update(eventId, { recurrence: oldRule, recurrence_until: addDays(occ, -1) });
    if (cut) return cut;
    let next = repeat;
    if (next?.rule.count && master.recurrence.count && next.rule.count === master.recurrence.count) {
      // Si no cambiaste "termina después de N", la serie nueva solo tiene las que faltaban.
      const left = master.recurrence.count - countBefore(seriesStart, master.recurrence, occ);
      next = { ...next, rule: { ...next.rule, count: Math.max(1, left) } };
    }
    const shift = daysBetween(occ, v.date);
    return (await insert(rowFor(v.date, next, shiftDates(exceptions.filter((d) => d >= occ), shift)))) ?? done();
  }

  // Todos los eventos: si moviste el día de esta repetición, toda la serie se mueve igual.
  const shift = daysBetween(occ, v.date);
  if (!repeat) return (await update(eventId, rowFor(v.date, null))) ?? done();
  return (await update(eventId, rowFor(addDays(seriesStart, shift), repeat, shiftDates(exceptions, shift)))) ?? done();
}

export async function deleteEvent(id: string, scope: Scope = "all", occurrence?: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const eventId = uuid.parse(id);
  const remove = async () => {
    const { error } = await supabase.from("calendar_events").delete().eq("id", eventId).eq("user_id", user.id);
    return error ? { ok: false as const, error: "Couldn't delete the event." } : done();
  };
  if (scope === "all") return remove();

  const { timeZone } = await getPrefs(supabase, user.id);
  const { master, error } = await loadMaster(supabase, eventId, user.id);
  if (error || !master?.recurrence || !occurrence || !isISODate(occurrence)) return remove();
  const seriesStart = utcToZoned(master.starts_at, timeZone).date;

  let patch: Record<string, unknown>;
  if (scope === "following") {
    if (countBefore(seriesStart, master.recurrence, occurrence) === 0) return remove();
    patch = { recurrence: { ...master.recurrence, count: null }, recurrence_until: addDays(occurrence, -1) };
  } else {
    const exceptions = [...new Set([...(master.recurrence_exceptions ?? []), occurrence])].sort();
    // Si ya no queda ninguna repetición, se elimina el evento.
    const left = occurrences(seriesStart, master.recurrence, { until: master.recurrence_until, exceptions, from: seriesStart, to: master.recurrence_until ?? addDays(occurrence, 3660) });
    if (!left.length && (master.recurrence.count || master.recurrence_until)) return remove();
    patch = { recurrence_exceptions: exceptions };
  }
  const { error: e2 } = await supabase.from("calendar_events").update(patch).eq("id", eventId).eq("user_id", user.id);
  return e2 ? { ok: false, error: "Couldn't delete the event." } : done();
}
