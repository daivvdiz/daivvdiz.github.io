import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Stage } from "./schema";

export interface Position { id: string; title: string; company: string | null; started_on: string; ended_on: string | null; monthly_salary: number | null; notes: string | null; imported: boolean }
export interface Interview { id: string; application_id: string; kind: string | null; scheduled_at: string; notes: string | null }
export interface Application {
  id: string; company: string; position: string; location: string | null; work_mode: "" | "onsite" | "hybrid" | "remote";
  salary_expectation: number | null; applied_on: string | null; stage: Stage; contact_person: string | null; job_url: string | null;
  technical_test: string | null; feedback: string | null; notes: string | null; updated_at: string; interviews: Interview[];
}
export interface SkillLevel { id: string; level: number; assessed_on: string; notes: string | null; imported: boolean }
export interface Skill {
  id: string; name: string; category: string; target_level: number | null; last_practiced_on: string | null; evidence: string | null;
  levels: SkillLevel[]; current: number | null; projects: number;
}
export interface Project {
  id: string; name: string; description: string | null; business_problem: string | null; technologies: string[]; results: string | null;
  repository_url: string | null; documentation_url: string | null; status: "idea" | "in_progress" | "completed" | "archived";
  completed_on: string | null; goal_id: string | null; skill_ids: string[];
}
export interface Learning {
  id: string; title: string; kind: "course" | "certification" | "objective" | "resource"; provider: string | null; url: string | null;
  progress: number; started_on: string | null; completed_on: string | null; skill_id: string | null;
}

const num = (v: unknown) => (v == null ? null : Number(v));

export async function getCareerData(supabase: SupabaseClient) {
  const [positions, apps, skills, levels, projects, learning, goals] = await Promise.all([
    supabase.from("career_positions").select("id, title, company, started_on, ended_on, monthly_salary, notes, legacy_registro_id").order("started_on", { ascending: false }),
    supabase.from("career_applications").select("*, application_interviews(id, application_id, kind, scheduled_at, notes)").order("updated_at", { ascending: false }),
    supabase.from("skills").select("id, name, category, target_level, last_practiced_on, evidence").order("name"),
    supabase.from("skill_levels").select("id, skill_id, level, assessed_on, notes, legacy_registro_id").order("assessed_on"),
    supabase.from("projects").select("*, project_skills(skill_id)").order("updated_at", { ascending: false }),
    supabase.from("learning_resources").select("id, title, kind, provider, url, progress, started_on, completed_on, skill_id").order("updated_at", { ascending: false }),
    supabase.from("goals").select("id, title").in("status", ["not_started", "active", "paused"]).order("title"),
  ]);

  const projectRows = ((projects.data ?? []) as (Omit<Project, "skill_ids"> & { project_skills: { skill_id: string }[] | null })[]).map(({ project_skills, ...p }) => ({
    ...p,
    technologies: p.technologies ?? [],
    skill_ids: (project_skills ?? []).map((s) => s.skill_id),
  })) as Project[];

  const levelsBySkill = new Map<string, SkillLevel[]>();
  for (const l of levels.data ?? []) {
    const arr = levelsBySkill.get(l.skill_id) ?? [];
    arr.push({ id: l.id, level: Number(l.level), assessed_on: l.assessed_on, notes: l.notes, imported: l.legacy_registro_id != null });
    levelsBySkill.set(l.skill_id, arr);
  }

  return {
    error: positions.error ?? apps.error ?? skills.error ?? projects.error ?? learning.error,
    positions: (positions.data ?? []).map(({ legacy_registro_id, ...p }) => ({ ...p, monthly_salary: num(p.monthly_salary), imported: legacy_registro_id != null }))
      .sort((a, b) => b.started_on.localeCompare(a.started_on)) as Position[],
    applications: (apps.data ?? []).map(({ application_interviews, ...a }) => ({
      ...a,
      work_mode: a.work_mode ?? "",
      salary_expectation: num(a.salary_expectation),
      interviews: ((application_interviews ?? []) as Interview[]).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at)),
    })) as Application[],
    skills: (skills.data ?? []).map((s) => {
      const lv = (levelsBySkill.get(s.id) ?? []).sort((a, b) => a.assessed_on.localeCompare(b.assessed_on));
      return { ...s, levels: lv, current: lv.length ? lv[lv.length - 1].level : null, projects: projectRows.filter((p) => p.skill_ids.includes(s.id)).length };
    }) as Skill[],
    projects: projectRows,
    learning: (learning.data ?? []) as Learning[],
    goals: (goals.data ?? []) as { id: string; title: string }[],
  };
}
