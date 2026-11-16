"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveDayEmotions } from "@/lib/mental/actions";

const COMMON = ["Joy", "Calm", "Gratitude", "Excitement", "Pride", "Tiredness", "Anxiety", "Sadness", "Frustration", "Anger", "Fear", "Loneliness"];

type Emo = { name: string; intensity: number | null };

/** Emociones y factores de estrés de un día. Nada es obligatorio. */
export function EmotionsToday({
  date,
  initial,
  known,
}: {
  date: string;
  initial: { emotions: Emo[]; stress_factors: string[] };
  known: string[];
}) {
  const [emotions, setEmotions] = useState<Emo[]>(initial.emotions);
  const [factors, setFactors] = useState<string[]>(initial.stress_factors);
  const [newEmo, setNewEmo] = useState("");
  const [newFactor, setNewFactor] = useState("");
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify({ emotions, factors }) !== JSON.stringify({ emotions: initial.emotions, factors: initial.stress_factors });

  const suggestions = [...new Set([...known, ...COMMON])].filter((s) => !emotions.some((e) => e.name.toLowerCase() === s.toLowerCase()));

  const addEmo = (name: string) => {
    const n = name.trim().slice(0, 40);
    if (!n || emotions.some((e) => e.name.toLowerCase() === n.toLowerCase())) return setNewEmo("");
    if (emotions.length >= 15) return void toast.error("Maximum 15 emotions per day");
    setEmotions([...emotions, { name: n, intensity: null }]);
    setNewEmo("");
  };
  const addFactor = () => {
    const f = newFactor.trim().slice(0, 200);
    if (!f) return;
    if (factors.length >= 10) return void toast.error("Maximum 10 factors per day");
    setFactors([...factors, f]);
    setNewFactor("");
  };

  const save = async () => {
    setPending(true);
    const r = await saveDayEmotions({ date, emotions, stress_factors: factors });
    setPending(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Saved");
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="emo-new">Emotions</Label>
        {emotions.length > 0 && (
          <ul className="space-y-1.5">
            {emotions.map((e, i) => (
              <li key={e.name} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
                <Select
                  aria-label={`Intensity of ${e.name}`}
                  className="h-7 w-32 text-xs"
                  value={e.intensity ?? ""}
                  onChange={(ev) => setEmotions(emotions.map((x, j) => (j === i ? { ...x, intensity: ev.target.value ? Number(ev.target.value) : null } : x)))}
                >
                  <option value="">No intensity</option>
                  {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => <option key={n} value={n}>Intensity {n}</option>)}
                </Select>
                <button type="button" className="rounded p-1 text-muted hover:text-foreground" aria-label={`Remove ${e.name}`}
                  onClick={() => setEmotions(emotions.filter((_, j) => j !== i))}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input id="emo-new" list="emo-suggestions" placeholder="Type or choose an emotion" value={newEmo} maxLength={40}
            onChange={(e) => setNewEmo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmo(newEmo))} />
          <datalist id="emo-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
          <Button type="button" variant="secondary" size="icon" aria-label="Add emotion" onClick={() => addEmo(newEmo)}><Plus /></Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map((s) => (
            <button key={s} type="button" onClick={() => addEmo(s)} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:text-foreground">
              + {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="factor-new">Stress factors</Label>
        {factors.length > 0 && (
          <ul className="space-y-1.5">
            {factors.map((f, i) => (
              <li key={`${f}-${i}`} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 break-words">{f}</span>
                <button type="button" className="rounded p-1 text-muted hover:text-foreground" aria-label={`Remove ${f}`}
                  onClick={() => setFactors(factors.filter((_, j) => j !== i))}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input id="factor-new" placeholder="E.g. a deadline at work" value={newFactor} maxLength={200}
            onChange={(e) => setNewFactor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFactor())} />
          <Button type="button" variant="secondary" size="icon" aria-label="Add stress factor" onClick={addFactor}><Plus /></Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-xs text-muted">Unsaved changes</span>}
        <Button onClick={save} disabled={pending || !dirty}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
