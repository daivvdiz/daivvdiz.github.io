"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Pencil, Plus, Radar as RadarIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DIMENSIONS, type LifeAssessment } from "@/lib/types";
import { formatDay } from "@/lib/format";
import { deleteAssessment } from "@/lib/assessments/actions";
import { AssessmentForm } from "./assessment-form";

export function LifeRadar({ assessments, today }: { assessments: LifeAssessment[]; today: string }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(assessments[0]?.id ?? "");
  const [compareId, setCompareId] = useState(assessments[1]?.id ?? "");
  const [editing, setEditing] = useState<LifeAssessment | "new" | null>(null);

  const current = assessments.find((a) => a.id === selectedId) ?? assessments[0];
  const compare = assessments.find((a) => a.id === compareId && a.id !== current?.id);

  const data = useMemo(
    () =>
      DIMENSIONS.map((d) => ({
        dimension: d.label,
        actual: current?.[d.key],
        anterior: compare?.[d.key],
      })),
    [current, compare],
  );

  const close = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Balance de vida</CardTitle>
          <CardDescription>Tu propia valoración de 1 a 10. Sin puntaje global.</CardDescription>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
          <Plus /> Autoevaluar
        </Button>
      </CardHeader>
      <CardContent>
        {!current ? (
          <EmptyState
            icon={RadarIcon}
            title="Aún no tienes autoevaluaciones"
            description="Valora cómo te sientes en cada área. Podrás comparar cómo cambia con el tiempo."
            action={<Button size="sm" onClick={() => setEditing("new")}>Crear la primera</Button>}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted">
                Evaluación
                <Select value={current.id} onChange={(e) => setSelectedId(e.target.value)}>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>{formatDay(a.assessed_on)}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs text-muted">
                Comparar con
                <Select value={compare?.id ?? ""} onChange={(e) => setCompareId(e.target.value)}>
                  <option value="">Sin comparación</option>
                  {assessments.filter((a) => a.id !== current.id).map((a) => (
                    <option key={a.id} value={a.id}>{formatDay(a.assessed_on)}</option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="h-80 w-full" role="img" aria-label="Gráfico de radar con tus seis dimensiones de vida">
              <ResponsiveContainer>
                <RadarChart data={data} outerRadius="78%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "var(--muted)", fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={false} axisLine={false} />
                  {compare && (
                    <Radar name={formatDay(compare.assessed_on)} dataKey="anterior" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.08} strokeDasharray="4 3" />
                  )}
                  <Radar name={formatDay(current.assessed_on)} dataKey="actual" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  {compare && <Legend wrapperStyle={{ fontSize: 12 }} />}
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {current.notes && <p className="mt-1 text-sm text-muted">“{current.notes}”</p>}
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>{assessments.length} {assessments.length === 1 ? "autoevaluación" : "autoevaluaciones"} en total</span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(current)}>
                  <Pencil /> Editar
                </Button>
                <ConfirmDialog
                  trigger={<Button size="sm" variant="ghost"><Trash2 /> Eliminar</Button>}
                  title="¿Eliminar esta autoevaluación?"
                  description={`Se eliminará la del ${formatDay(current.assessed_on)}. Esta acción no se puede deshacer.`}
                  onConfirm={async () => {
                    const res = await deleteAssessment(current.id);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("Autoevaluación eliminada");
                    setSelectedId("");
                    router.refresh();
                  }}
                />
              </span>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nueva autoevaluación" : "Editar autoevaluación"}</DialogTitle>
            <DialogDescription>No hay respuestas correctas: es una foto de cómo lo vives hoy.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <AssessmentForm initial={editing === "new" ? undefined : editing} today={today} onDone={close} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
