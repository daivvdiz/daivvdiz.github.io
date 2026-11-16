import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LifeRadar } from "@/components/overview/life-radar";
import {
  DailySummary, LiabilitiesCard, LifeCards, RecentActivity, RecentMemories, RecentWorkouts, UpcomingEvents,
} from "@/components/overview/sections";
import { getOverview, getRecentActivity } from "@/lib/overview/queries";
import { getUser } from "@/lib/supabase/server";
import { currentHour, greeting, longToday, TIMEZONE } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const PROMPTS = [
  "What happened today that you want to remember?",
  "What was the most important moment of your day?",
  "What did you learn today?",
  "What challenged you today, and how did you handle it?",
  "What small thing are you grateful for today?",
  "What gave you energy today?",
  "What do you need right now?",
];

export default async function OverviewPage() {
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, timezone").eq("id", user!.id).maybeSingle();
  const tz = profile?.timezone || TIMEZONE;

  const [data, activity] = await Promise.all([getOverview(supabase, tz), getRecentActivity(supabase)]);
  const firstName = profile?.full_name?.split(" ")[0];
  const dayOfYear = Math.floor((Date.parse(data.today) - Date.parse(data.today.slice(0, 4) + "-01-01")) / 864e5);

  return (
    <>
      <PageHeader
        title={`${greeting(currentHour(tz))}${firstName ? `, ${firstName}` : ""}`}
        description={`${longToday(tz)} · ${PROMPTS[dayOfYear % PROMPTS.length]}`}
        actions={
          <Button asChild>
            <Link href={`/calendar?view=day&date=${data.today}`}>{data.daily ? "Continue today's entry" : "Write about today"}</Link>
          </Button>
        }
      />

      {data.legacyPending > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <DatabaseZap className="mt-0.5 size-4 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium">You have {data.legacyPending} Segundo Cerebro records to bring over</p>
              <p className="text-xs text-muted">They're copied to LIFE OS without deleting anything from the previous app.</p>
            </div>
          </div>
          <Button asChild size="sm"><Link href="/settings#datos">Review and import</Link></Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <DailySummary data={data} />
          <LifeCards data={data} />
          <LifeRadar assessments={data.assessments} today={data.today} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <UpcomingEvents events={data.events} />
          <LiabilitiesCard data={data} />
          <RecentWorkouts workouts={data.workouts} />
          <RecentMemories memories={data.memories} />
          <RecentActivity items={activity} />
        </div>
      </div>
    </>
  );
}
