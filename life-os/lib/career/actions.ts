"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { zonedToUtc } from "@/lib/dates";
import {
  applicationSchema, interviewSchema, learningSchema, positionSchema, projectSchema, skillLevelSchema, skillSchema, STAGES,
  type ApplicationInput, type InterviewInput, type LearningInput, type PositionInput, type ProjectInput,
  type SkillInput, type SkillLevelInput, type Stage,
} from "./schema";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();
const issue = (e: z.ZodError) => ({ ok: false as const, error: e.issues[0]?.message ?? "Datos no válidos" });
const done = (): Result => {
  revalidatePath("/career");
  revalidatePath("/overview");
  return { ok: true };
};
/** Convierte "" en null en todos los campos de texto opcionales. */
const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === "" ? null : v])) as { [K in keyof T]: T[K] extends string ? T[K] | null : T[K] };

type Table = "career_positions" | "career_applications" | "application_interviews" | "skills" | "skill_levels" | "projects" | "learning_resources";

async function upsertRow(table: Table, row: Record<string, unknown>, id: string | undefined, msg: string, dupMsg?: string) {
  const { supabase, user } = await requireUser();
  const r = id
    ? await supabase.from(table).update(row).eq("id", uuid.parse(id)).eq("user_id", user.id).select("id").single()
    : await supabase.from(table).insert({ ...row, user_id: user.id }).select("id").single();
  if (r.error || !r.data) return { ok: false as const, error: r.error?.code === "23505" && dupMsg ? dupMsg : msg };
  return { ok: true as const, id: r.data.id as string, supabase, userId: user.id };
}

async function remove(table: Table, id: string, msg: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const r = await supabase.from(table).delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: msg };
  return done();
}

// Cargos y salario
export async function savePosition(input: PositionInput, id?: string): Promise<Result> {
  const p = positionSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const r = await upsertRow("career_positions", clean(p.data), id, "No se pudo guardar el cargo.");
  return r.ok ? done() : r;
}
export async function deletePosition(id: string) {
  return remove("career_positions", id, "No se pudo eliminar el cargo.");
}

// Aplicaciones
export async function saveApplication(input: ApplicationInput, id?: string): Promise<Result> {
  const p = applicationSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const r = await upsertRow("career_applications", clean(p.data), id, "No se pudo guardar la aplicación.");
  return r.ok ? done() : r;
}
export async function setApplicationStage(id: string, stage: Stage): Promise<Result> {
  if (!(stage in STAGES)) return { ok: false, error: "Etapa no válida" };
  const { supabase, user } = await requireUser();
  const r = await supabase.from("career_applications").update({ stage }).eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "No se pudo cambiar la etapa." };
  return done();
}
export async function deleteApplication(id: string) {
  return remove("career_applications", id, "No se pudo eliminar la aplicación.");
}
export async function saveInterview(input: InterviewInput): Promise<Result> {
  const p = interviewSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const { timeZone } = await getPrefs(supabase, user.id);
  const r = await supabase.from("application_interviews").insert({
    user_id: user.id,
    application_id: p.data.application_id,
    kind: p.data.kind || null,
    notes: p.data.notes || null,
    scheduled_at: zonedToUtc(p.data.date, p.data.time, timeZone),
  });
  if (r.error) return { ok: false, error: "No se pudo guardar la entrevista." };
  return done();
}
export async function deleteInterview(id: string) {
  return remove("application_interviews", id, "No se pudo eliminar la entrevista.");
}

// Skills
export async function saveSkill(input: SkillInput, id?: string): Promise<Result> {
  const p = skillSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const r = await upsertRow("skills", clean(p.data), id, "No se pudo guardar la skill.", "Ya tienes una skill con ese nombre.");
  return r.ok ? done() : r;
}
export async function deleteSkill(id: string) {
  return remove("skills", id, "No se pudo eliminar la skill.");
}
/** Agrega un nivel al historial. El nivel actual es siempre el más reciente. */
export async function addSkillLevel(input: SkillLevelInput): Promise<Result> {
  const p = skillLevelSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const r = await supabase.from("skill_levels").insert({ ...p.data, notes: p.data.notes || null, user_id: user.id });
  if (r.error) return { ok: false, error: "No se pudo guardar el nivel." };
  const { data: skill } = await supabase.from("skills").select("last_practiced_on").eq("id", p.data.skill_id).maybeSingle();
  if (!skill?.last_practiced_on || skill.last_practiced_on < p.data.assessed_on)
    await supabase.from("skills").update({ last_practiced_on: p.data.assessed_on }).eq("id", p.data.skill_id).eq("user_id", user.id);
  return done();
}
export async function deleteSkillLevel(id: string) {
  return remove("skill_levels", id, "No se pudo eliminar el registro.");
}

// Proyectos
export async function saveProject(input: ProjectInput, id?: string): Promise<Result> {
  const p = projectSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { skill_ids, technologies, ...rest } = p.data;
  const techs = [...new Set((technologies ?? "").split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 30);
  const r = await upsertRow("projects", { ...clean(rest), technologies: techs }, id, "No se pudo guardar el proyecto.");
  if (!r.ok) return r;
  const d = await r.supabase.from("project_skills").delete().eq("project_id", r.id);
  if (d.error) return { ok: false, error: "El proyecto se guardó, pero no sus skills." };
  if (skill_ids.length) {
    const ins = await r.supabase.from("project_skills").insert([...new Set(skill_ids)].map((s) => ({ project_id: r.id, skill_id: s, user_id: r.userId })));
    if (ins.error) return { ok: false, error: "El proyecto se guardó, pero no sus skills." };
  }
  return done();
}
export async function deleteProject(id: string) {
  return remove("projects", id, "No se pudo eliminar el proyecto.");
}

// Aprendizaje
export async function saveLearning(input: LearningInput, id?: string): Promise<Result> {
  const p = learningSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const r = await upsertRow("learning_resources", clean(p.data), id, "No se pudo guardar.");
  return r.ok ? done() : r;
}
export async function deleteLearning(id: string) {
  return remove("learning_resources", id, "No se pudo eliminar.");
}
