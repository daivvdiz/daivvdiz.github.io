"use client";
import { useEffect } from "react";

/**
 * Los diálogos reutilizan el mismo formulario: al abrirlos de nuevo se descarta lo que
 * quedó escrito la vez anterior y se vuelve a los valores iniciales.
 */
export function useResetOnOpen(open: boolean, reset: () => void) {
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
