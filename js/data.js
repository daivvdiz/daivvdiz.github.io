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
const DEMO_KEY = "sb-demo-v2";

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
        categoria: "fitness", titulo: e, unidad: "kg",
        valor: base + i * 2.5 + (i % 3 === 0 ? 0 : 1.25),
        extra: { series: 4, reps: 8 }, fecha: hoyMenos((9 - i) * 7),
      });
  });
  for (let i = 0; i < 8; i++)
    add({ categoria: "fitness", titulo: "Running", unidad: "tiempo", valor: 1500 + i * 150 + (i % 2) * 40, fecha: hoyMenos((7 - i) * 6 + 1) });
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
// Las rutas son relativas a la carpeta del usuario: "Universidad/Semestre 1/nota.pdf".
// Supabase no tiene carpetas reales: una carpeta existe si contiene algún archivo,
// por eso las carpetas vacías guardan un archivo oculto PLACEHOLDER.
export const PLACEHOLDER = ".emptyFolderPlaceholder";
const BUCKET = "documentos";
const unir = (...p) => p.filter(Boolean).join("/");
export const padreDe = (ruta) => ruta.split("/").slice(0, -1).join("/");
export const nombreDe = (ruta) => ruta.split("/").pop();

// Supabase solo acepta nombres "seguros": quitamos tildes y símbolos raros.
export const limpiarNombre = (n) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, " ").trim();

// --- Operaciones básicas por modo ---
const demoObjs = new Map(); // ruta -> {size, blob, created_at}
let demoSembrado = false;

const ops = {
  demo: {
    async listarNivel(ruta) {
      const pre = ruta ? ruta + "/" : "";
      const carpetas = new Set(), archivos = [];
      for (const [k, v] of demoObjs) {
        if (!k.startsWith(pre)) continue;
        const resto = k.slice(pre.length).split("/");
        if (resto.length > 1) carpetas.add(resto[0]);
        else archivos.push({ name: resto[0], size: v.size, created_at: v.created_at });
      }
      return { carpetas: [...carpetas], archivos };
    },
    async subir(ruta, blob) {
      demoObjs.set(ruta, { size: blob.size ?? 0, blob, created_at: new Date().toISOString() });
    },
    async borrar(rutas) { rutas.forEach((r) => demoObjs.delete(r)); },
    async mover(de, a) {
      if (demoObjs.has(a)) throw new Error("Ya existe un elemento con ese nombre en el destino");
      demoObjs.set(a, demoObjs.get(de));
      demoObjs.delete(de);
    },
    async url(ruta) {
      const o = demoObjs.get(ruta);
      return o ? URL.createObjectURL(o.blob) : null;
    },
  },
  supabase: {
    async listarNivel(ruta) {
      const c = await cliente();
      const { data, error } = await c.storage.from(BUCKET).list(unir(await uid(), ruta), {
        limit: 1000, sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      return {
        carpetas: data.filter((f) => f.id === null).map((f) => f.name),
        archivos: data.filter((f) => f.id !== null).map((f) => ({ name: f.name, size: f.metadata?.size ?? 0, created_at: f.created_at })),
      };
    },
    async subir(ruta, blob) {
      const c = await cliente();
      const { error } = await c.storage.from(BUCKET).upload(unir(await uid(), ruta), blob, { upsert: true });
      if (error) throw error;
    },
    async borrar(rutas) {
      if (!rutas.length) return;
      const c = await cliente();
      const u = await uid();
      const { error } = await c.storage.from(BUCKET).remove(rutas.map((r) => unir(u, r)));
      if (error) throw error;
    },
    async mover(de, a) {
      const c = await cliente();
      const u = await uid();
      const { error } = await c.storage.from(BUCKET).move(unir(u, de), unir(u, a));
      if (error) throw new Error(/exist/i.test(error.message) ? "Ya existe un elemento con ese nombre en el destino" : error.message);
    },
    async url(ruta) {
      const c = await cliente();
      const { data, error } = await c.storage.from(BUCKET).createSignedUrl(unir(await uid(), ruta), 300);
      if (error) throw error;
      return data.signedUrl;
    },
  },
};
const op = () => ops[MODO];

let _uid = null;
async function uid() {
  if (!_uid) {
    const c = await cliente();
    const { data } = await c.auth.getUser();
    _uid = data.user.id;
  }
  return _uid;
}

// --- API de documentos ---
export async function listarCarpeta(ruta) {
  const { carpetas, archivos } = await op().listarNivel(ruta);
  const cmp = (a, b) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
  return {
    carpetas: carpetas.sort(cmp),
    archivos: archivos.filter((a) => a.name !== PLACEHOLDER).sort((a, b) => cmp(a.name, b.name)),
  };
}

// Crea las secciones iniciales solo si no hay nada todavía.
export async function asegurarRaices(secciones) {
  if (MODO === "demo" && !demoSembrado) {
    demoSembrado = true;
    const txt = (t) => new Blob([t], { type: "text/plain" });
    await ops.demo.subir("Universidad/Semestre 1/Notas finales.txt", txt("Ejemplo"));
    await ops.demo.subir("Universidad/Semestre 2/" + PLACEHOLDER, txt(""));
    await ops.demo.subir("Universidad/Diploma.txt", txt("Ejemplo"));
    await ops.demo.subir("Personales/Pasaporte.txt", txt("Ejemplo"));
  }
  const { carpetas, archivos } = await op().listarNivel("");
  if (carpetas.length || archivos.length) return;
  for (const s of secciones) await crearCarpeta(limpiarNombre(s));
}

export async function crearCarpeta(ruta) {
  const { carpetas } = await op().listarNivel(padreDe(ruta));
  if (carpetas.includes(nombreDe(ruta))) throw new Error("Ya existe una carpeta con ese nombre");
  await op().subir(unir(ruta, PLACEHOLDER), new Blob([""], { type: "text/plain" }));
}

export async function subirArchivo(carpeta, archivo) {
  await op().subir(unir(carpeta, limpiarNombre(archivo.name)), archivo);
}

export const urlArchivo = (ruta) => op().url(ruta);

// Todas las rutas de archivo (incluidos los ocultos) dentro de una carpeta.
async function archivosBajo(ruta) {
  const { carpetas, archivos } = await op().listarNivel(ruta);
  const hijos = await Promise.all(carpetas.map((c) => archivosBajo(unir(ruta, c))));
  return [...archivos.map((a) => unir(ruta, a.name)), ...hijos.flat()];
}

// Todas las carpetas (para el diálogo "Mover a…").
export async function todasLasCarpetas(ruta = "") {
  const { carpetas } = await op().listarNivel(ruta);
  const sub = await Promise.all(carpetas.map((c) => todasLasCarpetas(unir(ruta, c))));
  return carpetas.flatMap((c, i) => [unir(ruta, c), ...sub[i]]);
}

async function nombreLibre(destino, nombre) {
  const { carpetas, archivos } = await op().listarNivel(destino);
  if (carpetas.includes(nombre) || archivos.some((a) => a.name === nombre))
    throw new Error(`Ya existe "${nombre}" en el destino`);
}

// Mueve (o renombra) un archivo o carpeta. "nuevaRuta" es la ruta completa final.
export async function moverElemento(ruta, esCarpeta, nuevaRuta) {
  if (ruta === nuevaRuta) return;
  if (esCarpeta && (nuevaRuta + "/").startsWith(ruta + "/"))
    throw new Error("No puedes mover una carpeta dentro de sí misma");
  await nombreLibre(padreDe(nuevaRuta), nombreDe(nuevaRuta));
  if (!esCarpeta) return op().mover(ruta, nuevaRuta);
  const rutas = await archivosBajo(ruta);
  for (const r of rutas) await op().mover(r, nuevaRuta + r.slice(ruta.length));
}

export async function borrarElemento(ruta, esCarpeta) {
  await op().borrar(esCarpeta ? await archivosBajo(ruta) : [ruta]);
}

// Si al borrar/mover se vació la carpeta padre, la mantenemos con un placeholder.
export async function conservarCarpeta(ruta) {
  if (!ruta) return;
  const { carpetas, archivos } = await op().listarNivel(ruta);
  if (!carpetas.length && !archivos.length) await op().subir(unir(ruta, PLACEHOLDER), new Blob([""], { type: "text/plain" }));
}
