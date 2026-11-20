-- ============================================================
-- LIFE OS · Market: impuesto por producto (migración 6)
--
-- Agrega la columna tax_code a market_items y actualiza save_market_trip
-- para guardarla. No borra datos: los productos ya registrados quedan como
-- "6-Excluido" (0 %), así que sus totales no cambian.
-- Se puede ejecutar más de una vez. Requiere la migración 5 (20261120000100_market.sql).
--
-- Cómo aplicarla: Supabase > SQL Editor > New query > pegar > Run.
-- ============================================================

alter table public.market_items add column if not exists tax_code text not null default '6';
alter table public.market_items drop constraint if exists market_items_tax_code;
alter table public.market_items add constraint market_items_tax_code check (tax_code in ('6', '5', 'C', 'A'));

-- Guarda un mercado completo en una sola transacción: crea o actualiza el mercado,
-- reemplaza sus productos y reutiliza los productos que ya existían por nombre.
-- p_items: [{"name": "Avena en hojuelas", "quantity": 2, "unit_price": 4500, "tax_code": "6"}, ...]
-- tax_code: 6 = Excluido (0 %), 5 = Exento (0 %), C = 5 %, A = 19 %. Si falta, se usa 6.
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
    insert into market_items (user_id, trip_id, product_id, quantity, unit_price, tax_code, position)
    values (v_uid, v_id, v_product, (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
            coalesce(nullif(v_item->>'tax_code', ''), '6'), v_pos);
  end loop;

  -- Productos que ya no aparecen en ningún mercado.
  delete from market_products p
   where p.user_id = v_uid and not exists (select 1 from market_items i where i.product_id = p.id);
  return v_id;
end $$;

revoke all on function public.save_market_trip(uuid, date, text, text, jsonb) from public, anon;
grant execute on function public.save_market_trip(uuid, date, text, text, jsonb) to authenticated;
