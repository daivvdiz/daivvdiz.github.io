"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { History, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntityDialog, useEditor } from "@/components/entity-dialog";
import { tooltipStyle } from "@/components/mental/charts";
import { formatDay, formatNumber } from "@/lib/format";
import { SKILL_CATEGORIES, skillLevelSchema, skillSchema, type SkillInput, type SkillLevelInput } from "@/lib/career/schema";
import { addSkillLevel, deleteSkill, deleteSkillLevel, saveSkill } from "@/lib/career/actions";
import type { Skill } from "@/lib/career/queries";

/** Nivel actual frente al objetivo, en la misma escala 0–10. */
function LevelBar({ current, target }: { current: number | null; target: number | null }) {
  return (
    <div className="relative h-1.5 w-full rounded-full bg-surface" aria-hidden>
      {current != null && <div className="h-full rounded-full bg-accent" style={{ width: `${current * 10}%` }} />}
      {target != null && <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-foreground/70" style={{ left: `calc(${target * 10}% - 1px)` }} />}
    </div>
  );
}

function HistoryDialog({ skill, onClose }: { skill: Skill | null; onClose: () => void }) {
  if (!skill) return null;
  const data = skill.levels.map((l) => ({ ...l, label: formatDay(l.assessed_on, "MMM d, yy") }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{skill.name} history</DialogTitle>
          <DialogDescription>{skill.levels.length} level {skill.levels.length === 1 ? "entry" : "entries"} (0 to 10).</DialogDescription>
        </DialogHeader>
        {data.length >= 2 && (
          <div className="h-48 w-full" role="img" aria-label={`${skill.name} level over time`}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={16} />
                <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}/10`, "Level"]} />
                <Line type="linear" dataKey="level" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "var(--series-1)" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <ul className="max-h-64 space-y-1 overflow-auto">
          {[...skill.levels].reverse().map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
              <span className="w-12 shrink-0 tabular-nums">{formatNumber(l.level, 1)}/10</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{formatDay(l.assessed_on)}{l.imported && " · Imported"}{l.notes && ` · ${l.notes}`}</span>
              <ConfirmDialog
                trigger={<Button size="icon" variant="ghost" className="size-7" aria-label="Delete entry"><Trash2 /></Button>}
                title="Delete this level entry?"
                description={l.imported ? "It comes from Segundo Cerebro; the original isn't changed and would reappear if you import again." : "This can't be undone."}
                onConfirm={async () => {
                  const r = await deleteSkillLevel(l.id);
                  if (!r.ok) toast.error(r.error);
                }}
              />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function Skills({ skills, today }: { skills: Skill[]; today: string }) {
  const ed = useEditor<Skill>();
  const it = ed.item;
  const [levelFor, setLevelFor] = useState<Skill | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [cat, setCat] = useState("");
  const shown = skills.filter((s) => !cat || s.category === cat);
  const history = skills.find((s) => s.id === historyId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select aria-label="Filter by category" className="h-8 w-56" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {Object.entries(SKILL_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> New skill</Button>
      </div>
      {!skills.length ? (
        <EmptyState icon={Sparkles} title="No skills" description="Log your skills and their level over time. What you imported from Segundo Cerebro shows up here." />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {shown.map((s) => (
            <li key={s.id} className="rounded-md border border-border p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{s.name}</p>
                  <p className="text-[11px] text-muted">
                    {SKILL_CATEGORIES[s.category as keyof typeof SKILL_CATEGORIES] ?? "Other"}
                    {s.last_practiced_on && ` · practiced ${formatDay(s.last_practiced_on)}`}
                    {s.projects > 0 && ` · ${s.projects} ${s.projects === 1 ? "project" : "projects"}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {s.current != null ? `${formatNumber(s.current, 1)}` : "—"}
                  <span className="text-xs text-muted">{s.target_level != null ? ` / target ${s.target_level}` : "/10"}</span>
                </span>
              </div>
              <div className="mt-2"><LevelBar current={s.current} target={s.target_level} /></div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <Button size="sm" variant="secondary" onClick={() => setLevelFor(s)}>Log level</Button>
                {s.levels.length > 0 && <Button size="sm" variant="ghost" onClick={() => setHistoryId(s.id)}><History /> History ({s.levels.length})</Button>}
                <span className="flex-1" />
                <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${s.name}`} onClick={() => ed.setEditing(s)}><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${s.name}`}><Trash2 /></Button>}
                  title={`Delete “${s.name}”?`}
                  description="It will be deleted with its whole level history. Projects and learning resources are kept."
                  onConfirm={async () => {
                    const r = await deleteSkill(s.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Skill deleted");
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted">The level is your own rating from 0 to 10; the vertical mark is your target. The current level is the most recent entry.</p>

      <EntityDialog<SkillInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Edit skill" : "New skill"}
        schema={skillSchema}
        defaults={it
          ? { name: it.name, category: (it.category ?? "other") as SkillInput["category"], target_level: it.target_level, last_practiced_on: it.last_practiced_on ?? "", evidence: it.evidence ?? "" }
          : { name: "", category: "data_analytics", target_level: null, last_practiced_on: "", evidence: "" }}
        fields={[
          { name: "name", label: "Name", kind: "text", placeholder: "E.g. SQL, Power BI, English" },
          { name: "category", label: "Category", kind: "select", options: SKILL_CATEGORIES, half: true },
          { name: "target_level", label: "Target level (1–10, optional)", kind: "number", min: 1, max: 10, half: true },
          { name: "last_practiced_on", label: "Last practiced (optional)", kind: "date", half: true },
          { name: "evidence", label: "Evidence (optional)", kind: "textarea", placeholder: "Certificates, projects, achievements that show it" },
        ]}
        onSave={(v) => saveSkill(v, it?.id)}
      />
      <EntityDialog<SkillLevelInput>
        open={levelFor !== null} onOpenChange={(o) => !o && setLevelFor(null)}
        title={levelFor ? `${levelFor.name} level` : "Level"} description="It's added to the history; it doesn't replace earlier entries."
        schema={skillLevelSchema} successMessage="Level logged"
        defaults={{ skill_id: levelFor?.id ?? "", level: levelFor?.current ?? (undefined as unknown as number), assessed_on: today, notes: "" }}
        fields={[
          { name: "level", label: "Level (0 to 10)", kind: "number", min: 0, max: 10, step: 0.5, half: true },
          { name: "assessed_on", label: "Date", kind: "date", half: true },
          { name: "notes", label: "Notes (optional)", kind: "textarea" },
        ]}
        onSave={(v) => addSkillLevel(v)}
      />
      <HistoryDialog skill={history} onClose={() => setHistoryId(null)} />
    </div>
  );
}
