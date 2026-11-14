// Tipos de filas usados por la interfaz. Las columnas siguen las migraciones en ../supabase/migrations.

export const DIMENSIONS = [
  { key: "professional", label: "Profesional" },
  { key: "financial", label: "Financiera" },
  { key: "physical", label: "Física" },
  { key: "emotional", label: "Emocional" },
  { key: "social", label: "Social" },
  { key: "intellectual", label: "Intelectual" },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];

export interface LifeAssessment extends Record<DimensionKey, number> {
  id: string;
  assessed_on: string;
  notes: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  all_day: boolean;
}

export interface ActivityItem {
  id: string;
  kind: "daily_entry" | "goal" | "workout" | "application" | "memory" | "transaction" | "position" | "skill" | "assessment";
  label: string;
  detail?: string;
  at: string;
}

export const WORKOUT_TYPES: Record<string, string> = {
  calisthenics: "Calistenia",
  strength: "Fuerza",
  beach_volleyball: "Vóley playa",
  running: "Running",
  mobility: "Movilidad",
  other_sport: "Otro deporte",
  other: "Otra actividad",
};

export const EVENT_CATEGORIES: Record<string, string> = {
  personal: "Personal",
  work: "Trabajo",
  health: "Salud",
  fitness: "Ejercicio",
  finance: "Finanzas",
  social: "Social",
  learning: "Aprendizaje",
  other: "Otro",
};
