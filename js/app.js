import * as db from "./data.js";
import { lineChart, sparkline, ring } from "./charts.js";
import { SECCIONES_DOCS } from "./config.js";

// ---------- Utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hoy = () => new Date().toLocaleDateString("sv"); // YYYY-MM-DD local
const fFecha = (f) => new Date(f + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
const fNum = (n, dec = 0) => Number(n).toLocaleString("es", { maximumFractionDigits: dec });
const agrupar = (arr, k) => arr.reduce((m, x) => ((m[x[k]] ??= []).push(x), m), {});
// Medidas de Fitness: "kg" (1 decimal) o "tiempo" (segundos, se muestra hh:mm:ss).
const fTiempo = (seg) => {
  const t = Math.round(Math.abs(Number(seg)));
  const p2 = (n) => String(n).padStart(2, "0");
  return `${p2(Math.floor(t / 3600))}:${p2(Math.floor((t % 3600) / 60))}:${p2(t % 60)}`;
};
const fPeso = (v) => Number(v).toLocaleString("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const esTiempo = (u) => u === "tiempo";
const fMedida = (v, u) => (esTiempo(u) ? fTiempo(v) : u === "kg" ? `${fPeso(v)} kg` : `${fNum(v, 2)}${u ? " " + u : ""}`);
const fDelta = (d, u) => `${d < 0 ? "−" : "+"}${esTiempo(u) ? fTiempo(d) : fMedida(Math.abs(d), u)}`;
const fBytes = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

const ICON = {
  inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  apartamento: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3"/>',
  trabajo: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  skills: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  fitness: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  documentos: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
};
const icon = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

const CATS = {
  apartamento: { nombre: "Apartamento", titulo: "Concepto", tituloDef: "Cuota mensual", valor: "Monto pagado", unidad: "" },
  trabajo: { nombre: "Trabajo", titulo: "Puesto o logro", valor: "Salario (opcional)", nota: "Empresa / detalles", unidad: "" },
  skills: { nombre: "Skills", titulo: "Skill", valor: "Nivel (1 a 10)", unidad: "" },
  fitness: { nombre: "Fitness", titulo: "Ejercicio", medida: true, series: true },
};
const VISTAS = ["inicio", "apartamento", "trabajo", "skills", "fitness", "documentos"];
const NOMBRES = { inicio: "Inicio", documentos: "Documentos", ...Object.fromEntries(Object.entries(CATS).map(([k, v]) => [k, v.nombre])) };

// ---------- Estado ----------
const estado = { registros: [], ajustes: {}, gymSel: null, docSec: SECCIONES_DOCS[0] };
const deCat = (c) => estado.registros.filter((r) => r.categoria === c);
const dinero = (n) => `${estado.ajustes.moneda ?? "$"}${fNum(n)}`;

function toast(msg, error = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (error ? " error" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = "toast"), 2600);
}

// ---------- Navegación ----------
function vistaActual() {
  const v = location.hash.slice(1);
  if (v === "gimnasio") return "fitness"; // enlaces antiguos
  return VISTAS.includes(v) ? v : "inicio";
}

function pintarNav() {
  const v = vistaActual();
  $("#nav").innerHTML = VISTAS.map(
    (k) => `<a href="#${k}" class="${k === v ? "on" : ""}" ${k === v ? 'aria-current="page"' : ""}>${icon(k)}<span>${NOMBRES[k]}</span></a>`,
  ).join("");
}

function render() {
  pintarNav();
  const v = vistaActual();
  $("#titulo").textContent = NOMBRES[v];
  $("#fab").hidden = v === "documentos";
  const main = $("#main");
  main.innerHTML = VISTAS_RENDER[v]();
  main.scrollTop = 0;
}

// ---------- Vistas ----------
function listaRegistros(rows, { mostrarCat = false, formato } = {}) {
  if (!rows.length) return `<p class="vacio">Sin registros todavía. Usa el botón + o tu Atajo.</p>`;
  return `<ul class="lista">${rows
    .map((r) => {
      const ex = r.extra && (r.extra.series || r.extra.reps) ? ` · ${r.extra.series ?? "?"}×${r.extra.reps ?? "?"}` : "";
      const val = r.valor != null ? (formato ? formato(r) : esc(fMedida(r.valor, r.unidad))) : "";
      return `<li>
        <div class="li-main">
          <strong>${esc(r.titulo || NOMBRES[r.categoria] || r.categoria)}</strong>
          <small>${mostrarCat ? esc(NOMBRES[r.categoria] ?? r.categoria) + " · " : ""}${fFecha(r.fecha)}${ex}${r.nota ? " · " + esc(r.nota) : ""}</small>
        </div>
        <span class="li-val">${val}</span>
        <button class="borrar" data-borrar="${r.id}" aria-label="Borrar registro">×</button>
      </li>`;
    })
    .join("")}</ul>`;
}

function datosApto() {
  const pagos = deCat("apartamento");
  const total = Number(estado.ajustes.apartamento_total) || 0;
  const pagado = pagos.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  return { pagos, total, pagado, pct: total ? (pagado / total) * 100 : 0 };
}

function ultimoPorTitulo(rows) {
  return Object.entries(agrupar(rows, "titulo")).map(([t, rs]) => ({ titulo: t, rs, ult: rs.at(-1), prim: rs[0] }));
}

const VISTAS_RENDER = {
  inicio() {
    const a = datosApto();
    const trab = deCat("trabajo");
    const puesto = [...trab].reverse().find((r) => r.valor != null) ?? trab.at(-1);
    const skills = ultimoPorTitulo(deCat("skills"));
    const prom = skills.length ? skills.reduce((s, x) => s + Number(x.ult.valor), 0) / skills.length : 0;
    const gym = deCat("fitness");
    const hace30 = new Date(Date.now() - 30 * 864e5).toLocaleDateString("sv");
    const sesiones = new Set(gym.filter((r) => r.fecha >= hace30).map((r) => r.fecha)).size;
    const recientes = [...estado.registros].sort((x, y) => y.fecha.localeCompare(x.fecha) || y.id - x.id).slice(0, 8);
    return `
      <section class="grid">
        <a class="card stat" href="#apartamento">
          <span class="stat-k">${icon("apartamento")} Apartamento</span>
          <span class="stat-v">${a.total ? a.pct.toFixed(1) + "%" : dinero(a.pagado)}</span>
          <div class="bar"><i style="width:${Math.min(100, a.pct)}%"></i></div>
          <span class="stat-s">${a.total ? `${dinero(a.pagado)} de ${dinero(a.total)}` : "Define el precio total"}</span>
        </a>
        <a class="card stat" href="#trabajo">
          <span class="stat-k">${icon("trabajo")} Trabajo</span>
          <span class="stat-v small">${esc(puesto?.titulo ?? "—")}</span>
          <span class="stat-s">${puesto ? "Desde " + fFecha(puesto.fecha) : "Añade tu primer puesto"}</span>
        </a>
        <a class="card stat" href="#skills">
          <span class="stat-k">${icon("skills")} Skills</span>
          <span class="stat-v">${skills.length}</span>
          <span class="stat-s">${skills.length ? `Nivel medio ${prom.toFixed(1)}/10` : "Sin skills aún"}</span>
        </a>
        <a class="card stat" href="#fitness">
          <span class="stat-k">${icon("fitness")} Fitness</span>
          <span class="stat-v">${sesiones}</span>
          <span class="stat-s">sesiones en 30 días</span>
        </a>
      </section>
      <section class="card">
        <h2>Últimos registros</h2>
        ${listaRegistros(recientes, { mostrarCat: true })}
      </section>`;
  },

  apartamento() {
    const a = datosApto();
    let acc = 0;
    const serie = a.pagos.map((r) => ({ x: r.fecha, y: (acc += Number(r.valor) || 0) }));
    const prom = a.pagos.length ? a.pagado / a.pagos.length : 0;
    const restante = Math.max(0, a.total - a.pagado);
    const meses = prom > 0 ? Math.ceil(restante / prom) : null;
    return `
      <section class="card hero">
        ${ring(a.pct)}
        <dl class="kv">
          <div><dt>Pagado</dt><dd>${dinero(a.pagado)}</dd></div>
          <div><dt>Restante</dt><dd>${dinero(restante)}</dd></div>
          <div><dt>Precio total</dt><dd>${a.total ? dinero(a.total) : "—"} <button class="link" id="editar-total">Editar</button></dd></div>
          <div><dt>Pagos</dt><dd>${a.pagos.length}${meses != null && restante > 0 ? ` · ~${meses} más al ritmo actual` : ""}</dd></div>
        </dl>
      </section>
      <section class="card"><h2>Acumulado pagado</h2>${lineChart(serie, { escalon: true, formato: dinero })}</section>
      <section class="card"><h2>Pagos</h2>${listaRegistros([...a.pagos].reverse(), { formato: (r) => dinero(r.valor) })}</section>`;
  },

  trabajo() {
    const rows = deCat("trabajo");
    const sal = rows.filter((r) => r.valor != null).map((r) => ({ x: r.fecha, y: Number(r.valor) }));
    const timeline = [...rows].reverse();
    return `
      <section class="card"><h2>Evolución salarial</h2>${lineChart(sal, { escalon: true, formato: dinero })}</section>
      <section class="card">
        <h2>Línea de tiempo</h2>
        ${timeline.length ? `<ol class="timeline">${timeline
          .map((r) => `<li><span class="tl-date">${fFecha(r.fecha)}</span><strong>${esc(r.titulo)}</strong>${r.nota ? `<small>${esc(r.nota)}</small>` : ""}${r.valor != null ? `<small>${dinero(r.valor)}</small>` : ""}<button class="borrar" data-borrar="${r.id}" aria-label="Borrar">×</button></li>`)
          .join("")}</ol>` : `<p class="vacio">Añade tu primer puesto, ascenso o logro.</p>`}
      </section>`;
  },

  skills() {
    const s = ultimoPorTitulo(deCat("skills")).sort((a, b) => b.ult.valor - a.ult.valor);
    if (!s.length) return `<section class="card"><p class="vacio">Registra una skill con su nivel del 1 al 10 para ver su evolución.</p></section>`;
    return `<section class="card"><h2>Nivel actual</h2><ul class="skills">${s
      .map(({ titulo, rs, ult, prim }) => {
        const delta = ult.valor - prim.valor;
        return `<li>
          <details>
            <summary>
              <span class="sk-name">${esc(titulo)}</span>
              ${sparkline(rs.map((r) => Number(r.valor)))}
              <span class="sk-lvl">${fNum(ult.valor, 1)}<small>/10</small></span>
              <div class="bar"><i style="width:${Math.min(100, ult.valor * 10)}%"></i></div>
              <small class="sk-delta">${delta > 0 ? "+" : ""}${fNum(delta, 1)} desde ${fFecha(prim.fecha)}</small>
            </summary>
            ${lineChart(rs.map((r) => ({ x: r.fecha, y: Number(r.valor) })), { alto: 140, formato: (v) => v + "/10" })}
            ${listaRegistros([...rs].reverse())}
          </details>
        </li>`;
      })
      .join("")}</ul></section>`;
  },

  fitness() {
    const g = agrupar(deCat("fitness"), "titulo");
    const ejercicios = Object.keys(g).sort();
    if (!ejercicios.length) return `<section class="card"><p class="vacio">Registra tu primer ejercicio con el botón +.</p></section>`;
    if (!g[estado.gymSel]) estado.gymSel = ejercicios[0];
    // Si un ejercicio tiene registros en varias unidades, se muestra la del más reciente.
    const unidad = g[estado.gymSel].at(-1).unidad ?? "kg";
    const rs = g[estado.gymSel].filter((r) => (r.unidad ?? "kg") === unidad);
    const vals = rs.map((r) => Number(r.valor));
    const fmt = (v) => fMedida(v, unidad);
    return `
      <div class="chips" role="tablist">${ejercicios
        .map((e) => `<button role="tab" class="chip ${e === estado.gymSel ? "on" : ""}" data-gym="${esc(e)}" aria-selected="${e === estado.gymSel}">${esc(e)}</button>`)
        .join("")}</div>
      <section class="grid three">
        <div class="card stat"><span class="stat-k">Último</span><span class="stat-v">${esc(fmt(vals.at(-1)))}</span></div>
        <div class="card stat"><span class="stat-k">${esTiempo(unidad) ? "Más largo" : "Récord"}</span><span class="stat-v">${esc(fmt(Math.max(...vals)))}</span></div>
        <div class="card stat"><span class="stat-k">Progreso</span><span class="stat-v">${esc(fDelta(vals.at(-1) - vals[0], unidad))}</span></div>
      </section>
      <section class="card"><h2>${esc(estado.gymSel)} <small>· ${esTiempo(unidad) ? "Tiempo" : "Peso"}</small></h2>${lineChart(rs.map((r) => ({ x: r.fecha, y: Number(r.valor) })), { formato: fmt })}</section>
      <section class="card"><h2>Sesiones</h2>${listaRegistros([...rs].reverse())}</section>`;
  },

  documentos() {
    setTimeout(cargarDocs);
    return `
      <div class="chips" role="tablist">${SECCIONES_DOCS.map(
        (s) => `<button role="tab" class="chip ${s === estado.docSec ? "on" : ""}" data-doc="${esc(s)}" aria-selected="${s === estado.docSec}">${esc(s)}</button>`,
      ).join("")}</div>
      <section class="card">
        <div class="row-between">
          <h2>${esc(estado.docSec)}</h2>
          <label class="btn">Subir archivo<input type="file" id="subir" multiple hidden></label>
        </div>
        ${db.MODO === "demo" ? `<p class="aviso">Modo demo: los archivos solo viven en esta pestaña. Conecta Supabase para guardarlos de forma privada.</p>` : ""}
        <div id="docs"><p class="vacio">Cargando…</p></div>
      </section>`;
  },
};

async function cargarDocs() {
  const cont = $("#docs");
  if (!cont) return;
  try {
    const docs = await db.listarDocs(estado.docSec);
    cont.innerHTML = docs.length
      ? `<ul class="lista">${docs
          .map((d) => `<li>
            <div class="li-main"><strong>${esc(d.name)}</strong><small>${fBytes(d.size)}${d.created_at ? " · " + new Date(d.created_at).toLocaleDateString("es") : ""}</small></div>
            <button class="btn ghost" data-abrir="${esc(d.name)}">Abrir</button>
            <button class="borrar" data-borrar-doc="${esc(d.name)}" aria-label="Borrar archivo">×</button>
          </li>`)
          .join("")}</ul>`
      : `<p class="vacio">No hay archivos en esta sección.</p>`;
  } catch (e) {
    cont.innerHTML = `<p class="vacio">No se pudieron cargar: ${esc(e.message)}</p>`;
  }
}

// ---------- Formulario de registro ----------
function abrirFormulario() {
  const v = vistaActual();
  const cat = CATS[v] ? v : "fitness";
  const dlg = $("#dlg");
  dlg.innerHTML = `<form method="dialog" id="form-reg">
    <h2>Nuevo registro</h2>
    <label>Categoría<select name="categoria">${Object.entries(CATS)
      .map(([k, c]) => `<option value="${k}" ${k === cat ? "selected" : ""}>${c.nombre}</option>`)
      .join("")}</select></label>
    <div id="campos"></div>
    <div class="acciones">
      <button type="button" class="btn ghost" id="cancelar">Cancelar</button>
      <button type="submit" class="btn" value="ok">Guardar</button>
    </div>
  </form>`;
  const pintarCampos = () => {
    const k = $("[name=categoria]", dlg).value;
    const c = CATS[k];
    const previos = [...new Set(deCat(k).map((r) => r.titulo))];
    const sel = k === "fitness" && estado.gymSel ? estado.gymSel : c.tituloDef ?? "";
    $("#campos", dlg).innerHTML = `
      <label>${c.titulo}<input name="titulo" list="dl-titulos" required value="${esc(sel)}" autocomplete="off"></label>
      <datalist id="dl-titulos">${previos.map((p) => `<option value="${esc(p)}">`).join("")}</datalist>
      ${c.medida ? `
      <div class="dos">
        <label>Unidad<select name="medida"><option value="kg">Peso</option><option value="tiempo">Tiempo</option></select></label>
        <label>Fecha<input name="fecha" type="date" required value="${hoy()}"></label>
      </div>
      <div id="campo-valor"></div>` : `
      <div class="dos">
        <label>${c.valor}<input name="valor" type="number" inputmode="decimal" step="any" ${k === "trabajo" ? "" : "required"} ${k === "skills" ? 'min="0" max="10"' : ""}></label>
        <label>Fecha<input name="fecha" type="date" required value="${hoy()}"></label>
      </div>`}
      ${c.series ? `<div class="dos"><label>Series<input name="series" type="number" inputmode="numeric" min="0"></label><label>Repeticiones<input name="reps" type="number" inputmode="numeric" min="0"></label></div>` : ""}
      <label>${c.nota ?? "Nota (opcional)"}<input name="nota"></label>`;
  };
  // Fitness: el campo de valor cambia según la unidad elegida.
  const pintarValor = () => {
    const cont = $("#campo-valor", dlg);
    if (!cont) return;
    cont.innerHTML = $("[name=medida]", dlg).value === "tiempo"
      ? `<fieldset class="tiempo"><legend>Tiempo (hh:mm:ss)</legend>
          <input name="hh" type="number" inputmode="numeric" min="0" max="99" placeholder="hh" aria-label="Horas">
          <span>:</span><input name="mm" type="number" inputmode="numeric" min="0" max="59" placeholder="mm" aria-label="Minutos">
          <span>:</span><input name="ss" type="number" inputmode="numeric" min="0" max="59" placeholder="ss" aria-label="Segundos">
        </fieldset>`
      : `<label>Peso (kg)<input name="valor" type="number" inputmode="decimal" step="any" min="0" placeholder="0,0" required></label>`;
  };
  // Al elegir un ejercicio ya usado, propone la unidad con la que se registró.
  const unidadPorEjercicio = () => {
    const sel = $("[name=medida]", dlg);
    if (!sel) return;
    const t = $("[name=titulo]", dlg).value.trim().toLowerCase();
    const prev = deCat("fitness").filter((r) => r.titulo.toLowerCase() === t).at(-1);
    const nueva = prev?.unidad === "tiempo" ? "tiempo" : "kg";
    // Solo se redibuja si cambia la unidad, para no borrar lo ya escrito ni quitar el foco.
    if (sel.value !== nueva || !$("#campo-valor", dlg).innerHTML) {
      sel.value = nueva;
      pintarValor();
    }
  };
  const pintarTodo = () => {
    pintarCampos();
    if ($("[name=medida]", dlg)) {
      $("[name=medida]", dlg).addEventListener("change", pintarValor);
      $("[name=titulo]", dlg).addEventListener("change", unidadPorEjercicio);
      unidadPorEjercicio();
    }
  };
  pintarTodo();
  $("[name=categoria]", dlg).addEventListener("change", pintarTodo);
  $("#cancelar", dlg).addEventListener("click", () => dlg.close());
  $("#form-reg", dlg).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const extra = {};
    if (f.series) extra.series = Number(f.series);
    if (f.reps) extra.reps = Number(f.reps);
    let valor = f.valor === undefined || f.valor === "" ? null : Number(f.valor);
    let unidad = CATS[f.categoria].unidad || null;
    if (CATS[f.categoria].medida) {
      unidad = f.medida;
      if (unidad === "tiempo") {
        valor = (Number(f.hh) || 0) * 3600 + (Number(f.mm) || 0) * 60 + (Number(f.ss) || 0);
        if (!valor) return toast("Escribe un tiempo mayor que 0", true);
      } else {
        valor = Math.round(valor * 10) / 10;
      }
    }
    const fila = {
      categoria: f.categoria,
      titulo: f.titulo.trim(),
      valor,
      unidad,
      nota: f.nota?.trim() || null,
      fecha: f.fecha,
      extra,
    };
    try {
      await db.agregarRegistro(fila);
      if (fila.categoria === "fitness") estado.gymSel = fila.titulo;
      dlg.close();
      await recargar();
      toast("Guardado ✓");
    } catch (err) {
      toast("Error: " + err.message, true);
    }
  });
  dlg.showModal();
}

// ---------- Eventos globales ----------
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-gym], [data-doc]");
  if (!t) return;
  if (t.id === "fab") return abrirFormulario();
  if (t.id === "salir") {
    await db.salir();
    return iniciar();
  }
  if (t.id === "editar-total") {
    const actual = estado.ajustes.apartamento_total ?? "";
    const v = prompt("Precio total del apartamento (solo números):", actual);
    if (v === null) return;
    const n = Number(String(v).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return toast("Número no válido", true);
    await db.guardarAjuste("apartamento_total", n);
    estado.ajustes.apartamento_total = n;
    return render();
  }
  if (t.dataset.borrar) {
    if (!confirm("¿Borrar este registro?")) return;
    await db.borrarRegistro(Number(t.dataset.borrar));
    await recargar();
    return toast("Borrado");
  }
  if (t.dataset.gym) {
    estado.gymSel = t.dataset.gym;
    return render();
  }
  if (t.dataset.doc) {
    estado.docSec = t.dataset.doc;
    return render();
  }
  if (t.dataset.abrir) {
    try {
      const url = await db.urlDoc(estado.docSec, t.dataset.abrir);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast("No se pudo abrir: " + err.message, true);
    }
    return;
  }
  if (t.dataset.borrarDoc) {
    if (!confirm(`¿Borrar "${t.dataset.borrarDoc}"?`)) return;
    await db.borrarDoc(estado.docSec, t.dataset.borrarDoc);
    return cargarDocs();
  }
});

document.addEventListener("change", async (e) => {
  if (e.target.id !== "subir") return;
  const files = [...e.target.files];
  if (!files.length) return;
  toast(`Subiendo ${files.length} archivo(s)…`);
  try {
    for (const f of files) await db.subirDoc(estado.docSec, f);
    toast("Subido ✓");
  } catch (err) {
    toast("Error al subir: " + err.message, true);
  }
  cargarDocs();
});

window.addEventListener("hashchange", render);

// ---------- Arranque ----------
async function recargar() {
  [estado.registros, estado.ajustes] = await Promise.all([db.listarRegistros(), db.leerAjustes()]);
  // Registros antiguos de "gimnasio" se muestran dentro de Fitness.
  estado.registros.forEach((r) => {
    if (r.categoria === "gimnasio") r.categoria = "fitness";
    if (r.categoria === "fitness" && (!r.unidad || r.unidad === "peso")) r.unidad = "kg";
  });
  render();
}

function pantallaLogin() {
  $("#app").hidden = true;
  const l = $("#login");
  l.hidden = false;
  l.innerHTML = `<form class="card login" id="form-login">
    <div class="logo">${icon("skills")}</div>
    <h1>Segundo Cerebro</h1>
    <p>Inicia sesión para ver tus datos.</p>
    <label>Correo<input name="email" type="email" autocomplete="username" required></label>
    <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn" type="submit">Entrar</button>
    <p class="error" id="login-error" role="alert"></p>
  </form>`;
  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      await db.entrar(f.email, f.password);
      iniciar();
    } catch (err) {
      $("#login-error").textContent = err.message;
    }
  });
}

async function iniciar() {
  const s = await db.sesion();
  if (!s) return pantallaLogin();
  $("#login").hidden = true;
  $("#app").hidden = false;
  $("#modo").textContent = db.MODO === "demo" ? "Demo" : s.user.email;
  $("#modo").classList.toggle("demo", db.MODO === "demo");
  $("#salir").hidden = db.MODO === "demo";
  try {
    await recargar();
  } catch (err) {
    $("#main").innerHTML = `<section class="card"><p class="vacio">No se pudieron cargar los datos: ${esc(err.message)}</p></section>`;
  }
}

iniciar();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
