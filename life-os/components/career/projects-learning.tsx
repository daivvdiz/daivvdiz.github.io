"use client";

import { BookOpen, ExternalLink, FolderGit2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityDialog, useEditor } from "@/components/entity-dialog";
import { ProgressBar } from "@/components/goals/goal-parts";
import { formatDay } from "@/lib/format";
import { LEARNING_KINDS, PROJECT_STATUS, learningSchema, projectSchema, type LearningInput, type ProjectInput } from "@/lib/career/schema";
import { deleteLearning, deleteProject, saveLearning, saveProject } from "@/lib/career/actions";
import type { Learning, Project, Skill } from "@/lib/career/queries";

type Opt = { id: string; title?: string; name?: string };
const toOptions = (xs: Opt[], none?: string) => ({ ...(none ? { "": none } : {}), ...Object.fromEntries(xs.map((x) => [x.id, x.title ?? x.name ?? ""])) });

function Links({ urls }: { urls: [string | null, string][] }) {
  const xs = urls.filter(([u]) => u) as [string, string][];
  if (!xs.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-3">
      {xs.map(([u, l]) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink className="size-3" aria-hidden /> {l}
        </a>
      ))}
    </div>
  );
}

export function Projects({ projects, skills, goals, today }: { projects: Project[]; skills: Skill[]; goals: { id: string; title: string }[]; today: string }) {
  const ed = useEditor<Project>();
  const it = ed.item;
  const skillName = new Map(skills.map((s) => [s.id, s.name]));
  const goalName = new Map(goals.map((g) => [g.id, g.title]));
  return (
    <div className="space-y-3">
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> New project</Button>
      {!projects.length ? (
        <EmptyState icon={FolderGit2} title="No projects" description="Your portfolio: the problem you solved, how you did it and what the results were." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="rounded-md border border-border p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-muted">
                    {PROJECT_STATUS[p.status]}{p.completed_on && ` · finished ${formatDay(p.completed_on)}`}
                    {p.goal_id && goalName.get(p.goal_id) && ` · Goal: ${goalName.get(p.goal_id)}`}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${p.name}`} onClick={() => ed.setEditing(p)}><Pencil /></Button>
                <ConfirmDialog
                  trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${p.name}`}><Trash2 /></Button>}
                  title={`Delete “${p.name}”?`} description="This can't be undone."
                  onConfirm={async () => {
                    const r = await deleteProject(p.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Project deleted");
                  }}
                />
              </div>
              {p.business_problem && <p className="mt-1.5 break-words text-xs"><span className="text-muted">Problem: </span>{p.business_problem}</p>}
              {p.results && <p className="mt-1 break-words text-xs"><span className="text-muted">Results: </span>{p.results}</p>}
              {(p.technologies.length > 0 || p.skill_ids.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.technologies.map((t) => <span key={t} className="rounded bg-surface px-1.5 py-0.5 text-[11px]">{t}</span>)}
                  {p.skill_ids.map((s) => skillName.get(s) && <span key={s} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted">{skillName.get(s)}</span>)}
                </div>
              )}
              <Links urls={[[p.repository_url, "Repository"], [p.documentation_url, "Documentation"]]} />
            </li>
          ))}
        </ul>
      )}
      <EntityDialog<ProjectInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()} wide
        title={it ? "Edit project" : "New project"}
        schema={projectSchema}
        defaults={it
          ? {
              name: it.name, description: it.description ?? "", business_problem: it.business_problem ?? "", technologies: it.technologies.join(", "),
              results: it.results ?? "", repository_url: it.repository_url ?? "", documentation_url: it.documentation_url ?? "", status: it.status,
              completed_on: it.completed_on ?? "", goal_id: it.goal_id ?? "", skill_ids: it.skill_ids,
            }
          : { name: "", description: "", business_problem: "", technologies: "", results: "", repository_url: "", documentation_url: "", status: "in_progress", completed_on: "", goal_id: "", skill_ids: [] }}
        fields={[
          { name: "name", label: "Name", kind: "text" },
          { name: "status", label: "Status", kind: "select", options: PROJECT_STATUS, half: true },
          { name: "completed_on", label: "Finished on (optional)", kind: "date", half: true },
          { name: "business_problem", label: "Problem it solves", kind: "textarea" },
          { name: "description", label: "Description", kind: "textarea" },
          { name: "results", label: "Results", kind: "textarea" },
          { name: "technologies", label: "Technologies", kind: "text", placeholder: "Python, SQL, Power BI", hint: "Separate them with commas." },
          { name: "repository_url", label: "Repository (optional)", kind: "url", placeholder: "https://github.com/…", half: true },
          { name: "documentation_url", label: "Documentation (optional)", kind: "url", placeholder: "https://…", half: true },
          { name: "goal_id", label: "Related goal (optional)", kind: "select", options: toOptions(goals, "None") },
          { name: "skill_ids", label: "Skills used", kind: "toggles", options: toOptions(skills), hint: "Create skills in the Skills tab to link them." },
        ]}
        onSave={(v) => saveProject(v, it?.id)}
      />
    </div>
  );
}

export function LearningList({ items, skills, today }: { items: Learning[]; skills: Skill[]; today: string }) {
  const ed = useEditor<Learning>();
  const it = ed.item;
  const skillName = new Map(skills.map((s) => [s.id, s.name]));
  const active = items.filter((i) => !i.completed_on);
  const done = items.filter((i) => i.completed_on);
  const render = (list: Learning[]) => (
    <ul className="space-y-2">
      {list.map((l) => (
        <li key={l.id} className="rounded-md border border-border p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{l.title}</p>
              <p className="text-[11px] text-muted">
                {[LEARNING_KINDS[l.kind], l.provider, l.skill_id && skillName.get(l.skill_id), l.started_on && `since ${formatDay(l.started_on)}`, l.completed_on && `finished ${formatDay(l.completed_on)}`]
                  .filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums">{l.progress}%</span>
            <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${l.title}`} onClick={() => ed.setEditing(l)}><Pencil /></Button>
            <ConfirmDialog
              trigger={<Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${l.title}`}><Trash2 /></Button>}
              title={`Delete “${l.title}”?`} description="This can't be undone."
              onConfirm={async () => {
                const r = await deleteLearning(l.id);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Deleted");
              }}
            />
          </div>
          <div className="mt-2"><ProgressBar value={l.progress} label={`${l.title} progress`} /></div>
          <Links urls={[[l.url, "Open"]]} />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="space-y-3">
      <Button size="sm" variant="secondary" onClick={() => ed.setEditing("new")}><Plus /> New course or resource</Button>
      {!items.length ? (
        <EmptyState icon={BookOpen} title="No learning logged" description="Courses, certifications, goals and resources, with their progress." />
      ) : (
        <>
          {active.length > 0 && <section><h3 className="mb-1.5 text-xs font-medium text-muted">In progress ({active.length})</h3>{render(active)}</section>}
          {done.length > 0 && <section><h3 className="mb-1.5 text-xs font-medium text-muted">Finished ({done.length})</h3>{render(done)}</section>}
        </>
      )}
      <EntityDialog<LearningInput>
        open={ed.open} onOpenChange={(o) => !o && ed.close()}
        title={it ? "Edit" : "New course or resource"} description="Setting a finish date moves it to the finished list."
        schema={learningSchema}
        defaults={it
          ? { title: it.title, kind: it.kind, provider: it.provider ?? "", url: it.url ?? "", progress: it.progress, started_on: it.started_on ?? "", completed_on: it.completed_on ?? "", skill_id: it.skill_id ?? "" }
          : { title: "", kind: "course", provider: "", url: "", progress: 0, started_on: today, completed_on: "", skill_id: "" }}
        fields={[
          { name: "title", label: "Title", kind: "text" },
          { name: "kind", label: "Type", kind: "select", options: LEARNING_KINDS, half: true },
          { name: "provider", label: "Platform or institution", kind: "text", placeholder: "E.g. Coursera, Platzi", half: true },
          { name: "progress", label: "Progress", kind: "range" },
          { name: "started_on", label: "Start (optional)", kind: "date", half: true },
          { name: "completed_on", label: "Finished on (optional)", kind: "date", half: true },
          { name: "skill_id", label: "Related skill (optional)", kind: "select", options: toOptions(skills, "None") },
          { name: "url", label: "Link (optional)", kind: "url", placeholder: "https://…" },
        ]}
        onSave={(v) => saveLearning(v, it?.id)}
      />
    </div>
  );
}
