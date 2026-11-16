import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const optDate = date.optional().or(z.literal(""));
const optUuid = z.string().uuid().optional().or(z.literal(""));
const text = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`).optional().or(z.literal(""));
const url = z.string().trim().max(500).url("Enter a full link (https://…)").optional().or(z.literal(""));
const money = z.number({ invalid_type_error: "Enter a value" }).finite().min(0, "Can't be negative").max(999_999_999_999).nullable();
const required = (label: string, max = 200) => z.string().trim().min(1, `Enter ${label}`).max(max, `Maximum ${max} characters`);
const enumOf = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

export const STAGES = {
  interested: "Interested",
  applied: "Applied",
  recruiter_screen: "Recruiter screen",
  technical_interview: "Technical interview",
  final_interview: "Final interview",
  offer: "Offer",
  rejected: "Didn't move forward",
  withdrawn: "Withdrew",
} as const;
export type Stage = keyof typeof STAGES;
export const OPEN_STAGES: Stage[] = ["interested", "applied", "recruiter_screen", "technical_interview", "final_interview", "offer"];

export const WORK_MODES = { "": "Not set", onsite: "On-site", hybrid: "Hybrid", remote: "Remote" } as const;

export const SKILL_CATEGORIES = {
  programming: "Programming",
  data_analytics: "Data analytics",
  data_engineering: "Data engineering",
  business_intelligence: "Business intelligence",
  cloud: "Cloud",
  soft_skills: "Soft skills",
  languages: "Languages",
  other: "Other",
} as const;

export const PROJECT_STATUS = { idea: "Idea", in_progress: "In progress", completed: "Completed", archived: "Archived" } as const;
export const LEARNING_KINDS = { course: "Course", certification: "Certification", objective: "Learning goal", resource: "Resource" } as const;

export const positionSchema = z
  .object({
    title: required("the job title"),
    company: text(200),
    started_on: date,
    ended_on: optDate,
    monthly_salary: money,
    notes: text(2000),
  })
  .refine((v) => !v.ended_on || v.ended_on >= v.started_on, { path: ["ended_on"], message: "Can't be before the start" });
export type PositionInput = z.infer<typeof positionSchema>;

export const applicationSchema = z.object({
  company: required("the company"),
  position: required("the role"),
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
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
  notes: text(2000),
});
export type InterviewInput = z.infer<typeof interviewSchema>;

export const skillSchema = z.object({
  name: required("a name", 100),
  category: enumOf(SKILL_CATEGORIES),
  target_level: z.number({ invalid_type_error: "Enter a number" }).int().min(1).max(10).nullable(),
  last_practiced_on: optDate,
  evidence: text(2000),
});
export type SkillInput = z.infer<typeof skillSchema>;

export const skillLevelSchema = z.object({
  skill_id: z.string().uuid(),
  level: z.number({ invalid_type_error: "Enter a number" }).min(0, "Minimum 0").max(10, "Maximum 10"),
  assessed_on: date,
  notes: text(1000),
});
export type SkillLevelInput = z.infer<typeof skillLevelSchema>;

export const projectSchema = z.object({
  name: required("a name"),
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
    title: required("a title"),
    kind: enumOf(LEARNING_KINDS),
    provider: text(200),
    url,
    progress: z.number({ invalid_type_error: "Enter a number" }).int().min(0, "Minimum 0").max(100, "Maximum 100"),
    started_on: optDate,
    completed_on: optDate,
    skill_id: optUuid,
  })
  .refine((v) => !v.started_on || !v.completed_on || v.completed_on >= v.started_on, { path: ["completed_on"], message: "Can't be before the start" });
export type LearningInput = z.infer<typeof learningSchema>;
