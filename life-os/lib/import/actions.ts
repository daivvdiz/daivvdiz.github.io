"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export interface PreviewRow {
  categoria: string;
  destino: string;
  total: number;
  ya_importados: number;
}

export async function previewImport(): Promise<{ ok: true; rows: PreviewRow[] } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("preview_segundo_cerebro_import");
  if (error) {
    return { ok: false, error: "No se pudo leer Segundo Cerebro. ¿Ya ejecutaste las migraciones de LIFE OS en Supabase?" };
  }
  return {
    ok: true,
    rows: (data as PreviewRow[]).map((r) => ({ ...r, total: Number(r.total), ya_importados: Number(r.ya_importados) })),
  };
}

export async function runImport(): Promise<{ ok: true; result: Record<string, number> } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("import_segundo_cerebro");
  if (error) return { ok: false, error: "La importación no se completó. Tus datos originales siguen intactos." };
  revalidatePath("/", "layout");
  return { ok: true, result: (data ?? {}) as Record<string, number> };
}
