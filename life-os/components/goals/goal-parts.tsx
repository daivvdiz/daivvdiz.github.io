"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flag, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GOAL_STATUS, type GoalStatus } from "@/lib/goals/schema";
import { deleteGoal, deleteMilestone, saveMilestone, setGoalStatus, toggleMilestone } from "@/lib/goals/actions";
import type { Goal } from "@/lib/goals/queries";

/** Barra de avance neutra (sin colores de "bien" o "mal"). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function StatusSelect({ goal }: { goal: Goal }) {
  const [pending, setPending] = useState(false);
  return (
    <Select
      aria-label="Goal status"
      className="h-8 w-40"
      value={goal.status}
      disabled={pending}
      onChange={async (e) => {
        setPending(true);
        const r = await setGoalStatus(goal.id, e.target.value as GoalStatus);
        setPending(false);
        if (!r.ok) return void toast.error(r.error);
        toast.success("Status updated");
      }}
    >
      {Object.entries(GOAL_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </Select>
  );
}

export function DeleteGoalButton({ goal }: { goal: Goal }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button size="sm" variant="ghost"><Trash2 /> Delete</Button>}
      title={`Delete “${goal.title}”?`}
      description="The goal and its milestones will be deleted. Linked habits, accomplishments, events and journal days are kept; they just lose the link. If you're no longer pursuing it, you can mark it as “Let go”."
      onConfirm={async () => {
        const r = await deleteGoal(goal.id);
        if (!r.ok) return void toast.error(r.error);
        toast.success("Goal deleted");
        router.push("/goals");
      }}
    />
  );
}

export function Milestones({ goal, today }: { goal: Goal; today: string }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string; due: string } | null>(null);

  const add = async () => {
    if (!title.trim()) return;
    setPending(true);
    const r = await saveMilestone({ goal_id: goal.id, title, due_date: due });
    setPending(false);
    if (!r.ok) return void toast.error(r.error);
    setTitle("");
    setDue("");
  };
  const saveEdit = async () => {
    if (!editing) return;
    const r = await saveMilestone({ goal_id: goal.id, title: editing.title, due_date: editing.due }, editing.id);
    if (!r.ok) return void toast.error(r.error);
    setEditing(null);
  };

  const done = goal.milestones.filter((m) => m.completed_at).length;

  return (
    <div className="space-y-3">
      {goal.milestones.length === 0 ? (
        <EmptyState icon={Flag} title="No milestones" description="Break the goal into concrete steps. They're optional." className="py-3" />
      ) : (
        <>
          <p className="text-xs text-muted">{done} of {goal.milestones.length} completed</p>
          <ul className="space-y-1.5">
            {goal.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!m.completed_at}
                  aria-label={`Mark “${m.title}” as ${m.completed_at ? "pending" : "completed"}`}
                  onClick={async () => {
                    const r = await toggleMilestone(m.id, m.completed_at ? null : today);
                    if (!r.ok) toast.error(r.error);
                  }}
                  className={cn("flex size-5 shrink-0 items-center justify-center rounded border", m.completed_at ? "border-accent bg-accent text-accent-foreground" : "border-border")}
                >
                  {m.completed_at && <Check className="size-3.5" />}
                </button>
                {editing?.id === m.id ? (
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    <Input aria-label="Milestone title" className="h-8 min-w-0 flex-1" value={editing.title} maxLength={200}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveEdit()} autoFocus />
                    <Input aria-label="Milestone date" type="date" className="h-8 w-36" value={editing.due} onChange={(e) => setEditing({ ...editing, due: e.target.value })} />
                    <Button size="icon" className="size-8" aria-label="Save milestone" onClick={saveEdit}><Check /></Button>
                    <Button size="icon" variant="ghost" className="size-8" aria-label="Cancel" onClick={() => setEditing(null)}><X /></Button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className={cn("break-words text-sm", m.completed_at && "text-muted line-through")}>{m.title}</p>
                      {(m.due_date || m.completed_at) && (
                        <p className="text-[11px] text-muted">
                          {m.completed_at ? `Completed on ${formatDay(m.completed_at)}` : `Due ${formatDay(m.due_date!)}`}
                        </p>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${m.title}`}
                      onClick={() => setEditing({ id: m.id, title: m.title, due: m.due_date ?? "" })}><Pencil /></Button>
                    <ConfirmDialog
                      trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${m.title}`}><Trash2 /></Button>}
                      title="Delete this milestone?"
                      description={`“${m.title}” will be deleted. This can't be undone.`}
                      onConfirm={async () => {
                        const r = await deleteMilestone(m.id);
                        if (!r.ok) toast.error(r.error);
                      }}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Input aria-label="New milestone" placeholder="New milestone" className="min-w-0 flex-1" value={title} maxLength={200}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        <Input aria-label="New milestone date (optional)" type="date" className="w-40" value={due} onChange={(e) => setDue(e.target.value)} />
        <Button variant="secondary" onClick={add} disabled={pending || !title.trim()}><Plus /> Add</Button>
      </div>
    </div>
  );
}
