"use client";

import { Apple, Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityDialog, useEditor } from "@/components/entity-dialog";
import { formatDay, formatNumber } from "@/lib/format";
import {
  BODY_MEASUREMENTS, bodySchema, nutritionSchema, type BodyInput, type BodyMeasurementKey, type NutritionInput,
} from "@/lib/physical/schema";
import { deleteBodyMetric, deleteNutrition, saveBodyMetric, saveNutrition } from "@/lib/physical/actions";
import type { BodyMetric, NutritionLog } from "@/lib/physical/queries";

const MKEYS = Object.keys(BODY_MEASUREMENTS) as BodyMeasurementKey[];
const measurementDefaults = (m: Record<string, number>) =>
  Object.fromEntries(MKEYS.map((k) => [k, m[k] ?? null])) as Record<BodyMeasurementKey, number | null>;

export function BodyList({ metrics, today }: { metrics: BodyMetric[]; today: string }) {
  const ed = useEditor<BodyMetric>();
  const it = ed.item;
  const lastHeight = metrics.find((m) => m.height_cm != null)?.height_cm ?? null;
  return (
    <div className="space-y-3">
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> New entry</Button>
      {!metrics.length ? (
        <EmptyState icon={Ruler} title="No body measurements" description="Weight, height, body fat percentage (optional) and measurements. Log only what you want." />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {metrics.map((m) => {
            const parts = [
              m.weight_kg != null && `${formatNumber(m.weight_kg, 1)} kg`,
              m.height_cm != null && `${formatNumber(m.height_cm, 0)} cm tall`,
              m.body_fat_pct != null && `${formatNumber(m.body_fat_pct, 1)}% body fat`,
            ].filter(Boolean);
            const meas = MKEYS.filter((k) => m.measurements[k] != null).map((k) => `${BODY_MEASUREMENTS[k]} ${formatNumber(m.measurements[k], 1)} cm`);
            return (
              <li key={m.id} className="flex items-start gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm tabular-nums">{parts.join(" · ") || "Only measurements or notes"}</p>
                  <p className="text-[11px] text-muted">{formatDay(m.measured_on)}{meas.length > 0 && ` · ${meas.join(" · ")}`}</p>
                  {m.notes && <p className="mt-0.5 break-words text-xs text-muted">{m.notes}</p>}
                </div>
                <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit entry from ${formatDay(m.measured_on)}`} onClick={() => ed.setEditing(m)}><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete entry from ${formatDay(m.measured_on)}`}><Trash2 /></Button>}
                  title="Delete this entry?" description="This can't be undone."
                  onConfirm={async () => {
                    const r = await deleteBodyMetric(m.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Entry deleted");
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      <EntityDialog<BodyInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()} wide
        title={it ? "Edit measurements" : "New measurements"} description="Everything is optional; leave empty what you don't measure."
        schema={bodySchema}
        defaults={it
          ? { measured_on: it.measured_on, weight_kg: it.weight_kg, height_cm: it.height_cm, body_fat_pct: it.body_fat_pct, notes: it.notes ?? "",
              ...measurementDefaults(it.measurements) }
          : { measured_on: today, weight_kg: null, height_cm: lastHeight, body_fat_pct: null, notes: "", ...measurementDefaults({}) }}
        fields={[
          { name: "measured_on", label: "Date", kind: "date", half: true },
          { name: "weight_kg", label: "Weight (kg)", kind: "number", step: 0.1, half: true },
          { name: "height_cm", label: "Height (cm)", kind: "number", step: 0.5, half: true, hint: lastHeight != null && !it ? "Taken from your last entry." : undefined },
          { name: "body_fat_pct", label: "Body fat (%)", kind: "number", step: 0.1, half: true },
          ...MKEYS.map((k) => ({ name: k, label: `${BODY_MEASUREMENTS[k]} (cm)`, kind: "number" as const, step: 0.5, half: true })),
          { name: "notes", label: "Notes (optional)", kind: "textarea" },
        ]}
        onSave={(v) => saveBodyMetric(v, it?.id)}
      />
    </div>
  );
}

export function NutritionList({ logs, today }: { logs: NutritionLog[]; today: string }) {
  const ed = useEditor<NutritionLog>();
  const it = ed.item;
  const hasToday = logs.some((l) => l.logged_on === today);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-xs text-muted">Optional. It's for remembering how you ate, not for hitting targets or counting everything.</p>
        <Button size="sm" variant="secondary" onClick={() => ed.setEditing(hasToday ? logs.find((l) => l.logged_on === today)! : "new")}>
          {hasToday ? <><Pencil /> Edit today's</> : <><Plus /> Log day</>}
        </Button>
      </div>
      {!logs.length ? (
        <EmptyState icon={Apple} title="No nutrition entries" description="Meals, water, protein or calories: whatever is useful to you, whenever you want." />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {logs.map((l) => {
            const parts = [
              l.water_liters != null && `${formatNumber(l.water_liters, 1)} L of water`,
              l.protein_g != null && `${formatNumber(l.protein_g, 0)} g of protein`,
              l.calories != null && `${formatNumber(l.calories, 0)} kcal`,
            ].filter(Boolean);
            return (
              <li key={l.id} className="flex items-start gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{formatDay(l.logged_on, "EEE, MMM d, yyyy")}</p>
                  {parts.length > 0 && <p className="text-[11px] tabular-nums text-muted">{parts.join(" · ")}</p>}
                  {l.meals && <p className="mt-0.5 line-clamp-3 whitespace-pre-line break-words text-xs">{l.meals}</p>}
                  {l.notes && <p className="mt-0.5 break-words text-xs text-muted">{l.notes}</p>}
                </div>
                <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${formatDay(l.logged_on)}`} onClick={() => ed.setEditing(l)}><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${formatDay(l.logged_on)}`}><Trash2 /></Button>}
                  title="Delete this entry?" description="This can't be undone."
                  onConfirm={async () => {
                    const r = await deleteNutrition(l.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Entry deleted");
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      <EntityDialog<NutritionInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? `Nutrition for ${formatDay(it.logged_on)}` : "Log nutrition"} description="One entry per day. Everything is optional."
        schema={nutritionSchema}
        defaults={it
          ? { logged_on: it.logged_on, meals: it.meals ?? "", water_liters: it.water_liters, protein_g: it.protein_g, calories: it.calories, notes: it.notes ?? "" }
          : { logged_on: today, meals: "", water_liters: null, protein_g: null, calories: null, notes: "" }}
        fields={[
          { name: "logged_on", label: "Date", kind: "date" },
          { name: "meals", label: "Meals", kind: "textarea", placeholder: "Breakfast, lunch, dinner…" },
          { name: "water_liters", label: "Water (L)", kind: "number", step: 0.1, half: true },
          { name: "protein_g", label: "Protein (g)", kind: "number", step: 1, half: true },
          { name: "calories", label: "Calories (kcal)", kind: "number", step: 1, half: true },
          { name: "notes", label: "Notes", kind: "textarea" },
        ]}
        onSave={(v) => saveNutrition(v, it?.id)}
      />
    </div>
  );
}
