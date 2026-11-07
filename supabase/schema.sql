-- ============================================================
-- Segundo Cerebro · esquema de Supabase
-- Pega todo este archivo en Supabase > SQL Editor > New query > Run
-- ============================================================

-- 1) Registros: una sola tabla para todo lo que sigues en el tiempo.
--    categoria: apartamento | trabajo | skills | gimnasio | (cualquier otra)
--    titulo:    qué es (ej. "Pago cuota", "Press banca", "Python", "Analista Sr")
--    valor:     número principal (monto pagado, kg, nivel 1-10, salario)
--    extra:     datos adicionales libres (ej. {"reps":8,"series":4})
create table if not exists public.registros (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria   text not null,
  titulo      text not null default '',
  valor       numeric,
  unidad      text,
  nota        text,
  fecha       date not null default current_date,
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists registros_user_cat_fecha
  on public.registros (user_id, categoria, fecha desc);

-- 2) Ajustes: valores de configuración (ej. precio total del apartamento).
create table if not exists public.ajustes (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave    text not null,
  valor    jsonb not null,
  primary key (user_id, clave)
);

-- 3) Seguridad: cada usuario solo ve y modifica sus propias filas.
alter table public.registros enable row level security;
alter table public.ajustes   enable row level security;

drop policy if exists "registros propios" on public.registros;
create policy "registros propios" on public.registros
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ajustes propios" on public.ajustes;
create policy "ajustes propios" on public.ajustes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Documentos: bucket PRIVADO. Los archivos se guardan como
--    <tu-user-id>/<Sección>/<archivo>, y solo tú puedes leerlos.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists "docs leer propios" on storage.objects;
create policy "docs leer propios" on storage.objects
  for select using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "docs subir propios" on storage.objects;
create policy "docs subir propios" on storage.objects
  for insert with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "docs editar propios" on storage.objects;
create policy "docs editar propios" on storage.objects
  for update using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "docs borrar propios" on storage.objects;
create policy "docs borrar propios" on storage.objects
  for delete using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
