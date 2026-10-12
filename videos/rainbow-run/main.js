/* 派星天护节 · 亲子彩虹跑 — 3D camera promo
 * One deterministic GSAP timeline drives a CSS-3D sky world through a virtual camera.
 * render(T) is pure in T, so the page can be previewed live or rendered frame by frame.
 * Cuts sit on a 120 BPM grid (0.5 s per beat) so music can be dropped in later.
 */
(() => {
  'use strict';

  const P = 1200, W = 1920, H = 1080, D2R = Math.PI / 180;
  const INTRO = 3;            // hook shot before the main film
  const MAIN = 52;
  const DURATION = INTRO + MAIN;
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  if (RENDER) document.body.classList.add('render');

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const world = $('#world');
  const cam = { x: 0, y: 0, z: 7600, yaw: 0, pitch: 0, roll: 0 };
  const fx = { speed: 0, night: 0, ice: 0, flare: 0, flareX: -300, flareY: 330, sway: 0, hud: 0, sweepX: -5600, rv: 0 };
  const tl = gsap.timeline({ paused: true });

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const env = (t, t0, t1, fin = 0.4, fout = 0.5) =>
    t < t0 || t > t1 ? 0 : Math.min(clamp((t - t0) / fin), clamp((t1 - t) / fout));

  /* ---------------- masked type: wrap text so it can rise from behind a line ---------------- */
  function wrapMask(el) {
    const hl = el.classList.contains('hl'), gold = el.classList.contains('gold');
    el.classList.remove('hl', 'gold');
    const kids = [...el.children].filter(c => c.tagName === 'SPAN');
    if (kids.length && kids.every(k => k.childElementCount === 0)) {
      kids.forEach(k => {
        const ln = document.createElement('span'); ln.className = 'ln';
        k.replaceWith(ln); ln.appendChild(k); k.classList.add('tx');
      });
    } else {
      const cls = ['tx', hl && 'hl', gold && 'gold'].filter(Boolean).join(' ');
      el.innerHTML = `<span class="ln"><span class="${cls}">${el.innerHTML}</span></span>`;
    }
  }
  $$('.kicker, .mega, .h1, .h1x, .eng, .role').forEach(wrapMask);

  /* ---------------- place the world ---------------- */
  const num = (v, n) => { const a = (v || '').split(',').map(Number); while (a.length < n) a.push(0); return a; };
  const G = {};
  $$('.g').forEach(g => {
    const [x, y, z] = num(g.dataset.p, 3);
    g._b = { x, y, z };
    gsap.set(g, { x, y, z });
    G[g.id] = g._b;
  });
  $$('.o').forEach(o => {
    const [x, y, z] = num(o.dataset.p, 3);
    const [rx, ry, rz] = num(o.dataset.r, 3);
    const ax = o.dataset.ax !== undefined ? +o.dataset.ax : -50;
    o._b = { x, y, z, rotationX: rx, rotationY: ry, rotation: rz, scale: 1 };
    gsap.set(o, { xPercent: ax, yPercent: -50, ...o._b });
  });

  // 虎虎 photo: falls back to a placeholder until assets/huhu.png exists
  const huhuImg = $('#huhuImg');
  const markMissing = () => $('#huhuCard').classList.add('missing');
  huhuImg.addEventListener('error', markMissing);
  if (huhuImg.complete && !huhuImg.naturalWidth) markMissing();

  const eq = $('#eq');
  for (let i = 0; i < 46; i++) eq.appendChild(document.createElement('i'));
  const eqBars = [...eq.children];

  /* ---------------- clouds: canvas sprites projected through the camera ---------------- */
  const cloudImgs = [1, 2, 3, 4, 5].map(i => { const im = new Image(); im.src = `assets/cloud${i}.png`; return im; });
  const clouds = [];
  const cloud = (x, y, z, w, op = 1, v = 1) => clouds.push({ x, y, z, w, op, im: cloudImgs[(v - 1) % 5] });
  (() => {
    const r = rng(42);
    // hook backdrop (text plane at y -1500, z 9000)
    [[-1900, -760, 8200, 3200], [1800, -820, 7900, 3400], [0, -560, 7200, 4800], [2300, -2400, 8400, 2400], [-2400, -2300, 8600, 2200]].forEach(([x, y, z, w], i) =>
      cloud(x, y, z, w, 0.95, 1 + (i % 5)));
    // fly-through corridor for the opening
    for (let i = 0; i < 12; i++) {
      const z = 7000 - i * 400;
      const side = i % 2 ? 1 : -1;
      const near = i % 4 === 1;
      cloud(near ? (r() - 0.5) * 500 : side * (600 + r() * 1100), (r() - 0.5) * 900 + 200, z, 2000 + r() * 1600, 1, 1 + (i % 5));
    }
    // distant clouds framing each cluster
    const centers = [[0, 0], [4200, -800], [8600, -300], [13000, -600], [17400, -600], [21800, -600]];
    centers.forEach(([cx, cz], k) => {
      for (let j = 0; j < 3; j++) {
        cloud(cx + (j - 1) * 2600 + (r() - 0.5) * 700, (j % 2 ? -1100 : 950) + (r() - 0.5) * 400, cz - 2600 - r() * 1800, 3200 + r() * 2400, 0.85, 1 + ((k + j) % 5));
      }
    });
    // foreground passers (parallax during whips)
    [[1900, 620, 260], [2900, -720, 140], [11000, 900, 520], [15300, 820, 120], [19600, -760, 160]].forEach(([x, y, z], i) =>
      cloud(x, y, z, 1800 + i * 140, 0.92, 1 + (i % 5)));
    // cloud sea far below the path
    for (let x = -5000; x <= 27000; x += 1500) {
      cloud(x + (r() - 0.5) * 700, 1350 + r() * 300, -600 - r() * 3000, 3000 + r() * 1800, 0.95, 1 + Math.floor(r() * 5));
    }
  })();

  /* ---------------- helpers for the timeline ---------------- */
  const els = sel => [].concat(sel).flatMap(s => (typeof s === 'string' ? $$(s) : [s]));
  const EASE = 'expo.out';
  function fly(sel, from, t, dur = 1.1, ease = EASE, stagger = 0) {
    els(sel).forEach((el, i) => {
      const b = el._b, f = {}, to = { duration: dur, ease, immediateRender: true };
      for (const k of ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotation']) { f[k] = b[k] + (from[k] || 0); to[k] = b[k]; }
      f.scale = b.scale * (from.scale ?? 1); to.scale = b.scale;
      f.autoAlpha = from.autoAlpha ?? 0; to.autoAlpha = 1;
      tl.fromTo(el, f, to, t + i * stagger);
    });
  }
  // text rising from behind its mask line
  function rise(sel, t, stagger = 0.06, dur = 1.0) {
    const tx = els(sel).flatMap(el => (el.classList.contains('tx') ? [el] : $$('.tx', el)));
    tl.fromTo(tx, { yPercent: 115 }, { yPercent: 0, duration: dur, ease: 'expo.out', stagger, immediateRender: true }, t);
  }
  // highlight travelling across gradient-filled text
  function gleam(sel, t, stagger = 0.05) {
    const tx = els(sel).flatMap(el => (el.matches('.hl') ? [el] : $$('.hl', el)));
    tl.fromTo(tx, { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: 1.4, ease: 'power2.inOut', stagger, immediateRender: true }, t);
  }
  // photo unveiled like a curtain, settling from a slight over-scale
  function unveil(sel, t, dir = 1) {
    els(sel).forEach(el => {
      const from = dir > 0 ? 'inset(0% 100% 0% 0% round 26px)' : 'inset(0% 0% 0% 100% round 26px)';
      tl.fromTo(el, { clipPath: from, autoAlpha: 1 }, { clipPath: 'inset(-25% -25% -30% -25% round 26px)', duration: 1.3, ease: 'expo.inOut', immediateRender: true }, t);
      const img = $('img', el);
      if (img) tl.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 2.2, ease: 'expo.out', immediateRender: true }, t);
    });
  }
  function header(root, t) {
    const g = typeof root === 'string' ? $(root) : root;
    const chap = $('.chap', g), tag = $('.tag', g), h1 = $('.h1', g);
    fly(chap, { x: -40 }, t, 1.0);
    tl.fromTo($('i', chap), { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: 'expo.inOut', immediateRender: true }, t + 0.1);
    fly(tag, { y: 30 }, t + 0.18, 1.0);
    if (!h1) return;
    tl.set(h1, { autoAlpha: 1 }, t);
    rise(h1, t + 0.32, 0, 1.1);
    gleam(h1, t + 1.0);
  }
  function out(sel, t, dz = 0, dur = 0.4) {
    els(sel).forEach(el => tl.to(el, { autoAlpha: 0, z: el._b.z + dz, duration: dur, ease: 'power2.in' }, t));
  }
  const mv = (t, dur, v, ease = 'power2.inOut') => tl.to(cam, { ...v, duration: dur, ease }, t);
  const cut = (t, v) => tl.set(cam, v, t);
  const fxTo = (t, dur, v, ease = 'power1.inOut') => tl.to(fx, { ...v, duration: dur, ease }, t);
  const at = (id, dx = 0, dy = 0, dz = 0) => ({ x: G[id].x + dx, y: G[id].y + dy, z: G[id].z + dz });

  const shakes = [], flashes = [], bursts = [], beats = [];
  const shake = (t, a = 1, k = 5) => shakes.push([t, a, k]);
  const flash = (t, a = 0.4, k = 6) => flashes.push([t, a, k]);
  const burst = (t, x, y, n = 120, seed = 1) => bursts.push([t, x, y, n, seed]);

  // masks start hidden so nothing pops in before its cue
  $$('.h1').forEach(h => gsap.set(h, { autoAlpha: 0 }));

  /* ======================================================================
     MAIN FILM (authored in its own clock, shifted after the hook)
     ====================================================================== */

  /* ---- A · 穿云而出 + 片头标题 (0 – 6) ---- */
  cut(0, { x: 0, y: -80, z: 7600, yaw: 0, pitch: 5, roll: -5 });
  mv(0, 2.2, { z: 1500, y: 0, pitch: 0, roll: 0 }, 'power3.out');
  mv(2.2, 3.4, { z: 1200, x: 30, yaw: -2 }, 'sine.inOut');
  fly('#rainbow', { z: -900 }, 0.6, 2.4, 'power2.out');
  fxTo(0.7, 2.0, { rv: 125 }, 'power2.inOut');
  rise('#aKick', 1.55, 0, 1.1);
  rise('.t2c', 1.85, 0.09, 1.25);
  $$('.t2c').forEach((el, i) => tl.fromTo(el, { z: -260, rotationY: (i - 2) * -9 }, { z: 0, rotationY: 0, duration: 2.0, ease: 'expo.out', immediateRender: true }, 1.85 + i * 0.09));
  gleam('.t2c', 2.9, 0.07);
  burst(2.6, 960, 520, 110, 3);
  rise('#aEng', 2.6, 0, 1.1);
  fly('#datepill', { y: 40 }, 2.95, 1.1);
  fxTo(2.5, 0.35, { flare: 1 }); fxTo(2.5, 1.8, { flareX: 2300 }, 'power1.inOut'); fxTo(3.6, 0.7, { flare: 0 });

  // whip pan → 虎虎
  mv(5.4, 1.0, { ...at('gB', -100, -100, 1330) }, 'power4.inOut');
  mv(5.4, 0.5, { yaw: 14, roll: -5 }, 'power2.in');
  mv(5.9, 0.7, { yaw: 3, roll: 0 }, 'power3.out');
  fxTo(5.45, 0.45, { speed: 1 }, 'power2.in'); fxTo(5.9, 0.5, { speed: 0 }, 'power2.out');
  fxTo(5.9, 0.8, { hud: 1 });
  tl.to('#rainbow', { autoAlpha: 0, duration: 0.5 }, 5.5);

  /* ---- B · 青鸟飞鱼-虎虎 (6.4 – 15) ---- */
  fly('#bloomB', { scale: 0.5 }, 5.9, 1.6, 'power2.out');
  fly('#hugeB', { z: -500, x: 260 }, 6.0, 2.0);
  tl.fromTo('#huhuCard', { autoAlpha: 1, clipPath: 'inset(100% 0% 0% 0% round 26px)' }, { clipPath: 'inset(-25% -25% -30% -25% round 26px)', duration: 1.4, ease: 'expo.inOut', immediateRender: true }, 6.05);
  tl.fromTo('#huhuCard .pic', { scale: 1.2 }, { scale: 1, duration: 2.4, ease: 'expo.out', immediateRender: true }, 6.05);
  header('#gB', 6.45);
  rise('#nameB', 6.95, 0.06, 1.15);
  gleam('#nameB', 7.9, 0.05);
  rise('#gB .role', 7.6, 0, 1.0);
  fly('#gB .cred', { x: -60 }, 8.1, 1.1, EASE, 0.35);
  mv(6.4, 5.0, { ...at('gB', 60, -100, 1270), yaw: -3 }, 'sine.inOut');
  mv(11.4, 3.0, { ...at('gB', 440, 0, 1000), yaw: -2 }, 'power2.inOut');

  // holi powder → 彩虹跑
  const powderCols = ['#ff5fae', '#ffd56a', '#9b6cff', '#4cc7ff', '#ff9a4a', '#6fdc8c', '#ff7ad6', '#5f8bff', '#ffe07a'];
  const holis = [];
  const holi = (t, cx, cy, seed) => holis.push([t, cx, cy, seed]);
  holi(14.55, 960, 600, 11);

  /* ---- C · 亲子彩虹跑 (15 – 23.4) ---- */
  cut(15.0, { ...at('gC', -620, 215, 760), yaw: -11, pitch: 0, roll: 3 });
  unveil('#run1', 14.8);
  mv(15.0, 2.2, { ...at('gC', -160, 215, 840), yaw: 2, roll: 0 }, 'sine.inOut');
  unveil('#run2', 16.9, -1);
  mv(17.2, 1.5, { ...at('gC', 40, -60, 1350), yaw: 0 }, 'power3.inOut');
  header('#gC', 17.6);
  mv(18.7, 2.4, { ...at('gC', 60, -60, 1300), yaw: 0.5 }, 'sine.inOut');
  mv(21.1, 2.0, { ...at('gC', 420, 250, 860), yaw: -5 }, 'power2.inOut');

  // barrel-roll whip → 带娃蹦迪
  mv(22.9, 0.9, { ...at('gD', 0, -60, 1420), pitch: 0, yaw: 0 }, 'power4.inOut');
  tl.fromTo(cam, { roll: 0 }, { roll: 360, duration: 0.9, ease: 'power3.inOut', immediateRender: false }, 22.9);
  cut(23.81, { roll: 0 });
  flash(23.36, 0.5, 5);
  fxTo(22.95, 0.45, { speed: 1 }, 'power2.in'); fxTo(23.4, 0.45, { speed: 0 });
  fxTo(23.2, 0.4, { night: 1 });

  /* ---- D · 带娃蹦迪 (23.8 – 30.9) ---- */
  unveil('#party1', 23.5);
  unveil('#party2', 23.8, -1);
  header('#gD', 24.1);
  fly('#eq', { y: 260 }, 23.9, 1.2);
  for (let b = 24.5; b < 30.4; b += 0.5) beats.push(b);
  for (let b = 25.0; b < 30.4; b += 1.0) flash(b, 0.06, 9);
  fxTo(23.9, 0.5, { sway: 1 }); fxTo(30.2, 0.5, { sway: 0 });
  mv(23.8, 6.6, { ...at('gD', 30, -60, 1400), yaw: 0.6 }, 'sine.inOut');

  // light sweep → 精彩演出
  tl.set('#sweep', { autoAlpha: 1 }, 30.3);
  tl.fromTo(fx, { sweepX: -5600 }, { sweepX: -1840, duration: 0.45, ease: 'power2.in', immediateRender: false }, 30.3);
  tl.to(fx, { sweepX: 1920, duration: 0.6, ease: 'power2.out' }, 30.85);
  tl.set('#sweep', { autoAlpha: 0 }, 31.5);
  tl.set(fx, { night: 0 }, 30.8);

  /* ---- E · 精彩演出不断 (30.8 – 37.6) ---- */
  cut(30.8, { ...at('gE', -880, -90, 1260), yaw: -6, pitch: 0, roll: 0 });
  mv(30.8, 6.7, { ...at('gE', 1520, -20, 1160), yaw: 7 }, 'power1.inOut');
  header('#gE', 30.95);
  ['#tile1', '#tile2', '#tile3', '#tile4'].forEach((s, i) => {
    unveil(s, 31.3 + i * 1.15, 1);
    tl.fromTo(`${s} .cap`, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.0, ease: EASE, immediateRender: true }, 31.9 + i * 1.15);
  });

  // frost flash → 冰雪女王
  flash(37.55, 1.0, 3.0);
  tl.set(fx, { ice: 1 }, 37.6);

  /* ---- F · 冰雪女王 (37.6 – 44.4) ---- */
  cut(37.6, { ...at('gF', 20, -1350, 1420), pitch: -40, yaw: 0, roll: 0 });
  mv(37.6, 2.4, { ...at('gF', 20, -90, 1360), pitch: 0 }, 'power3.inOut');
  mv(40.0, 4.4, { ...at('gF', 30, -95, 1270), yaw: 0.5 }, 'sine.inOut');
  unveil('#frozen1', 37.65);
  unveil('#frozen2', 37.95, -1);
  fly('#gF .flake', { scale: 0.2, rotation: -60 }, 37.7, 1.6, EASE, 0.08);
  header('#gF', 39.2);

  /* ---- H · 拉远回望 + 落版 (44.4 – 52) ---- */
  fxTo(44.2, 0.6, { hud: 0 });
  mv(44.4, 2.8, { x: 10900, y: -3200, z: 13600, yaw: 0, pitch: -12, roll: 0 }, 'power3.inOut');
  mv(47.2, 4.8, { x: 10700, y: -3400, z: 14400, yaw: 0, pitch: -13 }, 'sine.out');
  tl.to('#rainbow', { autoAlpha: 1, duration: 1.0 }, 44.8);
  tl.fromTo('#lockup', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, immediateRender: true }, 46.3);
  tl.fromTo('#view3d', { opacity: 1 }, { opacity: 0.08, duration: 1.2, ease: 'power2.inOut', immediateRender: false }, 46.2);
  tl.fromTo('#lockup .lg', { y: -30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, ease: EASE, immediateRender: true }, 46.4);
  rise('#lockup .kicker', 46.55, 0, 1.1);
  rise('#lockup .mega', 46.8, 0.09, 1.3);
  gleam('#lockup .mega', 47.8, 0.07);
  burst(47.3, 960, 420, 140, 7);
  rise('#lockup .eng', 47.3, 0, 1.1);
  tl.fromTo('#lockup .datepill', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: EASE, immediateRender: true }, 47.55);
  tl.fromTo('#lockup .bar', { y: 120, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.3, ease: EASE, immediateRender: true }, 47.8);

  tl.fromTo('#disc1', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: true }, 15.1);
  tl.to('#disc1', { autoAlpha: 0, duration: 0.4 }, 44.1);

  /* ---- I · 开场钩子 “听说 吉安周末有大事发生？” (absolute 0 – 3) ----
     Shift the main film so it starts after the hook. Event lists stay in main time,
     so the hook uses negative main times. */
  tl.shiftChildren(INTRO);
  tl.set(cam, { x: 40, y: -1510, z: 9000 + 1320, yaw: -2, pitch: 1, roll: 1.2 }, 0);
  tl.to(cam, { x: 20, y: -1500, z: 9000 + 1100, yaw: 1, roll: -0.4, duration: 2.4, ease: 'sine.inOut' }, 0);
  tl.to(cam, { x: 0, y: -80, z: 7600, yaw: 0, pitch: 5, roll: -5, duration: 0.6, ease: 'power2.in' }, 2.4);
  rise('#iTing', 0.15, 0, 0.9);
  rise('#iL1', 0.4, 0.07, 1.0);
  rise('#iL2', 0.9, 0.06, 1.0);
  gleam('#iL1', 1.3, 0.05);
  tl.fromTo('#iQ', { autoAlpha: 0, z: 140 + 700, rotation: -40 }, { autoAlpha: 1, z: 140, rotation: 10, duration: 0.55, ease: 'expo.out', immediateRender: true }, 1.4);
  tl.fromTo('#iRing', { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 1.0, ease: 'expo.out', immediateRender: true }, 1.45);
  shake(1.5 - INTRO, 0.35);
  out(['#iTing', '#iL1', '#iL2', '#iQ', '#iRing'], 2.5, 320, 0.3);
  fxTo(2.45, 0.55, { speed: 1 }, 'power2.in');
  fxTo(3.0, 0.6, { speed: 0 }, 'power2.out');

  tl.set({}, {}, DURATION);

  // fast camera moves get sub-frame motion blur in render.cjs (absolute times)
  window.FAST = [[2.3, 3.0], ...[[0, 2.3], [5.3, 6.6], [14.5, 15.3], [22.8, 24.0], [30.3, 31.4], [37.4, 37.8], [44.4, 47.3]]
    .map(([a, b]) => [a + INTRO, b + INTRO])];

  const chapters = [[6.0, 'STAR GUEST'], [15.0, 'RAINBOW RUN'], [23.5, 'PARTY NIGHT'], [30.8, 'SHOWTIME'], [37.6, 'FROZEN PARTY'], [44.4, '']];

  /* ======================================================================
     PARTICLES (screen-space canvases, pure functions of t)
     ====================================================================== */
  const cb = $('#fxBack').getContext('2d');
  const cf = $('#fxFront').getContext('2d');
  const mk = (n, seed, f) => { const r = rng(seed); return Array.from({ length: n }, (_, i) => f(r, i)); };

  // soft sprites
  function sprite(size, stops) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return c;
  }
  const BOKEH_T = ['255,255,255', '255,214,140', '170,215,255', '255,180,230', '200,190,255'];
  const NEON_T = ['255,80,200', '80,220,255', '255,220,120', '150,120,255'];
  const bokehSpr = t => sprite(128, [[0, `rgba(${t},.55)`], [0.72, `rgba(${t},.42)`], [0.86, `rgba(${t},.6)`], [1, `rgba(${t},0)`]]);
  const bokehS = BOKEH_T.map(bokehSpr), neonS = NEON_T.map(bokehSpr);
  const glowS = ['255,246,214', '255,255,255', '255,200,120', '190,225,255'].map(t => sprite(64, [[0, `rgba(${t},1)`], [0.25, `rgba(${t},.85)`], [1, `rgba(${t},0)`]]));

  const bokehBack = mk(30, 11, r => ({ x: r() * W, y: r() * H, r: 8 + r() * 26, vx: (r() - 0.5) * 14, vy: -6 - r() * 12, a: 0.25 + r() * 0.45, s: (r() * 5) | 0, ph: r() * 6 }));
  const bokehFront = mk(9, 12, r => ({ x: r() * W, y: r() * H, r: 70 + r() * 120, vx: (r() - 0.5) * 20, vy: -4 - r() * 8, a: 0.10 + r() * 0.12, s: (r() * 5) | 0, ph: r() * 6 }));
  function bokehFx(ctx, list, sprs, t, a, pulse = 0) {
    if (a <= 0) return;
    for (const p of list) {
      const x = ((p.x + p.vx * t) % (W + 400) + W + 400) % (W + 400) - 200;
      const y = ((p.y + p.vy * t) % (H + 400) + H + 400) % (H + 400) - 200;
      const r = p.r * (1 + pulse * 0.25);
      ctx.globalAlpha = a * p.a * (0.75 + 0.25 * Math.sin(t * 1.3 + p.ph));
      ctx.drawImage(sprs[p.s % sprs.length], x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  // glitter bursts (replaces confetti)
  const burstP = {};
  bursts.forEach(([t, , , n, seed]) => {
    burstP[t] = mk(n, seed, r => {
      const a = r() * Math.PI * 2, s = 250 + r() * 900;
      return { vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - 120, sz: 6 + r() * 16, c: (r() * 4) | 0, ph: r() * 6, tw: 6 + r() * 10 };
    });
  });
  function glitterFx(ctx, t) {
    ctx.globalCompositeOperation = 'lighter';
    for (const [tb, cx, cy] of bursts) {
      const u = t - tb; if (u < 0 || u > 3.2) continue;
      const damp = (1 - Math.exp(-2.2 * u)) / 2.2;
      for (const p of burstP[tb]) {
        const x = cx + p.vx * damp, y = cy + p.vy * damp + 60 * u * u;
        const tw = 0.55 + 0.45 * Math.sin(u * p.tw + p.ph);
        ctx.globalAlpha = clamp((3.2 - u) / 1.4) * tw * 0.9;
        const s = p.sz * (0.6 + 0.4 * tw);
        ctx.drawImage(glowS[p.c], x - s, y - s, s * 2, s * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  const sparks = mk(22, 71, r => ({ x: 160 + r() * (W - 320), y: 120 + r() * (H - 360), ph: r() * 6, s: 10 + r() * 22, sp: 1.5 + r() * 2.5 }));
  function star4(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
  }
  function sparklesFx(ctx, t, a) {
    if (a <= 0) return;
    ctx.fillStyle = '#fff';
    for (const p of sparks) {
      const k = Math.max(0, Math.sin(t * p.sp + p.ph));
      ctx.globalAlpha = a * k * 0.9; star4(ctx, p.x, p.y, p.s * (0.5 + k * 0.6));
      ctx.globalAlpha = a * k * 0.5; ctx.drawImage(glowS[0], p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
    }
    ctx.globalAlpha = 1;
  }

  const holiP = {};
  holis.forEach(([t, , , seed]) => {
    holiP[t] = mk(80, seed, r => ({ a: r() * Math.PI * 2, s: 300 + r() * 1700, s0: 260 + r() * 420, g: 900 + r() * 2200, rot: r() * 6.3, rs: (r() - 0.5) * 1.2, c: (r() * powderCols.length) | 0, dl: r() * 0.14 }));
  });
  let tints = [];
  function buildTints() {
    tints = powderCols.map((col, i) => {
      const im = cloudImgs[i % 5], cv = document.createElement('canvas');
      cv.width = im.width >> 1; cv.height = im.height >> 1;
      const x = cv.getContext('2d');
      x.drawImage(im, 0, 0, cv.width, cv.height);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0, cv.width, cv.height);
      return cv;
    });
  }
  function holiFx(ctx, t) {
    for (const [tb, cx, cy] of holis) {
      const u = t - tb; if (u < 0 || u > 1.7 || !tints.length) continue;
      const fade = u < 0.55 ? 1 : clamp(1 - (u - 0.55) / 0.45);
      for (const p of holiP[tb]) {
        const uu = u - p.dl; if (uu <= 0) continue;
        const k = (1 - Math.exp(-3.2 * uu)) / 3.2;
        const x = cx + Math.cos(p.a) * p.s * k, y = cy + Math.sin(p.a) * p.s * k * 0.8;
        const w = p.s0 + p.g * k * 1.3, im = tints[p.c], h = w * im.height / im.width;
        ctx.save(); ctx.globalAlpha = Math.min(1, uu / 0.08) * Math.pow(fade, 2.5) * 0.95;
        ctx.translate(x, y); ctx.rotate(p.rot + p.rs * u); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
      }
      const cover = clamp((u - 0.22) / 0.18) * fade;
      if (cover > 0) {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#ff8cc8'); g.addColorStop(0.5, '#b393ff'); g.addColorStop(1, '#ffd98a');
        ctx.globalAlpha = cover * 0.9; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;
    }
  }

  const powder = mk(22, 31, r => ({ x: r() * W, y: r() * (H + 700), v: 40 + r() * 80, r: 120 + r() * 260, ph: r() * 6, c: powderCols[(r() * powderCols.length) | 0], a: 0.12 + r() * 0.12 }));
  function powderFx(ctx, t, a) {
    if (a <= 0) return;
    for (const p of powder) {
      const y = H + 350 - ((p.y + p.v * t) % (H + 700));
      const x = p.x + Math.sin(t * 0.5 + p.ph) * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, p.r);
      g.addColorStop(0, p.c); g.addColorStop(1, p.c + '00');
      ctx.globalAlpha = a * p.a; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const bubbles = mk(22, 51, r => ({ x: r() * W, y: r() * (H + 300), v: 40 + r() * 70, r: 16 + r() * 64, ph: r() * 6, sw: 20 + r() * 60 }));
  function bubblesFx(ctx, t, a) {
    if (a <= 0) return;
    for (const p of bubbles) {
      const y = H + 150 - ((p.y + p.v * t) % (H + 300));
      const x = p.x + Math.sin(t * 0.8 + p.ph) * p.sw;
      ctx.save(); ctx.globalAlpha = a * 0.85;
      const g = ctx.createRadialGradient(x, y, p.r * 0.2, x, y, p.r);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.78, 'rgba(210,240,255,.08)'); g.addColorStop(1, 'rgba(255,200,240,.28)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, p.r * 0.72, Math.PI * 1.1, Math.PI * 1.4);
      ctx.lineWidth = Math.max(1.5, p.r * 0.07); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
      ctx.restore();
    }
  }
  const snow = mk(150, 61, r => { const d = 0.25 + r() * 0.75; return { x: r() * W, y: r() * (H + 100), d, v: 50 + d * 140, ph: r() * 6, sw: 10 + r() * 40, r: 2 + d * 6 }; });
  function snowFx(ctx, t, a) {
    if (a <= 0) return;
    for (const p of snow) {
      const y = ((p.y + p.v * t) % (H + 100)) - 50;
      const x = p.x + Math.sin(t * 0.9 + p.ph) * p.sw;
      ctx.globalAlpha = a * (0.4 + p.d * 0.6);
      const s = p.r * 2.2; ctx.drawImage(glowS[1], x - s, y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }
  const lines = mk(70, 81, r => ({ a: r() * Math.PI * 2, r0: r(), len: 160 + r() * 420, w: 1 + r() * 2, sp: 1.5 + r() * 2 }));
  function speedFx(ctx, t, a) {
    if (a <= 0.01) return;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    for (const p of lines) {
      const r = 300 + ((p.r0 + t * p.sp) % 1) * 1100;
      ctx.globalAlpha = a * 0.32; ctx.lineWidth = p.w;
      ctx.beginPath(); ctx.moveTo(Math.cos(p.a) * r, Math.sin(p.a) * r);
      ctx.lineTo(Math.cos(p.a) * (r + p.len), Math.sin(p.a) * (r + p.len)); ctx.stroke();
    }
    ctx.restore();
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  const sky = { grad: $('#sky .grad'), sun: $('#sky .sun'), rays: $('#sky .rays') };
  const night = $('#night'), beams = $$('#night .beam'), ice = $('#ice');
  const flashEl = $('#flash'), flareEl = $('#flare'), flareCore = $('#flare .core'), flareStreak = $('#flare .streak'), ghosts = $$('#flare .ghost');
  const hud = $('#hud'), haze = $('#haze'), sweepI = $('#sweep i'), rainbowImg = $('#rainbow img');
  const chNum = $('#hud .chapters .num'), chLbl = $('#hud .chapters .lbl'), chBars = $$('#hud .chapters .bars u');
  const partyEls = [$('#party1'), $('#party2')], flakes = $$('#gF .flake');
  const bloomB = $('#bloomB'), iQ = $('#iQ'), iRing = $('#iRing');

  const sumEvents = (list, t) => { let a = 0; for (const [ti, amp, k] of list) if (t >= ti && t < ti + 2.5) a += amp * Math.exp(-(t - ti) * k); return a; };
  const beatPulse = t => { let p = 0; for (const b of beats) if (t >= b && t < b + 0.5) p = Math.exp(-(t - b) * 7); return p; };

  // world point -> camera space (same maths as the CSS transform on #world)
  function toCam(px, py, pz, c) {
    const dx = px - c.x, dy = py - c.y, dz = pz - c.z;
    const a = c.yaw * D2R, b = c.pitch * D2R, g = c.roll * D2R;
    const x1 = dx * Math.cos(a) + dz * Math.sin(a), z1 = -dx * Math.sin(a) + dz * Math.cos(a);
    const y2 = dy * Math.cos(b) - z1 * Math.sin(b), z2 = dy * Math.sin(b) + z1 * Math.cos(b);
    return { x: x1 * Math.cos(g) - y2 * Math.sin(g), y: x1 * Math.sin(g) + y2 * Math.cos(g), d: -z2 };
  }
  // clouds nearer than the plane the camera is "about" draw in front of the world
  const focusPlan = [[0, 'gA'], [5.7, 'gB'], [15.0, 'gC'], [23.35, 'gD'], [30.8, 'gE'], [37.6, 'gF']];
  function drawClouds(t, c) {
    let fid = 'gA';
    for (const [ft, id] of focusPlan) if (t >= ft) fid = id;
    const f = G[fid];
    const fd = t < 0 ? toCam(0, -1500, 9000, c).d - 150 : t > 44.6 ? 0 : toCam(f.x, f.y, f.z, c).d - 150;
    const list = [];
    for (const k of clouds) {
      const q = toCam(k.x, k.y, k.z, c);
      if (q.d < 300) continue;
      const sc = P / q.d, w = k.w * sc;
      if (w < 4) continue;
      const h = w * k.im.height / k.im.width;
      const sx = W / 2 + q.x * sc, sy = H / 2 + q.y * sc;
      if (sx + w / 2 < 0 || sx - w / 2 > W || sy + h / 2 < 0 || sy - h / 2 > H) continue;
      list.push({ k, q, w, h, sx, sy });
    }
    list.sort((a, b) => b.q.d - a.q.d);
    for (const o of list) {
      const ctx = o.q.d < fd ? cf : cb;
      // atmospheric perspective: far clouds thin out into the haze
      const far = clamp((o.q.d - 9000) / 14000);
      ctx.globalAlpha = o.k.op * clamp((o.q.d - 300) / 1100) * (1 - fx.night * 0.88) * (1 - far * 0.45);
      ctx.save(); ctx.translate(o.sx, o.sy); ctx.rotate(c.roll * D2R);
      ctx.drawImage(o.k.im, -o.w / 2, -o.h / 2, o.w, o.h); ctx.restore();
    }
    cb.globalAlpha = 1; cf.globalAlpha = 1;
  }

  function render(T) {
    T = clamp(T, 0, DURATION);
    tl.seek(T, true);
    const t = T - INTRO; // main-film clock (negative during the hook)

    // camera with gentle impacts, handheld drift and beat bumps
    const s = sumEvents(shakes, t);
    const bp = beatPulse(t);
    const n1 = Math.sin(t * 61.3) + Math.sin(t * 37.1 + 1.3) * 0.7;
    const n2 = Math.sin(t * 53.7 + 2.1) + Math.sin(t * 29.3) * 0.6;
    const hx = Math.sin(t * 0.9) * 5 + Math.sin(t * 1.7 + 1) * 2.5;
    const hy = Math.sin(t * 1.1 + 2) * 4 + Math.sin(t * 2.3) * 1.5;
    const x = cam.x + n1 * s * 14 + hx;
    const y = cam.y + n2 * s * 10 + hy;
    const z = cam.z - bp * 55;
    const roll = cam.roll + Math.sin(t * 0.7) * 0.25 + Math.sin(t * 2.6) * 1.6 * fx.sway;
    const yaw = cam.yaw, pitch = cam.pitch;
    world.style.transform =
      `translateZ(${P}px) rotateZ(${roll}deg) rotateX(${pitch}deg) rotateY(${yaw}deg) translate3d(${-x}px,${-y}px,${-z}px)`;

    // sky parallax follows the camera
    sky.grad.style.transform = `translateY(${pitch * 26 - y * 0.05}px) rotate(${-roll * 0.6}deg)`;
    sky.sun.style.transform = `translate(${-yaw * 34 - x * 0.004}px, ${pitch * 26}px)`;
    sky.rays.style.transform = `translate(${-yaw * 34 - x * 0.004}px, ${pitch * 26}px) rotate(${t * 2.5}deg)`;
    night.style.opacity = fx.night;
    ice.style.opacity = fx.ice;
    beams.forEach((b, i) => { b.style.transform = `rotate(${Math.sin(t * 1.2 + i * 1.7) * 26}deg)`; b.style.opacity = 0.35 + 0.3 * bp; });
    rainbowImg.style.setProperty('--rv', fx.rv + '%');

    // procedural details
    gsap.set(bloomB, { rotation: t * 4 });
    flakes.forEach((f, i) => gsap.set(f, { rotation: t * (i % 2 ? -16 : 12) }));
    if (t > -1.6 && t < 0) gsap.set(iRing, { rotation: (t + 1.6) * 40 });
    if (t > 23.4 && t < 31) {
      partyEls.forEach(el => gsap.set(el, { scale: 1 + bp * 0.025 }));
      eqBars.forEach((b, i) => {
        const v = 0.2 + 0.8 * Math.abs(Math.sin(t * (2.6 + (i % 7) * 0.45) + i * 1.1)) * (0.4 + 0.6 * bp);
        b.style.height = (30 + v * 280).toFixed(0) + 'px';
      });
    }

    // overlays
    flashEl.style.opacity = clamp(sumEvents(flashes, t));
    haze.style.opacity = t < 0 ? clamp((t + 0.35) / 0.35) * 0.85 : 0.85 * Math.pow(1 - clamp(t / 1.3), 2);
    flareEl.style.opacity = fx.flare;
    flareCore.style.left = fx.flareX + 'px'; flareCore.style.top = fx.flareY + 'px';
    flareStreak.style.transform = `translateY(${fx.flareY - 540}px)`;
    ghosts.forEach((g, i) => {
      const k = [0.45, 0.95, 1.35][i];
      const gx = W / 2 + (W / 2 - fx.flareX) * k, gy = H / 2 + (H / 2 - fx.flareY) * k;
      g.style.transform = `translate(${gx - g.offsetWidth / 2}px, ${gy - g.offsetHeight / 2}px)`;
    });
    sweepI.style.transform = `translateX(${fx.sweepX}px) skewX(-14deg)`;
    hud.style.opacity = fx.hud;

    // chapter indicator
    let ci = 0;
    for (let i = 0; i < chapters.length - 1; i++) if (t >= chapters[i][0]) ci = i;
    const p = clamp((t - chapters[ci][0]) / (chapters[ci + 1][0] - chapters[ci][0]));
    chNum.textContent = `0${ci + 1} / 05`;
    chLbl.textContent = chapters[ci][1];
    chBars.forEach((u, i) => { u.style.transform = `scaleX(${i < ci ? 1 : i === ci ? p : 0})`; });

    // particles
    cb.clearRect(0, 0, W, H); cf.clearRect(0, 0, W, H);
    drawClouds(t, { x, y, z, yaw, pitch, roll });
    const day = 1 - fx.night;
    bokehFx(cb, bokehBack, bokehS, t, 0.8 * day * (t > 44.6 ? 0.5 : 1));
    bokehFx(cf, bokehFront, bokehS, t, 0.9 * day * (1 - fx.ice * 0.4));
    bokehFx(cb, bokehBack, neonS, t, fx.night, bp);
    bokehFx(cf, bokehFront, neonS, t, fx.night * 1.4, bp);
    powderFx(cb, t, env(t, 14.9, 23.2, 0.5, 0.6));
    bubblesFx(cf, t, env(t, 30.9, 37.7, 0.6, 0.4));
    snowFx(cf, t, env(t, 37.6, 44.8, 0.3, 0.6));
    glitterFx(cf, t);
    sparklesFx(cf, t, Math.max(env(t, 2.8, 5.6, 0.6, 0.6) * 0.7, env(t, 47.5, 52.5, 0.6, 0.5) * 0.8));
    speedFx(cf, t, fx.speed);
    holiFx(cf, t);
  }

  /* ---------------- boot ---------------- */
  async function ready() {
    await Promise.all(['300 20px NS', '500 20px NS', '700 20px NS', '900 20px NS', '600 20px MS', '700 20px MS', '800 20px MS'].map(f => document.fonts.load(f, '亲子彩虹跑ABC0123')));
    await document.fonts.ready;
    await Promise.all(cloudImgs.map(im => im.decode().catch(() => {})));
    buildTints();
    await Promise.all($$('img').map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
    await Promise.all($$('img').map(img => (img.naturalWidth && img.decode ? img.decode().catch(() => {}) : null)));
  }

  window.DURATION = DURATION;
  window.renderAt = t => render(t);

  ready().then(() => {
    render(0);
    window.__ready = true;
    if (RENDER) return;
    const stage = $('#stage');
    const fit = () => { const k = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${k})`; };
    addEventListener('resize', fit); fit();
    const fixed = params.get('t');
    if (fixed !== null) { render(+fixed); return; }
    let t0 = performance.now(), paused = false, tp = 0;
    addEventListener('keydown', e => {
      if (e.code === 'Space') { paused = !paused; if (!paused) t0 = performance.now() - tp * 1000; }
      if (e.code === 'ArrowRight') t0 -= 2000;
      if (e.code === 'ArrowLeft') t0 += 2000;
    });
    const loop = now => {
      if (!paused) { tp = ((now - t0) / 1000) % DURATION; render(tp); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
})();
