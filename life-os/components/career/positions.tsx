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

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Salario mensual en el tiempo: un punto por cada cargo o cambio de salario registrado. */
export function SalaryChart({ positions }: { positions: Position[] }) {
  const [table, setTable] = useState(false);
  const points = positions
    .filter((p) => p.monthly_salary != null)
    .sort((a, b) => a.started_on.localeCompare(b.started_on))
    .map((p) => ({ date: p.started_on, label: formatDay(p.started_on, "MMM yy"), salary: p.monthly_salary!, title: p.title, company: p.company }));
  if (points.length < 2)
    return <p className="text-sm text-muted">{points.length ? "With only one salary logged there's no change to show yet." : "No salaries logged."}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{points.length} salary entries</p>
        <Button size="sm" variant="ghost" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? <><ChartIcon /> View chart</> : <><Table2 /> View table</>}
        </Button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr><th scope="col" className="px-3 py-2 text-left font-medium">From</th><th scope="col" className="px-3 py-2 text-left font-medium">Role</th><th scope="col" className="px-3 py-2 text-right font-medium">Monthly salary</th></tr>
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
        <div className="h-56 w-full" role="img" aria-label="Monthly salary over time">
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={16} />
              <YAxis tickFormatter={(v: number) => compact.format(v)} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [formatMoney(v), "Monthly salary"]}
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
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> New role or salary</Button>
      {!positions.length ? (
        <EmptyState icon={Briefcase} title="No roles logged" description="Log your roles and salaries to see how they change. What you imported from Segundo Cerebro shows up here." />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {positions.map((p) => (
            <li key={p.id} className="flex items-start gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{p.title}{p.company && <span className="font-normal text-muted"> · {p.company}</span>}</p>
                <p className="text-[11px] text-muted">
                  {formatDay(p.started_on)} – {p.ended_on ? formatDay(p.ended_on) : "present"}
                  {p.imported && " · Imported"}
                </p>
                {p.notes && <p className="mt-0.5 break-words text-xs text-muted">{p.notes}</p>}
              </div>
              <span className="shrink-0 text-sm tabular-nums">{p.monthly_salary != null ? formatMoney(p.monthly_salary) : "—"}</span>
              <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${p.title}`} onClick={() => ed.setEditing(p)}><Pencil /></Button>
              <ConfirmDialog
                trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${p.title}`}><Trash2 /></Button>}
                title={`Delete “${p.title}”?`}
                description={p.imported ? "It will be deleted from LIFE OS. The original stays in Segundo Cerebro and would reappear if you import again." : "This can't be undone."}
                onConfirm={async () => {
                  const r = await deletePosition(p.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Role deleted");
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <EntityDialog<PositionInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Edit role" : "New role or salary"}
        description="If your salary went up in the same role, log a new entry with the date of the change."
        schema={positionSchema}
        defaults={it
          ? { title: it.title, company: it.company ?? "", started_on: it.started_on, ended_on: it.ended_on ?? "", monthly_salary: it.monthly_salary, notes: it.notes ?? "" }
          : { title: "", company: "", started_on: today, ended_on: "", monthly_salary: null, notes: "" }}
        fields={[
          { name: "title", label: "Role", kind: "text", placeholder: "E.g. Data analyst" },
          { name: "company", label: "Company (optional)", kind: "text" },
          { name: "started_on", label: "From", kind: "date", half: true },
          { name: "ended_on", label: "To (empty if current)", kind: "date", half: true },
          { name: "monthly_salary", label: "Monthly salary (optional)", kind: "money" },
          { name: "notes", label: "Notes (optional)", kind: "textarea" },
        ]}
        onSave={(v) => savePosition(v, it?.id)}
      />
    </div>
  );
}
