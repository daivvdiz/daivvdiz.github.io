"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileAttachments } from "@/components/calendar/attachments";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { cn } from "@/lib/utils";
import { IMPORTANCE, MEMORY_CATEGORIES, memorySchema, type MemoryInput } from "@/lib/archive/schema";
import { deleteMemory, deleteMemoryAttachment, registerMemoryAttachment, saveMemory } from "@/lib/archive/actions";
import type { Memory, Option } from "@/lib/archive/queries";

export type Options = { goals: Option[]; projects: Option[]; events: Option[]; workouts: Option[] };

export const toInput = (m: Memory): MemoryInput => ({
  title: m.title, occurred_on: m.occurred_on, category: m.category, description: m.description ?? "", location: m.location ?? "",
  people: m.people.join(", "), emotional_context: m.emotional_context ?? "", importance: m.importance ? (String(m.importance) as MemoryInput["importance"]) : "",
  chapter: m.chapter ?? "", tags: m.tags.join(", "), goal_id: m.goal_id ?? "", event_id: m.event_id ?? "", project_id: m.project_id ?? "",
  workout_id: m.workout_id ?? "", link_daily_entry: !!m.daily_entry_id,
});

/** Un recuerdo provisional con lo que se acaba de guardar, mientras llega la lista actualizada. */
export const fromInput = (id: string, v: MemoryInput): Memory => ({
  id, title: v.title, occurred_on: v.occurred_on, category: v.category, description: v.description || null, location: v.location || null,
  emotional_context: v.emotional_context || null, importance: v.importance ? Number(v.importance) : null, chapter: v.chapter || null,
  goal_id: v.goal_id || null, event_id: v.event_id || null, project_id: v.project_id || null, workout_id: v.workout_id || null,
  daily_entry_id: v.link_daily_entry ? "pendiente" : null, people: (v.people ?? "").split(",").map((s) => s.trim()).filter(Boolean), tags: (v.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean), files: [],
});

function Field({ id, label, error, children, half, hint }: { id: string; label: string; error?: string; children: React.ReactNode; half?: boolean; hint?: string }) {
  return (
    <div className={cn("space-y-1.5", !half && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

export function MemoryDialog({ open, onOpenChange, memory, isNew, options, chapters, today, userId, onCreated, preset }: {
  open: boolean; onOpenChange: (o: boolean) => void; memory: Memory | undefined; isNew: boolean; options: Options; chapters: string[];
  today: string; userId: string; onCreated: (m: Memory) => void; preset?: Partial<MemoryInput>;
}) {
  const defaults: MemoryInput = memory
    ? toInput(memory)
    : {
        title: "", occurred_on: today, category: "personal", description: "", location: "", people: "", emotional_context: "", importance: "",
        chapter: "", tags: "", goal_id: "", event_id: "", project_id: "", workout_id: "", link_daily_entry: false, ...preset,
      };
  const { register, handleSubmit, formState, reset } = useForm<MemoryInput>({
    resolver: zodResolver(memorySchema) as unknown as Resolver<MemoryInput>,
    values: defaults,
  });
  useResetOnOpen(open, () => reset(defaults));
  const e = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    const r = await saveMemory(v, memory?.id);
    if (!r.ok) return void toast.error(r.error);
    if (memory) {
      toast.success("Memory updated");
      onOpenChange(false);
    } else {
      toast.success("Memory saved. You can now add photos or files to it.");
      onCreated(fromInput(r.id, v));
    }
  });

  const sel = (name: "goal_id" | "event_id" | "project_id" | "workout_id", label: string, opts: Option[]) => (
    <Field id={`m-${name}`} label={label} half>
      <Select id={`m-${name}`} {...register(name)}>
        <option value="">None</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Select>
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{memory ? "Edit memory" : "New memory"}</DialogTitle>
          <DialogDescription>Only the title and date are required. You decide what matters.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field id="m-title" label="Title" error={e.title?.message}>
            <Input id="m-title" maxLength={200} aria-invalid={!!e.title} {...register("title")} />
          </Field>
          <Field id="m-date" label="Date" error={e.occurred_on?.message} half>
            <Input id="m-date" type="date" aria-invalid={!!e.occurred_on} {...register("occurred_on")} />
          </Field>
          <Field id="m-category" label="Category" half>
            <Select id="m-category" {...register("category")}>
              {Object.entries(MEMORY_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field id="m-description" label="Description" error={e.description?.message}>
            <Textarea id="m-description" rows={4} {...register("description")} />
          </Field>
          <Field id="m-location" label="Place (optional)" error={e.location?.message} half>
            <Input id="m-location" maxLength={200} {...register("location")} />
          </Field>
          <Field id="m-people" label="People (optional)" error={e.people?.message} half hint="Separate them with commas.">
            <Input id="m-people" placeholder="E.g. Mom, Laura" {...register("people")} />
          </Field>
          <Field id="m-emotional" label="How you felt (optional)" error={e.emotional_context?.message}>
            <Input id="m-emotional" maxLength={500} {...register("emotional_context")} />
          </Field>
          <Field id="m-importance" label="Importance (optional)" half>
            <Select id="m-importance" {...register("importance")}>
              {Object.entries(IMPORTANCE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field id="m-chapter" label="Chapter (optional)" error={e.chapter?.message} half hint="A stage of your life, e.g. University.">
            <Input id="m-chapter" list="m-chapters" maxLength={100} {...register("chapter")} />
            <datalist id="m-chapters">{chapters.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field id="m-tags" label="Tags (optional)" error={e.tags?.message} hint="Separate them with commas.">
            <Input id="m-tags" placeholder="E.g. beach, birthday" {...register("tags")} />
          </Field>
          {sel("goal_id", "Related goal", options.goals)}
          {sel("event_id", "Related event", options.events)}
          {sel("project_id", "Related project", options.projects)}
          {sel("workout_id", "Related workout", options.workouts)}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" {...register("link_daily_entry")} />
            Link to that day's journal entry (if there is one)
          </label>

          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">Photos and files</p>
            {memory ? (
              <FileAttachments pathPrefix={`${userId}/memories/${memory.id}/`} files={memory.files}
                onRegister={(f) => registerMemoryAttachment({ memoryId: memory.id, ...f })} onDelete={deleteMemoryAttachment} />
            ) : (
              <p className="text-[11px] text-muted">You can add them as soon as you save the memory.</p>
            )}
          </div>

          <DialogFooter className="sm:col-span-2 sm:justify-between">
            {memory ? (
              <ConfirmDialog
                trigger={<Button type="button" variant="ghost"><Trash2 /> Delete</Button>}
                title={`Delete “${memory.title}”?`}
                description={`It will be deleted along with ${memory.files.length === 1 ? "its file" : memory.files.length ? `its ${memory.files.length} files` : "its people and tags"}. This can't be undone.`}
                onConfirm={async () => {
                  const r = await deleteMemory(memory.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Memory deleted");
                  setTimeout(() => onOpenChange(false), 0);
                }}
              />
            ) : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{memory && isNew ? "Done" : "Cancel"}</Button>
              <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving…" : "Save"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
