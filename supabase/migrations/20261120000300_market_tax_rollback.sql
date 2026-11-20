-- ============================================================
-- LIFE OS · Market: quitar el impuesto por producto (migración 7)
--
-- Deshace la migración 20261120000200_market_tax.sql: quita la columna tax_code
-- de market_items y deja save_market_trip como estaba en la migración 5.
-- No borra mercados, productos ni precios; solo el código de impuesto de cada línea.
-- Se puede ejecutar más de una vez, y también si la migración 6 nunca se ejecutó.
--
-- Cómo aplicarla: Supabase > SQL Editor > New query > pegar > Run.
-- ============================================================

alter table public.market_items drop constraint if exists market_items_tax_code;
alter table public.market_items drop column if exists tax_code;

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

revoke all on function public.save_market_trip(uuid, date, text, text, jsonb) from public, anon;
grant execute on function public.save_market_trip(uuid, date, text, text, jsonb) to authenticated;
