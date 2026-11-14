"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { previewImport, runImport, type PreviewRow } from "@/lib/import/actions";

const LABELS: Record<string, string> = {
  transactions: "pagos",
  career_positions: "cargos",
  daily_accomplishments: "logros",
  skill_levels: "niveles de skills",
  workouts: "registros de entrenamiento",
  legacy_unmapped: "sin clasificar",
  skipped: "ya estaban importados",
  error: "con error (quedaron sin clasificar)",
};

export function DataImport() {
  const router = useRouter();
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    previewImport().then((r) => {
      if (r.ok) {
        setRows(r.rows);
        setError(null);
      } else setError(r.error);
    });

  useEffect(() => {
    load();
  }, []);

  const total = rows?.reduce((a, r) => a + r.total, 0) ?? 0;
  const pendingCount = rows?.reduce((a, r) => a + r.total - r.ya_importados, 0) ?? 0;

  const doImport = () =>
    start(async () => {
      const r = await runImport();
      if (!r.ok) return void toast.error(r.error);
      const summary = Object.entries(r.result)
        .filter(([k]) => k !== "skipped")
        .map(([k, n]) => `${n} ${LABELS[k] ?? k}`)
        .join(", ");
      toast.success(summary ? `Importado: ${summary}` : "No había nada nuevo por importar");
      await load();
      router.refresh();
    });

  if (error) return <p className="text-sm text-danger" role="alert">{error}</p>;
  if (!rows) return <p className="text-sm text-muted">Revisando Segundo Cerebro…</p>;
  if (total === 0) return <p className="text-sm text-muted">No se encontraron registros de Segundo Cerebro en tu cuenta.</p>;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Vista previa de la importación</caption>
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Categoría original</th>
              <th scope="col" className="px-3 py-2 font-medium">Destino en LIFE OS</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Registros</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Ya copiados</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.categoria + r.destino} className="border-t border-border">
                <td className="px-3 py-2">{r.categoria}</td>
                <td className="px-3 py-2 text-muted">{r.destino}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.ya_importados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          {pendingCount > 0
            ? `${pendingCount} de ${total} registros por copiar. Los originales no se modifican y repetir la importación no duplica nada.`
            : `Los ${total} registros ya están en LIFE OS. Lo nuevo que registres con el Atajo de iOS se copia solo.`}
        </p>
        <Button onClick={doImport} disabled={pending || pendingCount === 0}>
          {pending ? "Importando…" : "Importar ahora"}
        </Button>
      </div>
    </div>
  );
}
