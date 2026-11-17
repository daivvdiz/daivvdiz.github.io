-- ============================================================
-- LIFE OS · Eventos que se repiten (migración 4)
--
-- SOLO AGREGA columnas nuevas a calendar_events. No modifica ni borra
-- datos existentes (ni registros, ni ajustes, ni el bucket "documentos").
-- Tus eventos actuales quedan igual: sin repetición.
-- Se puede ejecutar más de una vez.
--
-- Cómo aplicarla: Supabase > SQL Editor > New query > pegar > Run.
-- ============================================================

-- Regla de repetición, p. ej. {"freq":"weekly","interval":1,"weekdays":[1,3]}.
-- null = el evento no se repite.
alter table public.calendar_events add column if not exists recurrence jsonb;
-- Último día de la serie (inclusive). null = se repite sin fin.
alter table public.calendar_events add column if not exists recurrence_until date;
-- Días quitados de la serie ("solo este evento").
alter table public.calendar_events add column if not exists recurrence_exceptions date[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_recurrence_valid') then
    alter table public.calendar_events add constraint calendar_events_recurrence_valid check (
      recurrence is null or (
        jsonb_typeof(recurrence) = 'object'
        and recurrence->>'freq' in ('daily','weekly','monthly','yearly')
        and coalesce((recurrence->>'interval')::int, 1) between 1 and 99
      )
    );
  end if;
end $$;

create index if not exists calendar_events_user_recurring
  on public.calendar_events (user_id, starts_at) where recurrence is not null;

-- RLS ya está activa en calendar_events ("own rows"); las columnas nuevas quedan cubiertas.
