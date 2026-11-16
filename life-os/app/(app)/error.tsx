"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-14 text-center">
      <p className="text-sm font-medium">Something didn't load right</p>
      <p className="max-w-md text-sm text-muted">Your data is safe. Try again, and if it keeps happening, reload the page.</p>
      <Button variant="secondary" onClick={reset}>Try again</Button>
    </div>
  );
}
