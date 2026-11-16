import type { SupabaseClient } from "@supabase/supabase-js";
import type { Exam } from "./schema";

const num = (v: unknown) => (v == null ? null : Number(v));
export const EXAM_COLUMNS = "id, taken_on, exam, subject, score, max_score, level, total_questions, correct, incorrect, duration_seconds, notes";

export const toExam = (r: Record<string, unknown>): Exam => ({
  id: r.id as string, taken_on: r.taken_on as string, exam: r.exam as string, subject: (r.subject as string | null) ?? null,
  score: num(r.score), max_score: num(r.max_score), level: (r.level as string | null) ?? null,
  total_questions: num(r.total_questions), correct: num(r.correct), incorrect: num(r.incorrect),
  duration_seconds: num(r.duration_seconds), notes: (r.notes as string | null) ?? null,
});

/** Simulacros, del más reciente al más antiguo. `missing` indica que aún no se ejecutó la migración. */
export async function getExams(supabase: SupabaseClient) {
  const r = await supabase.from("study_exams").select(EXAM_COLUMNS).order("taken_on", { ascending: false }).order("created_at", { ascending: false });
  const missing = r.error?.code === "42P01" || r.error?.code === "PGRST205";
  const exams = (r.data ?? []).map(toExam).sort((a, b) => (a.taken_on < b.taken_on ? 1 : a.taken_on > b.taken_on ? -1 : 0));
  return { exams, missing, error: missing ? null : r.error };
}
