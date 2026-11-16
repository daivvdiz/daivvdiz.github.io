"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDay, formatNumber } from "@/lib/format";
import { groupAverages, type DayPoint } from "@/lib/mental/stats";

type S = { avg: number | null; n: number };
const cell = (s: S, unit = "") => (s.n ? <>{formatNumber(s.avg, 1)}{unit}<span className="ml-1 text-muted">({s.n})</span></> : <span className="text-muted">—</span>);

/** Promedios por semana o mes. Entre paréntesis: cuántos días tienen ese dato. */
export function AveragesTable({ points, weekStartsOn }: { points: DayPoint[]; weekStartsOn: number }) {
  const [by, setBy] = useState<"week" | "month">("week");
  const rows = useMemo(() => groupAverages(points, by, weekStartsOn).reverse(), [points, by, weekStartsOn]);

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Group by">
        {([["week", "By week"], ["month", "By month"]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={by === k} onClick={() => setBy(k)}
            className={cn("rounded px-2.5 py-1 text-xs", by === k ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}>
            {l}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No entries in this period.</p>
      ) : (
        <div className="max-h-80 overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr>
                <th scope="col" className="px-2 py-2 text-left font-medium">{by === "week" ? "Week" : "Month"}</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Mood</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Energy</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Stress</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Sleep</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">
                    {by === "week" ? `${formatDay(r.key, "MMM d")} – ${formatDay(r.end!, "MMM d")}` : formatDay(`${r.key}-01`, "MMMM yyyy")}
                  </th>
                  <td className="px-2 py-1.5 text-right">{cell(r.mood)}</td>
                  <td className="px-2 py-1.5 text-right">{cell(r.energy)}</td>
                  <td className="px-2 py-1.5 text-right">{cell(r.stress)}</td>
                  <td className="px-2 py-1.5 text-right">{cell(r.sleep, " h")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted">In parentheses, the number of days with that value.</p>
    </div>
  );
}
