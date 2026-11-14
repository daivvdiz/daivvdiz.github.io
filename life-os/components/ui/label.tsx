"use client";
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn("text-xs font-medium text-muted", className)} {...props} />
));
Label.displayName = "Label";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-xs text-danger">{message}</p>;
}
