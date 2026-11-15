"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart as ChartIcon, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDay, formatMoney } from "@/lib/format";
import { tooltipStyle } from "@/components/mental/charts";

const compact = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });

/** Gastos por categoría como lista de barras: nombre, valor y porcentaje siempre visibles. */
export function CategoryBars({ rows }: { rows: { name: string; amount: number; n: number }[] }) {
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const max = Math.max(...rows.map((r) => r.amount), 1);
  if (!rows.length) return <p className="py-4 text-sm text-muted">Sin gastos registrados este mes.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{r.name}</span>
            <span className="shrink-0 tabular-nums">
              {formatMoney(r.amount)} <span className="text-xs text-muted">· {Math.round((r.amount / total) * 100)}% · {r.n} mov.</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${(r.amount / max) * 100}%`, background: "var(--series-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Ingresos y gastos de los últimos 6 meses. Un solo eje (COP). */
export function MonthlyTrend({ data }: { data: { month: string; income: number; expense: number; n: number }[] }) {
  const [table, setTable] = useState(false);
  const rows = data.map((d) => ({ ...d, label: formatDay(d.month, "MMM yy") }));
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? <><ChartIcon /> Ver gráfico</> : <><Table2 /> Ver tabla</>}
        </Button>
      </div>
      {table ? (
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Mes</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Ingresos</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Gastos</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Movimientos</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.month} className="border-t border-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal capitalize">{formatDay(r.month, "MMMM yyyy")}</th>
                  <td className="px-3 py-1.5 text-right">{r.n ? formatMoney(r.income) : "—"}</td>
                  <td className="px-3 py-1.5 text-right">{r.n ? formatMoney(r.expense) : "—"}</td>
                  <td className="px-3 py-1.5 text-right">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-60 w-full" role="img" aria-label="Ingresos y gastos por mes, últimos 6 meses">
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
              <YAxis tickFormatter={(v: number) => compact.format(v)} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "var(--accent-soft)" }} formatter={(v: number) => formatMoney(v)} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} iconType="circle" iconSize={8} />
              <Bar dataKey="income" name="Ingresos" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              <Bar dataKey="expense" name="Gastos" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[11px] text-muted">Los aportes a ahorro no cuentan como gasto. Los meses sin movimientos aparecen en 0.</p>
    </div>
  );
}
