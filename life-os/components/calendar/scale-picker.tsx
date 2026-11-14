"use client";

import { cn } from "@/lib/utils";

/** Escala 1-10 opcional, como grupo de radio accesible. Sin colores de "bueno/malo". */
export function ScalePicker({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  hint?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span id={id} className="text-xs font-medium text-muted">{label}</span>
        <span className="text-xs tabular-nums">{value == null ? "Sin registrar" : `${value}/10`}</span>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}`}
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "h-8 rounded-md border text-xs tabular-nums transition-colors",
              value === n ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted hover:text-foreground",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
