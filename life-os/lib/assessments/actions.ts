"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { assessmentSchema, type AssessmentInput } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().uuid();

export async function saveAssessment(input: AssessmentInput, id?: string): Promise<ActionResult> {
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const { supabase, user } = await requireUser();
  const row = { ...parsed.data, notes: parsed.data.notes || null };

  const { error } = id
    ? await supabase.from("life_assessments").update(row).eq("id", idSchema.parse(id)).eq("user_id", user.id)
    : await supabase.from("life_assessments").insert({ ...row, user_id: user.id });
  if (error) return { ok: false, error: "No se pudo guardar la autoevaluación." };

  revalidatePath("/overview");
  return { ok: true };
}

export async function deleteAssessment(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("life_assessments").delete().eq("id", idSchema.parse(id)).eq("user_id", user.id);
  if (error) return { ok: false, error: "No se pudo eliminar." };
  revalidatePath("/overview");
  return { ok: true };
}
