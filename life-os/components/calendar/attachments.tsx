"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { deleteAttachment, registerAttachment } from "@/lib/journal/actions";
import type { DayEntry } from "@/lib/calendar/queries";

const MAX = 10 * 1024 * 1024;
const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-120);

export function Attachments({ userId, entryId, files }: { userId: string; entryId: string; files: DayEntry["attachments"] }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    const supabase = createBrowserSupabase();
    let done = 0;
    for (const f of Array.from(list)) {
      if (f.size > MAX) {
        toast.error(`${f.name} supera 10 MB`);
        continue;
      }
      if (!/^image\/|^application\/pdf$/.test(f.type)) {
        toast.error(`${f.name}: solo imágenes o PDF`);
        continue;
      }
      const path = `${userId}/daily_entries/${entryId}/${Date.now()}-${safe(f.name)}`;
      const up = await supabase.storage.from("life-os").upload(path, f, { contentType: f.type });
      if (up.error) {
        toast.error(`No se pudo subir ${f.name}`);
        continue;
      }
      const r = await registerAttachment({ entryId, path, name: f.name, mime: f.type, size: f.size });
      if (!r.ok) {
        await supabase.storage.from("life-os").remove([path]);
        toast.error(r.error);
        continue;
      }
      done++;
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (done) {
      toast.success(done === 1 ? "Archivo adjuntado" : `${done} archivos adjuntados`);
    }
  };

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((f) => (
            <li key={f.id} className="group relative overflow-hidden rounded-md border border-border bg-surface">
              <a href={f.url ?? "#"} target="_blank" rel="noreferrer" className="block aspect-square" title={f.name}>
                {f.url && f.mime?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.name} className="size-full object-cover" />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-[11px] text-muted">
                    <FileText className="size-5" /> <span className="line-clamp-2">{f.name}</span>
                  </span>
                )}
              </a>
              <ConfirmDialog
                trigger={
                  <button type="button" className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-80 hover:opacity-100" aria-label={`Eliminar ${f.name}`}>
                    <Trash2 className="size-3.5" />
                  </button>
                }
                title="¿Eliminar este archivo?"
                description={`"${f.name}" se borrará de forma permanente.`}
                onConfirm={async () => {
                  const r = await deleteAttachment(f.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Archivo eliminado");
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        <Paperclip /> {busy ? "Subiendo…" : "Adjuntar imágenes o PDF"}
      </Button>
    </div>
  );
}
