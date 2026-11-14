"use client";

import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { dailyEntrySchema, type DailyEntryInput } from "@/lib/journal/schema";
import { deleteDailyEntry, saveDailyEntry } from "@/lib/journal/actions";
import type { CalEvent, DayEntry } from "@/lib/calendar/queries";
import { ScalePicker } from "./scale-picker";
import { Attachments } from "./attachments";
import type { GoalOption } from "./event-dialog";

const PROMPTS = [
  "¿Qué pasó hoy?",
  "¿Cuál fue el momento más importante?",
  "¿Qué aprendí?",
  "¿Qué me retó?",
  "¿Qué me gustaría recordar?",
];

function toForm(date: string, e: DayEntry | null): DailyEntryInput {
  return {
    entry_date: date,
    mood: e?.mood ?? null,
    energy: e?.energy ?? null,
    stress: e?.stress ?? null,
    sleep_hours: e?.sleep_hours ?? null,
    sleep_quality: e?.sleep_quality ?? null,
    sleep_notes: e?.sleep_notes ?? "",
    journal: e?.journal ?? "",
    memory: e?.memory ?? "",
    preserve_memory: e?.memoryInArchive ?? false,
    gratitude: [0, 1, 2].map((i) => e?.gratitude[i] ?? ""),
    accomplishments: (e?.accomplishments ?? []).map((a) => ({ id: a.id, content: a.content, is_main: a.is_main, goal_id: a.goal_id })),
    tag_names: e?.tags ?? [],
    goal_ids: e?.goal_ids ?? [],
    event_ids: e?.event_ids ?? [],
  };
}

export function DailyEntryForm({
  date,
  entry,
  events,
  goals,
  tagSuggestions,
  userId,
}: {
  date: string;
  entry: DayEntry | null;
  events: CalEvent[];
  goals: GoalOption[];
  tagSuggestions: string[];
  userId: string;
}) {
  const form = useForm<DailyEntryInput>({ resolver: zodResolver(dailyEntrySchema), values: toForm(date, entry) });
  const { register, control, handleSubmit, watch, setValue, getValues, formState } = form;
  const acc = useFieldArray({ control, name: "accomplishments", keyName: "key" });
  const [tagDraft, setTagDraft] = useState("");
  const tags = watch("tag_names");
  const importedIds = new Set((entry?.accomplishments ?? []).filter((a) => a.imported).map((a) => a.id));

  const addTag = () => {
    const t = tagDraft.trim().replace(/,$/, "");
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) setValue("tag_names", [...tags, t], { shouldDirty: true });
    setTagDraft("");
  };

  const onSubmit = handleSubmit(async (v) => {
    const r = await saveDailyEntry({ ...v, gratitude: v.gratitude.map((g) => g.trim()).filter(Boolean) });
    if (!r.ok) return void toast.error(r.error);
    toast.success("Entrada guardada");
  });

  const toggleIn = (field: "goal_ids" | "event_ids", id: string) => {
    const cur = getValues(field);
    setValue(field, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id], { shouldDirty: true });
  };
  const goalIds = watch("goal_ids");
  const eventIds = watch("event_ids");

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Cómo estuvo el día</CardTitle>
            <CardDescription>Todo es opcional. Toca un número otra vez para quitarlo.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          {(["mood", "energy", "stress"] as const).map((k) => (
            <Controller
              key={k}
              control={control}
              name={k}
              render={({ field }) => (
                <ScalePicker label={{ mood: "Ánimo", energy: "Energía", stress: "Estrés" }[k]} value={field.value} onChange={field.onChange} />
              )}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sueño</CardTitle></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-[10rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="sleep_hours">Horas dormidas</Label>
            <Controller
              control={control}
              name="sleep_hours"
              render={({ field }) => (
                <Input
                  id="sleep_hours"
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min={0}
                  max={24}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                  aria-invalid={!!formState.errors.sleep_hours}
                />
              )}
            />
            <FieldError message={formState.errors.sleep_hours?.message} />
          </div>
          <Controller
            control={control}
            name="sleep_quality"
            render={({ field }) => <ScalePicker label="Calidad del sueño" value={field.value} onChange={field.onChange} />}
          />
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="sleep_notes">Notas de sueño (opcional)</Label>
            <Input id="sleep_notes" {...register("sleep_notes")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Gratitud</CardTitle>
            <CardDescription>Hasta tres cosas, grandes o pequeñas.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Input key={i} aria-label={`Gratitud ${i + 1}`} placeholder={`${i + 1}.`} {...register(`gratitude.${i}` as const)} />
          ))}
          <FieldError message={formState.errors.gratitude?.message} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Diario</CardTitle>
            <CardDescription>Escribe libremente. Si quieres, usa una pregunta para empezar.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground"
                onClick={() => {
                  const cur = getValues("journal");
                  setValue("journal", `${cur}${cur && !cur.endsWith("\n") ? "\n\n" : ""}${p}\n`, { shouldDirty: true });
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <Textarea aria-label="Diario" className="min-h-48" {...register("journal")} />
          <FieldError message={formState.errors.journal?.message} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recuerdo del día</CardTitle>
            <CardDescription>Un momento concreto que quieras conservar.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea aria-label="Recuerdo del día" {...register("memory")} />
          {entry?.memoryInArchive ? (
            <p className="text-xs text-muted">Este recuerdo ya está en tu Archivo de vida y se actualiza al guardar.</p>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" {...register("preserve_memory")} />
              Guardarlo también en mi Archivo de vida
            </label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Logros</CardTitle>
            <CardDescription>Lo que hiciste y quieres reconocer. La estrella marca el principal.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => acc.append({ content: "", is_main: acc.fields.length === 0, goal_id: null })}>
            <Plus /> Agregar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {acc.fields.length === 0 && <p className="text-sm text-muted">Sin logros registrados este día.</p>}
          {acc.fields.map((f, i) => (
            <div key={f.key} className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center">
              <Controller
                control={control}
                name={`accomplishments.${i}.is_main`}
                render={({ field }) => (
                  <button
                    type="button"
                    aria-pressed={field.value}
                    aria-label="Marcar como logro principal"
                    title="Logro principal"
                    onClick={() => getValues("accomplishments").forEach((_, j) => setValue(`accomplishments.${j}.is_main`, j === i, { shouldDirty: true }))}
                    className="self-start rounded p-1.5 text-muted hover:text-foreground sm:self-center"
                  >
                    <Star className={cn("size-4", field.value && "fill-[var(--warning)] text-warning")} />
                  </button>
                )}
              />
              <div className="min-w-0 flex-1">
                <Input aria-label={`Logro ${i + 1}`} {...register(`accomplishments.${i}.content` as const)} />
                <FieldError message={formState.errors.accomplishments?.[i]?.content?.message} />
                {f.id && importedIds.has(f.id) && <p className="mt-1 text-[11px] text-muted">Importado de Segundo Cerebro</p>}
              </div>
              {goals.length > 0 && (
                <Controller
                  control={control}
                  name={`accomplishments.${i}.goal_id`}
                  render={({ field }) => (
                    <Select aria-label="Meta del logro" className="sm:w-48" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)}>
                      <option value="">Sin meta</option>
                      {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </Select>
                  )}
                />
              )}
              <Button type="button" variant="ghost" size="icon" aria-label="Quitar logro" onClick={() => acc.remove(i)}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Etiquetas y conexiones</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="tag-input">Etiquetas</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs">
                  {t}
                  <button type="button" aria-label={`Quitar ${t}`} onClick={() => setValue("tag_names", tags.filter((x) => x !== t), { shouldDirty: true })}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <Input
                id="tag-input"
                list="tag-suggestions"
                className="h-8 w-44"
                placeholder="Escribe y pulsa Enter"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
              />
              <datalist id="tag-suggestions">
                {tagSuggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-muted">Metas relacionadas</legend>
            {goals.length === 0 ? (
              <p className="text-sm text-muted">Aún no tienes metas. Podrás crearlas en Metas y hábitos (fase 4).</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {goals.map((g) => (
                  <button key={g.id} type="button" aria-pressed={goalIds.includes(g.id)} onClick={() => toggleIn("goal_ids", g.id)}
                    className={cn("rounded-full border px-2.5 py-1 text-xs", goalIds.includes(g.id) ? "border-accent bg-accent-soft" : "border-border text-muted")}>
                    {g.title}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-muted">Eventos de este día relacionados</legend>
            {events.length === 0 ? (
              <p className="text-sm text-muted">No hay eventos en el calendario este día.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {events.map((ev) => (
                  <button key={ev.id} type="button" aria-pressed={eventIds.includes(ev.id)} onClick={() => toggleIn("event_ids", ev.id)}
                    className={cn("rounded-full border px-2.5 py-1 text-xs", eventIds.includes(ev.id) ? "border-accent bg-accent-soft" : "border-border text-muted")}>
                    {ev.title}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Imágenes y archivos</CardTitle></CardHeader>
        <CardContent>
          {entry ? (
            <Attachments userId={userId} entryId={entry.id} files={entry.attachments} />
          ) : (
            <p className="text-sm text-muted">Guarda la entrada para poder adjuntar imágenes.</p>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        {entry ? (
          <ConfirmDialog
            trigger={<Button type="button" variant="ghost"><Trash2 /> Eliminar entrada</Button>}
            title="¿Eliminar la entrada de este día?"
            description="Se borrarán el ánimo, el sueño, la gratitud, los logros y los adjuntos de este día. Tus registros originales de Segundo Cerebro no se tocan."
            onConfirm={async () => {
              const r = await deleteDailyEntry(entry.id);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Entrada eliminada");
            }}
          />
        ) : <span className="text-xs text-muted">Aún no hay entrada para este día.</span>}
        <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Guardando…" : "Guardar entrada"}</Button>
      </div>
    </form>
  );
}
