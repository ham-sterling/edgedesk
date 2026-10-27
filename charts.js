/* ============================================================
   CHARTS — dependency-free SVG, sized to container, hover layer
   ============================================================ */
const chartSpecs = new Map(); let chartSeq = 0, chartRO = null;
function chartBox(spec, height = 240) { const id = 'c' + (++chartSeq), h = Math.round((spec.height || height) * .88), u0 = ui.unit;
  // formatters run later (drawing, tooltips) — pin them to the unit the chart was built with
  const pinned = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, typeof v === 'function' ? (...a) => { const s = ui.unit; ui.unit = u0; try { return v(...a); } finally { ui.unit = s; } } : v]));
  chartSpecs.set(id, { ...pinned, unit: spec.unit ?? u0, height: h }); return `<div class="chart" data-chart="${id}" style="height:${h}px"></div>`; }
function niceTicks(min, max, count = 5) {
  if (!finite(min) || !finite(max)) return [0]; if (min === max) { const p = Math.abs(min) || 1; min -= p * .5; max += p * .5; }
  const span = max - min, step0 = span / Math.max(1, count), mag = 10 ** Math.floor(Math.log10(step0)), n = step0 / mag;
  const step = (n >= 7.5 ? 10 : n >= 3.5 ? 5 : n >= 1.5 ? 2 : 1) * mag;
  const out = []; for (let v = Math.floor(min / step) * step; v <= max + step * .001; v += step) out.push(+v.toFixed(10));
  if (out[out.length - 1] < max - EPS) out.push(out[out.length - 1] + step);
  return out;
}
function axisFmt(u) { return v => { if (u === 'P&L') return (v < 0 ? '−' : '') + currencySymbol(baseCurrency()) + compact(Math.abs(v)); if (u === 'R') return fmt(v, Math.abs(v) < 10 ? 1 : 0) + 'R'; if (u === '%') return fmt(v, 1) + '%'; if (u === 'count') return fmt(v, 0); if (u === 'pct') return fmt(v, 0) + '%'; return compact(v); }; }
function xLabel(x) { if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) return fmtDate(x, { year: false }); if (typeof x === 'string' && /^\d{4}-\d{2}$/.test(x)) return monthName(+x.slice(5) - 1) + ' ' + x.slice(2, 4); return String(x); }
function mountCharts(root = document) {
  chartRO ??= new ResizeObserver(entries => { for (const e of entries) { const el = e.target; const w = Math.round(e.contentRect.width); if (w && Math.abs(w - (el._w || 0)) > 2) drawChart(el); } });
  $$('[data-chart]', root).forEach(el => { if (!el._mounted) { el._mounted = true; chartRO.observe(el); } drawChart(el); });
}
function drawChart(el) {
  const spec = chartSpecs.get(el.dataset.chart); if (!spec) return;
  const W = Math.max(120, el.clientWidth), H = spec.height; el._w = W;
  try { const fn = { line: drawLine, bar: drawBar, hbar: drawHBar, scatter: drawScatter, band: drawBand, heat: drawHeatStrip }[spec.type]; el.innerHTML = fn ? fn(spec, W, H, el) : ''; }
  catch (e) { console.error(e); el.innerHTML = `<div class="chart-empty">${L('แสดงกราฟไม่ได้', 'Chart unavailable')}</div>`; }
}
function emptyChart(msg) { return `<div class="chart-empty">${icon('chart')}<span>${esc(msg || L('ยังไม่มีข้อมูลเพียงพอ', 'Not enough data yet'))}</span></div>`; }
function yScaleFor(vals, H, top, bottom, zero = true) {
  let lo = Math.min(...vals), hi = Math.max(...vals); if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  const ticks = niceTicks(lo, hi, H < 200 ? 3 : 4); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const y = v => top + (hi - v) / ((hi - lo) || 1) * (H - top - bottom); return { y, ticks, lo, hi };
}
function gridSVG(ticks, y, left, right, W, f) { return ticks.map(t => `<line class="grid${Math.abs(t) < EPS ? ' zero' : ''}" x1="${left}" x2="${W - right}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="ylab" x="${left - 8}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end">${esc(f(t))}</text>`).join(''); }
function leftPad(ticks, f) { return clamp(Math.max(...ticks.map(t => f(t).length)) * 6.6 + 14, 34, 86); }
function xTicksSVG(xs, X, H, bottom, maxTicks) {
  if (!xs.length) return ''; const n = Math.min(maxTicks, xs.length), idx = n <= 1 ? [0] : [...new Set(Array.from({ length: n }, (_, i) => Math.round(i * (xs.length - 1) / (n - 1))))];
  return idx.map((i, k) => `<text class="xlab" x="${X(i).toFixed(1)}" y="${H - bottom + 17}" text-anchor="${n > 1 && k === 0 ? 'start' : n > 1 && k === idx.length - 1 ? 'end' : 'middle'}">${esc(xLabel(xs[i]))}</text>`).join('');
}
/* line / area */
function drawLine(spec, W, H, el) {
  const series = spec.series.filter(s => s.data?.length); if (!series.length) return emptyChart(spec.empty);
  if (series.length > 1) { let rows = 1, x = 0; for (const sr of series) { const w = String(sr.name).length * 7 + 30; if (x + w > W && x > 0) { rows++; x = 0; } x += w; } H = Math.max(140, H - rows * 24); } // keep the legend inside the box
  const f = axisFmt(spec.unit), all = series.flatMap(s => s.data.map(p => p.y)).filter(finite);
  const top = 12, bottom = 26, { y, ticks } = yScaleFor(all, H, top, bottom, spec.zero !== false), left = leftPad(ticks, f), right = 12;
  const n = Math.max(...series.map(s => s.data.length)), X = i => left + (n === 1 ? (W - left - right) / 2 : i / (n - 1) * (W - left - right));
  let svg = gridSVG(ticks, y, left, right, W, f);
  const z = clamp(y(0), top, H - bottom), gid = 'g' + el.dataset.chart;
  series.forEach((s, si) => {
    const pts = s.data.map((p, i) => [X(i), y(p.y)]), d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
    const col = s.color || 'var(--accent)';
    if (s.area || spec.signed) {
      const area = d + `L${pts[pts.length - 1][0].toFixed(1)},${z.toFixed(1)}L${pts[0][0].toFixed(1)},${z.toFixed(1)}Z`;
      if (spec.signed) {
        svg += `<defs><clipPath id="${gid}a${si}"><rect x="0" y="0" width="${W}" height="${z}"/></clipPath><clipPath id="${gid}b${si}"><rect x="0" y="${z}" width="${W}" height="${H}"/></clipPath><linearGradient id="${gid}p" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--pos)" stop-opacity=".28"/><stop offset="1" stop-color="var(--pos)" stop-opacity="0"/></linearGradient><linearGradient id="${gid}n" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="var(--neg)" stop-opacity=".28"/><stop offset="1" stop-color="var(--neg)" stop-opacity="0"/></linearGradient></defs>`;
        svg += `<path d="${area}" fill="url(#${gid}p)" clip-path="url(#${gid}a${si})"/><path d="${area}" fill="url(#${gid}n)" clip-path="url(#${gid}b${si})"/>`;
        svg += `<path d="${d}" class="ln" stroke="var(--pos)" clip-path="url(#${gid}a${si})"/><path d="${d}" class="ln" stroke="var(--neg)" clip-path="url(#${gid}b${si})"/>`;
      } else {
        svg += `<defs><linearGradient id="${gid}f${si}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="${s.fillOpacity ?? .22}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#${gid}f${si})"/><path d="${d}" class="ln" stroke="${col}"/>`;
      }
    } else svg += `<path d="${d}" class="ln${s.dash ? ' dash' : ''}" stroke="${col}" ${s.width ? `stroke-width="${s.width}"` : ''}/>`;
    if (s.endDot !== false && pts.length) { const p = pts[pts.length - 1]; svg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" class="enddot" fill="${spec.signed ? (s.data[s.data.length - 1].y >= 0 ? 'var(--pos)' : 'var(--neg)') : col}"/>`; }
  });
  svg += xTicksSVG(series[0].data.map(p => p.x), X, H, bottom, Math.max(2, Math.floor((W - left) / 90)));
  svg += `<line class="xhair" x1="0" x2="0" y1="${top}" y2="${H - bottom}" style="display:none"/>` + series.map((s, i) => `<circle class="hdot" data-s="${i}" r="4.5" style="display:none" fill="${s.color || 'var(--accent)'}"/>`).join('');
  el._layout = { kind: 'line', X, y, n, left, right, W, series, f: spec.tipFmt || (v => unitFmt(v, spec.unit === 'count' ? 'x' : spec.unit)), top, bottom, H };
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `${legend}<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(spec.label || L('กราฟ', 'Chart'))}">${svg}</svg>`;
}
/* vertical bars */
function drawBar(spec, W, H, el) {
  const data = spec.data || []; if (!data.length) return emptyChart(spec.empty);
  const f = axisFmt(spec.unit), top = 12, bottom = 26, { y, ticks } = yScaleFor(data.map(d => d.y), H, top, bottom, true), left = leftPad(ticks, f), right = 10;
  const bw = (W - left - right) / data.length, barW = clamp(bw * (spec.thin ? .5 : .68), 1.5, 36), X = i => left + (i + .5) * bw, z = y(0);
  let svg = gridSVG(ticks, y, left, right, W, f);
  data.forEach((d, i) => {
    const yy = y(d.y), h = Math.max(1, Math.abs(z - yy)), col = d.color || (spec.signed !== false ? (d.y >= 0 ? 'var(--pos)' : 'var(--neg)') : (spec.color || 'var(--accent)'));
    const r = Math.min(3, barW / 2, h), x0 = X(i) - barW / 2, up = d.y >= 0;
    // rounded data-end, square baseline
    const p = up ? `M${x0},${z}V${yy + r}Q${x0},${yy} ${x0 + r},${yy}H${x0 + barW - r}Q${x0 + barW},${yy} ${x0 + barW},${yy + r}V${z}Z` : `M${x0},${z}V${yy - r}Q${x0},${yy} ${x0 + r},${yy}H${x0 + barW - r}Q${x0 + barW},${yy} ${x0 + barW},${yy - r}V${z}Z`;
    svg += `<path d="${p}" fill="${col}" class="bar" data-i="${i}"/>`;
    if (spec.valueLabels && data.length <= 16 && Math.abs(d.y) > EPS) { const inside = !up && yy + 15 > H - bottom && h > 18; svg += `<text class="vlab${inside ? ' in' : ''}" x="${X(i)}" y="${up ? yy - 5 : inside ? yy - 5 : yy + 13}" text-anchor="middle">${esc(spec.valueFmt ? spec.valueFmt(d.y) : fmt(d.y, 0))}</text>`; }
  });
  if (spec.categorical) { const maxL = Math.floor(bw / 6.2); data.forEach((d, i) => { const t = String(d.label ?? xLabel(d.x)); svg += `<text class="xlab" x="${X(i)}" y="${H - bottom + 17}" text-anchor="middle">${esc(t.length > maxL && maxL > 3 ? t.slice(0, maxL - 1) + '…' : (maxL <= 3 && bw < 22 && i % 2 ? '' : t))}</text>`; }); }
  else svg += xTicksSVG(data.map(d => d.x), X, H, bottom, Math.max(2, Math.floor((W - left) / 90)));
  svg += `<rect class="hband" x="0" y="${top}" width="${bw}" height="${H - top - bottom}" style="display:none"/>`;
  el._layout = { kind: 'bar', X, bw, left, data, f: spec.tipFmt || (v => unitFmt(v, spec.unit)), top, bottom, H };
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(spec.label || L('กราฟแท่ง', 'Bar chart'))}">${svg}</svg>`;
}
/* horizontal bars (breakdowns) */
function drawHBar(spec, W, H, el) {
  const data = spec.data || []; if (!data.length) return emptyChart(spec.empty);
  const f = spec.valueFmt || axisFmt(spec.unit), labW = clamp(Math.max(...data.map(d => String(d.label).length)) * 6.8 + 14, 60, Math.min(190, W * .38)), valW = clamp(Math.max(...data.map(d => String(f(d.y)).length)) * 7.2 + 14, 48, 120);
  const top = 4, rowH = (H - top - 4) / data.length, barH = clamp(rowH * .62, 6, 22), maxAbs = Math.max(EPS, ...data.map(d => Math.abs(d.y))), hasNeg = data.some(d => d.y < 0);
  const plotL = labW, plotR = W - valW, maxPos = Math.max(0, ...data.map(d => d.y)), maxNeg = Math.max(0, ...data.map(d => -d.y));
  const scale = hasNeg ? (plotR - plotL) / ((maxPos + maxNeg) || 1) : (plotR - plotL) / maxAbs, zx = hasNeg ? plotL + maxNeg * scale : plotL;
  let svg = hasNeg ? `<line class="grid zero" x1="${zx}" x2="${zx}" y1="${top}" y2="${H - 4}"/>` : '';
  data.forEach((d, i) => {
    const cy = top + (i + .5) * rowH, w = Math.max(1.5, Math.abs(d.y) * scale), x = d.y >= 0 ? zx : zx - w, col = d.color || (spec.signed !== false ? (d.y >= 0 ? 'var(--pos)' : 'var(--neg)') : 'var(--accent)');
    const lbl = String(d.label), maxc = Math.floor((labW - 12) / 6.6);
    svg += `<text class="hlab" x="${spec.labelAlign === 'left' ? 2 : labW - 10}" y="${cy + 4}" text-anchor="${spec.labelAlign === 'left' ? 'start' : 'end'}">${esc(lbl.length > maxc ? lbl.slice(0, maxc - 1) + '…' : lbl)}</text><rect class="bar" data-i="${i}" x="${x.toFixed(1)}" y="${(cy - barH / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${barH.toFixed(1)}" rx="3" fill="${col}"/><text class="hval ${tone(d.y)}" x="${W - 4}" y="${cy + 4}" text-anchor="end">${esc(f(d.y))}</text>`;
  });
  el._layout = { kind: 'hbar', rowH, top, data, f: spec.tipFmt || f };
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(spec.label || L('กราฟแท่งแนวนอน', 'Breakdown'))}">${svg}</svg>`;
}
/* scatter */
function drawScatter(spec, W, H, el) {
  const lanes = spec.lanes || [], laneH = 13, laneTop = lanes.length ? lanes.length * laneH + 10 : 0;
  const data = (spec.data || []).filter(d => finite(d.x) && finite(d.y) && (!spec.xLog || d.x > 0)); if (!data.length) return emptyChart(spec.empty);
  const f = axisFmt(spec.unit), top = 12 + laneTop, bottom = 26, { y, ticks } = yScaleFor(data.map(d => d.y), H, top, bottom, true), left = Math.max(leftPad(ticks, f), lanes.length ? 54 : 0), right = 12;
  const xlo = spec.xMin ?? Math.min(...data.map(d => d.x)), xhi = spec.xMax ?? Math.max(...data.map(d => d.x));
  const tr = v => spec.xLog ? Math.log(Math.max(v, 1e-9)) : v, X = v => left + (tr(v) - tr(xlo)) / ((tr(xhi) - tr(xlo)) || 1) * (W - left - right);
  let svg = '';
  /* session-clock style lanes: a labelled track per session above the plot, plus a faint column inside it */
  lanes.forEach((ln, i) => {
    const ly = 6 + i * laneH;
    svg += `<text class="xlab lane-l" x="${left - 6}" y="${ly + 6}" text-anchor="end">${esc(ln.label)}</text><rect x="${left}" y="${ly}" width="${W - left - right}" height="6" rx="3" fill="var(--track)"/>`;
    for (const [a, b] of ln.segs) { const x0 = X(Math.max(a, xlo)), x1 = X(Math.min(b, xhi)); if (x1 <= x0) continue; svg += `<rect x="${x0.toFixed(1)}" y="${ly}" width="${(x1 - x0).toFixed(1)}" height="6" rx="3" fill="${ln.color}"/><rect x="${x0.toFixed(1)}" y="${top}" width="${(x1 - x0).toFixed(1)}" height="${H - top - bottom}" fill="${ln.color}" opacity=".07"/>`; }
  });
  svg += gridSVG(ticks, y, left, right, W, f);
  const xt = (spec.xTicks || niceTicks(xlo, xhi, Math.max(2, Math.floor((W - left) / 80)))).filter(v => v >= xlo - EPS && v <= xhi + EPS);
  svg += xt.map(v => `<text class="xlab" x="${X(v)}" y="${H - bottom + 17}" text-anchor="middle">${esc(spec.xFmt ? spec.xFmt(v) : fmt(v, 0))}</text>`).join('');
  const r = data.length > 300 ? 3 : 4.5;
  data.forEach((d, i) => { svg += `<circle class="dot" data-i="${i}" cx="${X(d.x).toFixed(1)}" cy="${y(d.y).toFixed(1)}" r="${r}" fill="${d.y >= 0 ? 'var(--pos)' : 'var(--neg)'}"/>`; });
  el._layout = { kind: 'scatter', pts: data.map(d => [X(d.x), y(d.y)]), data, f: v => unitFmt(v, spec.unit), xFmt: spec.xFmt };
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(spec.label || L('กราฟกระจาย', 'Scatter'))}">${svg}</svg>`;
}
/* Monte Carlo percentile bands */
function drawBand(spec, W, H, el) {
  const b = spec.bands; if (!b?.length) return emptyChart(spec.empty);
  const vals = b.flatMap(x => [x.p5, x.p95]), f = axisFmt('P&L'), top = 12, bottom = 26, { y, ticks } = yScaleFor(vals.concat([spec.start]), H, top, bottom, false), left = leftPad(ticks, f), right = 12;
  const X = i => left + i / (b.length - 1) * (W - left - right), path = k => b.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + y(p[k]).toFixed(1)).join('');
  const area = (a, c) => path(a) + b.slice().reverse().map((p, i) => 'L' + X(b.length - 1 - i).toFixed(1) + ',' + y(p[c]).toFixed(1)).join('') + 'Z';
  let svg = gridSVG(ticks, y, left, right, W, f);
  (spec.sample || []).forEach(p => { svg += `<path d="${p.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + y(v).toFixed(1)).join('')}" class="ln thin" stroke="var(--dim)" opacity=".18"/>`; });
  svg += `<path d="${area('p95', 'p5')}" fill="var(--accent)" opacity=".12"/><path d="${area('p75', 'p25')}" fill="var(--accent)" opacity=".2"/><path d="${path('p50')}" class="ln" stroke="var(--accent)"/>`;
  svg += `<line class="grid zero" x1="${left}" x2="${W - right}" y1="${y(spec.start)}" y2="${y(spec.start)}" stroke-dasharray="4 4"/>`;
  svg += [0, Math.round(b.length / 2), b.length - 1].map((i, k) => `<text class="xlab" x="${X(i)}" y="${H - bottom + 17}" text-anchor="${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}">${L('ไม้ที่ ', 'Trade ')}${b[i].x}</text>`).join('');
  svg += `<line class="xhair" x1="0" x2="0" y1="${top}" y2="${H - bottom}" style="display:none"/>`;
  el._layout = { kind: 'band', X, b, n: b.length, left, right, W, top, bottom, H };
  return `<div class="legend"><span><i style="background:var(--accent)"></i>${L('ค่ากลาง (P50)', 'Median')}</span><span><i style="background:var(--accent);opacity:.45"></i>P25–P75</span><span><i style="background:var(--accent);opacity:.2"></i>P5–P95</span></div><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>`;
}
function drawHeatStrip() { return ''; }

/* ---------- hover layer ---------- */
function chartTip(html, x, y) { const t = $('#charttip'); t.classList.remove('gloss'); delete t.dataset.key; if (!html) { t.style.display = 'none'; return; } t.innerHTML = html; t.style.display = 'block'; const r = t.getBoundingClientRect(); let left = x + 14, top = y - r.height - 10; if (left + r.width > innerWidth - 8) left = x - r.width - 14; if (top < 8) top = y + 16; left = Math.max(8, Math.min(left, innerWidth - r.width - 8)); t.style.left = left + 'px'; t.style.top = top + 'px'; }
function onChartMove(e) {
  const el = e.target.closest?.('[data-chart]'); if (!el || !el._layout) { if (document.querySelector('#charttip')?.style.display === 'block' && !e.target.closest?.('[data-tip]')) chartTip(''); return; }
  const Lo = el._layout, svg = el.querySelector('svg'); if (!svg) return; const rect = svg.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
  if (Lo.kind === 'line' || Lo.kind === 'band') {
    const i = clamp(Math.round((mx - Lo.left) / ((Lo.W - Lo.left - Lo.right) || 1) * (Lo.n - 1)), 0, Lo.n - 1), x = Lo.X(i);
    const xh = svg.querySelector('.xhair'); xh.style.display = ''; xh.setAttribute('x1', x); xh.setAttribute('x2', x);
    if (Lo.kind === 'band') { const p = Lo.b[i]; chartTip(`<b>${L('ไม้ที่', 'Trade')} ${p.x}</b><div>P95 <strong>${money(p.p95)}</strong></div><div>P50 <strong>${money(p.p50)}</strong></div><div>P5 <strong>${money(p.p5)}</strong></div>`, e.clientX, e.clientY); return; }
    let head = '', rowsH = '';
    Lo.series.forEach((s, si) => { const p = s.data[i], dot = svg.querySelector(`.hdot[data-s="${si}"]`); if (!p) { dot.style.display = 'none'; return; } dot.style.display = ''; dot.setAttribute('cx', x); dot.setAttribute('cy', Lo.y(p.y)); head ||= p.tip || xLabel(p.x) + (/^\d{4}-\d{2}-\d{2}$/.test(p.x) ? ' ' + String(p.x).slice(0, 4) : ''); rowsH += `<div>${Lo.series.length > 1 ? `<i style="background:${s.color}"></i>${esc(s.name)} ` : ''}<strong class="${tone(p.y)}">${esc(Lo.f(p.y))}</strong>${p.label ? ` <span class="dim">· ${esc(p.label)}</span>` : ''}</div>`; });
    chartTip(`<b>${esc(head)}</b>${rowsH}`, e.clientX, e.clientY);
  } else if (Lo.kind === 'bar') {
    const i = Math.floor((mx - Lo.left) / Lo.bw); const d = Lo.data[i]; const hb = svg.querySelector('.hband');
    if (!d) { hb.style.display = 'none'; chartTip(''); return; } hb.style.display = ''; hb.setAttribute('x', Lo.left + i * Lo.bw);
    chartTip(`<b>${esc(d.tip || d.label || xLabel(d.x))}</b><div><strong class="${tone(d.y)}">${esc(Lo.f(d.y))}</strong>${d.sub ? ` <span class="dim">· ${esc(d.sub)}</span>` : ''}</div>`, e.clientX, e.clientY);
  } else if (Lo.kind === 'hbar') {
    const i = Math.floor((my - Lo.top) / Lo.rowH), d = Lo.data[i]; if (!d) { chartTip(''); return; }
    chartTip(`<b>${esc(d.label)}</b><div><strong class="${tone(d.y)}">${esc(Lo.f(d.y))}</strong></div>${d.sub ? `<div class="dim">${esc(d.sub)}</div>` : ''}`, e.clientX, e.clientY);
  } else if (Lo.kind === 'scatter') {
    let best = -1, bd = 196; Lo.pts.forEach((p, i) => { const dd = (p[0] - mx) ** 2 + (p[1] - my) ** 2; if (dd < bd) { bd = dd; best = i; } });
    if (best < 0) { chartTip(''); return; } const d = Lo.data[best];
    chartTip(`<b>${esc(d.label || '')}</b><div>${esc(d.xTip || (Lo.xFmt ? Lo.xFmt(d.x) : fmt(d.x)))} · <strong class="${tone(d.y)}">${esc(Lo.f(d.y))}</strong></div>${d.sub ? `<div class="dim">${esc(d.sub)}</div>` : ''}`, e.clientX, e.clientY);
  }
}
function onChartLeave(e) { const el = e.target.closest?.('[data-chart]'); if (!el) return; el.querySelectorAll('.xhair,.hdot,.hband').forEach(x => x.style.display = 'none'); chartTip(''); }

/* ---------- static mini visuals ---------- */
function sparkline(vals, w = 120, h = 40, signed = true) {
  const v = vals.filter(finite); if (v.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
  const lo = Math.min(...v, 0), hi = Math.max(...v, 0), X = i => 2 + i / (v.length - 1) * (w - 4), Y = x => 3 + (hi - x) / ((hi - lo) || 1) * (h - 6);
  const d = v.map((x, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(x).toFixed(1)).join(''), col = signed ? (v[v.length - 1] >= 0 ? 'var(--pos)' : 'var(--neg)') : 'var(--accent)';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}L${X(v.length - 1)},${Y(0)}L2,${Y(0)}Z" fill="${col}" opacity=".12"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
function arcGauge(pct, cls = 'accent', w = 104) {
  const p = clamp(finite(pct) ? pct : 0, 0, 100);
  return `<svg class="gauge" viewBox="0 0 104 58" width="${w}" aria-hidden="true"><path d="M8 52A44 44 0 0 1 96 52" pathLength="100" class="g-track"/><path d="M8 52A44 44 0 0 1 96 52" pathLength="100" class="g-val ${cls}" style="stroke-dasharray:${p} 100"/></svg>`;
}
function wlGauge(w, b, l) {
  const t = w + b + l; if (!t) return arcGauge(0, 'muted');
  const seg = (cls, s, len) => len > 0 ? `<path d="M8 52A44 44 0 0 1 96 52" pathLength="100" class="g-val ${cls}" style="stroke-dasharray:${Math.max(0, len - 1)} 100;stroke-dashoffset:${-s}"/>` : '';
  const wp = w / t * 100, bp = b / t * 100, lp = l / t * 100;
  return `<svg class="gauge" viewBox="0 0 104 66" width="104" aria-hidden="true"><path d="M8 52A44 44 0 0 1 96 52" pathLength="100" class="g-track"/>${seg('pos', 0, wp)}${seg('muted', wp, bp)}${seg('neg', wp + bp, lp)}<text x="10" y="65" class="g-num pos">${w}</text><text x="52" y="65" text-anchor="middle" class="g-num">${b}</text><text x="94" y="65" text-anchor="end" class="g-num neg">${l}</text></svg>`;
}
function donut(parts, size = 120, thick = 14, center = '') {
  const tot = sum(parts.map(p => p.v)); const r = (size - thick) / 2, c = size / 2; let off = 0;
  const segs = tot > 0 ? parts.filter(p => p.v > 0).map(p => { const len = p.v / tot * 100; const s = `<circle cx="${c}" cy="${c}" r="${r}" pathLength="100" fill="none" stroke="${p.color}" stroke-width="${thick}" stroke-dasharray="${Math.max(0, len - .8)} 100" stroke-dashoffset="${-off}" transform="rotate(-90 ${c} ${c})"><title>${esc(p.label)}</title></circle>`; off += len; return s; }).join('') : '';
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${thick}"/>${segs}${center ? `<text x="${c}" y="${c + 6}" text-anchor="middle" class="donut-c">${esc(center)}</text>` : ''}</svg>`;
}
function radar(axes, size = 250) {
  const pad = 92, c = size / 2, R = size / 2 - 30, n = axes.length, pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; };
  let svg = [.25, .5, .75, 1].map(k => `<polygon class="r-grid" points="${axes.map((_, i) => pt(i, k).map(x => x.toFixed(1)).join(',')).join(' ')}"/>`).join('');
  svg += axes.map((_, i) => { const [x, y] = pt(i, 1); return `<line class="r-grid" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/>`; }).join('');
  svg += `<polygon class="r-shape" points="${axes.map((a, i) => pt(i, Math.max(.03, a.score / 100)).map(x => x.toFixed(1)).join(',')).join(' ')}"/>`;
  svg += axes.map((a, i) => { const [x, y] = pt(i, Math.max(.03, a.score / 100)); return `<circle cx="${x}" cy="${y}" r="3.5" class="r-dot"><title>${esc(a.label)}: ${esc(a.show)}</title></circle>`; }).join('');
  svg += axes.map((a, i) => { const [x, y] = pt(i, 1.2); const anchor = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end'; return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="r-lab"><tspan x="${x}" dy="-2">${esc(a.label)}</tspan><tspan x="${x}" dy="13" class="r-val">${esc(a.show)}</tspan></text>`; }).join('');
  return `<svg viewBox="${-pad} -6 ${size + pad * 2} ${size + 12}" class="radar" role="img" aria-label="Edge score radar">${svg}</svg>`;
}
