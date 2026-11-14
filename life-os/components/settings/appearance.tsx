"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveAppearance } from "@/lib/profile/actions";

const ACCENTS = [
  { key: "violet", label: "Violeta", color: "#8b8cf6" },
  { key: "blue", label: "Azul", color: "#6d9fd8" },
  { key: "green", label: "Verde", color: "#5fb37f" },
  { key: "amber", label: "Ámbar", color: "#d6a64f" },
] as const;

export function AppearanceSettings({ theme: initialTheme, accent: initialAccent }: { theme: "dark" | "light"; accent: string }) {
  const [theme, setTheme] = useState(initialTheme);
  const [accent, setAccent] = useState(initialAccent);

  const apply = async (t: "dark" | "light", a: string) => {
    setTheme(t);
    setAccent(a);
    const root = document.documentElement;
    root.classList.toggle("light", t === "light");
    root.classList.toggle("dark", t === "dark");
    if (a === "violet") delete root.dataset.accent;
    else root.dataset.accent = a;
    try {
      localStorage.setItem("lifeos-theme", t);
      localStorage.setItem("lifeos-accent", a === "violet" ? "" : a);
    } catch {}
    const res = await saveAppearance(t, a);
    if (!res.ok) toast.error(res.error);
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted">Tema</legend>
        <div className="flex gap-2">
          {([["dark", "Oscuro", Moon], ["light", "Claro", Sun]] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              aria-pressed={theme === k}
              onClick={() => apply(k, accent)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md border px-3 text-sm",
                theme === k ? "border-accent bg-accent-soft" : "border-border text-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted">Color de acento</legend>
        <div className="flex gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-pressed={accent === a.key}
              aria-label={a.label}
              title={a.label}
              onClick={() => apply(theme, a.key)}
              className={cn("size-8 rounded-full border-2", accent === a.key ? "border-foreground" : "border-transparent")}
              style={{ background: a.color }}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
