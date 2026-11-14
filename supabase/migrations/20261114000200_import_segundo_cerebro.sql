-- ============================================================
-- LIFE OS · importador de Segundo Cerebro (migración 2)
--
-- COPIA cada fila de public.registros al modelo de LIFE OS.
-- No modifica ni borra public.registros ni public.ajustes.
-- Cada fila copiada guarda legacy_registro_id: repetir la importación
-- no duplica nada.
--
-- Uso desde LIFE OS: Ajustes > Datos > "Importar desde Segundo Cerebro".
--   select * from public.preview_segundo_cerebro_import();  -- vista previa
--   select public.import_segundo_cerebro();                 -- importar
-- ============================================================

-- ¿Ya se importó este registro?
create or replace function public.legacy_is_imported(p_id bigint)
returns boolean language sql stable as $$
  select exists (select 1 from public.transactions where legacy_registro_id = p_id)
      or exists (select 1 from public.career_positions where legacy_registro_id = p_id)
      or exists (select 1 from public.daily_accomplishments where legacy_registro_id = p_id)
      or exists (select 1 from public.skill_levels where legacy_registro_id = p_id)
      or exists (select 1 from public.workout_exercises where legacy_registro_id = p_id)
      or exists (select 1 from public.workouts w where w.notes = 'segundo-cerebro:' || p_id)
      or exists (select 1 from public.legacy_unmapped where legacy_registro_id = p_id);
$$;

-- Destino de cada categoría (para la vista previa).
create or replace function public.legacy_target(p_categoria text, p_valor numeric)
returns text language sql immutable as $$
  select case
    when p_categoria = 'apartamento' and coalesce(p_valor, 0) > 0 then 'Finanzas · pagos del apartamento'
    when p_categoria = 'trabajo' and p_valor is not null then 'Carrera · cargos y salarios'
    when p_categoria = 'trabajo' then 'Diario · logros'
    when p_categoria = 'skills' and p_valor is not null then 'Carrera · historial de skills'
    when p_categoria in ('fitness', 'gimnasio') and p_valor is not null then 'Físico · entrenamientos'
    else 'Sin clasificar (revisar)'
  end;
$$;

-- Copia UNA fila. Nunca lanza error hacia afuera: si algo falla, la fila
-- queda en legacy_unmapped para revisarla, y el registro original sigue intacto.
create or replace function public.map_registro(r public.registros)
returns text language plpgsql as $$
declare
  v_cat       text := lower(coalesce(r.categoria, ''));
  v_uid       uuid := r.user_id;
  v_liab      uuid;
  v_catid     uuid;
  v_entry     uuid;
  v_skill     uuid;
  v_ex        uuid;
  v_workout   uuid;
  v_total     numeric;
  v_name      text := nullif(trim(coalesce(r.titulo, '')), '');
  v_is_time   boolean := lower(coalesce(r.unidad, '')) = 'tiempo';
begin
  if public.legacy_is_imported(r.id) then
    return 'skipped';
  end if;

  if v_cat = 'apartamento' and coalesce(r.valor, 0) > 0 then
    select id into v_liab from public.liabilities
      where user_id = v_uid and name = 'Apartamento' limit 1;
    if v_liab is null then
      select case when (valor #>> '{}') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then (valor #>> '{}')::numeric end
        into v_total from public.ajustes where user_id = v_uid and clave = 'apartamento_total';
      insert into public.liabilities (user_id, name, kind, original_amount, notes)
        values (v_uid, 'Apartamento', 'vivienda', coalesce(v_total, 0), 'Importado de Segundo Cerebro')
        returning id into v_liab;
    end if;
    insert into public.financial_categories (user_id, name, kind, is_default)
      values (v_uid, 'Vivienda', 'expense', true)
      on conflict (user_id, kind, name) do nothing;
    select id into v_catid from public.financial_categories
      where user_id = v_uid and kind = 'expense' and name = 'Vivienda';
    insert into public.transactions (user_id, type, description, amount, occurred_on, category_id, notes, liability_id, legacy_registro_id)
      values (v_uid, 'expense', coalesce(v_name, 'Pago apartamento'), r.valor, r.fecha, v_catid, r.nota, v_liab, r.id);
    return 'transactions';

  elsif v_cat = 'trabajo' and r.valor is not null then
    insert into public.career_positions (user_id, title, company, started_on, monthly_salary, legacy_registro_id)
      values (v_uid, coalesce(v_name, 'Cargo'), r.nota, r.fecha, r.valor, r.id);
    return 'career_positions';

  elsif v_cat = 'trabajo' then
    insert into public.daily_entries (user_id, entry_date) values (v_uid, r.fecha)
      on conflict (user_id, entry_date) do nothing;
    select id into v_entry from public.daily_entries where user_id = v_uid and entry_date = r.fecha;
    insert into public.daily_accomplishments (user_id, daily_entry_id, content, legacy_registro_id)
      values (v_uid, v_entry,
              left(concat_ws(' · ', coalesce(v_name, 'Logro laboral'), nullif(trim(coalesce(r.nota, '')), '')), 500),
              r.id);
    return 'daily_accomplishments';

  elsif v_cat = 'skills' and r.valor is not null and v_name is not null then
    insert into public.skills (user_id, name) values (v_uid, v_name)
      on conflict (user_id, name) do nothing;
    select id into v_skill from public.skills where user_id = v_uid and name = v_name;
    insert into public.skill_levels (user_id, skill_id, level, assessed_on, notes, legacy_registro_id)
      values (v_uid, v_skill, least(greatest(r.valor, 0), 10), r.fecha, r.nota, r.id);
    update public.skills set last_practiced_on = greatest(coalesce(last_practiced_on, r.fecha), r.fecha)
      where id = v_skill;
    return 'skill_levels';

  elsif v_cat in ('fitness', 'gimnasio') and r.valor is not null and v_name is not null then
    insert into public.exercises (user_id, name, measure)
      values (v_uid, v_name, case when v_is_time then 'time' else 'weight' end)
      on conflict (user_id, name) do nothing;
    select id into v_ex from public.exercises where user_id = v_uid and name = v_name;

    if v_is_time then
      -- Actividad por tiempo (ej. Running): un entrenamiento propio con su duración.
      insert into public.workouts (user_id, performed_on, activity_type, duration_seconds, notes)
        values (v_uid, r.fecha,
                case when v_name ~* '(run|corr|trot)' then 'running' else 'other' end,
                round(r.valor)::int, 'segundo-cerebro:' || r.id)
        returning id into v_workout;
      insert into public.workout_exercises (user_id, workout_id, exercise_id, duration_seconds, notes, legacy_registro_id)
        values (v_uid, v_workout, v_ex, round(r.valor)::int, r.nota, r.id);
    else
      -- Ejercicio con peso: se agrupa en un entrenamiento de fuerza por día.
      select id into v_workout from public.workouts
        where user_id = v_uid and performed_on = r.fecha and notes = 'Importado de Segundo Cerebro'
        limit 1;
      if v_workout is null then
        insert into public.workouts (user_id, performed_on, activity_type, notes)
          values (v_uid, r.fecha, 'strength', 'Importado de Segundo Cerebro')
          returning id into v_workout;
      end if;
      insert into public.workout_exercises (user_id, workout_id, exercise_id, sets, reps, weight_kg, notes, legacy_registro_id)
        values (v_uid, v_workout, v_ex,
                nullif(r.extra ->> 'series', '')::numeric::smallint,
                nullif(r.extra ->> 'reps', '')::numeric::smallint,
                round(r.valor, 1), r.nota, r.id);
    end if;
    return 'workouts';

  else
    insert into public.legacy_unmapped (legacy_registro_id, user_id, categoria)
      values (r.id, v_uid, coalesce(r.categoria, '')) on conflict do nothing;
    return 'legacy_unmapped';
  end if;

exception when others then
  insert into public.legacy_unmapped (legacy_registro_id, user_id, categoria)
    values (r.id, v_uid, coalesce(r.categoria, '') || ' (error)') on conflict do nothing;
  return 'error';
end $$;

-- Vista previa: cuántas filas van a cada destino y cuántas ya se copiaron.
create or replace function public.preview_segundo_cerebro_import()
returns table (categoria text, destino text, total bigint, ya_importados bigint)
language sql stable as $$
  select r.categoria,
         public.legacy_target(lower(r.categoria), r.valor) as destino,
         count(*) as total,
         count(*) filter (where public.legacy_is_imported(r.id)) as ya_importados
  from public.registros r
  where r.user_id = auth.uid()
  group by 1, 2
  order by 1, 2;
$$;

-- Importa todo lo pendiente del usuario que llama. Devuelve el conteo por destino.
create or replace function public.import_segundo_cerebro()
returns jsonb language plpgsql as $$
declare
  r       public.registros;
  v_res   text;
  v_out   jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  for r in select * from public.registros where user_id = auth.uid() order by fecha, id loop
    v_res := public.map_registro(r);
    v_out := jsonb_set(v_out, array[v_res], to_jsonb(coalesce((v_out ->> v_res)::int, 0) + 1));
  end loop;
  return v_out;
end $$;

-- Lo nuevo que llegue por el Atajo de iOS o por Segundo Cerebro también se copia.
-- Si la copia falla, el registro original se guarda igual (map_registro no lanza errores).
create or replace function public.registros_after_insert()
returns trigger language plpgsql as $$
begin
  perform public.map_registro(new);
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists life_os_copy on public.registros;
create trigger life_os_copy after insert on public.registros
  for each row execute function public.registros_after_insert();

grant execute on function public.preview_segundo_cerebro_import() to authenticated;
grant execute on function public.import_segundo_cerebro() to authenticated;
