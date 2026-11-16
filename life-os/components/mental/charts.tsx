"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Table2, LineChart as LineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { addDays } from "@/lib/dates";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { distribution, type DayPoint } from "@/lib/mental/stats";

export const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" },
  labelStyle: { color: "var(--foreground)", marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", padding: 0 },
};
export const axisTick = { fill: "var(--muted)", fontSize: 11 };

/** Todos los días del periodo; los días sin registro quedan vacíos (nunca se rellenan). */
function fillDays(points: DayPoint[], from: string, to: string) {
  const byDate = new Map(points.map((p) => [p.date, p]));
  const out: (DayPoint & { label: string })[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const p = byDate.get(d);
    out.push({ date: d, label: formatDay(d, "MMM d"), mood: p?.mood ?? null, energy: p?.energy ?? null, stress: p?.stress ?? null, sleep_hours: p?.sleep_hours ?? null, sleep_quality: p?.sleep_quality ?? null });
  }
  return out;
}

const SERIES = [
  { key: "mood", label: "Mood", color: "var(--series-1)" },
  { key: "energy", label: "Energy", color: "var(--series-2)" },
  { key: "stress", label: "Stress", color: "var(--series-3)" },
] as const;

export function ViewToggle({ table, onChange }: { table: boolean; onChange: (t: boolean) => void }) {
  return (
    <Button size="sm" variant="ghost" onClick={() => onChange(!table)} aria-pressed={table}>
      {table ? <><LineIcon /> View chart</> : <><Table2 /> View table</>}
    </Button>
  );
}

export function DataTable({ rows, cols }: { rows: Record<string, string | number | null>[]; cols: { key: string; label: string }[] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-surface text-muted">
          <tr>{cols.map((c) => <th key={c.key} scope="col" className="px-3 py-2 text-left font-medium">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {cols.map((c) => <td key={c.key} className="px-3 py-1.5 tabular-nums">{r[c.key] ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ánimo, energía y estrés en el tiempo. Un solo eje (1–10). */
export function TrendChart({ points, from, to }: { points: DayPoint[]; from: string; to: string }) {
  const data = useMemo(() => fillDays(points, from, to), [points, from, to]);
  const [visible, setVisible] = useState<Record<string, boolean>>({ mood: true, energy: true, stress: true });
  const [table, setTable] = useState(false);
  const recorded = points.filter((p) => p.mood != null || p.energy != null || p.stress != null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Visible series">
          {SERIES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={visible[s.key]}
              onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                visible[s.key] ? "border-border text-foreground" : "border-transparent text-muted line-through",
              )}
            >
              <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
            </button>
          ))}
        </div>
        <ViewToggle table={table} onChange={setTable} />
      </div>
      {table ? (
        <DataTable
          rows={recorded.map((p) => ({ date: formatDay(p.date, "EEE, MMM d"), mood: p.mood, energy: p.energy, stress: p.stress }))}
          cols={[{ key: "date", label: "Day" }, ...SERIES.map((s) => ({ key: s.key, label: s.label }))]}
        />
      ) : (
        <div className="h-64 w-full" role="img" aria-label="Line chart of mood, energy and stress per day, on a 1 to 10 scale">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
              <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => `${v}/10`} />
              {SERIES.filter((s) => visible[s.key]).map((s) => (
                <Line key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: s.color }} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[11px] text-muted">Days without an entry show as gaps; they aren't filled in.</p>
    </div>
  );
}

/** Sueño: horas (barras) y calidad (1–10) en gráficos separados, cada uno con su propio eje. */
export function SleepChart({ points, from, to }: { points: DayPoint[]; from: string; to: string }) {
  const data = useMemo(() => fillDays(points, from, to), [points, from, to]);
  const [mode, setMode] = useState<"hours" | "quality">("hours");
  const [table, setTable] = useState(false);
  const recorded = points.filter((p) => p.sleep_hours != null || p.sleep_quality != null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Sleep measure">
          {([["hours", "Hours"], ["quality", "Quality"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}
              className={cn("rounded px-2.5 py-1 text-xs", mode === k ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}>
              {l}
            </button>
          ))}
        </div>
        <ViewToggle table={table} onChange={setTable} />
      </div>
      {table ? (
        <DataTable
          rows={recorded.map((p) => ({ date: formatDay(p.date, "EEE, MMM d"), h: p.sleep_hours, q: p.sleep_quality }))}
          cols={[{ key: "date", label: "Day" }, { key: "h", label: "Hours" }, { key: "q", label: "Quality (1–10)" }]}
        />
      ) : (
        <div className="h-56 w-full" role="img" aria-label={mode === "hours" ? "Sleep hours per day" : "Sleep quality per day, from 1 to 10"}>
          <ResponsiveContainer>
            {mode === "hours" ? (
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
                <YAxis domain={[0, 12]} ticks={[0, 4, 8, 12]} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "var(--accent-soft)" }} formatter={(v: number) => [`${v} h`, "Sleep"]} />
                <Bar dataKey="sleep_hours" name="Sleep hours" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
                <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}/10`, "Quality"]} />
                <Line type="linear" dataKey="sleep_quality" name="Sleep quality" stroke="var(--series-1)" strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: "var(--series-1)" }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const DIST_LABEL = { mood: "Mood", energy: "Energy", stress: "Stress" } as const;

/** Cuántos días tuvo cada valor de 1 a 10. */
export function DistributionChart({ points }: { points: DayPoint[] }) {
  const [metric, setMetric] = useState<keyof typeof DIST_LABEL>("mood");
  const data = useMemo(() => distribution(points, metric), [points, metric]);
  const n = data.reduce((a, b) => a + b.days, 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          Measure
          <Select className="h-8 w-32" value={metric} onChange={(e) => setMetric(e.target.value as keyof typeof DIST_LABEL)}>
            {Object.entries(DIST_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </label>
        <span className="text-xs text-muted">{n} {n === 1 ? "day" : "days"} with a value</span>
      </div>
      <div className="h-48 w-full" role="img" aria-label={`${DIST_LABEL[metric]} distribution: days per value from 1 to 10`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="value" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "var(--accent-soft)" }} labelFormatter={(v) => `${DIST_LABEL[metric]}: ${v}/10`} formatter={(v: number) => [v, "Days"]} />
            <Bar dataKey="days" name="Days" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
