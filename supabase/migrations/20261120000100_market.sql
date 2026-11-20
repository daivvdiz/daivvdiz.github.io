-- ============================================================
-- LIFE OS · Market: mercados (compras de la canasta familiar) (migración 5)
--
-- SOLO AGREGA tablas y funciones nuevas. No modifica ni borra datos existentes
-- (ni registros, ni ajustes, ni el bucket "documentos").
-- Se puede ejecutar más de una vez.
--
-- Cómo aplicarla: Supabase > SQL Editor > New query > pegar > Run.
--
--   market_trips     un mercado (fecha, tienda, notas)
--   market_products  cada producto que has comprado alguna vez, una sola vez
--                    por nombre normalizado ("Avena en hojuelas" = "avena en  HOJUELAS")
--   market_items     cada producto de un mercado: cantidad y precio unitario
-- ============================================================

-- Clave para reconocer el mismo producto: sin tildes, en minúsculas y con
-- espacios simples. Debe coincidir con nameKey() en life-os/lib/market/schema.ts.
create or replace function public.market_name_key(p text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(regexp_replace(
    btrim(translate(coalesce(p, ''), 'ÁÉÍÓÚÜÑÀÈÌÒÙáéíóúüñàèìòù', 'AEIOUUNAEIOUaeiouunaeiou')),
    '\s+', ' ', 'g'))
$$;

create table if not exists public.market_trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_date   date not null default current_date,
  store       text check (store is null or length(store) <= 120),
  notes       text check (notes is null or length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists market_trips_user_date on public.market_trips (user_id, trip_date desc);

create table if not exists public.market_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 120),
  name_key    text generated always as (public.market_name_key(name)) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint market_products_user_key unique (user_id, name_key)
);

create table if not exists public.market_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id     uuid not null references public.market_trips(id) on delete cascade,
  product_id  uuid not null references public.market_products(id) on delete restrict,
  quantity    numeric(12,3) not null check (quantity > 0),
  unit_price  numeric(14,2) not null check (unit_price >= 0),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists market_items_trip on public.market_items (trip_id, position);
create index if not exists market_items_product on public.market_items (product_id);

do $$
declare t text;
begin
  foreach t in array array['market_trips', 'market_products', 'market_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
  foreach t in array array['market_trips', 'market_products'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Guarda un mercado completo en una sola transacción: crea o actualiza el mercado,
-- reemplaza sus productos y reutiliza los productos que ya existían por nombre.
-- p_items: [{"name": "Avena en hojuelas", "quantity": 2, "unit_price": 4500}, ...]
create or replace function public.save_market_trip(
  p_id uuid, p_trip_date date, p_store text, p_notes text, p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := p_id;
  v_item jsonb;
  v_pos int;
  v_name text;
  v_product uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'a market needs at least one product';
  end if;

  if v_id is null then
    insert into market_trips (user_id, trip_date, store, notes)
    values (v_uid, p_trip_date, nullif(btrim(p_store), ''), nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    update market_trips
       set trip_date = p_trip_date, store = nullif(btrim(p_store), ''), notes = nullif(btrim(p_notes), '')
     where id = v_id and user_id = v_uid;
    if not found then raise exception 'market not found'; end if;
    delete from market_items where trip_id = v_id and user_id = v_uid;
  end if;

  for v_item, v_pos in select e, o::int from jsonb_array_elements(p_items) with ordinality as x(e, o) loop
    v_name := regexp_replace(btrim(v_item->>'name'), '\s+', ' ', 'g');
    insert into market_products (user_id, name) values (v_uid, v_name)
    on conflict (user_id, name_key) do update set name = market_products.name
    returning id into v_product;
    insert into market_items (user_id, trip_id, product_id, quantity, unit_price, position)
    values (v_uid, v_id, v_product, (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric, v_pos);
  end loop;

  -- Productos que ya no aparecen en ningún mercado.
  delete from market_products p
   where p.user_id = v_uid and not exists (select 1 from market_items i where i.product_id = p.id);
  return v_id;
end $$;

create or replace function public.delete_market_trip(p_id uuid) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  delete from market_trips where id = p_id and user_id = v_uid;
  delete from market_products p
   where p.user_id = v_uid and not exists (select 1 from market_items i where i.product_id = p.id);
end $$;

-- Cambia el nombre de un producto. Si el nuevo nombre ya es otro producto, los une:
-- todas sus compras pasan a ese producto (útil para "Avena hojuelas" y "Avena en hojuelas").
create or replace function public.rename_market_product(p_id uuid, p_name text) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(btrim(p_name), '\s+', ' ', 'g');
  v_target uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from market_products where id = p_id and user_id = v_uid) then
    raise exception 'product not found';
  end if;
  select id into v_target from market_products
   where user_id = v_uid and name_key = market_name_key(v_name) and id <> p_id;
  if v_target is null then
    update market_products set name = v_name where id = p_id and user_id = v_uid;
    return p_id;
  end if;
  update market_items set product_id = v_target where product_id = p_id and user_id = v_uid;
  delete from market_products where id = p_id and user_id = v_uid;
  return v_target;
end $$;

revoke all on function public.save_market_trip(uuid, date, text, text, jsonb) from public, anon;
revoke all on function public.delete_market_trip(uuid) from public, anon;
revoke all on function public.rename_market_product(uuid, text) from public, anon;
grant execute on function public.save_market_trip(uuid, date, text, text, jsonb) to authenticated;
grant execute on function public.delete_market_trip(uuid) to authenticated;
grant execute on function public.rename_market_product(uuid, text) to authenticated;
