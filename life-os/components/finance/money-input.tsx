"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { parseMoney } from "@/lib/finance/schema";

const fmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

/** Campo de dinero en COP: acepta "1.250.000" o "1250000" y muestra el valor con puntos de miles. */
export function MoneyInput({
  value, onChange, id, invalid, placeholder = "0", className,
}: { value: number | null | undefined; onChange: (v: number | null) => void; id?: string; invalid?: boolean; placeholder?: string; className?: string }) {
  const [text, setText] = useState(value == null || Number.isNaN(value) ? "" : fmt.format(value));
  useEffect(() => {
    const parsed = parseMoney(text);
    if (value == null && text === "") return;
    if (value != null && !Number.isNaN(value) && parsed !== value) setText(fmt.format(value));
    if (value == null && text !== "" && !Number.isNaN(parsed)) setText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        aria-invalid={invalid}
        className={`pl-6 tabular-nums ${className ?? ""}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseMoney(e.target.value);
          onChange(e.target.value.trim() === "" ? null : n);
        }}
        onBlur={() => {
          const n = parseMoney(text);
          if (!Number.isNaN(n)) setText(fmt.format(n));
        }}
      />
    </div>
  );
}
