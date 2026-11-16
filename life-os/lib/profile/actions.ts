"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { profileSchema, type ProfileInput } from "./schema";

type Result = { ok: true } | { ok: false; error: string };

export async function saveProfile(input: ProfileInput): Promise<Result> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  try {
    Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone });
  } catch {
    return { ok: false, error: "Invalid time zone" };
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...parsed.data, full_name: parsed.data.full_name || null });
  if (error) return { ok: false, error: "Couldn't save your profile." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveAppearance(theme: "dark" | "light", accent: string): Promise<Result> {
  const t = z.enum(["dark", "light"]).parse(theme);
  const a = z.enum(["violet", "blue", "green", "amber"]).parse(accent);
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ theme: t, accent_color: a }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save the appearance settings." };
  return { ok: true };
}
