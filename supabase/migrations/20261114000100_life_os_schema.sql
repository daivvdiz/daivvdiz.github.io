-- ============================================================
-- LIFE OS · esquema principal (migración 1)
--
-- SOLO AGREGA tablas nuevas. No modifica ni borra:
--   public.registros, public.ajustes, ni el bucket "documentos".
-- Se puede ejecutar más de una vez (if not exists / drop policy if exists).
--
-- Cómo aplicarla: Supabase > SQL Editor > New query > pegar > Run.
-- ============================================================

-- gen_random_uuid() viene incluido en PostgreSQL 13+.

-- ---------- Utilidades ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Núcleo ----------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  avatar_path       text,
  timezone          text not null default 'America/Bogota',
  language          text not null default 'es',
  currency          text not null default 'COP',
  date_format       text not null default 'dd/MM/yyyy',
  week_starts_on    smallint not null default 1 check (week_starts_on between 0 and 6),
  theme             text not null default 'dark' check (theme in ('dark','light','system')),
  accent_color      text not null default 'violet',
  default_period    text not null default '30d',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(name) between 1 and 60),
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- Adjuntos genéricos: apuntan a un archivo en Storage y a cualquier registro.
create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type   text not null,
  entity_id     uuid not null,
  bucket        text not null default 'life-os',
  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists attachments_entity on public.attachments (user_id, entity_type, entity_id);

-- Autoevaluación de las 6 dimensiones (1-10). Sin puntaje global.
create table if not exists public.life_assessments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assessed_on     date not null default current_date,
  professional    smallint not null check (professional between 1 and 10),
  financial       smallint not null check (financial between 1 and 10),
  physical        smallint not null check (physical between 1 and 10),
  emotional       smallint not null check (emotional between 1 and 10),
  social          smallint not null check (social between 1 and 10),
  intellectual    smallint not null check (intellectual between 1 and 10),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists life_assessments_user_date on public.life_assessments (user_id, assessed_on desc);

-- ---------- Diario ----------
create table if not exists public.daily_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date      date not null,
  mood            smallint check (mood between 1 and 10),
  energy          smallint check (energy between 1 and 10),
  stress          smallint check (stress between 1 and 10),
  sleep_hours     numeric(4,2) check (sleep_hours between 0 and 24),
  sleep_quality   smallint check (sleep_quality between 1 and 10),
  sleep_notes     text,
  journal         text,
  memory          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, entry_date)
);
create index if not exists daily_entries_user_date on public.daily_entries (user_id, entry_date desc);

create table if not exists public.daily_gratitude (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  daily_entry_id  uuid not null references public.daily_entries(id) on delete cascade,
  position        smallint not null check (position between 1 and 3),
  content         text not null check (length(content) between 1 and 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (daily_entry_id, position)
);

create table if not exists public.daily_entry_tags (
  daily_entry_id  uuid not null references public.daily_entries(id) on delete cascade,
  tag_id          uuid not null references public.tags(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (daily_entry_id, tag_id)
);

-- Entradas de diario adicionales (emocional, reflexiones) ligadas a un día.
create table if not exists public.journal_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  daily_entry_id  uuid references public.daily_entries(id) on delete set null,
  entry_date      date not null default current_date,
  kind            text not null default 'reflection'
                  check (kind in ('reflection','emotional','difficult','helped','thought')),
  title           text,
  content         text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists journal_entries_user_date on public.journal_entries (user_id, entry_date desc);

-- ---------- Salud mental ----------
create table if not exists public.emotional_tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- "moods" del spec = emociones etiquetadas de un día, con intensidad.
create table if not exists public.daily_entry_emotions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  daily_entry_id    uuid not null references public.daily_entries(id) on delete cascade,
  emotional_tag_id  uuid not null references public.emotional_tags(id) on delete cascade,
  intensity         smallint check (intensity between 1 and 10),
  created_at        timestamptz not null default now(),
  unique (daily_entry_id, emotional_tag_id)
);

create table if not exists public.stress_factors (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  daily_entry_id  uuid not null references public.daily_entries(id) on delete cascade,
  description     text not null,
  created_at      timestamptz not null default now()
);

create table if not exists public.coping_strategies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.coping_strategy_logs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  coping_strategy_id    uuid not null references public.coping_strategies(id) on delete cascade,
  daily_entry_id        uuid references public.daily_entries(id) on delete set null,
  used_on               date not null default current_date,
  helped                smallint check (helped between 1 and 5),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------- Metas y hábitos ----------
create table if not exists public.goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title           text not null check (length(title) between 1 and 200),
  description     text,
  category        text not null check (category in ('professional','financial','physical','emotional','social','intellectual','personal')),
  motivation      text,
  start_date      date,
  target_date     date,
  status          text not null default 'active' check (status in ('not_started','active','paused','completed','abandoned')),
  priority        text not null default 'medium' check (priority in ('low','medium','high')),
  progress        smallint not null default 0 check (progress between 0 and 100),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists goals_user_status on public.goals (user_id, status);

create table if not exists public.milestones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id       uuid not null references public.goals(id) on delete cascade,
  title         text not null,
  due_date      date,
  completed_at  date,
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists milestones_goal on public.milestones (goal_id, position);

create table if not exists public.habits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  description       text,
  category          text check (category in ('professional','financial','physical','emotional','social','intellectual','personal')),
  frequency         text not null default 'daily' check (frequency in ('daily','weekly','custom')),
  times_per_period  smallint not null default 1 check (times_per_period > 0),
  weekdays          smallint[],
  tracking_method   text not null default 'check' check (tracking_method in ('check','count','duration')),
  start_date        date not null default current_date,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id    uuid not null references public.habits(id) on delete cascade,
  logged_on   date not null default current_date,
  value       numeric,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (habit_id, logged_on)
);
create index if not exists habit_logs_user_date on public.habit_logs (user_id, logged_on desc);

create table if not exists public.goal_habits (
  goal_id     uuid not null references public.goals(id) on delete cascade,
  habit_id    uuid not null references public.habits(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (goal_id, habit_id)
);

create table if not exists public.goal_daily_entries (
  goal_id         uuid not null references public.goals(id) on delete cascade,
  daily_entry_id  uuid not null references public.daily_entries(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (goal_id, daily_entry_id)
);

-- ---------- Finanzas ----------
create table if not exists public.financial_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('income','expense')),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind, name)
);

create table if not exists public.savings_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  target_amount   numeric(14,2) not null check (target_amount > 0),
  target_date     date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  kind        text,
  value       numeric(14,2) not null check (value >= 0),
  valued_on   date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Deudas y pasivos. El apartamento de Segundo Cerebro se importa aquí.
create table if not exists public.liabilities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  kind              text,
  original_amount   numeric(14,2) not null check (original_amount >= 0),
  start_date        date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type              text not null check (type in ('income','expense','transfer')),
  description       text not null,
  amount            numeric(14,2) not null check (amount > 0),
  occurred_on       date not null default current_date,
  category_id       uuid references public.financial_categories(id) on delete set null,
  payment_method    text,
  notes             text,
  savings_goal_id   uuid references public.savings_goals(id) on delete set null,
  liability_id      uuid references public.liabilities(id) on delete set null,
  legacy_registro_id bigint unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists transactions_user_date on public.transactions (user_id, occurred_on desc);

create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month         date not null check (extract(day from month) = 1),
  category_id   uuid not null references public.financial_categories(id) on delete cascade,
  amount        numeric(14,2) not null check (amount >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, month, category_id)
);

alter table public.goals add column if not exists savings_goal_id uuid references public.savings_goals(id) on delete set null;

-- ---------- Carrera ----------
create table if not exists public.career_positions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title             text not null,
  company           text,
  started_on        date not null,
  ended_on          date,
  monthly_salary    numeric(14,2),
  notes             text,
  legacy_registro_id bigint unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.career_applications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company             text not null,
  position            text not null,
  location            text,
  work_mode           text check (work_mode in ('onsite','hybrid','remote')),
  salary_expectation  numeric(14,2),
  applied_on          date,
  stage               text not null default 'interested'
                      check (stage in ('interested','applied','recruiter_screen','technical_interview','final_interview','offer','rejected','withdrawn')),
  contact_person      text,
  job_url             text,
  technical_test      text,
  feedback            text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists career_applications_user_stage on public.career_applications (user_id, stage);

create table if not exists public.application_interviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  application_id  uuid not null references public.career_applications(id) on delete cascade,
  kind            text,
  scheduled_at    timestamptz not null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.skills (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  category          text check (category in ('programming','data_analytics','data_engineering','business_intelligence','cloud','soft_skills','languages','other')),
  target_level      smallint check (target_level between 1 and 10),
  last_practiced_on date,
  evidence          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, name)
);

-- Historial de nivel de cada skill (el nivel actual = el más reciente).
create table if not exists public.skill_levels (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill_id          uuid not null references public.skills(id) on delete cascade,
  level             numeric(4,1) not null check (level between 0 and 10),
  assessed_on       date not null default current_date,
  notes             text,
  legacy_registro_id bigint unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists skill_levels_skill_date on public.skill_levels (skill_id, assessed_on);

create table if not exists public.projects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  description       text,
  business_problem  text,
  technologies      text[] not null default '{}',
  results           text,
  repository_url    text,
  documentation_url text,
  status            text not null default 'in_progress' check (status in ('idea','in_progress','completed','archived')),
  completed_on      date,
  goal_id           uuid references public.goals(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.project_skills (
  project_id  uuid not null references public.projects(id) on delete cascade,
  skill_id    uuid not null references public.skills(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (project_id, skill_id)
);

create table if not exists public.learning_resources (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text not null,
  kind          text not null default 'course' check (kind in ('objective','course','certification','resource')),
  provider      text,
  url           text,
  progress      smallint not null default 0 check (progress between 0 and 100),
  started_on    date,
  completed_on  date,
  skill_id      uuid references public.skills(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- Físico ----------
create table if not exists public.exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  measure     text not null default 'weight' check (measure in ('weight','reps','time','distance')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.workouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  performed_on      date not null default current_date,
  activity_type     text not null default 'strength'
                    check (activity_type in ('calisthenics','strength','beach_volleyball','running','mobility','other_sport','other')),
  duration_seconds  int check (duration_seconds >= 0),
  notes             text,
  daily_entry_id    uuid references public.daily_entries(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists workouts_user_date on public.workouts (user_id, performed_on desc);

create table if not exists public.workout_exercises (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_id        uuid not null references public.workouts(id) on delete cascade,
  exercise_id       uuid not null references public.exercises(id) on delete cascade,
  sets              smallint check (sets > 0),
  reps              smallint check (reps >= 0),
  weight_kg         numeric(6,1),
  duration_seconds  int,
  distance_km       numeric(7,2),
  notes             text,
  legacy_registro_id bigint unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists workout_exercises_exercise on public.workout_exercises (exercise_id);

create table if not exists public.body_metrics (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on     date not null default current_date,
  weight_kg       numeric(5,1),
  height_cm       numeric(5,1),
  body_fat_pct    numeric(4,1) check (body_fat_pct between 0 and 100),
  measurements    jsonb not null default '{}'::jsonb,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.nutrition_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  logged_on     date not null default current_date,
  meals         text,
  water_liters  numeric(4,2),
  protein_g     numeric(6,1),
  calories      int,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, logged_on)
);

-- ---------- Calendario ----------
create table if not exists public.calendar_events (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title                   text not null check (length(title) between 1 and 200),
  description             text,
  category                text not null default 'personal'
                          check (category in ('personal','work','health','fitness','finance','social','learning','other')),
  starts_at               timestamptz not null,
  ends_at                 timestamptz,
  all_day                 boolean not null default false,
  location                text,
  goal_id                 uuid references public.goals(id) on delete set null,
  workout_id              uuid references public.workouts(id) on delete set null,
  career_application_id   uuid references public.career_applications(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists calendar_events_user_start on public.calendar_events (user_id, starts_at);

create table if not exists public.daily_entry_events (
  daily_entry_id  uuid not null references public.daily_entries(id) on delete cascade,
  event_id        uuid not null references public.calendar_events(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (daily_entry_id, event_id)
);

-- Logros: varios por día, opcionalmente ligados a una meta o proyecto.
create table if not exists public.daily_accomplishments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  daily_entry_id    uuid not null references public.daily_entries(id) on delete cascade,
  content           text not null check (length(content) between 1 and 500),
  is_main           boolean not null default false,
  goal_id           uuid references public.goals(id) on delete set null,
  project_id        uuid references public.projects(id) on delete set null,
  legacy_registro_id bigint unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists daily_accomplishments_entry on public.daily_accomplishments (daily_entry_id);

-- ---------- Archivo de vida ----------
create table if not exists public.memories (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title               text not null check (length(title) between 1 and 200),
  occurred_on         date not null,
  description         text,
  category            text not null default 'personal'
                      check (category in ('personal','family','friends','relationships','career','education','travel','achievements','experiences','important_moments')),
  location            text,
  emotional_context   text,
  importance          smallint check (importance between 1 and 5),
  chapter             text,
  daily_entry_id      uuid references public.daily_entries(id) on delete set null,
  goal_id             uuid references public.goals(id) on delete set null,
  event_id            uuid references public.calendar_events(id) on delete set null,
  workout_id          uuid references public.workouts(id) on delete set null,
  project_id          uuid references public.projects(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists memories_user_date on public.memories (user_id, occurred_on desc);
create index if not exists memories_user_md on public.memories (user_id, (extract(month from occurred_on)), (extract(day from occurred_on)));

create table if not exists public.memory_tags (
  memory_id   uuid not null references public.memories(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (memory_id, tag_id)
);

create table if not exists public.memory_people (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  memory_id   uuid not null references public.memories(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Registros de Segundo Cerebro sin categoría conocida ----------
-- Solo guarda la referencia; los datos siguen en public.registros.
create table if not exists public.legacy_unmapped (
  legacy_registro_id  bigint primary key,
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria           text not null,
  resolved            boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- RLS + updated_at para todas las tablas de LIFE OS
-- ============================================================
do $$
declare
  t text;
  owner_tables text[] := array[
    'tags','attachments','life_assessments','daily_entries','daily_gratitude','daily_entry_tags',
    'journal_entries','emotional_tags','daily_entry_emotions','stress_factors','coping_strategies',
    'coping_strategy_logs','goals','milestones','habits','habit_logs','goal_habits','goal_daily_entries',
    'financial_categories','savings_goals','assets','liabilities','transactions','budgets',
    'career_positions','career_applications','application_interviews','skills','skill_levels','projects',
    'project_skills','learning_resources','exercises','workouts','workout_exercises','body_metrics',
    'nutrition_logs','calendar_events','daily_entry_events','daily_accomplishments','memories',
    'memory_tags','memory_people','legacy_unmapped'
  ];
begin
  foreach t in array owner_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'updated_at') then
      execute format('drop trigger if exists set_updated_at on public.%I', t);
      execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    end if;
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Perfil automático para usuarios nuevos y para los que ya existen.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- ============================================================
-- Storage: bucket privado para adjuntos e imágenes de LIFE OS
-- Rutas: <user_id>/<entidad>/<archivo>. El bucket "documentos" no se toca.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('life-os', 'life-os', false)
on conflict (id) do nothing;

drop policy if exists "life-os leer propios" on storage.objects;
create policy "life-os leer propios" on storage.objects for select to authenticated
  using (bucket_id = 'life-os' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "life-os subir propios" on storage.objects;
create policy "life-os subir propios" on storage.objects for insert to authenticated
  with check (bucket_id = 'life-os' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "life-os editar propios" on storage.objects;
create policy "life-os editar propios" on storage.objects for update to authenticated
  using (bucket_id = 'life-os' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "life-os borrar propios" on storage.objects;
create policy "life-os borrar propios" on storage.objects for delete to authenticated
  using (bucket_id = 'life-os' and (storage.foldername(name))[1] = auth.uid()::text);
