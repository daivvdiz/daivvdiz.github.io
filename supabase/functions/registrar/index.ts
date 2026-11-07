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
//   Body:   { "categoria": "fitness", "titulo": "Press banca", "valor": 60.5,
//             "unidad": "kg", "nota": "", "fecha": "2026-11-07",
//             "extra": { "reps": 8, "series": 4 } }
//   Tiempo: { "categoria": "fitness", "titulo": "Running", "valor": "00:32:15" }
//           (un valor con ":" se guarda como tiempo en segundos, unidad "tiempo")
// Solo "categoria" es obligatoria. "gimnasio" se acepta como alias de "fitness".

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

  let categoria = String(body.categoria ?? "").trim().toLowerCase();
  if (categoria === "gimnasio") categoria = "fitness";
  if (!categoria) return json({ error: "Falta 'categoria'" }, 400);

  const num = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  // "hh:mm:ss", "mm:ss" -> segundos
  const tiempo = (v: unknown) => {
    const partes = String(v).trim().split(":").map(Number);
    if (partes.length < 2 || partes.length > 3 || partes.some((n) => !Number.isFinite(n))) return null;
    return partes.reduce((acc, n) => acc * 60 + n, 0);
  };

  let valor = num(body.valor);
  let unidad = body.unidad ? String(body.unidad).trim().toLowerCase() : null;
  if (typeof body.valor === "string" && body.valor.includes(":")) {
    valor = tiempo(body.valor);
    if (valor === null) return json({ error: "Tiempo inválido, usa hh:mm:ss" }, 400);
    unidad = "tiempo";
  }
  if (categoria === "fitness") {
    if (!unidad || unidad === "peso") unidad = "kg";
    if (unidad === "kg" && valor !== null) valor = Math.round(valor * 10) / 10;
  }

  const fila = {
    user_id: Deno.env.get("OWNER_USER_ID"),
    categoria,
    titulo: String(body.titulo ?? "").trim(),
    valor,
    unidad,
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
