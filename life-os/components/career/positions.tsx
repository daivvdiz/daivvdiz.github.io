"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Briefcase, LineChart as ChartIcon, Pencil, Plus, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityDialog, useEditor } from "@/components/entity-dialog";
import { tooltipStyle } from "@/components/mental/charts";
import { formatDay, formatMoney } from "@/lib/format";
import { positionSchema, type PositionInput } from "@/lib/career/schema";
import { deletePosition, savePosition } from "@/lib/career/actions";
import type { Position } from "@/lib/career/queries";

const compact = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });

/** Salario mensual en el tiempo: un punto por cada cargo o cambio de salario registrado. */
export function SalaryChart({ positions }: { positions: Position[] }) {
  const [table, setTable] = useState(false);
  const points = positions
    .filter((p) => p.monthly_salary != null)
    .sort((a, b) => a.started_on.localeCompare(b.started_on))
    .map((p) => ({ date: p.started_on, label: formatDay(p.started_on, "MMM yy"), salary: p.monthly_salary!, title: p.title, company: p.company }));
  if (points.length < 2)
    return <p className="text-sm text-muted">{points.length ? "Con un solo salario registrado aún no hay evolución que mostrar." : "Sin salarios registrados."}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{points.length} registros de salario</p>
        <Button size="sm" variant="ghost" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? <><ChartIcon /> Ver gráfico</> : <><Table2 /> Ver tabla</>}
        </Button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr><th scope="col" className="px-3 py-2 text-left font-medium">Desde</th><th scope="col" className="px-3 py-2 text-left font-medium">Cargo</th><th scope="col" className="px-3 py-2 text-right font-medium">Salario mensual</th></tr>
            </thead>
            <tbody className="tabular-nums">
              {[...points].reverse().map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-1.5">{formatDay(p.date)}</td>
                  <td className="px-3 py-1.5">{p.title}{p.company && ` · ${p.company}`}</td>
                  <td className="px-3 py-1.5 text-right">{formatMoney(p.salary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-56 w-full" role="img" aria-label="Evolución del salario mensual">
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={16} />
              <YAxis tickFormatter={(v: number) => compact.format(v)} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [formatMoney(v), "Salario mensual"]}
                labelFormatter={(_, p) => (p?.[0] ? `${formatDay(p[0].payload.date)} · ${p[0].payload.title}` : "")} />
              <Line type="stepAfter" dataKey="salary" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "var(--series-1)" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function PositionsList({ positions, today }: { positions: Position[]; today: string }) {
  const ed = useEditor<Position>();
  const it = ed.item;
  return (
    <div className="space-y-3">
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> Nuevo cargo o salario</Button>
      {!positions.length ? (
        <EmptyState icon={Briefcase} title="Sin cargos registrados" description="Registra tus cargos y salarios para ver cómo evolucionan. Lo importado de Segundo Cerebro aparece aquí." />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {positions.map((p) => (
            <li key={p.id} className="flex items-start gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{p.title}{p.company && <span className="font-normal text-muted"> · {p.company}</span>}</p>
                <p className="text-[11px] text-muted">
                  {formatDay(p.started_on)} – {p.ended_on ? formatDay(p.ended_on) : "actual"}
                  {p.imported && " · Importado"}
                </p>
                {p.notes && <p className="mt-0.5 break-words text-xs text-muted">{p.notes}</p>}
              </div>
              <span className="shrink-0 text-sm tabular-nums">{p.monthly_salary != null ? formatMoney(p.monthly_salary) : "—"}</span>
              <Button size="icon" variant="ghost" className="size-7" aria-label={`Editar ${p.title}`} onClick={() => ed.setEditing(p)}><Pencil /></Button>
              <ConfirmDialog
                trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Eliminar ${p.title}`}><Trash2 /></Button>}
                title={`¿Eliminar “${p.title}”?`}
                description={p.imported ? "Se eliminará de LIFE OS. El original sigue en Segundo Cerebro y reaparecería si vuelves a importar." : "Esta acción no se puede deshacer."}
                onConfirm={async () => {
                  const r = await deletePosition(p.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Cargo eliminado");
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <EntityDialog<PositionInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Editar cargo" : "Nuevo cargo o salario"}
        description="Si te subieron el salario en el mismo cargo, registra una nueva entrada con la fecha del cambio."
        schema={positionSchema}
        defaults={it
          ? { title: it.title, company: it.company ?? "", started_on: it.started_on, ended_on: it.ended_on ?? "", monthly_salary: it.monthly_salary, notes: it.notes ?? "" }
          : { title: "", company: "", started_on: today, ended_on: "", monthly_salary: null, notes: "" }}
        fields={[
          { name: "title", label: "Cargo", kind: "text", placeholder: "Ej. Analista de datos" },
          { name: "company", label: "Empresa (opcional)", kind: "text" },
          { name: "started_on", label: "Desde", kind: "date", half: true },
          { name: "ended_on", label: "Hasta (vacío si es el actual)", kind: "date", half: true },
          { name: "monthly_salary", label: "Salario mensual (opcional)", kind: "money" },
          { name: "notes", label: "Notas (opcional)", kind: "textarea" },
        ]}
        onSave={(v) => savePosition(v, it?.id)}
      />
    </div>
  );
}
