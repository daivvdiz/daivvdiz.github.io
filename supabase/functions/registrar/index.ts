// Función "registrar": la URL a la que llama tu Atajo de iOS.
//
// Secretos que debes crear en Supabase > Edge Functions > Secrets:
//   ATAJO_TOKEN    = una contraseña larga inventada por ti (la pondrás en el Atajo)
//   OWNER_USER_ID  = tu User ID (Authentication > Users)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya existen por defecto.
//
// Desactiva "Verify JWT" para esta función (el Atajo usa ATAJO_TOKEN).
//
// Petición (POST, JSON):
//   Header: Authorization: Bearer <ATAJO_TOKEN>
//   Body:   { "categoria": "gimnasio", "titulo": "Press banca", "valor": 60,
//             "unidad": "kg", "nota": "", "fecha": "2026-11-07",
//             "extra": { "reps": 8, "series": 4 } }
// Solo "categoria" es obligatoria.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const expected = Deno.env.get("ATAJO_TOKEN");
  if (!expected || token !== expected) return json({ error: "Token inválido" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "El cuerpo debe ser JSON" }, 400);
  }

  const categoria = String(body.categoria ?? "").trim().toLowerCase();
  if (!categoria) return json({ error: "Falta 'categoria'" }, 400);

  const num = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const fila = {
    user_id: Deno.env.get("OWNER_USER_ID"),
    categoria,
    titulo: String(body.titulo ?? "").trim(),
    valor: num(body.valor),
    unidad: body.unidad ? String(body.unidad) : null,
    nota: body.nota ? String(body.nota) : null,
    fecha: body.fecha ? String(body.fecha).slice(0, 10) : undefined,
    extra: typeof body.extra === "object" && body.extra !== null ? body.extra : {},
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.from("registros").insert(fila).select().single();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, mensaje: `Guardado en ${categoria}`, registro: data });
});
