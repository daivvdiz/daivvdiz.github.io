import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIMEZONE } from "@/lib/format";

export async function getPrefs(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, timezone, week_starts_on")
    .eq("id", userId)
    .maybeSingle();
  return {
    fullName: (data?.full_name as string | null) ?? null,
    timeZone: (data?.timezone as string | null) || TIMEZONE,
    weekStartsOn: (data?.week_starts_on as number | null) ?? 1,
  };
}
