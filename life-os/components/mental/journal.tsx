"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDay } from "@/lib/format";
import { JOURNAL_KINDS, journalSchema, type JournalInput } from "@/lib/mental/schema";
import { deleteJournalEntry, saveJournalEntry } from "@/lib/mental/actions";

export type JournalItem = { id: string; entry_date: string; kind: string; title: string | null; content: string };
type Kind = keyof typeof JOURNAL_KINDS;

const PROMPTS: Record<Kind, string> = {
  emotional: "What did you feel today, and what do you think caused it?",
  thought: "Which thought kept coming back? What would you kindly tell yourself?",
  difficult: "What happened? How did you experience it? What did you need?",
  reflection: "What are you noticing about yourself lately?",
  helped: "What helped you feel a little better?",
};

function JournalDialog({ open, onOpenChange, item, today }: { open: boolean; onOpenChange: (o: boolean) => void; item?: JournalItem; today: string }) {
  const form = useForm<JournalInput>({
    resolver: zodResolver(journalSchema),
    values: item
      ? { entry_date: item.entry_date, kind: item.kind as Kind, title: item.title ?? "", content: item.content }
      : { entry_date: today, kind: "emotional", title: "", content: "" },
  });
  useResetOnOpen(open, () => form.reset());
  const { register, handleSubmit, watch, formState } = form;
  const kind = watch("kind");

  const onSubmit = handleSubmit(async (v) => {
    const r = await saveJournalEntry(v, item?.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(item ? "Entry updated" : "Entry saved");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit entry" : "New emotional journal entry"}</DialogTitle>
          <DialogDescription>Only you can see it. Write whatever you want, no format needed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jr-date">Date</Label>
              <Input id="jr-date" type="date" max={today} {...register("entry_date")} />
              <FieldError message={formState.errors.entry_date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jr-kind">Type</Label>
              <Select id="jr-kind" {...register("kind")}>
                {Object.entries(JOURNAL_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jr-title">Title (optional)</Label>
            <Input id="jr-title" maxLength={200} {...register("title")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jr-content">Text</Label>
            <Textarea id="jr-content" rows={8} placeholder={PROMPTS[kind] ?? ""} aria-invalid={!!formState.errors.content} {...register("content")} />
            <FieldError message={formState.errors.content?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewJournalButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus /> Write</Button>
      <JournalDialog open={open} onOpenChange={setOpen} today={today} />
    </>
  );
}

export function JournalList({ items, today }: { items: JournalItem[]; today: string }) {
  const [filter, setFilter] = useState<"" | Kind>("");
  const [editing, setEditing] = useState<JournalItem | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const shown = filter ? items.filter((i) => i.kind === filter) : items;

  if (!items.length)
    return (
      <EmptyState
        icon={NotebookPen}
        title="No entries in this period"
        description="A space to write about emotions, thoughts, difficult experiences or what helped you."
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select aria-label="Filter by type" className="h-8 w-48" value={filter} onChange={(e) => setFilter(e.target.value as Kind | "")}>
          <option value="">All types</option>
          {Object.entries(JOURNAL_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <span className="text-xs text-muted">{shown.length} {shown.length === 1 ? "entry" : "entries"}</span>
      </div>
      <ul className="space-y-2">
        {shown.map((i) => {
          const long = i.content.length > 280;
          const open = expanded.has(i.id);
          return (
            <li key={i.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{formatDay(i.entry_date, "EEE, MMM d, yyyy")} · {JOURNAL_KINDS[i.kind as Kind] ?? i.kind}</p>
                  {i.title && <p className="mt-0.5 text-sm font-medium break-words">{i.title}</p>}
                </div>
                <div className="flex shrink-0">
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Edit entry" onClick={() => setEditing(i)}><Pencil /></Button>
                  <ConfirmDialog
                    trigger={<Button size="icon" variant="ghost" className="size-8" aria-label="Delete entry"><Trash2 /></Button>}
                    title="Delete this entry?"
                    description={`The entry from ${formatDay(i.entry_date)} will be deleted. This can't be undone.`}
                    onConfirm={async () => {
                      const r = await deleteJournalEntry(i.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Entry deleted");
                    }}
                  />
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
                {long && !open ? `${i.content.slice(0, 280)}…` : i.content}
              </p>
              {long && (
                <button type="button" className="mt-1 text-xs text-accent hover:underline"
                  onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })}>
                  {open ? "Show less" : "Show all"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <JournalDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} item={editing ?? undefined} today={today} />
    </div>
  );
}
