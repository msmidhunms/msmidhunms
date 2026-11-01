/* Interactive architecture diagram: lanes, nodes, animated data flow, modes, hover tracing, details panel. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const XL = 'http://www.w3.org/1999/xlink';
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function mount(root, cfg) {
    const tabs = root.querySelector('.arch-tabs');
    const stage = root.querySelector('.arch-stage');
    const panel = root.querySelector('.arch-info');
    const svg = el('svg', { viewBox: '0 0 ' + cfg.width + ' ' + cfg.height, class: 'arch-svg', role: 'img', 'aria-label': cfg.label || 'Architecture diagram' });
    stage.appendChild(svg);
    const defs = el('defs', {}, svg);
    const mk = el('marker', { id: cfg.id + '-arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arch-arrowhead' }, mk);

    cfg.columns.forEach(function (c) {
      el('rect', { x: c.x - 14, y: 14, width: c.w + 28, height: cfg.height - 28, rx: 14, class: 'arch-lane' }, svg);
      el('text', { x: c.x, y: 40, class: 'arch-lane-label' }, svg).textContent = c.label;
    });

    const gE = el('g', {}, svg), gN = el('g', {}, svg), gL = el('g', {}, svg), gP = el('g', { class: 'arch-packets' }, svg);
    const N = {};
    cfg.nodes.forEach(function (n) { N[n.id] = n; });
    function anchor(n, s) {
      if (s === 'r') return [n.x + n.w, n.y + n.h / 2];
      if (s === 'l') return [n.x, n.y + n.h / 2];
      if (s === 'b') return [n.x + n.w / 2, n.y + n.h];
      return [n.x + n.w / 2, n.y];
    }

    cfg.edges.forEach(function (e, i) {
      let d = e.d;
      if (!d) {
        const fs = e.fs || 'r', ts = e.ts || 'l';
        const a = anchor(N[e.from], fs), b = anchor(N[e.to], ts);
        if (fs === 'b' || fs === 't') {
          const my = (a[1] + b[1]) / 2;
          d = 'M' + a[0] + ',' + a[1] + ' C' + a[0] + ',' + my + ' ' + b[0] + ',' + my + ' ' + b[0] + ',' + b[1];
        } else {
          const mx = (a[0] + b[0]) / 2;
          d = 'M' + a[0] + ',' + a[1] + ' C' + mx + ',' + a[1] + ' ' + mx + ',' + b[1] + ' ' + b[0] + ',' + b[1];
        }
      }
      const g = el('g', { class: 'arch-edge' + (e.dashed ? ' dashed' : '') }, gE);
      const pid = cfg.id + '-e' + i;
      const p = el('path', { d: d, id: pid, class: 'arch-path', 'marker-end': 'url(#' + cfg.id + '-arr)' }, g);
      el('path', { d: d, class: 'arch-flow' }, g);
      e._g = g; e._p = p; e._id = pid;
      if (e.label) {
        const L = p.getTotalLength(), pt = p.getPointAtLength(L * (e.lt == null ? 0.5 : e.lt));
        e._lab = el('text', { x: pt.x + (e.lx || 0), y: pt.y - 7 + (e.ly || 0), 'text-anchor': 'middle', class: 'arch-elabel' }, gL);
        e._lab.textContent = e.label;
      }
    });

    cfg.nodes.forEach(function (n) {
      const g = el('g', { class: 'arch-node' + (n.kind ? ' ' + n.kind : ''), tabindex: 0, role: 'button', 'aria-label': n.title }, gN);
      el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10 }, g);
      el('text', { x: n.x + 14, y: n.y + 25, class: 'arch-title' }, g).textContent = n.title;
      if (n.sub) el('text', { x: n.x + 14, y: n.y + 43, class: 'arch-sub' }, g).textContent = n.sub;
      n._lines = el('g', {}, g);
      n._g = g;
      g.addEventListener('mouseenter', function () { focus(n.id); });
      g.addEventListener('mouseleave', function () { focus(null); });
      g.addEventListener('focus', function () { focus(n.id); });
      g.addEventListener('blur', function () { focus(null); });
      g.addEventListener('click', function () { select(n.id); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(n.id); }
      });
    });

    let mode = cfg.modes ? cfg.modes[0].id : null, sel = null, ready = false;
    function on(n) { return !n.modes || n.modes.indexOf(mode) >= 0; }
    function renderLines(n) {
      while (n._lines.firstChild) n._lines.firstChild.remove();
      let ls = n.lines;
      if (ls && !Array.isArray(ls)) ls = ls[mode] || [];
      (ls || []).forEach(function (t, i) {
        el('text', { x: n.x + 14, y: n.y + (n.sub ? 66 : 50) + i * 19, class: 'arch-line' }, n._lines).textContent = t;
      });
    }
    function packets() {
      while (gP.firstChild) gP.firstChild.remove();
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      cfg.edges.forEach(function (e) {
        if (!e._on || e.dashed) return;
        const L = e._p.getTotalLength(), dur = Math.max(1.2, L / 110);
        for (let k = 0; k < 2; k++) {
          const c = el('circle', { r: 3.5, class: 'arch-packet' }, gP);
          const am = el('animateMotion', { dur: dur.toFixed(2) + 's', repeatCount: 'indefinite', begin: (-k * dur / 2).toFixed(2) + 's' }, c);
          const mp = el('mpath', { href: '#' + e._id }, am);
          mp.setAttributeNS(XL, 'xlink:href', '#' + e._id);
        }
      });
    }
    function setMode(m) {
      if (ready && m === mode) return;
      mode = m;
      if (tabs) tabs.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === m); });
      cfg.nodes.forEach(function (n) { n._g.classList.toggle('off', !on(n)); renderLines(n); });
      cfg.edges.forEach(function (e) {
        const act = e.always ? true : (on(N[e.from]) && on(N[e.to]) && (!e.modes || e.modes.indexOf(mode) >= 0));
        e._on = act;
        [e._g, e._lab].forEach(function (x) { if (x) x.classList.toggle('off', !act); });
      });
      packets();
      showInfo();
      if (ready && cfg.onMode) cfg.onMode(m);
      ready = true;
    }
    function linked(a, b) {
      return cfg.edges.some(function (e) { return (e.from === a && e.to === b) || (e.to === a && e.from === b); });
    }
    function focus(id) {
      const t = id || sel;
      svg.classList.toggle('focus', !!t);
      cfg.nodes.forEach(function (n) { n._g.classList.toggle('hl', !!t && (n.id === t || linked(t, n.id))); });
      cfg.edges.forEach(function (e) {
        const hl = !!t && (e.from === t || e.to === t);
        [e._g, e._lab].forEach(function (x) { if (x) x.classList.toggle('hl', hl); });
      });
    }
    function select(id) {
      sel = sel === id ? null : id;
      cfg.nodes.forEach(function (n) { n._g.classList.toggle('sel', n.id === sel); });
      focus(null);
      showInfo();
    }
    function showInfo() {
      panel.innerHTML = '';
      if (!sel) {
        const m = cfg.modes && cfg.modes.find(function (x) { return x.id === mode; });
        panel.appendChild(h('div', 'arch-kicker', m ? m.label : 'Overview'));
        panel.appendChild(h('p', null, m ? m.desc : cfg.intro));
        panel.appendChild(h('p', 'arch-hint', 'Hover a block to trace its connections. Click it for details. Moving dots show live data.'));
        return;
      }
      const n = N[sel], info = n.info || {};
      panel.appendChild(h('div', 'arch-kicker', n.sub || 'Block'));
      panel.appendChild(h('h4', null, n.title));
      const body = (info.byMode && info.byMode[mode]) || info.body;
      if (body) panel.appendChild(h('p', null, body));
      if (info.facts) {
        const ul = h('ul', 'arch-facts');
        info.facts.forEach(function (f) { ul.appendChild(h('li', null, f)); });
        panel.appendChild(ul);
      }
      if (info.topics) {
        const d = h('div', 'arch-topics');
        info.topics.forEach(function (t) { d.appendChild(h('code', null, t)); });
        panel.appendChild(d);
      }
      const ins = cfg.edges.filter(function (e) { return e.to === sel && e._on; }).map(function (e) { return N[e.from].title; });
      const outs = cfg.edges.filter(function (e) { return e.from === sel && e._on; }).map(function (e) { return N[e.to].title; });
      if (ins.length) panel.appendChild(h('p', 'arch-io', 'In ← ' + ins.join(', ')));
      if (outs.length) panel.appendChild(h('p', 'arch-io', 'Out → ' + outs.join(', ')));
      const b = h('button', 'btn', 'Back to overview');
      b.type = 'button';
      b.onclick = function () { select(sel); };
      panel.appendChild(b);
    }

    if (tabs && cfg.modes) {
      cfg.modes.forEach(function (m) {
        const b = h('button', null, m.label);
        b.type = 'button';
        b.dataset.m = m.id;
        b.onclick = function () { setMode(m.id); };
        tabs.appendChild(b);
      });
    } else if (tabs) tabs.remove();
    setMode(mode);
    return { setMode: setMode };
  }
  window.Arch = { mount: mount };
})();
