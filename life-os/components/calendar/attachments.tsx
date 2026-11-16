"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { deleteAttachment, registerAttachment } from "@/lib/journal/actions";

type Result = { ok: true } | { ok: false; error: string };
export type AttachmentFile = { id: string; name: string; mime: string | null; url: string | null };

const MAX = 10 * 1024 * 1024;
const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-120);

/** Adjuntos de la entrada del día. */
export function Attachments({ userId, entryId, files }: { userId: string; entryId: string; files: AttachmentFile[] }) {
  return (
    <FileAttachments pathPrefix={`${userId}/daily_entries/${entryId}/`} files={files}
      onRegister={(f) => registerAttachment({ entryId, ...f })} onDelete={deleteAttachment} />
  );
}

/** Subida al bucket privado (desde el navegador, con RLS de Storage) y registro del archivo. */
export function FileAttachments({ pathPrefix, files, onRegister, onDelete }: {
  pathPrefix: string; files: AttachmentFile[];
  onRegister: (f: { path: string; name: string; mime: string; size: number }) => Promise<Result>;
  onDelete: (id: string) => Promise<Result>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    const supabase = createBrowserSupabase();
    let done = 0;
    for (const f of Array.from(list)) {
      if (f.size > MAX) {
        toast.error(`${f.name} is larger than 10 MB`);
        continue;
      }
      if (!/^image\/|^application\/pdf$/.test(f.type)) {
        toast.error(`${f.name}: images or PDFs only`);
        continue;
      }
      const path = `${pathPrefix}${Date.now()}-${safe(f.name)}`;
      const up = await supabase.storage.from("life-os").upload(path, f, { contentType: f.type });
      if (up.error) {
        toast.error(`Couldn't upload ${f.name}`);
        continue;
      }
      const r = await onRegister({ path, name: f.name, mime: f.type, size: f.size });
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
      toast.success(done === 1 ? "File attached" : `${done} files attached`);
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
                  <button type="button" className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-80 hover:opacity-100" aria-label={`Delete ${f.name}`}>
                    <Trash2 className="size-3.5" />
                  </button>
                }
                title="Delete this file?"
                description={`"${f.name}" will be permanently deleted.`}
                onConfirm={async () => {
                  const r = await onDelete(f.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("File deleted");
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        <Paperclip /> {busy ? "Subiendo…" : "Attach images or PDFs"}
      </Button>
    </div>
  );
}
