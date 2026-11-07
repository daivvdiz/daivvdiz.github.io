// Capa de datos: Supabase si está configurado, si no, modo demo local.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const MODO = SUPABASE_URL && SUPABASE_ANON_KEY ? "supabase" : "demo";

let sb = null;
async function cliente() {
  if (!sb) {
    const { createClient } = await import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm"
    );
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return sb;
}

// ---------- Modo demo (localStorage) ----------
const DEMO_KEY = "sb-demo-v1";
const memDocs = {}; // seccion -> [{name, size, url, created_at}]

function hoyMenos(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function semilla() {
  const r = [];
  let id = 1;
  const add = (o) => r.push({ id: id++, extra: {}, unidad: null, nota: null, ...o });
  for (let i = 11; i >= 0; i--)
    add({ categoria: "apartamento", titulo: "Cuota mensual", valor: 1500000, fecha: hoyMenos(i * 30 + 3) });
  add({ categoria: "apartamento", titulo: "Abono extra (prima)", valor: 4000000, fecha: hoyMenos(170) });
  add({ categoria: "trabajo", titulo: "Analista Junior", nota: "Primera empresa", valor: 2800000, fecha: hoyMenos(900) });
  add({ categoria: "trabajo", titulo: "Analista", nota: "Ascenso", valor: 3600000, fecha: hoyMenos(520) });
  add({ categoria: "trabajo", titulo: "Certificación en la nube", nota: "Logro", fecha: hoyMenos(300) });
  add({ categoria: "trabajo", titulo: "Analista Senior", nota: "Cambio de empresa", valor: 5200000, fecha: hoyMenos(120) });
  [["Python", [3, 4, 5, 6, 7]], ["SQL", [4, 5, 5, 6, 8]], ["Inglés", [5, 5, 6, 6, 7]], ["Power BI", [2, 3, 5, 6, 6]]].forEach(
    ([s, niveles]) => niveles.forEach((n, i) => add({ categoria: "skills", titulo: s, valor: n, fecha: hoyMenos((4 - i) * 75) })),
  );
  [["Press banca", 40], ["Sentadilla", 50], ["Peso muerto", 60]].forEach(([e, base]) => {
    for (let i = 0; i < 10; i++)
      add({
        categoria: "gimnasio", titulo: e, unidad: "kg",
        valor: base + i * 2.5 + (i % 3 === 0 ? 0 : 1.25),
        extra: { series: 4, reps: 8 }, fecha: hoyMenos((9 - i) * 7),
      });
  });
  return { registros: r, ajustes: { apartamento_total: 120000000, moneda: "$" }, nextId: id };
}

function demoLeer() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const s = semilla();
  demoGuardar(s);
  return s;
}
function demoGuardar(s) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch {}
}

// ---------- API pública ----------
export async function sesion() {
  if (MODO === "demo") return { user: { email: "modo demo" } };
  const c = await cliente();
  const { data } = await c.auth.getSession();
  return data.session;
}

export async function entrar(email, password) {
  const c = await cliente();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : error.message);
}

export async function salir() {
  if (MODO === "demo") return;
  const c = await cliente();
  await c.auth.signOut();
}

export async function listarRegistros() {
  if (MODO === "demo")
    return [...demoLeer().registros].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const c = await cliente();
  const { data, error } = await c.from("registros").select("*").order("fecha", { ascending: true }).order("id");
  if (error) throw error;
  return data;
}

export async function agregarRegistro(fila) {
  if (MODO === "demo") {
    const s = demoLeer();
    const nuevo = { id: s.nextId++, extra: {}, ...fila };
    s.registros.push(nuevo);
    demoGuardar(s);
    return nuevo;
  }
  const c = await cliente();
  const { data, error } = await c.from("registros").insert(fila).select().single();
  if (error) throw error;
  return data;
}

export async function borrarRegistro(id) {
  if (MODO === "demo") {
    const s = demoLeer();
    s.registros = s.registros.filter((r) => r.id !== id);
    demoGuardar(s);
    return;
  }
  const c = await cliente();
  const { error } = await c.from("registros").delete().eq("id", id);
  if (error) throw error;
}

export async function leerAjustes() {
  if (MODO === "demo") return { ...demoLeer().ajustes };
  const c = await cliente();
  const { data, error } = await c.from("ajustes").select("clave, valor");
  if (error) throw error;
  return Object.fromEntries(data.map((a) => [a.clave, a.valor]));
}

export async function guardarAjuste(clave, valor) {
  if (MODO === "demo") {
    const s = demoLeer();
    s.ajustes[clave] = valor;
    demoGuardar(s);
    return;
  }
  const c = await cliente();
  const { data: u } = await c.auth.getUser();
  const { error } = await c.from("ajustes").upsert({ user_id: u.user.id, clave, valor });
  if (error) throw error;
}

// ---------- Documentos ----------
async function prefijo() {
  const c = await cliente();
  const { data } = await c.auth.getUser();
  return data.user.id;
}

const limpiarNombre = (n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\- ]+/g, "_");

export async function listarDocs(seccion) {
  if (MODO === "demo") return memDocs[seccion] ?? [];
  const c = await cliente();
  const { data, error } = await c.storage
    .from("documentos")
    .list(`${await prefijo()}/${seccion}`, { sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  return data
    .filter((f) => f.name !== ".emptyFolderPlaceholder")
    .map((f) => ({ name: f.name, size: f.metadata?.size ?? 0, created_at: f.created_at }));
}

export async function subirDoc(seccion, archivo) {
  if (MODO === "demo") {
    (memDocs[seccion] ??= []).push({
      name: archivo.name, size: archivo.size, url: URL.createObjectURL(archivo),
      created_at: new Date().toISOString(),
    });
    return;
  }
  const c = await cliente();
  const ruta = `${await prefijo()}/${seccion}/${limpiarNombre(archivo.name)}`;
  const { error } = await c.storage.from("documentos").upload(ruta, archivo, { upsert: true });
  if (error) throw error;
}

export async function urlDoc(seccion, nombre) {
  if (MODO === "demo") return memDocs[seccion]?.find((d) => d.name === nombre)?.url;
  const c = await cliente();
  const { data, error } = await c.storage
    .from("documentos")
    .createSignedUrl(`${await prefijo()}/${seccion}/${nombre}`, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function borrarDoc(seccion, nombre) {
  if (MODO === "demo") {
    memDocs[seccion] = (memDocs[seccion] ?? []).filter((d) => d.name !== nombre);
    return;
  }
  const c = await cliente();
  const { error } = await c.storage.from("documentos").remove([`${await prefijo()}/${seccion}/${nombre}`]);
  if (error) throw error;
}
