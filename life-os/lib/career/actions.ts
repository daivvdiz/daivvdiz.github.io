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
const issue = (e: z.ZodError) => ({ ok: false as const, error: e.issues[0]?.message ?? "Invalid data" });
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
  const r = await upsertRow("career_positions", clean(p.data), id, "Couldn't save the position.");
  return r.ok ? done() : r;
}
export async function deletePosition(id: string) {
  return remove("career_positions", id, "Couldn't delete the position.");
}

// Aplicaciones
export async function saveApplication(input: ApplicationInput, id?: string): Promise<Result> {
  const p = applicationSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const r = await upsertRow("career_applications", clean(p.data), id, "Couldn't save the application.");
  return r.ok ? done() : r;
}
export async function setApplicationStage(id: string, stage: Stage): Promise<Result> {
  if (!(stage in STAGES)) return { ok: false, error: "Invalid stage" };
  const { supabase, user } = await requireUser();
  const r = await supabase.from("career_applications").update({ stage }).eq("id", uuid.parse(id)).eq("user_id", user.id);
  if (r.error) return { ok: false, error: "Couldn't change the stage." };
  return done();
}
export async function deleteApplication(id: string) {
  return remove("career_applications", id, "Couldn't delete the application.");
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
  if (r.error) return { ok: false, error: "Couldn't save the interview." };
  return done();
}
export async function deleteInterview(id: string) {
  return remove("application_interviews", id, "Couldn't delete the interview.");
}

// Skills
export async function saveSkill(input: SkillInput, id?: string): Promise<Result> {
  const p = skillSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const r = await upsertRow("skills", clean(p.data), id, "Couldn't save the skill.", "You already have a skill with that name.");
  return r.ok ? done() : r;
}
export async function deleteSkill(id: string) {
  return remove("skills", id, "Couldn't delete the skill.");
}
/** Agrega un nivel al historial. El nivel actual es siempre el más reciente. */
export async function addSkillLevel(input: SkillLevelInput): Promise<Result> {
  const p = skillLevelSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { supabase, user } = await requireUser();
  const r = await supabase.from("skill_levels").insert({ ...p.data, notes: p.data.notes || null, user_id: user.id });
  if (r.error) return { ok: false, error: "Couldn't save the level." };
  const { data: skill } = await supabase.from("skills").select("last_practiced_on").eq("id", p.data.skill_id).maybeSingle();
  if (!skill?.last_practiced_on || skill.last_practiced_on < p.data.assessed_on)
    await supabase.from("skills").update({ last_practiced_on: p.data.assessed_on }).eq("id", p.data.skill_id).eq("user_id", user.id);
  return done();
}
export async function deleteSkillLevel(id: string) {
  return remove("skill_levels", id, "Couldn't delete the entry.");
}

// Proyectos
export async function saveProject(input: ProjectInput, id?: string): Promise<Result> {
  const p = projectSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const { skill_ids, technologies, ...rest } = p.data;
  const techs = [...new Set((technologies ?? "").split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 30);
  const r = await upsertRow("projects", { ...clean(rest), technologies: techs }, id, "Couldn't save the project.");
  if (!r.ok) return r;
  const d = await r.supabase.from("project_skills").delete().eq("project_id", r.id);
  if (d.error) return { ok: false, error: "The project was saved, but not its skills." };
  if (skill_ids.length) {
    const ins = await r.supabase.from("project_skills").insert([...new Set(skill_ids)].map((s) => ({ project_id: r.id, skill_id: s, user_id: r.userId })));
    if (ins.error) return { ok: false, error: "The project was saved, but not its skills." };
  }
  return done();
}
export async function deleteProject(id: string) {
  return remove("projects", id, "Couldn't delete the project.");
}

// Aprendizaje
export async function saveLearning(input: LearningInput, id?: string): Promise<Result> {
  const p = learningSchema.safeParse(input);
  if (!p.success) return issue(p.error);
  const r = await upsertRow("learning_resources", clean(p.data), id, "Couldn't save it.");
  return r.ok ? done() : r;
}
export async function deleteLearning(id: string) {
  return remove("learning_resources", id, "Couldn't delete it.");
}
