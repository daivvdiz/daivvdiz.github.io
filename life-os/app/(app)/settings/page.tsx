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

export const metadata: Metadata = { title: "Ajustes" };
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
      <PageHeader title="Ajustes" description="Tu perfil, la apariencia y el control de tus datos." />
      <div className="space-y-4">
        <Card>
          <CardHeader><div><CardTitle>Perfil y preferencias</CardTitle><CardDescription>Idioma: español. Sistema métrico.</CardDescription></div></CardHeader>
          <CardContent><ProfileForm initial={initial} email={user!.email ?? ""} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Apariencia</CardTitle></CardHeader>
          <CardContent>
            <AppearanceSettings theme={p?.theme === "light" ? "light" : "dark"} accent={p?.accent_color ?? "violet"} />
          </CardContent>
        </Card>

        <Card id="datos" className="scroll-mt-6">
          <CardHeader>
            <div>
              <CardTitle>Importar desde Segundo Cerebro</CardTitle>
              <CardDescription>Copia tus registros anteriores al nuevo modelo. Nada se borra de la app anterior.</CardDescription>
            </div>
          </CardHeader>
          <CardContent><DataImport /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Exportar mis datos</CardTitle>
              <CardDescription>Un archivo JSON con todos tus registros de LIFE OS y de Segundo Cerebro.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <a href="/api/export" download><Download /> Descargar JSON</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Privacidad</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted">
            <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />Cada fila de la base de datos solo la puede leer tu usuario (Row Level Security).</p>
            <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />Tus archivos se guardan en buckets privados y se abren con enlaces temporales.</p>
            <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />Tus datos no se usan para entrenar IA ni para analítica externa.</p>
            <p className="pt-2 text-xs">La exportación en CSV y la eliminación de cuenta llegan en la fase 8.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
