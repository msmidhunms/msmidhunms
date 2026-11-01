/* Helpers for thesis-derived charts and tables. Exposes window.T. */
(function () {
  function fmt(v, d) { return v.toFixed(d == null ? 3 : d); }
  function bars(el, cfg) {
    el.innerHTML = '';
    const max = cfg.max || Math.max.apply(null, [].concat.apply([], cfg.series.map(function (s) { return s.values; })));
    if (cfg.series.length > 1) {
      const lg = document.createElement('div'); lg.className = 'legend';
      cfg.series.forEach(function (s) { const i = document.createElement('span'); i.innerHTML = '<i style="background:' + s.color + '"></i>' + s.name; lg.appendChild(i); });
      el.appendChild(lg);
    }
    cfg.labels.forEach(function (lab, i) {
      cfg.series.forEach(function (s, j) {
        const r = document.createElement('div'); r.className = 'row';
        const l = document.createElement('span'); l.className = 'lbl'; l.textContent = j === 0 ? lab : '';
        const t = document.createElement('div'); t.className = 'track';
        const f = document.createElement('div'); f.className = 'fill'; f.style.width = (s.values[i] / max * 100).toFixed(1) + '%'; f.style.background = s.color;
        t.appendChild(f);
        const v = document.createElement('span'); v.className = 'val'; v.textContent = (cfg.fmt ? cfg.fmt(s.values[i]) : fmt(s.values[i])) + (cfg.unit || '');
        r.appendChild(l); r.appendChild(t); r.appendChild(v); el.appendChild(r);
      });
    });
  }
  function table(el, headers, rows, hl) {
    let h = '<table class="data"><thead><tr>' + headers.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r, i) { h += '<tr' + (hl && hl === i ? ' class="hl"' : '') + '>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; });
    el.innerHTML = h + '</tbody></table>';
  }
  function toggles(el, opts, onPick) {
    el.innerHTML = '';
    opts.forEach(function (o, i) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o.label; b.className = i === 0 ? 'on' : '';
      b.addEventListener('click', function () { el.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); onPick(o.value); });
      el.appendChild(b);
    });
  }
  window.T = { bars: bars, table: table, toggles: toggles };
})();
