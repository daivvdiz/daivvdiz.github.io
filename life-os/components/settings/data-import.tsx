"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { previewImport, runImport, type PreviewRow } from "@/lib/import/actions";

const LABELS: Record<string, string> = {
  transactions: "payments",
  career_positions: "positions",
  daily_accomplishments: "accomplishments",
  skill_levels: "skill levels",
  workouts: "workout entries",
  legacy_unmapped: "unclassified",
  skipped: "already imported",
  error: "with errors (left unclassified)",
};

export function DataImport() {
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
      toast.success(summary ? `Imported: ${summary}` : "There was nothing new to import");
      await load();
    });

  if (error) return <p className="text-sm text-danger" role="alert">{error}</p>;
  if (!rows) return <p className="text-sm text-muted">Checking Segundo Cerebro…</p>;
  if (total === 0) return <p className="text-sm text-muted">No Segundo Cerebro records were found in your account.</p>;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Import preview</caption>
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Original category</th>
              <th scope="col" className="px-3 py-2 font-medium">Destination in LIFE OS</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Records</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Already copied</th>
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
            ? `${pendingCount} of ${total} records left to copy. The originals aren't changed, and running the import again won't duplicate anything.`
            : `All ${total} records are already in LIFE OS. Anything new you log with the iOS Shortcut is copied automatically.`}
        </p>
        <Button onClick={doImport} disabled={pending || pendingCount === 0}>
          {pending ? "Importing…" : "Import now"}
        </Button>
      </div>
    </div>
  );
}
