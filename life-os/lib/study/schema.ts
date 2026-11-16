import { z } from "zod";
import { formatDuration, formatNumber } from "@/lib/format";
import { date, durationField, optNum, parseDuration, text } from "@/lib/physical/schema";

export const examSchema = z
  .object({
    taken_on: date,
    exam: z.string().trim().min(1, "Escribe el nombre del simulacro").max(120, "Máximo 120 caracteres"),
    subject: text(120),
    score: optNum(-100000, 100000),
    max_score: optNum(0.01, 100000),
    level: text(60),
    total_questions: optNum(1, 10000, { int: true }),
    correct: optNum(0, 10000, { int: true }),
    incorrect: optNum(0, 10000, { int: true }),
    duration: durationField,
    notes: text(2000),
  })
  .refine((v) => v.total_questions == null || (v.correct ?? 0) + (v.incorrect ?? 0) <= v.total_questions, {
    message: "Correctas más incorrectas no pueden superar las preguntas totales",
    path: ["incorrect"],
  })
  .refine((v) => v.score == null || v.max_score == null || v.score <= v.max_score, {
    message: "El puntaje no puede superar el máximo",
    path: ["score"],
  });
export type ExamInput = z.input<typeof examSchema>;

export interface Exam {
  id: string;
  taken_on: string;
  exam: string;
  subject: string | null;
  score: number | null;
  max_score: number | null;
  level: string | null;
  total_questions: number | null;
  correct: number | null;
  incorrect: number | null;
  duration_seconds: number | null;
  notes: string | null;
}

/** Cifras derivadas de un simulacro. Solo se calculan si están los datos necesarios. */
export function examStats(e: Exam) {
  const answered = e.correct != null || e.incorrect != null ? (e.correct ?? 0) + (e.incorrect ?? 0) : null;
  return {
    accuracy: e.total_questions && e.correct != null ? (e.correct / e.total_questions) * 100 : null,
    blank: e.total_questions != null && answered != null ? e.total_questions - answered : null,
    perQuestion: e.duration_seconds != null && e.total_questions ? e.duration_seconds / e.total_questions : null,
  };
}

const n0 = (v: number) => formatNumber(v, 0);
const fmtScore = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Una línea legible con lo que registraste; lo que falta no se muestra. */
export function examSummary(e: Exam) {
  const s = examStats(e);
  return [
    e.score != null && `Puntaje ${fmtScore(e.score)}${e.max_score != null ? ` de ${fmtScore(e.max_score)}` : ""}`,
    e.level && `Nivel ${e.level}`,
    e.correct != null && (e.total_questions ? `${n0(e.correct)} de ${n0(e.total_questions)} correctas (${n0(s.accuracy!)}%)` : `${n0(e.correct)} correctas`),
    e.correct == null && e.total_questions != null && `${n0(e.total_questions)} preguntas`,
    e.incorrect != null && plural(e.incorrect, "incorrecta", "incorrectas"),
    s.blank ? `${n0(s.blank)} sin responder` : null,
    e.duration_seconds != null && formatDuration(e.duration_seconds),
  ].filter(Boolean) as string[];
}

export { parseDuration };
