-- ============================================================
-- LIFE OS · Estudio: simulacros y exámenes de práctica (migración 3)
--
-- SOLO AGREGA una tabla nueva. No modifica ni borra datos existentes
-- (ni registros, ni ajustes, ni el bucket "documentos").
-- Se puede ejecutar más de una vez.
--
-- Cómo aplicarla: Supabase > SQL Editor > New query > pegar > Run.
-- ============================================================

create table if not exists public.study_exams (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taken_on          date not null default current_date,
  exam              text not null check (length(trim(exam)) between 1 and 120),
  subject           text check (subject is null or length(subject) <= 120),
  score             numeric(10,2),
  max_score         numeric(10,2) check (max_score is null or max_score > 0),
  level             text check (level is null or length(level) <= 60),
  total_questions   int check (total_questions is null or total_questions > 0),
  correct           int check (correct is null or correct >= 0),
  incorrect         int check (incorrect is null or incorrect >= 0),
  duration_seconds  int check (duration_seconds is null or duration_seconds >= 0),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint study_exams_answers_fit check (
    total_questions is null or coalesce(correct, 0) + coalesce(incorrect, 0) <= total_questions
  )
);
create index if not exists study_exams_user_date on public.study_exams (user_id, taken_on desc);

alter table public.study_exams enable row level security;
drop policy if exists "own rows" on public.study_exams;
create policy "own rows" on public.study_exams for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists set_updated_at on public.study_exams;
create trigger set_updated_at before update on public.study_exams
  for each row execute function public.set_updated_at();
