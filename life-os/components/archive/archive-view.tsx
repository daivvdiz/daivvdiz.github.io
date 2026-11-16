"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, BookOpen, CalendarHeart, FileText, ImageIcon, MapPin, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MEMORY_CATEGORIES, type MemoryCategory } from "@/lib/archive/schema";
import { archiveDailyMemory } from "@/lib/archive/actions";
import type { DailyMemory, Memory } from "@/lib/archive/queries";
import { MemoryDialog, type Options } from "./memory-dialog";

export type ArchiveTab = "timeline" | "gallery" | "categories" | "chapters" | "onthisday";

const isImage = (mime: string | null) => !!mime?.startsWith("image/");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function MemoryCard({ m, onOpen }: { m: Memory; onOpen: (m: Memory) => void }) {
  const cover = m.files.find((f) => isImage(f.mime) && f.url);
  const others = m.files.length - (cover ? 1 : 0);
  return (
    <button type="button" onClick={() => onOpen(m)} className="flex w-full gap-3 rounded-md border border-border p-3 text-left hover:bg-surface/60">
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url!} alt="" className="size-16 shrink-0 rounded object-cover sm:size-20" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="break-words text-sm font-medium">{m.title}</p>
          <p className="shrink-0 text-xs text-muted">{formatDay(m.occurred_on, "d MMM yyyy")}</p>
        </div>
        <p className="text-[11px] text-muted">
          {[MEMORY_CATEGORIES[m.category], m.chapter && `Capítulo: ${m.chapter}`, m.importance && `Importancia ${m.importance}/5`, others > 0 && `${others} ${others === 1 ? "archivo" : "archivos"}`]
            .filter(Boolean).join(" · ")}
        </p>
        {m.description && <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-xs">{m.description}</p>}
        {(m.location || m.people.length > 0) && (
          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
            {m.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" aria-hidden />{m.location}</span>}
            {m.people.length > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3" aria-hidden />{m.people.join(", ")}</span>}
          </p>
        )}
        {m.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {m.tags.map((t) => <span key={t} className="rounded bg-surface px-1.5 py-0.5 text-[11px]">{t}</span>)}
          </div>
        )}
      </div>
    </button>
  );
}

function DailyCard({ d }: { d: DailyMemory }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="inline-flex items-center gap-1 text-[11px] text-muted"><BookOpen className="size-3" aria-hidden /> Del diario · aún no está en el Archivo</p>
        <p className="text-xs text-muted">{formatDay(d.date, "d MMM yyyy")}</p>
      </div>
      <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-sm">{d.text}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button size="sm" variant="secondary" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await archiveDailyMemory(d.entryId);
          setBusy(false);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Guardado en el Archivo");
        }}>Guardar en el Archivo</Button>
        <Button asChild size="sm" variant="ghost"><Link href={`/calendar?view=day&date=${d.date}`}>Ver el día</Link></Button>
      </div>
    </div>
  );
}

const monthLabel = (iso: string) => {
  const s = formatDay(iso, "MMMM");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

type Item = { kind: "memory"; date: string; m: Memory } | { kind: "daily"; date: string; d: DailyMemory };

function Grouped({ items, onOpen }: { items: Item[]; onOpen: (m: Memory) => void }) {
  const years = new Map<string, Map<string, Item[]>>();
  for (const it of items) {
    const y = it.date.slice(0, 4), mo = it.date.slice(0, 7);
    if (!years.has(y)) years.set(y, new Map());
    const months = years.get(y)!;
    months.set(mo, [...(months.get(mo) ?? []), it]);
  }
  return (
    <div className="space-y-6">
      {[...years.entries()].map(([y, months]) => (
        <section key={y} aria-labelledby={`y-${y}`}>
          <h2 id={`y-${y}`} className="mb-2 text-lg font-semibold tabular-nums">{y}</h2>
          <div className="space-y-4 border-l border-border pl-4">
            {[...months.entries()].map(([mo, list]) => (
              <div key={mo}>
                <h3 className="mb-1.5 text-xs font-medium text-muted">{monthLabel(`${mo}-01`)} ({list.length})</h3>
                <ul className="space-y-2">
                  {list.map((it) => (
                    <li key={it.kind === "memory" ? it.m.id : `d-${it.d.entryId}`}>
                      {it.kind === "memory" ? <MemoryCard m={it.m} onOpen={onOpen} /> : <DailyCard d={it.d} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ArchiveView({ tab, memories, dailyMemories, options, today, userId, initialCategory }: {
  tab: ArchiveTab; memories: Memory[]; dailyMemories: DailyMemory[]; options: Options; today: string; userId: string; initialCategory?: string;
}) {
  const [editing, setEditing] = useState<{ memory?: Memory; isNew: boolean } | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(initialCategory && initialCategory in MEMORY_CATEGORIES ? initialCategory : "");
  const [tag, setTag] = useState("");
  const [person, setPerson] = useState("");
  const [withDaily, setWithDaily] = useState(true);

  const current = editing?.memory ? memories.find((m) => m.id === editing.memory!.id) ?? editing.memory : undefined;
  const open = (m: Memory) => setEditing({ memory: m, isNew: false });
  const chapters = useMemo(() => [...new Set(memories.map((m) => m.chapter).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)), [memories]);
  const allTags = useMemo(() => [...new Set(memories.flatMap((m) => m.tags))].sort((a, b) => a.localeCompare(b)), [memories]);
  const allPeople = useMemo(() => [...new Set(memories.flatMap((m) => m.people))].sort((a, b) => a.localeCompare(b)), [memories]);

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return memories.filter((m) =>
      (!cat || m.category === cat) && (!tag || m.tags.includes(tag)) && (!person || m.people.includes(person)) &&
      (!nq || norm([m.title, m.description, m.location, m.emotional_context, m.chapter, ...m.people, ...m.tags].filter(Boolean).join(" ")).includes(nq)));
  }, [memories, q, cat, tag, person]);
  const dailyShown = withDaily && !cat && !tag && !person ? dailyMemories.filter((d) => !q.trim() || norm(d.text).includes(norm(q.trim()))) : [];
  const timelineItems: Item[] = [
    ...filtered.map((m) => ({ kind: "memory" as const, date: m.occurred_on, m })),
    ...dailyShown.map((d) => ({ kind: "daily" as const, date: d.date, d })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const newButton = <Button size="sm" onClick={() => setEditing({ isNew: true })}><Plus /> Nuevo recuerdo</Button>;
  const hasAny = memories.length > 0 || dailyMemories.length > 0;

  return (
    <div className="space-y-4">
      {tab === "timeline" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input aria-label="Buscar recuerdos" placeholder="Buscar por título, lugar, persona, etiqueta…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select aria-label="Categoría" className="w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas las categorías</option>
              {Object.entries(MEMORY_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            {allTags.length > 0 && (
              <Select aria-label="Etiqueta" className="w-auto" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">Todas las etiquetas</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
            {allPeople.length > 0 && (
              <Select aria-label="Persona" className="w-auto" value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">Todas las personas</option>
                {allPeople.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
            {newButton}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{filtered.length} de {memories.length} {memories.length === 1 ? "recuerdo" : "recuerdos"}{dailyShown.length > 0 && ` · ${dailyShown.length} del diario`}</span>
            {dailyMemories.length > 0 && (
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" className="size-3.5 accent-[var(--accent)]" checked={withDaily} onChange={(e) => setWithDaily(e.target.checked)} />
                Mostrar recuerdos del diario que no están en el Archivo ({dailyMemories.length})
              </label>
            )}
          </div>
          {!hasAny ? (
            <EmptyState icon={Archive} title="Tu archivo está vacío" description="Guarda momentos, logros, viajes y personas. También llegan aquí los recuerdos que marques en tu diario." action={newButton} />
          ) : !timelineItems.length ? (
            <p className="py-6 text-center text-sm text-muted">Ningún recuerdo coincide con la búsqueda.</p>
          ) : (
            <Grouped items={timelineItems} onOpen={open} />
          )}
        </>
      )}

      {tab === "gallery" && <Gallery memories={memories} onOpen={open} action={newButton} />}

      {tab === "categories" && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(MEMORY_CATEGORIES) as MemoryCategory[]).map((k) => {
            const list = memories.filter((m) => m.category === k);
            return (
              <li key={k}>
                <Link href={`/archive?category=${k}`} className={cn("block rounded-md border border-border p-3 hover:bg-surface/60", !list.length && "opacity-60")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{MEMORY_CATEGORIES[k]}</p>
                    <span className="text-xs tabular-nums text-muted">{list.length}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted">{list[0] ? `Último: ${list[0].title} · ${formatDay(list[0].occurred_on, "MMM yyyy")}` : "Sin recuerdos"}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "chapters" && <Chapters memories={memories} onOpen={open} />}

      {tab === "onthisday" && <OnThisDay memories={memories} daily={dailyMemories} today={today} onOpen={open} />}

      <MemoryDialog
        open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        memory={current} isNew={!!editing?.isNew} options={options} chapters={chapters} today={today} userId={userId}
        preset={cat ? { category: cat as MemoryCategory } : undefined}
        onCreated={(m) => setEditing({ memory: m, isNew: true })}
      />
    </div>
  );
}

function Gallery({ memories, onOpen, action }: { memories: Memory[]; onOpen: (m: Memory) => void; action: React.ReactNode }) {
  const images = memories.flatMap((m) => m.files.filter((f) => isImage(f.mime) && f.url).map((f) => ({ f, m })));
  const docs = memories.reduce((a, m) => a + m.files.filter((f) => !isImage(f.mime)).length, 0);
  if (!images.length)
    return <EmptyState icon={ImageIcon} title="Sin fotos todavía" description="Abre un recuerdo y agrégale fotos; aparecerán aquí." action={action} />;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {images.length} {images.length === 1 ? "foto" : "fotos"} en {new Set(images.map((i) => i.m.id)).size} recuerdos
        {docs > 0 && <> · <FileText className="inline size-3" aria-hidden /> {docs} {docs === 1 ? "documento" : "documentos"} más en la línea de tiempo</>}
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {images.map(({ f, m }) => (
          <li key={f.id}>
            <button type="button" onClick={() => onOpen(m)} className="group block w-full overflow-hidden rounded-md border border-border text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url!} alt={m.title} loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]" />
              <span className="block truncate px-2 py-1 text-[11px]"><span className="font-medium">{m.title}</span> <span className="text-muted">· {formatDay(m.occurred_on, "MMM yyyy")}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Compact({ list, onOpen }: { list: Memory[]; onOpen: (m: Memory) => void }) {
  return (
    <ul className="space-y-0.5">
      {list.map((m) => (
        <li key={m.id}>
          <button type="button" onClick={() => onOpen(m)} className="flex w-full min-w-0 gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-surface/60">
            <span className="w-20 shrink-0 text-xs tabular-nums text-muted">{formatDay(m.occurred_on, "d MMM yy")}</span>
            <span className="min-w-0 truncate">{m.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Chapters({ memories, onOpen }: { memories: Memory[]; onOpen: (m: Memory) => void }) {
  const named = new Map<string, Memory[]>();
  for (const m of memories) if (m.chapter) named.set(m.chapter, [...(named.get(m.chapter) ?? []), m]);
  const chapters = [...named.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
    return { name, list: sorted, from: sorted[0].occurred_on, to: sorted[sorted.length - 1].occurred_on };
  }).sort((a, b) => b.from.localeCompare(a.from));
  const years = new Map<string, Memory[]>();
  for (const m of memories) years.set(m.occurred_on.slice(0, 4), [...(years.get(m.occurred_on.slice(0, 4)) ?? []), m]);

  if (!memories.length) return <EmptyState icon={BookOpen} title="Sin capítulos" description="Asigna un capítulo a tus recuerdos (ej. Universidad, Vida en Bogotá) para agruparlos." />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Tus capítulos</h2>
        {!chapters.length ? (
          <p className="text-sm text-muted">Aún no has asignado capítulos. Edita un recuerdo y escribe el capítulo al que pertenece.</p>
        ) : chapters.map((c) => (
          <div key={c.name} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-[11px] text-muted">{formatDay(c.from, "MMM yyyy")}{c.to.slice(0, 7) !== c.from.slice(0, 7) && ` – ${formatDay(c.to, "MMM yyyy")}`} · {c.list.length} {c.list.length === 1 ? "recuerdo" : "recuerdos"}</p>
            </div>
            <div className="mt-1.5"><Compact list={[...c.list].reverse()} onOpen={onOpen} /></div>
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Por año</h2>
        {[...years.entries()].map(([y, list]) => (
          <details key={y} className="rounded-md border border-border p-3" open={y === [...years.keys()][0]}>
            <summary className="cursor-pointer text-sm font-medium">{y} <span className="text-xs font-normal text-muted">· {list.length} {list.length === 1 ? "recuerdo" : "recuerdos"}</span></summary>
            <div className="mt-1.5"><Compact list={list} onOpen={onOpen} /></div>
          </details>
        ))}
      </section>
    </div>
  );
}

function OnThisDay({ memories, daily, today, onOpen }: { memories: Memory[]; daily: DailyMemory[]; today: string; onOpen: (m: Memory) => void }) {
  const md = today.slice(5);
  const year = Number(today.slice(0, 4));
  const ms = memories.filter((m) => m.occurred_on.slice(5) === md && m.occurred_on < today);
  const ds = daily.filter((d) => d.date.slice(5) === md && d.date < today);
  const byYear = new Map<number, Item[]>();
  for (const m of ms) byYear.set(Number(m.occurred_on.slice(0, 4)), [...(byYear.get(Number(m.occurred_on.slice(0, 4))) ?? []), { kind: "memory", date: m.occurred_on, m }]);
  for (const d of ds) byYear.set(Number(d.date.slice(0, 4)), [...(byYear.get(Number(d.date.slice(0, 4))) ?? []), { kind: "daily", date: d.date, d }]);
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Recuerdos de un {formatDay(today, "d 'de' MMMM")} en años anteriores.</p>
      {!years.length ? (
        <EmptyState icon={CalendarHeart} title="Nada en esta fecha todavía" description="Cuando tengas recuerdos de otros años en este mismo día, aparecerán aquí." />
      ) : years.map((y) => (
        <section key={y}>
          <h2 className="mb-1.5 text-sm font-semibold">{y} <span className="text-xs font-normal text-muted">· hace {year - y} {year - y === 1 ? "año" : "años"}</span></h2>
          <ul className="space-y-2">
            {byYear.get(y)!.map((it) => (
              <li key={it.kind === "memory" ? it.m.id : `d-${it.d.entryId}`}>{it.kind === "memory" ? <MemoryCard m={it.m} onOpen={onOpen} /> : <DailyCard d={it.d} />}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
