import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { ModuleDef } from "@/lib/modules";

/** Página honesta para módulos que llegan en una fase posterior: sin controles falsos. */
export function UpcomingModule({ module }: { module: ModuleDef }) {
  const Icon = module.icon;
  return (
    <>
      <PageHeader title={module.label} description={module.description} />
      <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <Icon className="size-6 text-muted" aria-hidden />
        <p className="text-sm font-medium">Este módulo llega en la fase {module.phase}</p>
        <p className="max-w-md text-sm text-muted">
          La base de datos ya está lista para él, y lo que importes de Segundo Cerebro se mostrará aquí cuando esté construido.
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <Link href="/overview">Volver al resumen</Link>
        </Button>
      </Card>
    </>
  );
}
