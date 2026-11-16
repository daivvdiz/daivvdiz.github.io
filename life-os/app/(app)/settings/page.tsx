import type { Metadata } from "next";
import { Download, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/settings/profile-form";
import { AppearanceSettings } from "@/components/settings/appearance";
import { DataImport } from "@/components/settings/data-import";
import { getUser } from "@/lib/supabase/server";
import type { ProfileInput } from "@/lib/profile/schema";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, user } = await getUser();
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name, timezone, currency, week_starts_on, default_period, theme, accent_color")
    .eq("id", user!.id)
    .maybeSingle();

  const initial: ProfileInput = {
    full_name: p?.full_name ?? "",
    timezone: p?.timezone ?? "America/Bogota",
    currency: (p?.currency as ProfileInput["currency"]) ?? "COP",
    week_starts_on: p?.week_starts_on ?? 1,
    default_period: (p?.default_period as ProfileInput["default_period"]) ?? "30d",
  };

  return (
    <>
      <PageHeader title="Settings" description="Your profile, appearance and control over your data." />
      <div className="space-y-4">
        <Card>
          <CardHeader><div><CardTitle>Profile and preferences</CardTitle><CardDescription>Language: English. Metric system.</CardDescription></div></CardHeader>
          <CardContent><ProfileForm initial={initial} email={user!.email ?? ""} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardContent>
            <AppearanceSettings theme={p?.theme === "light" ? "light" : "dark"} accent={p?.accent_color ?? "violet"} />
          </CardContent>
        </Card>

        <Card id="datos" className="scroll-mt-6">
          <CardHeader>
            <div>
              <CardTitle>Import from Segundo Cerebro</CardTitle>
              <CardDescription>Copies your earlier records into the new model. Nothing is deleted from the previous app.</CardDescription>
            </div>
          </CardHeader>
          <CardContent><DataImport /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Export my data</CardTitle>
              <CardDescription>A JSON file with all your LIFE OS and Segundo Cerebro records.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <a href="/api/export" download><Download /> Download JSON</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Privacy</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted">
            <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />Each database row can only be read by your user (Row Level Security).</p>
            <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />Your files are stored in private buckets and opened with temporary links.</p>
            <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />Your data isn't used to train AI or for external analytics.</p>
            <p className="pt-2 text-xs">CSV export and account deletion arrive in phase 8.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
