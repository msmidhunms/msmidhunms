/* Home page: interactive robot arm (inverse kinematics + minimum-jerk motion), timeline and skill map. */
(function () {
  /* ---------- robot arm ---------- */
  const cv = document.getElementById('arm');
  if (cv) {
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, base, L1, L2, L3;
    function size() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base = { x: W * 0.5, y: H * 0.86 };
      const reach = Math.min(W * 0.46, H * 0.78);
      L1 = reach * 0.42; L2 = reach * 0.36; L3 = reach * 0.18;
    }
    size();
    if (window.ResizeObserver) new ResizeObserver(size).observe(cv); else addEventListener('resize', size);

    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const modeLbl = document.getElementById('arm-mode');
    const shapes = {
      figure8: function (t) { return [Math.sin(t), Math.sin(2 * t) / 2]; },
      star: function (t) {
        const k = Math.floor((t / (2 * Math.PI)) * 5 % 5), f = ((t / (2 * Math.PI)) * 5) % 1;
        const p = function (i) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; return [Math.cos(a), Math.sin(a)]; };
        const a = p(k), b = p(k + 1);
        return [(a[0] + (b[0] - a[0]) * f) * 0.85, (a[1] + (b[1] - a[1]) * f) * 0.85];
      },
      heart: function (t) { return [Math.pow(Math.sin(t), 3) * 0.95, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]; }
    };
    let shape = 'figure8', mode = 'trace', tt = 0;
    let ee = { x: 0, y: 0 }, goal = null, move = null, trail = [], mouse = null;

    function centre() { return { x: W * 0.5, y: H * 0.42, s: Math.min(W, H) * 0.24 }; }
    function shapePoint(t) { const c = centre(), p = shapes[shape](t); return { x: c.x + p[0] * c.s, y: c.y + p[1] * c.s }; }
    ee = shapePoint(0);

    function clampReach(p) {
      const dx = p.x - base.x, dy = p.y - base.y, d = Math.hypot(dx, dy), max = (L1 + L2 + L3) * 0.97, min = 30;
      const r = Math.max(min, Math.min(max, d));
      let x = base.x + dx / d * r, y = base.y + dy / d * r;
      if (y > base.y - 12) y = base.y - 12;
      return { x: x, y: y };
    }
    function ik(p) {
      // wrist point keeps the last link pointing toward the target from the base direction
      const ang = Math.atan2(p.y - base.y, p.x - base.x);
      const wx = p.x - L3 * Math.cos(ang), wy = p.y - L3 * Math.sin(ang);
      const dx = wx - base.x, dy = wy - base.y;
      let d = Math.hypot(dx, dy);
      d = Math.min(d, L1 + L2 - 0.001);
      const c2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
      const q2 = -Math.acos(Math.max(-1, Math.min(1, c2)));
      const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
      return { q1: q1, q2: q2, ang: ang };
    }
    function minJerk(s) { return 10 * s * s * s - 15 * s * s * s * s + 6 * s * s * s * s * s; }

    function setMode(m, label) {
      mode = m;
      if (modeLbl) modeLbl.textContent = label;
      document.querySelectorAll('.arm-modes button').forEach(function (b) { b.classList.toggle('on', b.dataset.shape === shape && mode === 'trace'); });
    }
    function planTo(p, then) {
      const q = clampReach(p);
      move = { from: { x: ee.x, y: ee.y }, to: q, t: 0, dur: Math.max(0.35, Math.hypot(q.x - ee.x, q.y - ee.y) / 380), then: then };
    }

    cv.addEventListener('pointermove', function (e) {
      const r = cv.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (mode !== 'reach') setMode('follow', 'following your pointer · live inverse kinematics');
    });
    cv.addEventListener('pointerleave', function () { mouse = null; if (mode === 'follow') { planTo(shapePoint(tt), 'trace'); setMode('return', 'returning to trajectory'); } });
    cv.addEventListener('pointerdown', function (e) {
      const r = cv.getBoundingClientRect();
      goal = { x: e.clientX - r.left, y: e.clientY - r.top };
      planTo(goal, 'hold');
      setMode('reach', 'minimum-jerk reach to target');
    });
    document.querySelectorAll('.arm-modes button').forEach(function (b) {
      b.addEventListener('click', function () { shape = b.dataset.shape; trail = []; goal = null; planTo(shapePoint(tt), 'trace'); setMode('return', 'planning a path to the ' + b.textContent.toLowerCase()); });
    });

    let last = 0, holdT = 0;
    function frame(ts) {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
      if (move) {
        move.t += dt;
        const s = minJerk(Math.min(1, move.t / move.dur));
        ee = { x: move.from.x + (move.to.x - move.from.x) * s, y: move.from.y + (move.to.y - move.from.y) * s };
        if (move.t >= move.dur) {
          const then = move.then; move = null;
          if (then === 'trace') setMode('trace', 'tracing a generated trajectory');
          if (then === 'hold') { holdT = 1.6; }
        }
      } else if (mode === 'reach') {
        holdT -= dt;
        if (holdT <= 0) { goal = null; planTo(shapePoint(tt), 'trace'); setMode('return', 'returning to trajectory'); }
      } else if (mode === 'follow' && mouse) {
        const q = clampReach(mouse);
        ee = { x: ee.x + (q.x - ee.x) * Math.min(1, dt * 9), y: ee.y + (q.y - ee.y) * Math.min(1, dt * 9) };
      } else if (mode === 'trace') {
        tt += dt * (reduce ? 0.25 : 0.8);
        ee = clampReach(shapePoint(tt));
      }
      if (mode === 'trace' || mode === 'follow' || move) { trail.push({ x: ee.x, y: ee.y }); if (trail.length > 220) trail.shift(); }
      draw();
      requestAnimationFrame(frame);
    }

    function draw() {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const P = dark
        ? { grid: '#24222f', reach: '#3b3750', plate: '#2a2738', dome: '#3b3750', l1: '#8a84b3', l2: '#a8a2cf', l3: '#9183ee', jFill: '#1c1a25', jLine: '#9183ee', tip: '#9183ee', text: '#a8a4bf', trail: '145,131,238' }
        : { grid: '#eeebf6', reach: '#d9d4ec', plate: '#e4e0f2', dome: '#cfc9e6', l1: '#2b2840', l2: '#3d3957', l3: '#5a48c8', jFill: '#ffffff', jLine: '#5a48c8', tip: '#5a48c8', text: '#6b6880', trail: '90,72,200' };
      ctx.clearRect(0, 0, W, H);
      // grid
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // reach envelope
      ctx.setLineDash([4, 6]); ctx.strokeStyle = P.reach;
      ctx.beginPath(); ctx.arc(base.x, base.y, (L1 + L2 + L3) * 0.97, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      // trail
      for (let i = 1; i < trail.length; i++) {
        ctx.strokeStyle = 'rgba(' + P.trail + ',' + (i / trail.length * 0.85).toFixed(3) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
      // goal
      if (goal) {
        ctx.strokeStyle = '#d9822b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(goal.x, goal.y, 9, 0, 2 * Math.PI); ctx.moveTo(goal.x - 14, goal.y); ctx.lineTo(goal.x + 14, goal.y); ctx.moveTo(goal.x, goal.y - 14); ctx.lineTo(goal.x, goal.y + 14); ctx.stroke();
      }
      // arm
      const k = ik(ee);
      const j1 = { x: base.x + L1 * Math.cos(k.q1), y: base.y + L1 * Math.sin(k.q1) };
      const j2 = { x: j1.x + L2 * Math.cos(k.q1 + k.q2), y: j1.y + L2 * Math.sin(k.q1 + k.q2) };
      const tip = { x: j2.x + L3 * Math.cos(k.ang), y: j2.y + L3 * Math.sin(k.ang) };
      ctx.fillStyle = P.plate; ctx.fillRect(base.x - 46, base.y + 6, 92, 14);
      ctx.fillStyle = P.dome; ctx.beginPath(); ctx.arc(base.x, base.y + 6, 26, Math.PI, 2 * Math.PI); ctx.fill();
      function link(a, b, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      link(base, j1, 16, P.l1); link(j1, j2, 12, P.l2); link(j2, tip, 7, P.l3);
      [base, j1, j2].forEach(function (j, i) { ctx.fillStyle = P.jFill; ctx.beginPath(); ctx.arc(j.x, j.y, [9, 7, 5][i], 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = P.jLine; ctx.lineWidth = 2; ctx.stroke(); });
      ctx.fillStyle = P.tip; ctx.beginPath(); ctx.arc(tip.x, tip.y, 4.5, 0, 2 * Math.PI); ctx.fill();
      // joint readout
      ctx.fillStyle = P.text; ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left';
      const deg = function (r) { return (r * 180 / Math.PI).toFixed(0).padStart(4, ' ') + '°'; };
      ctx.fillText('q1 ' + deg(-k.q1) + '   q2 ' + deg(-k.q2), 12, 18);
    }
    requestAnimationFrame(frame);
    setMode('trace', 'tracing a generated trajectory');
  }

  /* ---------- timeline ---------- */
  const TL = [
    { y: '2013', k: 'edu', t: 'B.Tech, Electronics & Communication', s: 'Model Engineering College (CUSAT)', b: ['Undergraduate degree in electronics and communication engineering.'] },
    { y: '2015', k: 'edu', t: 'M.Tech, Digital Electronics', s: 'CUSAT', b: ['Ranked 4th in the university.', 'GATE qualified in 2013, 2014 and 2015.'] },
    { y: '2015', k: 'res', t: 'UGC Junior Research Fellow', s: 'Dept. of Electronics, CUSAT · 2015–2018', b: ['Applied AI techniques to robot data generation, task planning and task classification.', 'Selected through the UGC-NET Junior Research Fellowship.'] },
    { y: '2018', k: 'res', t: 'UGC Senior Research Fellow', s: 'Dept. of Electronics, CUSAT · 2018–2025', b: ['Generative models (CVAE, β-VAE, GAN) and sequence models for robot trajectory and task planning in ROS.', 'Few-shot outlier detection with Siamese and triplet networks to catch failed or unwanted executions.', 'Containerised training on GPU/HPC clusters and a Docker Swarm framework generating large-scale simulation data in Gazebo.'] },
    { y: '2019', k: 'res', t: 'Mentor, robotics & AI projects', s: 'CUSAT · 2019–2024', b: ['Mentored 20+ student engineering teams through robotics and AI projects, from scoping to final evaluation.', 'Topics included motion planning, task automation and ML integration.'] },
    { y: '2024', k: 'ind', t: 'GenAI developer & AI strategy consultant', s: 'Freelance · 2024–2025', b: ['Built a LangChain RAG chatbot with switchable LLM back-ends for customer support.', 'Set up MLOps and CI/CD pipelines across client projects.', 'Advised organisations on aligning AI adoption with business goals.'] },
    { y: '2025', k: 'edu', t: 'PhD awarded', s: 'CUSAT', b: ['Thesis on generative AI for robot trajectory planning.', '12 publications: 7 journal and 5 conference papers.'] },
    { y: '2025', k: 'ind', t: 'Senior Data Scientist', s: 'AI-focused software company · since June 2025', b: ['Lead AI product development for two GenAI platforms, owning architecture, roadmap and delivery.', 'Multi-agent workflows, RAG, LLM evaluation, model routing and cost control.', 'Lead two small AI teams.'] },
    { y: 'Now', k: 'ind', t: 'Open to new opportunities', s: 'Looking for the next challenge', b: ['Looking for a senior role where research depth and hands-on engineering both matter.', 'Happy to talk about new positions and collaborations.'] }
  ];
  const track = document.getElementById('tl-track'), det = document.getElementById('tl-detail');
  if (track && det) {
    function showTL(i) {
      track.querySelectorAll('.tl-item').forEach(function (b, j) { b.classList.toggle('on', i === j); b.setAttribute('aria-selected', i === j); });
      const e = TL[i];
      det.innerHTML = '';
      const k = document.createElement('div'); k.className = 'arch-kicker'; k.textContent = e.y + ' · ' + e.s;
      const h = document.createElement('h4'); h.textContent = e.t;
      const ul = document.createElement('ul'); e.b.forEach(function (x) { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
      det.appendChild(k); det.appendChild(h); det.appendChild(ul);
      det.style.animation = 'none'; void det.offsetWidth; det.style.animation = '';
    }
    TL.forEach(function (e, i) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tl-item ' + e.k; b.setAttribute('role', 'tab');
      b.innerHTML = '<span class="yr"></span><span class="dot"></span><span class="lbl"></span>';
      b.querySelector('.yr').textContent = e.y; b.querySelector('.lbl').textContent = e.t;
      b.addEventListener('click', function () { showTL(i); });
      b.addEventListener('mouseenter', function () { showTL(i); });
      b.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); const n = (i + (ev.key === 'ArrowRight' ? 1 : TL.length - 1)) % TL.length; track.children[n].focus(); showTL(n); }
      });
      track.appendChild(b);
    });
    showTL(0);
  }

  /* ---------- skill map ---------- */
  const sm = document.getElementById('skillmap');
  if (sm) {
    sm.querySelectorAll('[data-f]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const f = btn.dataset.f;
        sm.querySelectorAll('[data-f]').forEach(function (b) { b.classList.toggle('on', b === btn); });
        sm.classList.toggle('filtering', f !== 'all');
        sm.querySelectorAll('.sk').forEach(function (s) { s.classList.toggle('hit', f !== 'all' && (s.dataset.u || '').split(' ').indexOf(f) >= 0); });
      });
    });
  }
})();
