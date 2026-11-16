"use client";

import { useState } from "react";
import { Controller, useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { ZodTypeAny } from "zod";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/finance/money-input";
import { cn } from "@/lib/utils";
import { useResetOnOpen } from "@/lib/use-reset-on-open";

export type Field = {
  name: string;
  label: string;
  kind: "text" | "url" | "money" | "number" | "date" | "time" | "textarea" | "select" | "toggles" | "range";
  options?: Record<string, string>;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Ocupa media fila en pantallas medianas. */
  half?: boolean;
  /** Sugerencias para un campo de texto (se puede escribir otro valor). */
  suggestions?: string[];
};

type SaveResult = { ok: true } | { ok: false; error: string };

/** Diálogo de formulario genérico para entidades simples (finanzas, carrera…). */
export function EntityDialog<T extends FieldValues>({
  open, onOpenChange, title, description, schema, defaults, fields, onSave, footer, children, successMessage = "Guardado", wide,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; schema: ZodTypeAny;
  defaults: T; fields: Field[]; onSave: (v: T) => Promise<SaveResult>; footer?: React.ReactNode; children?: React.ReactNode;
  successMessage?: string; wide?: boolean;
}) {
  const { register, handleSubmit, control, formState, reset, watch } = useForm<T>({
    resolver: zodResolver(schema) as unknown as Resolver<T>,
    values: defaults,
    defaultValues: defaults as DefaultValues<T>,
  });
  useResetOnOpen(open, () => reset());
  const errors = formState.errors as Record<string, { message?: string } | undefined>;
  const onSubmit = handleSubmit(async (v) => {
    const r = await onSave(v);
    if (!r.ok) return void toast.error(r.error);
    toast.success(successMessage);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? "max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          {fields.map((f) => {
            const id = `ent-${f.name}`;
            const err = errors[f.name]?.message;
            const name = f.name as never;
            return (
              <div key={f.name} className={cn("space-y-1.5", !f.half && "sm:col-span-2")}>
                {f.kind !== "toggles" && (
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor={id}>{f.label}</Label>
                    {f.kind === "range" && <span className="text-xs tabular-nums">{String(watch(name) ?? 0)}%</span>}
                  </div>
                )}
                {f.kind === "money" ? (
                  <Controller control={control} name={name}
                    render={({ field }) => <MoneyInput id={id} placeholder={f.placeholder} value={field.value as number | null} onChange={field.onChange} invalid={!!err} />} />
                ) : f.kind === "number" ? (
                  <Controller control={control} name={name}
                    render={({ field }) => (
                      <Input id={id} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step ?? 1} placeholder={f.placeholder} aria-invalid={!!err}
                        value={field.value == null || Number.isNaN(field.value) ? "" : String(field.value)}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                    )} />
                ) : f.kind === "range" ? (
                  <input id={id} type="range" min={f.min ?? 0} max={f.max ?? 100} step={f.step ?? 5} className="w-full accent-[var(--accent)]"
                    {...register(name, { valueAsNumber: true })} />
                ) : f.kind === "textarea" ? (
                  <Textarea id={id} rows={3} placeholder={f.placeholder} aria-invalid={!!err} {...register(name)} />
                ) : f.kind === "select" ? (
                  <Select id={id} {...register(name)}>
                    {Object.entries(f.options ?? {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                ) : f.kind === "toggles" ? (
                  <Controller control={control} name={name}
                    render={({ field }) => {
                      const value = (field.value ?? []) as string[];
                      return (
                        <fieldset className="space-y-1.5">
                          <legend className="text-xs font-medium text-muted">{f.label}</legend>
                          {Object.keys(f.options ?? {}).length === 0 ? (
                            <p className="text-xs text-muted">{f.hint ?? "No hay opciones todavía."}</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(f.options ?? {}).map(([k, l]) => {
                                const on = value.includes(k);
                                return (
                                  <button key={k} type="button" aria-pressed={on}
                                    onClick={() => field.onChange(on ? value.filter((v) => v !== k) : [...value, k])}
                                    className={cn("max-w-full truncate rounded-full border px-2.5 py-1 text-xs",
                                      on ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground")}>
                                    {l}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </fieldset>
                      );
                    }} />
                ) : (
                  <>
                    <Input id={id} type={f.kind === "url" ? "url" : f.kind} placeholder={f.placeholder} aria-invalid={!!err}
                      list={f.suggestions?.length ? `${id}-list` : undefined} autoComplete={f.suggestions?.length ? "off" : undefined} {...register(name)} />
                    {!!f.suggestions?.length && <datalist id={`${id}-list`}>{f.suggestions.map((x) => <option key={x} value={x} />)}</datalist>}
                  </>
                )}
                {f.hint && f.kind !== "toggles" && <p className="text-[11px] text-muted">{f.hint}</p>}
                <FieldError message={err} />
              </div>
            );
          })}
          {children && <div className="sm:col-span-2">{children}</div>}
          <DialogFooter className="sm:col-span-2 sm:justify-between">
            {footer ?? <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Guardando…" : "Guardar"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useEditor<T>() {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  return { editing, open: editing !== null, item: editing && editing !== "new" ? (editing as T) : undefined, setEditing, close: () => setEditing(null) };
}
