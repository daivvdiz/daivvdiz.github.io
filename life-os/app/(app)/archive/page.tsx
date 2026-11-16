import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchiveView, type ArchiveTab } from "@/components/archive/archive-view";
import { LifeRadar } from "@/components/overview/life-radar";
import { Documents } from "@/components/archive/documents";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { getArchiveData } from "@/lib/archive/queries";
import { DIMENSIONS } from "@/lib/types";
import { formatDay, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Life archive" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "timeline", label: "Timeline" },
  { key: "gallery", label: "Gallery" },
  { key: "categories", label: "Categories" },
  { key: "chapters", label: "Chapters" },
  { key: "onthisday", label: "On this day" },
  { key: "documents", label: "Documents" },
  { key: "radar", label: "Life balance" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ tab?: string; category?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "timeline";
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);
  const d = await getArchiveData(supabase, prefs.timeZone);
  const href = (t: Tab) => (t === "timeline" ? "/archive" : `/archive?tab=${t}`);
  const md = today.slice(5);
  const onThisDay = d.memories.filter((m) => m.occurred_on.slice(5) === md && m.occurred_on < today).length
    + d.dailyMemories.filter((x) => x.date.slice(5) === md && x.date < today).length;

  return (
    <>
      <PageHeader title="Life archive" description="Your memories, people, life stages and important moments, in one place." />

      <nav aria-label="Archive sections" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-md border border-border p-0.5">
          {TABS.map((t) => (
            <Link key={t.key} href={href(t.key)} aria-current={tab === t.key ? "page" : undefined}
              className={cn("whitespace-nowrap rounded px-3 py-1.5 text-xs", tab === t.key ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}>
              {t.label}{t.key === "onthisday" && onThisDay > 0 && <span className="ml-1 tabular-nums text-muted">{onThisDay}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {d.error && (
        <Card className="mb-5 flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> Couldn't load your memories. Try reloading the page.
        </Card>
      )}

      {tab === "documents" ? (
        <Card><CardContent className="pt-5"><Documents userId={user!.id} /></CardContent></Card>
      ) : tab === "radar" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <LifeRadar assessments={d.assessments} today={today} />
          <Card>
            <CardHeader><div><CardTitle>History</CardTitle><CardDescription>All your self-assessments, from 1 to 10. No overall score.</CardDescription></div></CardHeader>
            <CardContent>
              {!d.assessments.length ? (
                <p className="text-sm text-muted">You don't have any self-assessments yet.</p>
              ) : (
                <div className="max-h-[26rem] overflow-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-surface text-muted">
                      <tr>
                        <th scope="col" className="px-2 py-2 text-left font-medium">Date</th>
                        {DIMENSIONS.map((x) => <th key={x.key} scope="col" className="px-2 py-2 text-right font-medium">{x.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {d.assessments.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-normal">{formatDay(a.assessed_on, "MMM d, yy")}</th>
                          {DIMENSIONS.map((x) => <td key={x.key} className="px-2 py-1.5 text-right tabular-nums">{a[x.key]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <ArchiveView key={`${tab}-${sp.category ?? ""}`} tab={tab as ArchiveTab} memories={d.memories} dailyMemories={d.dailyMemories}
              options={d.options} today={today} userId={user!.id} initialCategory={sp.category} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
