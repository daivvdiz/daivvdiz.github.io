"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, FileText, Folder, FolderPlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { formatDay } from "@/lib/format";

// Mismo bucket y convenciones que Segundo Cerebro: <user_id>/<carpeta>/<archivo>.
// Las carpetas vacías existen gracias a un archivo oculto; nada de esto cambia aquí.
const BUCKET = "documentos";
const PLACEHOLDER = ".emptyFolderPlaceholder";
const MAX = 50 * 1024 * 1024;
const join = (...p: string[]) => p.filter(Boolean).join("/");
const clean = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, " ").trim();
const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const cmp = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true });

type Listing = { folders: string[]; files: { name: string; size: number; created_at: string | null }[] };

export function Documents({ userId }: { userId: string }) {
  const [path, setPath] = useState("");
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async (p: string) => {
    setError(null);
    const { data: rows, error: e } = await createBrowserSupabase().storage.from(BUCKET).list(join(userId, p), { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (e) {
      setError("No se pudieron cargar tus documentos.");
      setData({ folders: [], files: [] });
      return;
    }
    type Row = { id: string | null; name: string; created_at: string | null; metadata: { size?: number } | null };
    const list = (rows ?? []) as Row[];
    setData({
      folders: list.filter((r) => r.id === null).map((r) => r.name).sort(cmp),
      files: list.filter((r) => r.id !== null && r.name !== PLACEHOLDER).map((r) => ({ name: r.name, size: r.metadata?.size ?? 0, created_at: r.created_at })).sort((a, b) => cmp(a.name, b.name)),
    });
  }, [userId]);

  useEffect(() => {
    setData(null);
    void load(path);
  }, [path, load]);

  const openFile = async (name: string) => {
    const { data: s, error: e } = await createBrowserSupabase().storage.from(BUCKET).createSignedUrl(join(userId, path, name), 300);
    if (e || !s) return void toast.error("No se pudo abrir el archivo.");
    window.open(s.signedUrl, "_blank", "noopener,noreferrer");
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    let ok = 0;
    for (const f of Array.from(list)) {
      if (f.size > MAX) {
        toast.error(`${f.name} supera 50 MB`);
        continue;
      }
      // Sin sobrescribir: si ya existe un archivo con ese nombre, no se toca.
      const { error: e } = await createBrowserSupabase().storage.from(BUCKET).upload(join(userId, path, clean(f.name)), f, { upsert: false, contentType: f.type || undefined });
      if (e) toast.error(/exist|duplicate/i.test(e.message) ? `Ya existe “${clean(f.name)}” en esta carpeta` : `No se pudo subir ${f.name}`);
      else ok++;
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (ok) toast.success(ok === 1 ? "Archivo subido" : `${ok} archivos subidos`);
    void load(path);
  };

  const createFolder = async () => {
    const name = clean(newFolder ?? "");
    if (!name) return;
    if (data?.folders.includes(name)) return void toast.error("Ya existe una carpeta con ese nombre");
    const { error: e } = await createBrowserSupabase().storage.from(BUCKET).upload(join(userId, path, name, PLACEHOLDER), new Blob([""], { type: "text/plain" }));
    if (e) return void toast.error("No se pudo crear la carpeta.");
    setNewFolder(null);
    toast.success("Carpeta creada");
    void load(path);
  };

  const removeFile = async (name: string) => {
    const supabase = createBrowserSupabase();
    const { error: e } = await supabase.storage.from(BUCKET).remove([join(userId, path, name)]);
    if (e) return void toast.error("No se pudo eliminar el archivo.");
    // Si la carpeta quedó vacía, se conserva como en Segundo Cerebro.
    if (path && data && data.files.length === 1 && !data.folders.length)
      await supabase.storage.from(BUCKET).upload(join(userId, path, PLACEHOLDER), new Blob([""], { type: "text/plain" }), { upsert: true });
    toast.success("Archivo eliminado");
    void load(path);
  };

  const parts = path ? path.split("/") : [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Ruta de la carpeta" className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm">
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-surface" onClick={() => setPath("")} aria-current={!path ? "page" : undefined}>Documentos</button>
          {parts.map((p, i) => (
            <span key={i} className="inline-flex min-w-0 items-center gap-0.5">
              <ChevronRight className="size-3.5 shrink-0 text-muted" aria-hidden />
              <button type="button" className="truncate rounded px-1.5 py-0.5 hover:bg-surface" aria-current={i === parts.length - 1 ? "page" : undefined}
                onClick={() => setPath(parts.slice(0, i + 1).join("/"))}>{p}</button>
            </span>
          ))}
        </nav>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setNewFolder("")}><FolderPlus /> Carpeta</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}><Upload /> {busy ? "Subiendo…" : "Subir archivos"}</Button>
          <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      </div>
      {newFolder !== null && (
        <div className="flex gap-2">
          <Input aria-label="Nombre de la carpeta nueva" placeholder="Nombre de la carpeta" maxLength={80} autoFocus value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void createFolder(); if (e.key === "Escape") setNewFolder(null); }} />
          <Button size="sm" onClick={createFolder}>Crear</Button>
          <Button size="sm" variant="ghost" onClick={() => setNewFolder(null)}>Cancelar</Button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!data ? (
        <p className="py-4 text-sm text-muted">Cargando…</p>
      ) : !data.folders.length && !data.files.length ? (
        <p className="py-4 text-center text-sm text-muted">{path ? "Carpeta vacía. Sube un archivo o crea una subcarpeta." : "Aún no hay documentos."}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {data.folders.map((f) => (
            <li key={`d-${f}`}>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface/60" onClick={() => setPath(join(path, f))}>
                <Folder className="size-4 shrink-0 text-muted" aria-hidden /> <span className="min-w-0 truncate">{f}</span>
              </button>
            </li>
          ))}
          {data.files.map((f) => (
            <li key={`f-${f.name}`} className="flex items-center gap-1 pr-1">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface/60" onClick={() => openFile(f.name)}>
                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted">{size(f.size)}{f.created_at && ` · ${formatDay(f.created_at.slice(0, 10), "d MMM yy")}`}</span>
              </button>
              <ConfirmDialog
                trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Eliminar ${f.name}`}><Trash2 /></Button>}
                title={`¿Eliminar “${f.name}”?`} description="Se borrará de forma permanente de tus documentos. Esta acción no se puede deshacer."
                onConfirm={() => removeFile(f.name)}
              />
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted">Son los mismos documentos de Segundo Cerebro, en el mismo lugar privado. Subir un archivo con un nombre que ya existe no lo reemplaza.</p>
    </div>
  );
}
