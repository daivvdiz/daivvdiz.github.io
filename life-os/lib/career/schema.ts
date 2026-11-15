import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const optDate = date.optional().or(z.literal(""));
const optUuid = z.string().uuid().optional().or(z.literal(""));
const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`).optional().or(z.literal(""));
const url = z.string().trim().max(500).url("Escribe un enlace completo (https://…)").optional().or(z.literal(""));
const money = z.number({ invalid_type_error: "Indica un valor" }).finite().min(0, "No puede ser negativo").max(999_999_999_999).nullable();
const required = (label: string, max = 200) => z.string().trim().min(1, `Escribe ${label}`).max(max, `Máximo ${max} caracteres`);
const enumOf = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

export const STAGES = {
  interested: "Interesado",
  applied: "Aplicado",
  recruiter_screen: "Entrevista con reclutador",
  technical_interview: "Entrevista técnica",
  final_interview: "Entrevista final",
  offer: "Oferta",
  rejected: "No continuó",
  withdrawn: "Me retiré",
} as const;
export type Stage = keyof typeof STAGES;
export const OPEN_STAGES: Stage[] = ["interested", "applied", "recruiter_screen", "technical_interview", "final_interview", "offer"];

export const WORK_MODES = { "": "Sin indicar", onsite: "Presencial", hybrid: "Híbrido", remote: "Remoto" } as const;

export const SKILL_CATEGORIES = {
  programming: "Programación",
  data_analytics: "Análisis de datos",
  data_engineering: "Ingeniería de datos",
  business_intelligence: "Inteligencia de negocios",
  cloud: "Nube",
  soft_skills: "Habilidades blandas",
  languages: "Idiomas",
  other: "Otra",
} as const;

export const PROJECT_STATUS = { idea: "Idea", in_progress: "En curso", completed: "Terminado", archived: "Archivado" } as const;
export const LEARNING_KINDS = { course: "Curso", certification: "Certificación", objective: "Objetivo de aprendizaje", resource: "Recurso" } as const;

export const positionSchema = z
  .object({
    title: required("el cargo"),
    company: text(200),
    started_on: date,
    ended_on: optDate,
    monthly_salary: money,
    notes: text(2000),
  })
  .refine((v) => !v.ended_on || v.ended_on >= v.started_on, { path: ["ended_on"], message: "No puede ser anterior al inicio" });
export type PositionInput = z.infer<typeof positionSchema>;

export const applicationSchema = z.object({
  company: required("la empresa"),
  position: required("el cargo"),
  location: text(200),
  work_mode: z.enum(["", "onsite", "hybrid", "remote"]),
  salary_expectation: money,
  applied_on: optDate,
  stage: enumOf(STAGES),
  contact_person: text(200),
  job_url: url,
  technical_test: text(2000),
  feedback: text(5000),
  notes: text(5000),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;

export const interviewSchema = z.object({
  application_id: z.string().uuid(),
  kind: text(100),
  date,
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
  notes: text(2000),
});
export type InterviewInput = z.infer<typeof interviewSchema>;

export const skillSchema = z.object({
  name: required("un nombre", 100),
  category: enumOf(SKILL_CATEGORIES),
  target_level: z.number({ invalid_type_error: "Indica un número" }).int().min(1).max(10).nullable(),
  last_practiced_on: optDate,
  evidence: text(2000),
});
export type SkillInput = z.infer<typeof skillSchema>;

export const skillLevelSchema = z.object({
  skill_id: z.string().uuid(),
  level: z.number({ invalid_type_error: "Indica un número" }).min(0, "Mínimo 0").max(10, "Máximo 10"),
  assessed_on: date,
  notes: text(1000),
});
export type SkillLevelInput = z.infer<typeof skillLevelSchema>;

export const projectSchema = z.object({
  name: required("un nombre"),
  description: text(5000),
  business_problem: text(2000),
  technologies: text(500),
  results: text(5000),
  repository_url: url,
  documentation_url: url,
  status: enumOf(PROJECT_STATUS),
  completed_on: optDate,
  goal_id: optUuid,
  skill_ids: z.array(z.string().uuid()).max(50),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const learningSchema = z
  .object({
    title: required("un título"),
    kind: enumOf(LEARNING_KINDS),
    provider: text(200),
    url,
    progress: z.number({ invalid_type_error: "Indica un número" }).int().min(0, "Mínimo 0").max(100, "Máximo 100"),
    started_on: optDate,
    completed_on: optDate,
    skill_id: optUuid,
  })
  .refine((v) => !v.started_on || !v.completed_on || v.completed_on >= v.started_on, { path: ["completed_on"], message: "No puede ser anterior al inicio" });
export type LearningInput = z.infer<typeof learningSchema>;
