import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";

// Tablas que se incluyen en la exportación. RLS garantiza que solo salen tus filas.
const TABLES = [
  "profiles", "life_assessments", "daily_entries", "daily_gratitude", "daily_accomplishments", "journal_entries",
  "tags", "daily_entry_tags", "emotional_tags", "daily_entry_emotions", "stress_factors", "coping_strategies",
  "coping_strategy_logs", "goals", "milestones", "habits", "habit_logs", "goal_habits", "goal_daily_entries",
  "financial_categories", "transactions", "budgets", "savings_goals", "assets", "liabilities",
  "career_positions", "career_applications", "application_interviews", "skills", "skill_levels", "projects",
  "project_skills", "learning_resources", "exercises", "workouts", "workout_exercises", "body_metrics",
  "nutrition_logs", "calendar_events", "daily_entry_events", "memories", "memory_tags", "memory_people", "attachments",
  // Datos originales de Segundo Cerebro (solo lectura)
  "registros", "ajustes",
] as const;

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(from, from + 999);
      if (error || !data) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    out[t] = rows;
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify({ app: "life-os", exported_at: new Date().toISOString(), tables: out }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="life-os-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
