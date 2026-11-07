// Explorador de documentos: carpetas, subcarpetas, subir, renombrar, mover (arrastrando o con "Mover a…") y borrar.
import * as db from "./data.js";
import { SECCIONES_DOCS } from "./config.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fBytes = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const unir = (...p) => p.filter(Boolean).join("/");

const ICO_CARPETA = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const ICO_ARCHIVO = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';

let ruta = ""; // carpeta abierta
let toast = () => {};
let ocupado = false;

export function configurar(opciones) {
  toast = opciones.toast;
}

export function vista() {
  setTimeout(cargar);
  return `
    <section class="card explorer" id="explorador">
      <nav class="migas" id="migas" aria-label="Ruta"></nav>
      <div class="toolbar">
        <button class="btn ghost" id="nueva-carpeta">+ Carpeta</button>
        <label class="btn">Subir archivo<input type="file" id="subir" multiple hidden></label>
      </div>
      ${db.MODO === "demo" ? `<p class="aviso">Modo demo: los archivos solo viven en esta pestaña. Conecta Supabase para guardarlos de forma privada.</p>` : ""}
      <ul class="items" id="items"><li class="vacio">Cargando…</li></ul>
      <p class="pista">Mantén pulsado (o arrastra con el ratón) una carpeta o archivo y suéltalo sobre otra carpeta, o sobre la ruta de arriba para sacarlo. También puedes usar ⋯ → Mover a…</p>
    </section>`;
}

function pintarMigas() {
  const partes = ruta ? ruta.split("/") : [];
  const migas = [`<button class="miga" data-ir="" data-drop="">Documentos</button>`];
  partes.forEach((p, i) => {
    const r = partes.slice(0, i + 1).join("/");
    migas.push(`<span class="sep">/</span><button class="miga${i === partes.length - 1 ? " actual" : ""}" data-ir="${esc(r)}" data-drop="${esc(r)}">${esc(p)}</button>`);
  });
  $("#migas").innerHTML = migas.join("");
}

export async function cargar() {
  const cont = $("#items");
  if (!cont) return;
  pintarMigas();
  try {
    if (!ruta) await db.asegurarRaices(SECCIONES_DOCS);
    const { carpetas, archivos } = await db.listarCarpeta(ruta);
    if (!$("#items")) return;
    if (!carpetas.length && !archivos.length) {
      cont.innerHTML = `<li class="vacio">Carpeta vacía. Crea una subcarpeta o sube un archivo.</li>`;
      return;
    }
    cont.innerHTML =
      carpetas
        .map((c) => {
          const r = unir(ruta, c);
          return `<li class="item carpeta" data-ruta="${esc(r)}" data-tipo="carpeta" data-drop="${esc(r)}">
            <button class="item-main" data-abrir-carpeta="${esc(r)}">${ICO_CARPETA}<span class="item-nombre">${esc(c)}</span></button>
            <button class="mas" data-menu="${esc(r)}" data-tipo="carpeta" aria-label="Opciones de ${esc(c)}">⋯</button>
          </li>`;
        })
        .join("") +
      archivos
        .map((a) => {
          const r = unir(ruta, a.name);
          return `<li class="item archivo" data-ruta="${esc(r)}" data-tipo="archivo">
            <button class="item-main" data-abrir-archivo="${esc(r)}">${ICO_ARCHIVO}<span class="item-nombre">${esc(a.name)}</span><small>${fBytes(a.size)}</small></button>
            <button class="mas" data-menu="${esc(r)}" data-tipo="archivo" aria-label="Opciones de ${esc(a.name)}">⋯</button>
          </li>`;
        })
        .join("");
  } catch (e) {
    cont.innerHTML = `<li class="vacio">No se pudo cargar: ${esc(e.message)}</li>`;
  }
}

// ---------- Acciones ----------
async function accion(fn, ok) {
  if (ocupado) return;
  ocupado = true;
  try {
    await fn();
    if (ok) toast(ok);
  } catch (e) {
    toast(e.message, true);
  } finally {
    ocupado = false;
    cargar();
  }
}

function mover(origen, tipo, destino) {
  const nueva = unir(destino, db.nombreDe(origen));
  if (nueva === origen) return;
  return accion(async () => {
    await db.moverElemento(origen, tipo === "carpeta", nueva);
    await db.conservarCarpeta(db.padreDe(origen));
  }, `Movido a ${destino || "Documentos"}`);
}

function pedirNombre(titulo, valor = "") {
  const n = prompt(titulo, valor);
  if (n === null) return null;
  const limpio = db.limpiarNombre(n.replace(/\//g, "-"));
  if (!limpio || limpio === db.PLACEHOLDER) {
    toast("Nombre no válido", true);
    return null;
  }
  return limpio;
}

function abrirMenu(r, tipo) {
  const dlg = $("#dlg");
  const nombre = db.nombreDe(r);
  dlg.innerHTML = `<div class="hoja">
    <h2>${esc(nombre)}</h2>
    ${tipo === "archivo" ? `<button class="btn ghost" data-h="abrir">Abrir</button>` : `<button class="btn ghost" data-h="abrir">Abrir carpeta</button>`}
    <button class="btn ghost" data-h="renombrar">Renombrar</button>
    <button class="btn ghost" data-h="mover">Mover a…</button>
    <button class="btn ghost peligro" data-h="borrar">Borrar</button>
    <button class="btn" data-h="cerrar">Cancelar</button>
  </div>`;
  dlg.onclick = async (e) => {
    const h = e.target.closest("[data-h]")?.dataset.h;
    if (!h) return;
    dlg.close();
    if (h === "abrir") return tipo === "archivo" ? abrirArchivo(r) : irA(r);
    if (h === "renombrar") {
      const n = pedirNombre("Nuevo nombre:", nombre);
      if (n && n !== nombre)
        accion(async () => {
          await db.moverElemento(r, tipo === "carpeta", unir(db.padreDe(r), n));
        }, "Renombrado ✓");
    }
    if (h === "mover") elegirDestino(r, tipo);
    if (h === "borrar") {
      const aviso = tipo === "carpeta" ? `¿Borrar la carpeta "${nombre}" y TODO su contenido?` : `¿Borrar "${nombre}"?`;
      if (confirm(aviso))
        accion(async () => {
          await db.borrarElemento(r, tipo === "carpeta");
          await db.conservarCarpeta(db.padreDe(r));
        }, "Borrado");
    }
  };
  dlg.showModal();
}

async function elegirDestino(r, tipo) {
  const dlg = $("#dlg");
  dlg.onclick = null;
  dlg.innerHTML = `<div class="hoja"><h2>Mover "${esc(db.nombreDe(r))}" a…</h2><p class="vacio">Cargando carpetas…</p></div>`;
  dlg.showModal();
  let carpetas;
  try {
    carpetas = await db.todasLasCarpetas();
  } catch (e) {
    dlg.close();
    return toast(e.message, true);
  }
  const actual = db.padreDe(r);
  const validas = ["", ...carpetas].filter((c) => !(tipo === "carpeta" && (c + "/").startsWith(r + "/")));
  dlg.innerHTML = `<div class="hoja">
    <h2>Mover "${esc(db.nombreDe(r))}" a…</h2>
    <ul class="destinos">${validas
      .map((c) => {
        const nivel = c ? c.split("/").length : 0;
        return `<li><button class="destino" data-dest="${esc(c)}" style="padding-left:${12 + nivel * 18}px" ${c === actual ? "disabled" : ""}>
          ${ICO_CARPETA}<span>${esc(c ? db.nombreDe(c) : "Documentos (inicio)")}</span>${c === actual ? "<small>actual</small>" : ""}</button></li>`;
      })
      .join("")}</ul>
    <button class="btn ghost" data-cerrar>Cancelar</button>
  </div>`;
  dlg.onclick = (e) => {
    if (e.target.closest("[data-cerrar]")) return dlg.close();
    const b = e.target.closest("[data-dest]");
    if (!b || b.disabled) return;
    dlg.close();
    mover(r, tipo, b.dataset.dest);
  };
}

async function abrirArchivo(r) {
  try {
    const url = await db.urlArchivo(r);
    window.open(url, "_blank", "noopener");
  } catch (e) {
    toast("No se pudo abrir: " + e.message, true);
  }
}

function irA(r) {
  ruta = r;
  cargar();
}

// ---------- Clics ----------
document.addEventListener("click", (e) => {
  if (!e.target.closest("#explorador")) return;
  if (arrastre.reciente) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  const t = e.target.closest("button");
  if (!t) return;
  if (t.id === "nueva-carpeta") {
    const n = pedirNombre("Nombre de la nueva carpeta:");
    if (n) accion(() => db.crearCarpeta(unir(ruta, n)), "Carpeta creada ✓");
  } else if (t.dataset.ir !== undefined) irA(t.dataset.ir);
  else if (t.dataset.abrirCarpeta) irA(t.dataset.abrirCarpeta);
  else if (t.dataset.abrirArchivo) abrirArchivo(t.dataset.abrirArchivo);
  else if (t.dataset.menu) abrirMenu(t.dataset.menu, t.dataset.tipo);
}, true);

async function subir(files) {
  if (!files.length) return;
  toast(`Subiendo ${files.length} archivo(s)…`);
  await accion(async () => {
    for (const f of files) await db.subirArchivo(ruta, f);
  }, "Subido ✓");
}

document.addEventListener("change", (e) => {
  if (e.target.id === "subir") subir([...e.target.files]);
});

// Soltar archivos del ordenador sobre el explorador.
document.addEventListener("dragover", (e) => {
  if (e.target.closest?.("#explorador") && e.dataTransfer?.types.includes("Files")) {
    e.preventDefault();
    $("#explorador").classList.add("soltando");
  }
});
document.addEventListener("dragleave", (e) => {
  if (!e.relatedTarget || !e.relatedTarget.closest?.("#explorador")) $("#explorador")?.classList.remove("soltando");
});
document.addEventListener("drop", (e) => {
  if (!e.target.closest?.("#explorador") || !e.dataTransfer?.files.length) return;
  e.preventDefault();
  $("#explorador").classList.remove("soltando");
  subir([...e.dataTransfer.files]);
});

// ---------- Arrastrar para mover (ratón y táctil) ----------
const arrastre = { item: null, activo: false, x0: 0, y0: 0, timer: 0, fantasma: null, destino: null, reciente: false };

function iniciarArrastre(x, y) {
  arrastre.activo = true;
  arrastre.item.classList.add("arrastrando");
  const f = document.createElement("div");
  f.className = "fantasma";
  f.innerHTML = (arrastre.item.dataset.tipo === "carpeta" ? ICO_CARPETA : ICO_ARCHIVO) + `<span>${esc(db.nombreDe(arrastre.item.dataset.ruta))}</span>`;
  document.body.appendChild(f);
  arrastre.fantasma = f;
  navigator.vibrate?.(15);
  moverArrastre(x, y);
}

function moverArrastre(x, y) {
  arrastre.fantasma.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
  arrastre.fantasma.hidden = true;
  const bajo = document.elementFromPoint(x, y)?.closest("[data-drop]");
  arrastre.fantasma.hidden = false;
  const origen = arrastre.item.dataset.ruta;
  const valido =
    bajo && bajo.dataset.drop !== origen && bajo.dataset.drop !== db.padreDe(origen) &&
    !(arrastre.item.dataset.tipo === "carpeta" && (bajo.dataset.drop + "/").startsWith(origen + "/"));
  if (arrastre.destino && arrastre.destino !== bajo) arrastre.destino.classList.remove("destino-on");
  arrastre.destino = valido ? bajo : null;
  arrastre.destino?.classList.add("destino-on");
}

function terminarArrastre(soltar) {
  clearTimeout(arrastre.timer);
  if (arrastre.activo) {
    const { item, destino } = arrastre;
    item.classList.remove("arrastrando");
    destino?.classList.remove("destino-on");
    arrastre.fantasma?.remove();
    arrastre.reciente = true;
    setTimeout(() => (arrastre.reciente = false), 400);
    if (soltar && destino) mover(item.dataset.ruta, item.dataset.tipo, destino.dataset.drop);
  }
  Object.assign(arrastre, { item: null, activo: false, fantasma: null, destino: null });
}

// Ratón
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  const item = e.target.closest("#explorador .item");
  if (!item || e.target.closest(".mas")) return;
  Object.assign(arrastre, { item, x0: e.clientX, y0: e.clientY });
});
document.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" || !arrastre.item) return;
  if (!arrastre.activo && Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0) > 6) iniciarArrastre(e.clientX, e.clientY);
  if (arrastre.activo) moverArrastre(e.clientX, e.clientY);
});
document.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse" && arrastre.item) terminarArrastre(true);
});

// Táctil: mantener pulsado ~0,4 s para empezar a arrastrar; si deslizas antes, es scroll normal.
document.addEventListener("touchstart", (e) => {
  const item = e.target.closest("#explorador .item");
  if (!item || e.target.closest(".mas") || e.touches.length > 1) return;
  const t = e.touches[0];
  Object.assign(arrastre, { item, x0: t.clientX, y0: t.clientY });
  arrastre.timer = setTimeout(() => iniciarArrastre(arrastre.x0, arrastre.y0), 400);
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!arrastre.item) return;
  const t = e.touches[0];
  if (arrastre.activo) {
    e.preventDefault(); // bloquea el scroll mientras arrastras
    moverArrastre(t.clientX, t.clientY);
  } else if (Math.hypot(t.clientX - arrastre.x0, t.clientY - arrastre.y0) > 8) {
    clearTimeout(arrastre.timer);
    arrastre.item = null;
  }
}, { passive: false });
document.addEventListener("touchend", () => arrastre.item && terminarArrastre(true));
document.addEventListener("touchcancel", () => arrastre.item && terminarArrastre(false));
document.addEventListener("contextmenu", (e) => {
  if (e.target.closest("#explorador .item")) e.preventDefault();
});
