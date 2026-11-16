"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, ViewToggle, axisTick, tooltipStyle } from "@/components/mental/charts";
import { formatDay, formatDuration, formatNumber } from "@/lib/format";

export type FormatKind = "count" | "kg0" | "kg1" | "reps" | "time" | "km";
export const FORMATS: Record<FormatKind, (v: number) => string> = {
  count: (v) => formatNumber(v, 0),
  kg0: (v) => `${formatNumber(v, 0)} kg`,
  kg1: (v) => `${formatNumber(v, 1)} kg`,
  reps: (v) => `${formatNumber(v, 0)} reps`,
  time: (v) => formatDuration(v),
  km: (v) => `${formatNumber(v, 2)} km`,
};
const compact = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
/** Etiquetas cortas del eje (la unidad va en el título, la tabla y el tooltip). */
const axisFormat = (kind: FormatKind) => (v: number) => (kind === "time" ? `${Math.round(v / 60)} min` : compact.format(v));

/** Barras por semana. Un solo eje; una sola serie. */
export function WeeklyBars({ data, label, format: kind, ariaLabel, note }: {
  data: { week: string; value: number }[]; label: string; format: FormatKind; ariaLabel: string; note?: string;
}) {
  const format = FORMATS[kind];
  const [table, setTable] = useState(false);
  const rows = data.map((d) => ({ ...d, label: formatDay(d.week, "d MMM") }));
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><ViewToggle table={table} onChange={setTable} /></div>
      {table ? (
        <DataTable rows={rows.map((r) => ({ w: `Semana del ${formatDay(r.week)}`, v: format(r.value) }))} cols={[{ key: "w", label: "Semana" }, { key: "v", label }]} />
      ) : (
        <div className="h-48 w-full" role="img" aria-label={ariaLabel}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={16} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={axisFormat(kind)} width={48} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "var(--accent-soft)" }} labelFormatter={(l: string) => `Semana del ${l}`} formatter={(v: number) => [format(v), label]} />
              <Bar dataKey="value" name={label} fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {note && <p className="text-[11px] text-muted">{note}</p>}
    </div>
  );
}

/** Evolución de un valor en el tiempo: solo los días con registro, sin interpolar valores. */
export function ValueLine({ points, label, format: kind, ariaLabel, tableExtra }: {
  points: { date: string; value: number; detail?: string | null }[]; label: string; format: FormatKind; ariaLabel: string; tableExtra?: string;
}) {
  const format = FORMATS[kind];
  const [table, setTable] = useState(false);
  if (points.length < 2)
    return <p className="py-4 text-sm text-muted">{points.length === 1 ? `Un solo registro (${format(points[0].value)} el ${formatDay(points[0].date)}). Con dos o más verás la evolución.` : "Sin registros todavía."}</p>;
  const data = points.map((p) => ({ ...p, label: formatDay(p.date, "d MMM yy") }));
  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const pad = (max - min) * 0.15 || Math.max(1, max * 0.05);
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><ViewToggle table={table} onChange={setTable} /></div>
      {table ? (
        <DataTable
          rows={[...data].reverse().map((p) => ({ d: formatDay(p.date), v: format(p.value), x: p.detail ?? null }))}
          cols={[{ key: "d", label: "Fecha" }, { key: "v", label }, ...(tableExtra ? [{ key: "x", label: tableExtra }] : [])]}
        />
      ) : (
        <div className="h-48 w-full" role="img" aria-label={ariaLabel}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
              <YAxis domain={[Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={axisFormat(kind)} width={48} />
              <Tooltip {...tooltipStyle} formatter={(v: number, _n, item) => [`${format(v)}${item?.payload?.detail ? ` · ${item.payload.detail}` : ""}`, label]} />
              <Line type="linear" dataKey="value" name={label} stroke="var(--series-1)" strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: "var(--series-1)" }} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[11px] text-muted">{points.length} registros. Solo se muestran los días en que registraste un valor.</p>
    </div>
  );
}

/** Distribución por tipo de actividad como barras horizontales con su conteo (una sola tonalidad). */
export function DistributionBars({ items, total }: { items: { label: string; n: number }[]; total: number }) {
  if (!total) return <p className="text-sm text-muted">Sin entrenamientos en este periodo.</p>;
  const max = Math.max(...items.map((i) => i.n));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2 text-sm">
          <span className="truncate">{i.label}</span>
          <div className="h-2 rounded-full bg-surface" aria-hidden>
            <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${(i.n / max) * 100}%` }} />
          </div>
          <span className="text-right text-xs tabular-nums text-muted">{i.n} · {Math.round((i.n / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}
