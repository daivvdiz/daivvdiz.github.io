"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { examSchema, parseDuration, type ExamInput } from "./schema";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();
const nul = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const done = (): Result => {
  revalidatePath("/physical");
  revalidatePath("/analytics");
  return { ok: true };
};
const MISSING = "The practice exam table hasn't been created in Supabase yet. Run the 20261116000100_study_exams.sql migration.";
const missing = (code?: string) => code === "42P01" || code === "PGRST205";

export async function saveExam(input: ExamInput, id?: string): Promise<Result> {
  const p = examSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid data" };
  const v = p.data;
  const { supabase, user } = await requireUser();
  const row = {
    taken_on: v.taken_on, exam: v.exam.trim(), subject: nul(v.subject), score: v.score, max_score: v.max_score, level: nul(v.level),
    total_questions: v.total_questions, correct: v.correct, incorrect: v.incorrect, duration_seconds: parseDuration(v.duration), notes: nul(v.notes),
  };
  const r = id
    ? await supabase.from("study_exams").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id)
    : await supabase.from("study_exams").insert({ ...row, user_id: user.id });
  if (r.error) return { ok: false, error: missing(r.error.code) ? MISSING : "Couldn't save the practice exam." };
  return done();
}

export async function deleteExam(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from("study_exams").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "Couldn't delete the practice exam." };
  return done();
}
