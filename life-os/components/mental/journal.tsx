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
  emotional: "¿Qué sentiste hoy y qué crees que lo provocó?",
  thought: "¿Qué pensamiento se repitió? ¿Qué te dirías con amabilidad?",
  difficult: "¿Qué pasó? ¿Cómo lo viviste? ¿Qué necesitabas?",
  reflection: "¿Qué estás notando de ti en estos días?",
  helped: "¿Qué te ayudó a sentirte un poco mejor?",
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
    toast.success(item ? "Entrada actualizada" : "Entrada guardada");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar entrada" : "Nueva entrada del diario emocional"}</DialogTitle>
          <DialogDescription>Solo tú puedes verla. Escribe lo que quieras, sin formato.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jr-date">Fecha</Label>
              <Input id="jr-date" type="date" max={today} {...register("entry_date")} />
              <FieldError message={formState.errors.entry_date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jr-kind">Tipo</Label>
              <Select id="jr-kind" {...register("kind")}>
                {Object.entries(JOURNAL_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jr-title">Título (opcional)</Label>
            <Input id="jr-title" maxLength={200} {...register("title")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jr-content">Texto</Label>
            <Textarea id="jr-content" rows={8} placeholder={PROMPTS[kind] ?? ""} aria-invalid={!!formState.errors.content} {...register("content")} />
            <FieldError message={formState.errors.content?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Guardando…" : "Guardar"}</Button>
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
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus /> Escribir</Button>
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
        title="Sin entradas en este periodo"
        description="Un espacio para escribir emociones, pensamientos, experiencias difíciles o lo que te ayudó."
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select aria-label="Filtrar por tipo" className="h-8 w-48" value={filter} onChange={(e) => setFilter(e.target.value as Kind | "")}>
          <option value="">Todos los tipos</option>
          {Object.entries(JOURNAL_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <span className="text-xs text-muted">{shown.length} {shown.length === 1 ? "entrada" : "entradas"}</span>
      </div>
      <ul className="space-y-2">
        {shown.map((i) => {
          const long = i.content.length > 280;
          const open = expanded.has(i.id);
          return (
            <li key={i.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{formatDay(i.entry_date, "EEE d MMM yyyy")} · {JOURNAL_KINDS[i.kind as Kind] ?? i.kind}</p>
                  {i.title && <p className="mt-0.5 text-sm font-medium break-words">{i.title}</p>}
                </div>
                <div className="flex shrink-0">
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Editar entrada" onClick={() => setEditing(i)}><Pencil /></Button>
                  <ConfirmDialog
                    trigger={<Button size="icon" variant="ghost" className="size-8" aria-label="Eliminar entrada"><Trash2 /></Button>}
                    title="¿Eliminar esta entrada?"
                    description={`Se eliminará la entrada del ${formatDay(i.entry_date)}. Esta acción no se puede deshacer.`}
                    onConfirm={async () => {
                      const r = await deleteJournalEntry(i.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Entrada eliminada");
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
                  {open ? "Ver menos" : "Ver todo"}
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
