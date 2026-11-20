"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { isMissing } from "./queries";
import { renameSchema, tripSchema, type RenameInput, type TripInput } from "./schema";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();
const MISSING = "The Market tables haven't been created in Supabase yet. Run the 20261120000100_market.sql migration.";
const done = (): Result => {
  revalidatePath("/market");
  return { ok: true };
};

export async function saveTrip(input: TripInput, id?: string): Promise<Result> {
  const p = tripSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid data" };
  const v = p.data;
  const { supabase } = await requireUser();
  const r = await supabase.rpc("save_market_trip", {
    p_id: id ? uuid.parse(id) : null,
    p_trip_date: v.trip_date,
    p_store: v.store?.trim() || null,
    p_notes: v.notes?.trim() || null,
    p_items: v.items.map((i) => ({ name: i.name.trim(), quantity: i.quantity, unit_price: i.unit_price })),
  });
  if (r.error) return { ok: false, error: isMissing(r.error.code) ? MISSING : "Couldn't save the market." };
  return done();
}

export async function deleteTrip(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const r = await supabase.rpc("delete_market_trip", { p_id: uuid.parse(id) });
  if (r.error) return { ok: false, error: isMissing(r.error.code) ? MISSING : "Couldn't delete the market." };
  return done();
}

export async function renameProduct(id: string, input: RenameInput): Promise<Result> {
  const p = renameSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid data" };
  const { supabase } = await requireUser();
  const r = await supabase.rpc("rename_market_product", { p_id: uuid.parse(id), p_name: p.data.name });
  if (r.error) return { ok: false, error: isMissing(r.error.code) ? MISSING : "Couldn't rename the product." };
  return done();
}
