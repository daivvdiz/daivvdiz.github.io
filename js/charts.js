// Gráficas SVG ligeras, sin librerías.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// puntos: [{x: Date|string, y: number}] ordenados por x
export function lineChart(puntos, { alto = 180, formato = (v) => v, escalon = false } = {}) {
  if (!puntos.length) return `<div class="chart-empty">Aún no hay datos</div>`;
  // En gráficas escalonadas (acumulados, salario) el último valor sigue vigente hoy.
  const hoy = new Date().toISOString().slice(0, 10);
  if (escalon && puntos.at(-1).x < hoy) puntos = [...puntos, { x: hoy, y: puntos.at(-1).y, extendido: true }];
  const W = 600, H = alto, pl = 0, pr = 0, pt = 28, pb = 4;
  const xs = puntos.map((p) => new Date(p.x).getTime());
  const ys = puntos.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 864e5; x1 += 864e5; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.12;
  y0 = y0 >= 0 ? Math.max(0, y0 - pad) : y0 - pad;
  y1 += pad;
  const sx = (t) => pl + ((t - x0) / (x1 - x0)) * (W - pl - pr);
  const sy = (v) => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);

  let d = "";
  puntos.forEach((p, i) => {
    const X = sx(xs[i]), Y = sy(p.y);
    if (i === 0) d += `M${X},${Y}`;
    else if (escalon) d += `H${X}V${Y}`;
    else d += `L${X},${Y}`;
  });
  const area = `${d}V${H - pb}H${sx(xs[0])}Z`;
  const fmtFecha = (t) => new Date(t).toLocaleDateString("es", { month: "short", year: "2-digit" });

  const ultReal = [...puntos].reverse().find((p) => !p.extendido);
  const iu = puntos.lastIndexOf(ultReal);
  const lx = (sx(xs[iu]) / W) * 100, ly = (sy(ultReal.y) / H) * 100;

  return `<figure class="chart-wrap">
    <div class="chart-box" style="height:${H}px">
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Gráfica de evolución, último valor ${esc(formato(ultReal.y))}">
        <line class="grid" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>
        <line class="grid dashed" x1="${pl}" x2="${W - pr}" y1="${sy((y0 + y1) / 2)}" y2="${sy((y0 + y1) / 2)}"/>
        <path class="area" d="${area}"/>
        <path class="line" d="${d}"/>
      </svg>
      <span class="chart-dot" style="left:${lx}%;top:${ly}%" title="${esc(formato(ultReal.y))}"></span>
      <span class="chart-tag" style="top:${ly}%;${lx > 70 ? `right:${100 - lx}%` : `left:${lx}%`}">${esc(formato(ultReal.y))}</span>
    </div>
    <figcaption class="chart-axis"><span>${esc(fmtFecha(x0))}</span><span>${esc(fmtFecha(x1))}</span></figcaption>
  </figure>`;
}


export function sparkline(valores, { ancho = 90, alto = 28 } = {}) {
  if (valores.length < 2) return "";
  const min = Math.min(...valores), max = Math.max(...valores);
  const r = max - min || 1;
  const pts = valores
    .map((v, i) => `${(i / (valores.length - 1)) * (ancho - 4) + 2},${alto - 2 - ((v - min) / r) * (alto - 4)}`)
    .join(" ");
  return `<svg class="spark" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

export function ring(pct, { size = 140 } = {}) {
  const r = 52, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${v.toFixed(1)}% pagado">
    <circle class="ring-bg" cx="60" cy="60" r="${r}"/>
    <circle class="ring-fg" cx="60" cy="60" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="58" text-anchor="middle" class="ring-num">${v.toFixed(1)}%</text>
    <text x="60" y="76" text-anchor="middle" class="ring-lbl">pagado</text>
  </svg>`;
}
