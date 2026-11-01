/* Simplified 2-D ball-on-plate simulator for the concept demo. */
(function () {
  const root = document.getElementById('bb-demo');
  if (!root) return;
  const cTop = root.querySelector('.bb-top'), cSide = root.querySelector('.bb-side'), cPlot = root.querySelector('.bb-plot');
  const R = 0.15, G = 7.007, TAU = 0.037, TMAX = 8 * Math.PI / 180, BR = 0.016, CYL = 0.8 * R, DT = 0.001;
  const SENS = {
    direct: { rate: 100, noise: 0.0008, lat: 0, bias: 0, drift: 0, a: 0.5, b: 0.1 },
    camera: { rate: 60, noise: 0.001, lat: 0.012, bias: 0.0015, drift: 0, a: 0.5, b: 0.12 },
    imu: { rate: 200, noise: 0.0004, lat: 0, bias: 0, drift: 0.0012, a: 0.35, b: 0.05 }
  };
  const DEF = { kp: 3, kd: 1.5, ki: 0.5 };
  const cfg = { mode: 'direct', ctrl: 'on', traj: 'hold' };
  const gains = Object.assign({}, DEF);
  const css = function (n, f) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f; };
  const C = { accent: css('--accent', '#5a48c8'), text: css('--text', '#1c1b24'), muted: css('--muted', '#6b6880'), border: css('--border', '#e4e1ee'), bg: css('--bg', '#f8f7fb'), warn: '#d9822b', bad: '#c0392b' };
  document.addEventListener('themechange', function () { C.accent = css('--accent', '#5a48c8'); C.text = css('--text', '#1c1b24'); C.muted = css('--muted', '#6b6880'); C.border = css('--border', '#e4e1ee'); C.bg = css('--bg', '#f8f7fb'); });
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  let s;
  function reset() {
    const x0 = 0.06, y0 = -0.04;
    s = { t: 0, x: x0, y: y0, vx: 0, vy: 0, thx: 0, thy: 0, ix: 0, iy: 0, hist: [], est: { px: x0, py: y0, vx: 0, vy: 0, tm: 0 },
      ex: x0, ey: y0, next: 0, dx: 0, dy: 0, lost: false, tx: 0, ty: 0, rx: 0, ry: 0, man: [0, 0], log: [], trail: [], logT: 0, drag: null };
  }
  reset();

  function ref(t) {
    if (cfg.traj === 'circle') {
      const w = 2 * Math.PI / 6, r = 0.04;
      return [r * Math.cos(w * t), r * Math.sin(w * t), -r * w * Math.sin(w * t), r * w * Math.cos(w * t)];
    }
    return [s.tx, s.ty, 0, 0];
  }

  function step() {
    const S = SENS[cfg.mode], e = s.est;
    s.t += DT;
    if (S.drift) { s.dx += gauss() * S.drift * Math.sqrt(DT); s.dy += gauss() * S.drift * Math.sqrt(DT); }
    s.hist.push(s.x, s.y);
    if (s.hist.length > 400) s.hist.splice(0, 2);
    if (s.t >= s.next) {
      const T = 1 / S.rate;
      s.next = s.t + T;
      const k = Math.min(s.hist.length / 2 - 1, Math.round(S.lat / DT)), j = s.hist.length - 2 - 2 * k;
      const zx = s.hist[j] + S.bias + s.dx + gauss() * S.noise, zy = s.hist[j + 1] + s.dy + gauss() * S.noise;
      const px = e.px + e.vx * T, py = e.py + e.vy * T, rx = zx - px, ry = zy - py;
      e.px = px + S.a * rx; e.py = py + S.a * ry; e.vx += S.b * rx / T; e.vy += S.b * ry / T; e.tm = s.t;
    }
    const ago = s.t - e.tm + S.lat;
    s.ex = e.px + e.vx * ago; s.ey = e.py + e.vy * ago;

    const r = ref(s.t);
    s.rx = r[0]; s.ry = r[1];
    let cx, cy;
    if (cfg.ctrl === 'on') {
      const ex = r[0] - s.ex, ey = r[1] - s.ey, lim = 0.04 / Math.max(gains.ki, 1e-6);
      if (Math.hypot(ex, ey) < 0.025) { s.ix = clamp(s.ix + ex * DT, -lim, lim); s.iy = clamp(s.iy + ey * DT, -lim, lim); }
      cx = gains.kp * ex + gains.kd * (r[2] - e.vx) + gains.ki * s.ix;
      cy = gains.kp * ey + gains.kd * (r[3] - e.vy) + gains.ki * s.iy;
    } else { cx = s.man[0]; cy = s.man[1]; }
    const m = Math.hypot(cx, cy);
    if (m > TMAX) { cx *= TMAX / m; cy *= TMAX / m; }
    s.thx += (cx - s.thx) * DT / TAU;
    s.thy += (cy - s.thy) * DT / TAU;
    if (!(s.drag && s.drag.kind === 'ball')) {
      s.vx += (G * s.thx - 0.15 * s.vx) * DT;
      s.vy += (G * s.thy - 0.15 * s.vy) * DT;
      s.x += s.vx * DT; s.y += s.vy * DT;
    }
    if (Math.hypot(s.x, s.y) > R) s.lost = true;

    if (s.t - s.logT >= 0.02) {
      s.logT = s.t;
      s.log.push([s.t, Math.hypot(s.rx - s.x, s.ry - s.y) * 1000, Math.hypot(s.ex - s.x, s.ey - s.y) * 1000]);
      while (s.log.length && s.log[0][0] < s.t - 10) s.log.shift();
      s.trail.push([s.x, s.y]);
      if (s.trail.length > 70) s.trail.shift();
    }
  }

  /* ---------- canvas setup ---------- */
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  function fit(c, h) {
    const w = c.clientWidth || 300;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.height = h + 'px';
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { x: x, w: w, h: h };
  }
  let T, SD, P;
  function layout() { T = fit(cTop, cTop.clientWidth || 300); SD = fit(cSide, 170); P = fit(cPlot, 150); }
  layout();
  if (window.ResizeObserver) new ResizeObserver(layout).observe(root); else window.addEventListener('resize', layout);

  function arrow(g, x1, y1, x2, y2, col) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 9 * Math.cos(a - 0.4), y2 - 9 * Math.sin(a - 0.4)); g.lineTo(x2 - 9 * Math.cos(a + 0.4), y2 - 9 * Math.sin(a + 0.4)); g.closePath(); g.fill();
  }

  function drawTop() {
    const g = T.x, w = T.w, c = w / 2, k = (w / 2 - 16) / R;
    const P2 = function (X, Y) { return [c + X * k, c - Y * k]; };
    g.clearRect(0, 0, w, w);
    const tx = s.thx / TMAX, ty = s.thy / TMAX, mag = Math.min(1, Math.hypot(tx, ty));
    g.beginPath(); g.arc(c, c, R * k, 0, 2 * Math.PI);
    if (mag > 0.02) {
      const ux = tx / Math.hypot(tx, ty), uy = ty / Math.hypot(tx, ty);
      const gr = g.createLinearGradient(c - ux * R * k, c + uy * R * k, c + ux * R * k, c - uy * R * k);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, 'rgba(90,72,200,' + (0.05 + 0.2 * mag).toFixed(3) + ')');
      g.fillStyle = gr;
    } else g.fillStyle = '#ffffff';
    g.fill(); g.lineWidth = 2; g.strokeStyle = C.border; g.stroke();

    g.setLineDash([3, 5]); g.lineWidth = 1; g.strokeStyle = C.border;
    [R / 3, 2 * R / 3].forEach(function (rr) { g.beginPath(); g.arc(c, c, rr * k, 0, 2 * Math.PI); g.stroke(); });
    g.beginPath(); g.moveTo(c - R * k, c); g.lineTo(c + R * k, c); g.moveTo(c, c - R * k); g.lineTo(c, c + R * k); g.stroke();
    g.setLineDash([]);

    // cylinders
    const smax = CYL * Math.sin(TMAX);
    [0, 1, 2, 3].forEach(function (i) {
      const ph = i * Math.PI / 2, st = CYL * (s.thx * Math.cos(ph) + s.thy * Math.sin(ph)), p = P2(CYL * Math.cos(ph), CYL * Math.sin(ph));
      const a = Math.min(1, Math.abs(st) / smax);
      g.beginPath(); g.arc(p[0], p[1], 10, 0, 2 * Math.PI);
      g.fillStyle = st < 0 ? 'rgba(90,72,200,' + (0.12 + 0.6 * a) + ')' : 'rgba(217,130,43,' + (0.12 + 0.6 * a) + ')';
      g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke();
      g.fillStyle = C.text; g.font = '600 10px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('C' + (i + 1), p[0], p[1]);
    });

    if (cfg.traj === 'circle') {
      g.setLineDash([5, 5]); g.strokeStyle = C.accent; g.globalAlpha = 0.45; g.lineWidth = 1.5;
      g.beginPath(); g.arc(c, c, 0.04 * k, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }

    // downhill arrow
    if (mag > 0.05) {
      const ux = tx / Math.hypot(tx, ty), uy = ty / Math.hypot(tx, ty), L = mag * R * k * 0.55;
      g.globalAlpha = 0.55; arrow(g, c, c, c + ux * L, c - uy * L, C.accent); g.globalAlpha = 1;
    }

    // trail
    if (s.trail.length > 1) {
      g.strokeStyle = C.muted; g.lineWidth = 1.5;
      for (let i = 1; i < s.trail.length; i++) {
        const a = P2(s.trail[i - 1][0], s.trail[i - 1][1]), b = P2(s.trail[i][0], s.trail[i][1]);
        g.globalAlpha = 0.5 * i / s.trail.length; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      g.globalAlpha = 1;
    }

    // target
    if (cfg.ctrl === 'on') {
      const p = P2(s.rx, s.ry);
      g.strokeStyle = C.accent; g.lineWidth = 2;
      g.beginPath(); g.arc(p[0], p[1], 9, 0, 2 * Math.PI); g.moveTo(p[0] - 15, p[1]); g.lineTo(p[0] + 15, p[1]); g.moveTo(p[0], p[1] - 15); g.lineTo(p[0], p[1] + 15); g.stroke();
    }

    // estimate (ghost)
    const pe = P2(s.ex, s.ey);
    g.setLineDash([3, 3]); g.strokeStyle = C.warn; g.lineWidth = 2;
    g.beginPath(); g.arc(pe[0], pe[1], BR * k, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]);

    // slingshot
    const pb = P2(s.x, s.y);
    if (s.drag && s.drag.kind === 'ball') {
      const pd = P2(s.drag.px, s.drag.py);
      g.strokeStyle = C.muted; g.lineWidth = 1.5; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(pb[0], pb[1]); g.lineTo(pd[0], pd[1]); g.stroke(); g.setLineDash([]);
      arrow(g, pb[0], pb[1], pb[0] + (pb[0] - pd[0]) * 0.6, pb[1] + (pb[1] - pd[1]) * 0.6, C.warn);
    }

    // ball
    const rg = g.createRadialGradient(pb[0] - 4, pb[1] - 5, 2, pb[0], pb[1], BR * k);
    rg.addColorStop(0, '#6d6a80'); rg.addColorStop(1, '#1c1b24');
    g.fillStyle = rg; g.beginPath(); g.arc(pb[0], pb[1], BR * k, 0, 2 * Math.PI); g.fill();

    if (s.lost) {
      g.fillStyle = 'rgba(255,255,255,0.82)'; g.fillRect(0, c - 28, w, 56);
      g.fillStyle = C.bad; g.font = '600 15px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('Ball lost. Press Reset.', c, c);
    }
  }

  function drawSide() {
    const g = SD.x, w = SD.w, h = SD.h, cx = w / 2, base = h - 18, k = (w / 2 - 24) / R, ex = 3;
    g.clearRect(0, 0, w, h);
    const pY = base - 74, tn = Math.tan(s.thx * ex), yAt = function (X) { return pY + X * tn * k; };
    g.fillStyle = '#ece9f5'; g.fillRect(cx - R * k - 6, base, 2 * R * k + 12, 8);
    [-CYL, CYL].forEach(function (X) {
      const px = cx + X * k, top = yAt(X);
      g.fillStyle = '#ddd9ea'; g.fillRect(px - 10, top + 26, 20, base - top - 26);
      g.fillStyle = '#9b97ad'; g.fillRect(px - 3, top, 6, 28);
    });
    g.strokeStyle = C.text; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - R * k, yAt(-R)); g.lineTo(cx + R * k, yAt(R)); g.stroke(); g.lineCap = 'butt';
    const bx = clamp(s.x, -R, R), br = Math.max(7, BR * k);
    g.fillStyle = '#1c1b24'; g.beginPath(); g.arc(cx + bx * k, yAt(bx) - br - 3, br, 0, 2 * Math.PI); g.fill();
    g.fillStyle = C.muted; g.font = '11px ui-monospace, Menlo, monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('Side section (x axis), tilt drawn ×3', 6, 4);
    g.textAlign = 'right';
    g.fillText('θx ' + (s.thx * 180 / Math.PI).toFixed(2) + '°', w - 6, 4);
  }

  function drawPlot() {
    const g = P.x, w = P.w, h = P.h, L = 34, Rm = 8, Tp = 18, B = 18, pw = w - L - Rm, ph = h - Tp - B;
    g.clearRect(0, 0, w, h);
    let ymax = 10;
    s.log.forEach(function (r) { ymax = Math.max(ymax, r[1], r[2]); });
    ymax = Math.ceil(Math.min(ymax, 150) / 5) * 5;
    g.font = '10px ui-monospace, Menlo, monospace'; g.fillStyle = C.muted; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.strokeStyle = C.border; g.lineWidth = 1;
    [0, 0.5, 1].forEach(function (f) {
      const y = Tp + ph * (1 - f);
      g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke();
      g.fillText((ymax * f).toFixed(0), L - 5, y);
    });
    g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('mm', 2, 2);
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText('last 10 s', L + pw / 2, h - 13);
    const t0 = s.t - 10;
    [[1, C.accent, 'Tracking error'], [2, C.warn, 'Estimation error']].forEach(function (d, i) {
      g.strokeStyle = d[1]; g.lineWidth = 1.8; g.beginPath();
      s.log.forEach(function (r, j) {
        const x = L + (r[0] - t0) / 10 * pw, y = Tp + ph * (1 - Math.min(r[d[0]], ymax) / ymax);
        if (j) g.lineTo(x, y); else g.moveTo(x, y);
      });
      g.stroke();
      const lx = w - Rm - 230 + i * 120;
      g.fillStyle = d[1]; g.fillRect(lx, 5, 14, 3);
      g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(d[2], lx + 18, 7);
    });
  }

  /* ---------- readouts ---------- */
  const q = function (sel) { return root.querySelector(sel); };
  const bars = root.querySelectorAll('.cyl i');
  let lastStat = 0;
  function stats() {
    const now = s.log[s.log.length - 1] || [0, 0, 0];
    const recent = s.log.filter(function (r) { return r[0] > s.t - 5; });
    const rms = Math.sqrt(recent.reduce(function (a, r) { return a + r[1] * r[1]; }, 0) / Math.max(1, recent.length));
    q('[data-s=track]').textContent = now[1].toFixed(1) + ' mm';
    q('[data-s=trackrms]').textContent = 'RMS over 5 s: ' + rms.toFixed(1) + ' mm';
    q('[data-s=est]').textContent = now[2].toFixed(1) + ' mm';
    q('[data-s=tilt]').textContent = (Math.hypot(s.thx, s.thy) * 180 / Math.PI).toFixed(2) + '°';
    const st = q('[data-s=status]');
    st.textContent = s.lost ? 'Ball lost' : cfg.ctrl === 'on' ? 'Balancing' : 'Manual';
    st.classList.toggle('bad', s.lost);
    const smax = CYL * Math.sin(TMAX);
    bars.forEach(function (b, i) {
      const ph = i * Math.PI / 2, v = clamp(CYL * (s.thx * Math.cos(ph) + s.thy * Math.sin(ph)) / smax, -1, 1);
      b.style.height = (Math.abs(v) * 50) + '%';
      b.style.top = v >= 0 ? (50 - v * 50) + '%' : '50%';
      b.style.background = v >= 0 ? C.warn : C.accent;
    });
  }

  /* ---------- loop ---------- */
  let last = 0, visible = true;
  if (window.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(root);
  function frame(ts) {
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
    last = ts;
    if (visible) {
      if (!s.lost) { const n = Math.round(dt / DT); for (let i = 0; i < n && !s.lost; i++) step(); }
      drawTop(); drawSide(); drawPlot();
      if (ts - lastStat > 100) { stats(); lastStat = ts; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- interaction ---------- */
  function toPlate(ev) {
    const r = cTop.getBoundingClientRect(), c = r.width / 2, k = (r.width / 2 - 16) / R;
    return [(ev.clientX - r.left - c) / k, -(ev.clientY - r.top - c) / k];
  }
  function setTarget(X, Y) {
    const m = Math.hypot(X, Y), lim = 0.09;
    if (m > lim) { X *= lim / m; Y *= lim / m; }
    s.tx = X; s.ty = Y;
  }
  cTop.addEventListener('pointerdown', function (ev) {
    const p = toPlate(ev);
    if (!s.lost && Math.hypot(p[0] - s.x, p[1] - s.y) < 0.03) { s.drag = { kind: 'ball', px: p[0], py: p[1] }; s.vx = s.vy = 0; }
    else if (cfg.ctrl === 'on') { if (cfg.traj !== 'hold') setSeg('traj', 'hold'); s.drag = { kind: 'target' }; setTarget(p[0], p[1]); }
    try { cTop.setPointerCapture(ev.pointerId); } catch (e) {}
    ev.preventDefault();
  });
  cTop.addEventListener('pointermove', function (ev) {
    const p = toPlate(ev);
    if (s.drag && s.drag.kind === 'ball') { s.drag.px = p[0]; s.drag.py = p[1]; }
    else if (s.drag && s.drag.kind === 'target') setTarget(p[0], p[1]);
    if (cfg.ctrl === 'off') s.man = [clamp(p[0] / R, -1, 1) * TMAX, clamp(p[1] / R, -1, 1) * TMAX];
  });
  function release() {
    if (s.drag && s.drag.kind === 'ball') {
      let vx = (s.x - s.drag.px) * 5, vy = (s.y - s.drag.py) * 5;
      const m = Math.hypot(vx, vy);
      if (m > 0.6) { vx *= 0.6 / m; vy *= 0.6 / m; }
      s.vx = vx; s.vy = vy;
    }
    s.drag = null;
  }
  cTop.addEventListener('pointerup', release);
  cTop.addEventListener('pointercancel', release);
  cTop.addEventListener('pointerleave', function () { if (cfg.ctrl === 'off') s.man = [0, 0]; });

  const hint = q('.demo-hint');
  function setHint() {
    hint.textContent = cfg.ctrl === 'on'
      ? 'Drag on the plate to move the target. Grab the ball, pull back and let go to flick it.'
      : 'Controller off. Move your pointer over the plate to tilt it yourself and try to keep the ball on.';
  }
  function setSeg(key, v) {
    const changed = cfg[key] !== v;
    cfg[key] = v;
    root.querySelectorAll('.seg[data-k="' + key + '"] button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
    if (!changed) return;
    if (key === 'mode') { s.dx = s.dy = 0; s.est.px = s.x; s.est.py = s.y; if (window.bbArch) window.bbArch.setMode(v); }
    if (key === 'ctrl') { s.ix = s.iy = 0; s.man = [0, 0]; setHint(); }
  }
  root.querySelectorAll('.seg').forEach(function (sg) {
    sg.addEventListener('click', function (ev) { const b = ev.target.closest('button'); if (b) setSeg(sg.dataset.k, b.dataset.v); });
  });
  q('[data-act=push]').onclick = function () {
    if (s.lost) return;
    const a = Math.random() * 2 * Math.PI;
    s.vx += 0.25 * Math.cos(a); s.vy += 0.25 * Math.sin(a);
  };
  q('[data-act=reset]').onclick = function () { reset(); };
  const sliders = root.querySelectorAll('.sliders input');
  function syncSliders() {
    sliders.forEach(function (inp) { inp.value = gains[inp.dataset.g]; inp.parentNode.querySelector('output').textContent = (+gains[inp.dataset.g]).toFixed(1); });
  }
  sliders.forEach(function (inp) {
    inp.addEventListener('input', function () { gains[inp.dataset.g] = +inp.value; inp.parentNode.querySelector('output').textContent = (+inp.value).toFixed(1); });
  });
  q('[data-act=gains]').onclick = function () { Object.assign(gains, DEF); s.ix = s.iy = 0; syncSliders(); };
  syncSliders();
  setHint();
  window.bbDemo = { setMode: function (v) { setSeg('mode', v); } };
})();
