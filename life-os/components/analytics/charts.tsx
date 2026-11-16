"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, ViewToggle, axisTick, tooltipStyle } from "@/components/mental/charts";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Fmt = "count" | "score" | "hours" | "money" | "minutes" | "pct";
const FORMAT: Record<Fmt, (v: number) => string> = {
  count: (v) => formatNumber(v, 0),
  score: (v) => `${formatNumber(v, 1)}/10`,
  hours: (v) => `${formatNumber(v, 1)} h`,
  money: (v) => formatMoney(v),
  minutes: (v) => (v >= 60 ? `${formatNumber(v / 60, 1)} h` : `${formatNumber(v, 0)} min`),
  pct: (v) => `${formatNumber(v, 0)}%`,
};
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const AXIS: Record<Fmt, (v: number) => string> = {
  count: (v) => compact.format(v), score: (v) => String(v), hours: (v) => String(v), money: (v) => `$${compact.format(v)}`,
  minutes: (v) => (v >= 60 ? `${compact.format(v / 60)} h` : `${v}`), pct: (v) => `${v}%`,
};
const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

export type Row = { label: string; period: string; values: Record<string, number | null>; n?: Record<string, number> };

/**
 * Una o varias series con la misma unidad (un solo eje). Los periodos sin registros quedan vacíos:
 * nunca se dibujan como cero si no hay datos.
 */
export function SeriesChart({ rows, series, kind = "bar", format, ariaLabel, note, domain }: {
  rows: Row[]; series: { key: string; label: string }[]; kind?: "bar" | "line"; format: Fmt; ariaLabel: string; note?: string; domain?: [number, number];
}) {
  const [table, setTable] = useState(false);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const total = rows.reduce((a, r) => a + series.reduce((b, s) => b + (r.values[s.key] != null ? 1 : 0), 0), 0);
  const data = rows.map((r) => ({ label: r.label, period: r.period, n: r.n ?? {}, ...r.values }));
  const visible = series.filter((s) => !hidden[s.key]);
  const fmt = FORMAT[format];

  if (!total) return <p className="py-6 text-center text-sm text-muted">No entries in this period.</p>;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {series.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Visible series">
            {series.map((s, i) => (
              <button key={s.key} type="button" aria-pressed={!hidden[s.key]} onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", !hidden[s.key] ? "border-border text-foreground" : "border-transparent text-muted line-through")}>
                <span className="size-2.5 rounded-full" style={{ background: COLORS[i] }} aria-hidden /> {s.label}
              </button>
            ))}
          </div>
        ) : <span />}
        <ViewToggle table={table} onChange={setTable} />
      </div>
      {table ? (
        <DataTable
          rows={rows.map((r) => ({
            p: r.period,
            ...Object.fromEntries(series.map((s) => [s.key, r.values[s.key] == null ? null : `${fmt(r.values[s.key]!)}${r.n?.[s.key] != null ? ` (${r.n[s.key]})` : ""}`])),
          }))}
          cols={[{ key: "p", label: "Period" }, ...series.map((s) => ({ key: s.key, label: s.label }))]}
        />
      ) : (
        <div className="h-56 w-full" role="img" aria-label={ariaLabel}>
          <ResponsiveContainer>
            {kind === "bar" ? (
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: format === "money" ? 0 : -12 }} barGap={2}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={12} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={AXIS[format]} width={52} domain={domain} allowDecimals={format !== "count"} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "var(--accent-soft)" }} labelFormatter={(_l, p) => p?.[0]?.payload?.period ?? _l}
                  formatter={(v, name, item) => {
                    const key = item?.dataKey as string;
                    const n = item?.payload?.n?.[key];
                    return [`${fmt(Number(v))}${n != null ? ` · ${n} ${n === 1 ? "entry" : "entries"}` : ""}`, name];
                  }} />
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {visible.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[series.indexOf(s)]} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: format === "money" ? 0 : -12 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={12} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={AXIS[format]} width={52} domain={domain} />
                <Tooltip {...tooltipStyle} labelFormatter={(_l, p) => p?.[0]?.payload?.period ?? _l}
                  formatter={(v, name, item) => {
                    const key = item?.dataKey as string;
                    const n = item?.payload?.n?.[key];
                    return [`${fmt(Number(v))}${n != null ? ` · ${n} ${n === 1 ? "day" : "days"}` : ""}`, name];
                  }} />
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {visible.map((s) => (
                  <Line key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={COLORS[series.indexOf(s)]} strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: COLORS[series.indexOf(s)] }} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {note && <p className="text-[11px] text-muted">{note}</p>}
    </div>
  );
}
