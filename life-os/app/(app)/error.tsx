"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-14 text-center">
      <p className="text-sm font-medium">Algo no cargó bien</p>
      <p className="max-w-md text-sm text-muted">Tus datos están a salvo. Intenta de nuevo y, si se repite, recarga la página.</p>
      <Button variant="secondary" onClick={reset}>Intentar de nuevo</Button>
    </div>
  );
}
