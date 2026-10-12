/* 派星天护节 · 亲子彩虹跑 — 3D camera promo
 * One deterministic GSAP timeline drives a CSS-3D world through a virtual camera.
 * render(t) is pure in t, so the page can be previewed live or rendered frame by frame.
 * Cuts sit on a 120 BPM grid (0.5 s per beat) so music can be dropped in later.
 */
(() => {
  'use strict';

  const P = 1200, W = 1920, H = 1080, D2R = Math.PI / 180;
  const INTRO = 3;            // hook shot before the main film
  const MAIN = 62;
  const DURATION = INTRO + MAIN;
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  if (RENDER) document.body.classList.add('render');

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const world = $('#world');
  const cam = { x: 0, y: 0, z: 7600, yaw: 0, pitch: 0, roll: 0 };
  const fx = { speed: 0, night: 0, ice: 0, flare: 0, flareX: -300, sway: 0, hud: 0 };
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

  /* ---------------- place the world ---------------- */
  const num = (v, n) => { const a = (v || '').split(',').map(Number); while (a.length < n) a.push(0); return a; };
  const G = {};
  $$('.g, .ring').forEach(g => {
    const [x, y, z] = num(g.dataset.p, 3);
    g._b = { x, y, z };
    gsap.set(g, { x, y, z });
    if (g.id) G[g.id] = g._b;
  });
  $$('.slot').forEach((s, i) => gsap.set(s, { rotationY: i * 60 }));
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

  // rainbow arcs: prepare draw-on
  $$('#rainbow .arc').forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p._L = L; });

  // 100% badge starburst
  (() => {
    const pts = []; const n = 22;
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? 84 : 98, a = (i / (n * 2)) * Math.PI * 2;
      pts.push((Math.cos(a) * r).toFixed(1) + ',' + (Math.sin(a) * r).toFixed(1));
    }
    $('#badgeSvg').innerHTML =
      `<polygon points="${pts.join(' ')}" fill="url(#bg)" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>` +
      `<circle r="70" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-dasharray="6 8"/>`;
  })();

  // EQ bars
  const eq = $('#eq');
  for (let i = 0; i < 28; i++) eq.appendChild(document.createElement('i'));
  const eqBars = [...eq.children];

  /* ---------------- clouds: canvas sprites projected through the camera ---------------- */
  const cloudImgs = [1, 2, 3, 4, 5].map(i => { const im = new Image(); im.src = `assets/cloud${i}.png`; return im; });
  const clouds = [];
  const cloud = (x, y, z, w, op = 1, v = 1) => clouds.push({ x, y, z, w, op, im: cloudImgs[(v - 1) % 5] });
  (() => {
    const r = rng(42);
    // fly-through corridor for the opening
    for (let i = 0; i < 13; i++) {
      const z = 7000 - i * 380;
      const side = i % 2 ? 1 : -1;
      const near = i % 4 === 1;
      cloud(near ? (r() - 0.5) * 500 : side * (500 + r() * 1100), (r() - 0.5) * 900, z, 1700 + r() * 1500, 1, 1 + (i % 5));
    }
    // backdrop for the opening hook (text plane at z 9000)
    [[-1700, -820, 8200, 3000], [1600, -880, 8000, 3200], [0, -620, 7300, 4600], [-2100, -2350, 8300, 2300], [2100, -2250, 8500, 2100], [2000, -950, 9700, 1500], [-2100, -1800, 9900, 1500]].forEach(([x, y, z, w], i) =>
      cloud(x, y, z, w, 1, 1 + (i % 5)));
    // distant clouds behind every cluster
    const centers = [[0, 0], [4200, -800], [8600, -300], [13000, -600], [17400, -600], [21800, -600], [26200, -600], [26200, -5200]];
    centers.forEach(([cx, cz], k) => {
      for (let j = 0; j < 4; j++) {
        cloud(cx + (j - 1.5) * 1900 + (r() - 0.5) * 600, (j % 2 ? -900 : 800) + (r() - 0.5) * 500, cz - 2200 - r() * 1800, 2600 + r() * 2200, 0.9, 1 + ((k + j) % 5));
      }
    });
    // foreground passers (parallax during whips)
    [[1800, 500, 250], [2900, -600, 120], [10600, 900, 600], [24000, 650, 120], [23000, -700, 60], [15200, 800, 100]].forEach(([x, y, z], i) =>
      cloud(x, y, z, 1600 + i * 120, 0.95, 1 + (i % 5)));
    // cloud floor far below the path
    for (let x = -4000; x <= 32000; x += 1700) {
      cloud(x + (r() - 0.5) * 800, 1250 + r() * 300, -400 - r() * 2600, 2800 + r() * 1600, 0.95, 1 + Math.floor(r() * 5));
    }
  })();

  /* ---------------- helpers for the timeline ---------------- */
  const els = sel => [].concat(sel).flatMap(s => (typeof s === 'string' ? $$(s) : [s]));
  function fly(sel, from, t, dur = 0.8, ease = 'back.out(1.4)', stagger = 0) {
    els(sel).forEach((el, i) => {
      const b = el._b, f = {}, to = { duration: dur, ease, immediateRender: true };
      for (const k of ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotation']) { f[k] = b[k] + (from[k] || 0); to[k] = b[k]; }
      f.scale = b.scale * (from.scale ?? 1); to.scale = b.scale;
      f.autoAlpha = from.autoAlpha ?? 0; to.autoAlpha = 1;
      tl.fromTo(el, f, to, t + i * stagger);
    });
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
  const burst = (t, x, y, n = 140, seed = 1) => bursts.push([t, x, y, n, seed]);

  /* ======================================================================
     TIMELINE
     ====================================================================== */

  /* ---- A · 穿云而出 + 片头标题 (0 – 6.3) ---- */
  cut(0, { x: 0, y: -80, z: 7600, yaw: 0, pitch: 5, roll: -5 });
  mv(0, 2.1, { z: 1500, y: 0, pitch: 0, roll: 0 }, 'power3.out');
  mv(2.1, 3.2, { z: 1170, x: 40, yaw: -2.5 }, 'sine.inOut');
  $$('#rainbow .arc').forEach((p, i) =>
    tl.fromTo(p, { strokeDashoffset: p._L }, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.out', immediateRender: true }, 0.7 + i * 0.07));
  fly('#rainbow', { z: -800 }, 0.6, 1.6, 'power2.out');
  fly('.t1c', { z: 900, y: -120 }, 1.45, 0.55, 'back.out(2)', 0.07);
  shake(1.95, 0.45);
  (() => {
    const r = rng(9);
    $$('.t2c').forEach((el, i) => fly(el, {
      z: -1700, x: (r() - 0.5) * 900, y: (r() - 0.5) * 700,
      rotationY: (r() < 0.5 ? -1 : 1) * (80 + r() * 40), rotationX: (r() - 0.5) * 80, scale: 0.6,
    }, 2.0 + i * 0.1, 0.8, 'back.out(1.5)'));
  })();
  shake(2.78, 1.1); flash(2.78, 0.35); burst(2.78, 960, 560, 170, 3);
  fly('.acc', { scale: 0, rotation: -120 }, 2.85, 0.5, 'back.out(2.5)', 0.04);
  fly('#datepill', { rotationX: -90, y: 80 }, 3.3, 0.7, 'back.out(1.6)');
  fxTo(2.7, 0.25, { flare: 1 }); fxTo(2.7, 1.3, { flareX: 2300 }, 'power1.inOut'); fxTo(3.5, 0.6, { flare: 0 });

  // whip pan → 虎虎
  mv(5.3, 1.0, { ...at('gB', -100, 0, 1330) }, 'power4.inOut');
  mv(5.3, 0.5, { yaw: 15, roll: -7 }, 'power2.in');
  mv(5.8, 0.7, { yaw: 3, roll: 0 }, 'power3.out');
  fxTo(5.35, 0.45, { speed: 1 }, 'power2.in'); fxTo(5.8, 0.5, { speed: 0 }, 'power2.out');
  fxTo(5.9, 0.6, { hud: 1 });
  tl.to('#rainbow', { autoAlpha: 0, duration: 0.5 }, 5.5);
  tl.to('#rainbow', { autoAlpha: 1, duration: 0.8 }, 56.4);

  /* ---- B · 青鸟飞鱼-虎虎 (6.3 – 13.75) ---- */
  fly('#raysB', { scale: 0.4 }, 5.9, 1.2, 'power2.out');
  fly('#hugeB', { z: -700, x: 300 }, 6.0, 1.2, 'power3.out');
  fly('#huhuCard', { x: 700, z: -900, rotationY: -60 }, 5.95, 1.05, 'power3.out');
  fly('#pillB', { x: -260 }, 6.5, 0.6, 'power3.out');
  tl.fromTo('#nameB span', { y: -170, autoAlpha: 0, scale: 1.7 },
    { y: 0, autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)', stagger: 0.06, immediateRender: true }, 6.8);
  shake(7.32, 0.5);
  fly('#nametag', { x: -120, scale: 0.4, rotation: -12 }, 7.35, 0.6, 'back.out(2)');
  fly('.stripB', { x: -520, rotationY: 65 }, 7.9, 0.6, 'power3.out', 0.5);
  shake(8.15, 0.25); shake(8.65, 0.25); shake(9.15, 0.25);
  mv(6.3, 4.7, { ...at('gB', 60, 0, 1250), yaw: -3 }, 'sine.inOut');
  mv(11.0, 2.3, { ...at('gB', 440, 0, 1000), yaw: -2 }, 'power2.inOut');

  // holi powder explosion → 彩虹跑 (drawn on the front canvas)
  const powderCols = ['#ff4fa3', '#ffd93b', '#8b5cd6', '#36c3ff', '#ff8a1e', '#5cd65c', '#ff6fd0', '#4f7dff', '#ffe36e'];
  const holis = [];
  const holi = (t, cx, cy, seed) => holis.push([t, cx, cy, seed]);
  holi(13.3, 960, 600, 11);

  /* ---- C · 亲子彩虹跑 (13.75 – 18.35) ---- */
  cut(13.75, { ...at('gC', -620, 210, 760), yaw: -11, pitch: 0, roll: 3 });
  fly('#run1', { z: -200 }, 13.45, 0.6, 'power2.out');
  mv(13.75, 2.0, { ...at('gC', -160, 210, 840), yaw: 2, roll: 0 }, 'sine.inOut');
  fly('#run2', { x: 900, z: -800, rotationY: -50 }, 15.55, 0.9, 'power3.out');
  mv(15.75, 1.3, { ...at('gC', 40, 10, 1340), yaw: 0 }, 'power3.inOut');
  fly('#pillC', { x: -260 }, 16.05, 0.6, 'power3.out');
  fly('#banC', { x: -360, rotationY: 70 }, 16.25, 0.7, 'power3.out');
  shake(16.55, 0.3);
  mv(17.05, 1.3, { ...at('gC', 70, 10, 1290), yaw: 1 }, 'sine.inOut');

  // crane down → 0.1元装备包
  mv(18.35, 0.85, { ...at('gC2', 0, 0, 1440), yaw: 0, pitch: 0 }, 'power3.inOut');
  fxTo(18.4, 0.4, { speed: 0.6 }, 'power2.in'); fxTo(18.8, 0.4, { speed: 0 });

  /* ---- C2 · 0.1元购装备包 (19.2 – 23.3) ---- */
  tl.fromTo('#big01', { autoAlpha: 0, z: 1350 }, { autoAlpha: 1, z: 200, duration: 0.32, ease: 'power3.in', immediateRender: true }, 19.0);
  tl.fromTo('#big01', { scale: 1.18 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,0.45)', immediateRender: false }, 19.32);
  shake(19.32, 1.2); flash(19.32, 0.3);
  fly('#ribC2', { scale: 0.2, rotation: -10 }, 19.55, 0.55, 'back.out(2)');
  fly('.kit', { scale: 0 }, 19.7, 0.45, 'back.out(1.8)', 0.03);
  // spin in, then snap one item to the front on every beat
  tl.fromTo('#ring', { rotationY: 220 }, { rotationY: 0, duration: 0.7, ease: 'power3.out', immediateRender: true }, 19.65);
  for (let k = 1; k <= 5; k++) {
    tl.to('#ring', { rotationY: -60 * k, duration: 0.38, ease: 'back.out(1.8)' }, 20.5 + (k - 1) * 0.5);
    shake(20.6 + (k - 1) * 0.5, 0.12);
  }
  tl.to('#ring', { rotationY: -420, duration: 0.9, ease: 'power2.in' }, 22.6);
  mv(19.2, 4.1, { ...at('gC2', 60, -10, 1360), yaw: 2, pitch: -2 }, 'sine.inOut');

  // barrel-roll whip → 带娃蹦迪
  mv(23.3, 0.9, { ...at('gD', 0, 10, 1360), pitch: 0, yaw: 0 }, 'power4.inOut');
  tl.fromTo(cam, { roll: 0 }, { roll: 360, duration: 0.9, ease: 'power3.inOut', immediateRender: false }, 23.3);
  cut(24.21, { roll: 0 });
  flash(23.76, 0.55, 5);
  fxTo(23.35, 0.45, { speed: 1 }, 'power2.in'); fxTo(23.8, 0.45, { speed: 0 });
  fxTo(23.6, 0.4, { night: 1 });

  /* ---- D · 带娃蹦迪 (24.2 – 30.8) ---- */
  fly('#party1', { y: -1200, rotationX: 50 }, 24.0, 0.75, 'back.out(1.3)');
  fly('#party2', { x: 900, rotationY: -50 }, 24.3, 0.75, 'back.out(1.2)');
  fly('#pillD', { x: -260 }, 24.6, 0.6, 'power3.out');
  fly('#banD', { x: -360, rotationY: 70 }, 24.8, 0.7, 'power3.out');
  fly('#eq', { y: 300 }, 24.3, 0.7, 'power3.out');
  for (let b = 24.5; b < 30.4; b += 0.5) beats.push(b);
  for (let b = 25.0; b < 30.4; b += 1.0) flash(b, 0.1, 9);
  fxTo(24.2, 0.5, { sway: 1 }); fxTo(30.3, 0.5, { sway: 0 });
  mv(24.2, 6.2, { ...at('gD', 50, 10, 1300), yaw: 1 }, 'sine.inOut');

  // rainbow stripe wipe → 精彩演出
  const stripesEl = $('#stripes');
  const stripeCols = ['#f23b2e', '#ff9a1f', '#ffd93b', '#5cc24a', '#2e8bea', '#8b5cd6', '#ffffff'];
  function stripeWipe(t, dir = 1) {
    const bars = stripeCols.map((c, i) => {
      const d = document.createElement('i');
      d.style.background = c;
      d.style.left = (-560 + i * 360) + 'px';
      stripesEl.appendChild(d);
      return d;
    });
    tl.fromTo(bars, { x: -2900 * dir }, { x: 0, duration: 0.4, ease: 'power3.in', stagger: 0.03, immediateRender: true }, t);
    tl.to(bars, { x: 2900 * dir, duration: 0.5, ease: 'power3.out', stagger: 0.03 }, t + 0.64);
  }
  stripeWipe(30.3, 1);
  tl.set(fx, { night: 0 }, 30.92);

  /* ---- E · 精彩演出不断 (30.8 – 37.6) ---- */
  cut(30.92, { ...at('gE', -880, -40, 1260), yaw: -6, pitch: 0, roll: 0 });
  mv(30.92, 6.5, { ...at('gE', 1520, 10, 1160), yaw: 7 }, 'power1.inOut');
  fly('#pillE', { x: -260 }, 31.0, 0.6, 'power3.out');
  fly('#banE', { x: -360, rotationY: 70 }, 31.2, 0.7, 'power3.out');
  ['#tile1', '#tile2', '#tile3', '#tile4'].forEach((s, i) => {
    fly(s, { y: 320, rotationX: -75, scale: 0.7 }, 31.35 + i * 1.15, 0.75, 'back.out(1.5)');
    shake(31.75 + i * 1.15, 0.22);
  });

  // white flash → 冰雪女王
  flash(37.55, 1.0, 3.2);
  tl.set(fx, { ice: 1 }, 37.6);

  /* ---- F · 冰雪女王 (37.6 – 44.3) ---- */
  cut(37.6, { ...at('gF', 20, -1350, 1420), pitch: -40, yaw: 0, roll: 0 });
  mv(37.6, 2.3, { ...at('gF', 20, 10, 1360), pitch: 0 }, 'power3.inOut');
  mv(39.9, 4.4, { ...at('gF', 90, 10, 1230), yaw: 2 }, 'sine.inOut');
  fly('#frozen1', { z: -500, rotationY: 35 }, 37.65, 0.9, 'power3.out');
  fly('#frozen2', { z: -500, rotationY: -35 }, 37.95, 0.9, 'power3.out');
  fly('#gF .flake', { scale: 0, rotation: -90 }, 37.7, 0.9, 'back.out(1.5)', 0.08);
  fly('#pillF', { x: -260 }, 39.3, 0.6, 'power3.out');
  fly('#banF', { x: -360, rotationY: 70 }, 39.5, 0.7, 'power3.out');
  shake(39.8, 0.3);

  // whip → 抽奖
  mv(44.3, 0.9, { ...at('gG', 0, 0, 1320), yaw: 0 }, 'power4.inOut');
  mv(44.3, 0.45, { yaw: 14, roll: -6 }, 'power2.in');
  mv(44.75, 0.6, { yaw: 0, roll: 0 }, 'power3.out');
  fxTo(44.35, 0.45, { speed: 1 }, 'power2.in'); fxTo(44.8, 0.45, { speed: 0 });
  fxTo(44.5, 0.5, { ice: 0 });

  /* ---- G · 双重抽奖 (45.2 – 56) ---- */
  tl.fromTo('#g1title span', { y: -220, autoAlpha: 0, scale: 2.2 },
    { y: 0, autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)', stagger: 0.07, immediateRender: true }, 45.0);
  shake(45.45, 0.9); flash(45.45, 0.2);
  fly('#g1rib', { scale: 0.2, rotation: -10 }, 45.75, 0.55, 'back.out(2)');
  mv(45.2, 1.4, { ...at('gG', 0, 0, 1160) }, 'sine.out');

  // → 机制一
  mv(46.6, 1.0, { ...at('gG', 0, 0, -2600 + 1360) }, 'power3.inOut');
  out(['#g1title', '#g1rib'], 46.7, 500, 0.45);
  fly('#mech1', { rotationX: -90, y: -60 }, 47.25, 0.6, 'back.out(1.6)');
  fly('#glow1', { scale: 0 }, 47.7, 0.8, 'power2.out');
  fly('#phone', { y: 500, scale: 0.4, rotationY: 200 }, 47.7, 0.85, 'back.out(1.4)');
  fly('#medal1', { scale: 0, rotation: -25 }, 48.1, 0.45, 'back.out(2.5)');
  fly('#pname1', { y: 60 }, 48.2, 0.45, 'power3.out');
  shake(48.15, 0.7); flash(48.15, 0.3);
  fly('#glow2', { scale: 0 }, 48.45, 0.8, 'power2.out');
  fly('#scooter', { x: 600, scale: 0.4, rotationY: -120 }, 48.45, 0.85, 'back.out(1.3)');
  fly('#medal2', { scale: 0, rotation: 25 }, 48.85, 0.45, 'back.out(2.5)');
  fly('#pname2', { y: 60 }, 48.95, 0.45, 'power3.out');
  shake(48.9, 0.5);
  mv(47.6, 1.8, { ...at('gG', 0, 10, -2600 + 1290) }, 'sine.inOut');
  mv(49.4, 0.8, { ...at('gG', 2060, 20, -2600 + 1300) }, 'power3.inOut');
  fly('#pgroup', { x: 400, rotationY: -40 }, 49.65, 0.7, 'power3.out');
  fly('#plist', { autoAlpha: 1 }, 49.6, 0.01, 'none');
  tl.fromTo('#plist .row', { x: 160, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease: 'back.out(1.7)', stagger: 0.12, immediateRender: true }, 49.85);

  // → 获券形式 + 19.9元礼包
  mv(50.8, 0.9, { ...at('gG', 0, 0, -5200 + 1360) }, 'power3.inOut');
  out(['#mech1', '#glow1', '#glow2', '#phone', '#scooter', '#medal1', '#medal2', '#pname1', '#pname2', '#pgroup', '#plist'], 50.9, 400, 0.4);
  fly('#gift', { x: 600, rotationY: -50 }, 51.5, 0.8, 'power3.out');
  fly('#pillG3', { x: -260 }, 51.55, 0.55, 'power3.out');
  fly('#gG .ticket', { x: -320, rotationY: 40 }, 51.75, 0.55, 'power3.out', 0.22);
  mv(51.7, 1.6, { ...at('gG', 50, 0, -5200 + 1310), yaw: 1.5 }, 'sine.inOut');

  // → 机制二
  mv(53.3, 0.9, { ...at('gG', 0, 0, -7800 + 1400), yaw: 0 }, 'power3.inOut');
  out(['#pillG3', '#gG .ticket', '#gift'], 53.45, 400, 0.4);
  fly('#mech2', { rotationX: -90, y: -60 }, 53.9, 0.6, 'back.out(1.6)');
  fly('#prize2', { y: 420, scale: 0.6 }, 54.05, 0.8, 'back.out(1.3)');
  tl.fromTo('#badge', { autoAlpha: 0, z: -7640 + 1000, rotation: -140 },
    { autoAlpha: 1, z: -7640, rotation: 0, duration: 0.36, ease: 'power3.in', immediateRender: true }, 54.5);
  shake(54.86, 1.1); flash(54.86, 0.32);
  fly('#raysG', { scale: 0.3 }, 54.86, 0.9, 'power2.out');
  mv(54.2, 1.8, { ...at('gG', 60, 0, -7800 + 1260) }, 'sine.inOut');

  /* ---- H · 拉远回望 + 落版 (56 – 62) ---- */
  fxTo(55.8, 0.6, { hud: 0 });
  mv(56.0, 2.6, { x: 13600, y: -3600, z: 16500, yaw: 0, pitch: -12, roll: 0 }, 'power3.inOut');
  mv(58.6, 3.4, { x: 13300, y: -3900, z: 17600, yaw: 0, pitch: -13 }, 'sine.out');
  tl.fromTo('#lockup', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: true }, 57.7);
  tl.fromTo('#lockup .lg', { y: -40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out', immediateRender: true }, 57.7);
  tl.fromTo('#lockup .t1', { y: -120, scale: 1.6, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2)', immediateRender: true }, 57.8);
  tl.fromTo('#lockup .t2 span', { y: -240, scale: 2, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.08, immediateRender: true }, 58.0);
  shake(58.45, 0.7); burst(58.45, 960, 420, 200, 7);
  tl.fromTo('#lockup .datepill', { rotationX: -90, autoAlpha: 0 }, { rotationX: 0, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.6)', immediateRender: true }, 58.6);
  tl.fromTo('#lockup .bar', { y: 260, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', immediateRender: true }, 58.85);

  // HUD captions
  tl.fromTo('#disc1', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: true }, 13.9);
  tl.to('#disc1', { autoAlpha: 0, duration: 0.3 }, 44.2);
  tl.fromTo('#disc2', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: true }, 46.8);
  tl.to('#disc2', { autoAlpha: 0, duration: 0.3 }, 55.8);

  /* ---- I · 开场钩子 “听说 吉安周末有大事发生？” (absolute 0 – 3) ----
     The main film above is authored in its own clock; shift it so it starts after the hook.
     Event lists (shakes, flashes…) stay in main time, so the hook uses negative main times. */
  tl.shiftChildren(INTRO);
  (() => {
    const pts = [];
    const r = rng(5);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + r() * 0.08, r0 = 250 + r() * 30, r1 = r0 + 90 + r() * 110;
      pts.push(`<line x1="${(Math.cos(a) * r0).toFixed(1)}" y1="${(Math.sin(a) * r0).toFixed(1)}" x2="${(Math.cos(a) * r1).toFixed(1)}" y2="${(Math.sin(a) * r1).toFixed(1)}" stroke="#fff" stroke-width="${(8 + r() * 12).toFixed(1)}" stroke-linecap="round"/>`);
    }
    $('#iBurstSvg').innerHTML = pts.join('');
  })();
  tl.set(cam, { x: 40, y: -1510, z: 9000 + 1320, yaw: -2, pitch: 1, roll: 1.5 }, 0);
  tl.to(cam, { x: 20, y: -1500, z: 9000 + 1090, yaw: 1, roll: -0.5, duration: 2.4, ease: 'sine.inOut' }, 0);
  tl.to(cam, { x: 0, y: -80, z: 7600, yaw: 0, pitch: 5, roll: -5, duration: 0.6, ease: 'power2.in' }, 2.4);
  fly('#iTing', { scale: 0, rotation: -30, y: 40 }, 0.15, 0.45, 'back.out(2.5)');
  tl.fromTo('#iL1 span', { y: -200, scale: 1.8, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2.2)', stagger: 0.07, immediateRender: true }, 0.45);
  shake(0.85 - INTRO, 0.5);
  tl.fromTo('#iL2 span', { y: 160, scale: 0.4, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(2)', stagger: 0.06, immediateRender: true }, 1.0);
  tl.fromTo('#iQ', { autoAlpha: 0, z: 140 + 950, rotation: -70 }, { autoAlpha: 1, z: 140, rotation: 12, duration: 0.3, ease: 'power3.in', immediateRender: true }, 1.45);
  fly('#iBurst', { scale: 0.3 }, 1.75, 0.4, 'back.out(2)');
  shake(1.75 - INTRO, 1.1); flash(1.75 - INTRO, 0.25);
  out(['#iTing', '#iL1', '#iL2', '#iQ', '#iBurst'], 2.5, 320, 0.3);
  fxTo(2.45, 0.55, { speed: 1 }, 'power2.in');
  fxTo(3.0, 0.6, { speed: 0 }, 'power2.out');

  tl.set({}, {}, DURATION);

  // fast camera moves get sub-frame motion blur in render.cjs (absolute times)
  window.FAST = [[2.3, 3.0], ...[[0, 2.3], [5.2, 6.5], [13.2, 14.1], [18.3, 19.5], [23.2, 24.4], [37.5, 37.8], [44.2, 45.4],
    [45.35, 45.6], [46.5, 47.7], [49.3, 50.3], [50.7, 51.8], [53.2, 54.3], [54.45, 55.0], [56.0, 58.7]].map(([a, b]) => [a + INTRO, b + INTRO])];

  /* ======================================================================
     PARTICLES (screen-space canvases, pure functions of t)
     ====================================================================== */
  const cb = $('#fxBack').getContext('2d');
  const cf = $('#fxFront').getContext('2d');
  const CONF = ['#f23b2e', '#ff9a1f', '#ffd93b', '#5cc24a', '#2e8bea', '#8b5cd6', '#ff6fae', '#ffffff'];

  const mk = (n, seed, f) => { const r = rng(seed); return Array.from({ length: n }, (_, i) => f(r, i)); };
  const confRain = mk(150, 21, r => ({ x: r() * W, y: r() * (H + 200), vy: 150 + r() * 220, f: 0.6 + r() * 1.6, ph: r() * 7, sw: 20 + r() * 50, w: 12 + r() * 14, h: 7 + r() * 7, rs: (r() - 0.5) * 8, fl: 2 + r() * 6, c: CONF[(r() * CONF.length) | 0] }));
  const burstP = {};
  bursts.forEach(([t, x, y, n, seed]) => {
    burstP[t] = mk(n, seed, r => {
      const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.7, s = 700 + r() * 1300;
      return { vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: 12 + r() * 16, h: 7 + r() * 8, rs: (r() - 0.5) * 14, fl: 3 + r() * 8, c: CONF[(r() * CONF.length) | 0], ph: r() * 6 };
    });
  });
  const holiP = {};
  holis.forEach(([t, , , seed]) => {
    holiP[t] = mk(90, seed, r => ({ a: r() * Math.PI * 2, s: 300 + r() * 1700, s0: 220 + r() * 420, g: 900 + r() * 2200, rot: r() * 6.3, rs: (r() - 0.5) * 2, c: (r() * powderCols.length) | 0, dl: r() * 0.14 }));
  });
  let tints = [];
  function buildTints() {
    tints = powderCols.map((col, i) => {
      const im = cloudImgs[i % 5], cv = document.createElement('canvas');
      cv.width = im.width >> 1; cv.height = im.height >> 1;
      const x = cv.getContext('2d');
      x.drawImage(im, 0, 0, cv.width, cv.height);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
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
        ctx.save(); ctx.globalAlpha = Math.min(1, uu / 0.08) * Math.pow(fade, 2.5) * 0.92;
        ctx.translate(x, y); ctx.rotate(p.rot + p.rs * u); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
      }
      const cover = clamp((u - 0.22) / 0.18) * fade;
      if (cover > 0) {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#ff6fc0'); g.addColorStop(0.5, '#b07cff'); g.addColorStop(1, '#ffd25a');
        ctx.globalAlpha = cover * 0.88; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;
    }
  }
  const powder = mk(30, 31, r => ({ x: r() * W, y: r() * (H + 700), v: 40 + r() * 90, r: 90 + r() * 240, ph: r() * 6, c: powderCols[(r() * powderCols.length) | 0], a: 0.16 + r() * 0.16 }));
  const notes = mk(20, 41, r => ({ x: r() * W, y: r() * (H + 300), v: 80 + r() * 120, s: 40 + r() * 50, ph: r() * 6, c: ['#ffffff', '#ff7fd0', '#ffe36e', '#7df9ff'][(r() * 4) | 0], k: (r() * 2) | 0 }));
  const bubbles = mk(34, 51, r => ({ x: r() * W, y: r() * (H + 300), v: 50 + r() * 90, r: 16 + r() * 70, ph: r() * 6, sw: 20 + r() * 60 }));
  const snow = mk(170, 61, r => { const d = 0.25 + r() * 0.75; return { x: r() * W, y: r() * (H + 100), d, v: 60 + d * 160, ph: r() * 6, sw: 10 + r() * 40, r: 2 + d * 7 }; });
  const sparks = mk(26, 71, r => ({ x: 200 + r() * (W - 400), y: 140 + r() * (H - 380), ph: r() * 6, s: 14 + r() * 26, sp: 2 + r() * 3 }));
  const lines = mk(80, 81, r => ({ a: r() * Math.PI * 2, r0: r(), len: 120 + r() * 380, w: 1 + r() * 3, sp: 1.5 + r() * 2 }));

  function drawConf(ctx, x, y, w, h, rot, flip, c, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, flip);
    ctx.fillStyle = c; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
  }
  function confettiRain(ctx, t, a) {
    if (a <= 0) return;
    for (const p of confRain) {
      const y = ((p.y + p.vy * t) % (H + 200)) - 100;
      const x = p.x + Math.sin(t * p.f + p.ph) * p.sw;
      drawConf(ctx, x, y, p.w, p.h, p.ph + t * p.rs, Math.cos(t * p.fl + p.ph), p.c, a);
    }
  }
  function confettiBursts(ctx, t) {
    for (const [tb, cx, cy] of bursts) {
      const u = t - tb; if (u < 0 || u > 4) continue;
      const a = clamp((4 - u) / 1.0);
      const damp = Math.exp(-1.6 * u), k = (1 - damp) / 1.6;
      for (const p of burstP[tb]) {
        const x = cx + p.vx * k + Math.sin(u * 3 + p.ph) * 20 * u;
        const y = cy + p.vy * k + 420 * u * u * 0.5 + 160 * u;
        drawConf(ctx, x, y, p.w, p.h, p.ph + u * p.rs, Math.cos(u * p.fl + p.ph), p.c, a);
      }
    }
  }
  function powderFx(ctx, t, a, front) {
    if (a <= 0) return;
    powder.forEach((p, i) => {
      if (front !== (i % 4 === 0)) return;
      const y = H + 350 - ((p.y + p.v * t) % (H + 700));
      const x = p.x + Math.sin(t * 0.5 + p.ph) * 90;
      const r = p.r * (front ? 1.5 : 1);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, p.c); g.addColorStop(1, p.c + '00');
      ctx.globalAlpha = a * p.a * (front ? 0.7 : 1); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  function note(ctx, s, k) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.32, s * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(s * 0.24, -s * 1.05, s * 0.09, s * 1.05);
    if (k) {
      ctx.beginPath(); ctx.ellipse(s * 0.75, s * 0.12, s * 0.32, s * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(s * 0.99, -s * 0.93, s * 0.09, s * 1.05);
      ctx.fillRect(s * 0.24, -s * 1.05, s * 0.84, s * 0.16);
    } else {
      ctx.beginPath(); ctx.moveTo(s * 0.33, -s * 1.05); ctx.quadraticCurveTo(s * 0.75, -s * 0.7, s * 0.55, -s * 0.35);
      ctx.lineWidth = s * 0.09; ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
    }
  }
  function notesFx(ctx, t, a) {
    if (a <= 0) return;
    for (const p of notes) {
      const y = H + 150 - ((p.y + p.v * t) % (H + 300));
      const x = p.x + Math.sin(t * 1.2 + p.ph) * 50;
      ctx.save(); ctx.globalAlpha = a * 0.85; ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + p.ph) * 0.3);
      ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 18; note(ctx, p.s, p.k); ctx.restore();
    }
  }
  function bubblesFx(ctx, t, a) {
    if (a <= 0) return;
    for (const p of bubbles) {
      const y = H + 150 - ((p.y + p.v * t) % (H + 300));
      const x = p.x + Math.sin(t * 0.8 + p.ph) * p.sw;
      ctx.save(); ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(x, y, p.r * 0.2, x, y, p.r);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(210,240,255,.10)'); g.addColorStop(1, 'rgba(255,190,240,.32)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, p.r * 0.72, Math.PI * 1.1, Math.PI * 1.45);
      ctx.lineWidth = Math.max(2, p.r * 0.09); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
      ctx.restore();
    }
  }
  function snowFx(ctx, t, a) {
    if (a <= 0) return;
    for (const p of snow) {
      const y = ((p.y + p.v * t) % (H + 100)) - 50;
      const x = p.x + Math.sin(t * 0.9 + p.ph) * p.sw;
      ctx.globalAlpha = a * (0.45 + p.d * 0.55);
      const g = ctx.createRadialGradient(x, y, 0, x, y, p.r * 1.8);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r * 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function star4(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
  }
  function sparklesFx(ctx, t, a) {
    if (a <= 0) return;
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff6c0'; ctx.shadowBlur = 16;
    for (const p of sparks) {
      const k = Math.max(0, Math.sin(t * p.sp + p.ph));
      ctx.globalAlpha = a * k; star4(ctx, p.x, p.y, p.s * (0.5 + k * 0.6));
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  function speedFx(ctx, t, a) {
    if (a <= 0.01) return;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    for (const p of lines) {
      const r = 260 + ((p.r0 + t * p.sp) % 1) * 1100;
      ctx.globalAlpha = a * 0.55; ctx.lineWidth = p.w;
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
  const flashEl = $('#flash'), flareEl = $('#flare'), flareCore = $('#flare .core');
  const hud = $('#hud'), lockup = $('#lockup');
  const partyEls = [$('#party1'), $('#party2')], flakes = $$('#gF .flake');
  const raysB = $('#raysB'), raysG = $('#raysG'), badge = $('#badge');
  const ringEl = $('#ring'), kits = $$('.kit');

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
  // which plane the camera is "about": clouds nearer than this draw in front of the world
  const focusPlan = [[0, 'gA'], [5.6, 'gB'], [13.75, 'gC'], [18.6, 'gC2'], [23.75, 'gD'], [30.92, 'gE'], [37.6, 'gF'], [44.75, 'gG']];
  function drawClouds(t, c) {
    let fid = 'gA';
    for (const [ft, id] of focusPlan) if (t >= ft) fid = id;
    const f = G[fid];
    let fz = f.z;
    if (fid === 'gG') fz += t < 46.9 ? 0 : t < 51.1 ? -2600 : t < 53.6 ? -5200 : -7800;
    const fd = t < 0 ? toCam(0, -1500, 9000, c).d - 150 : t > 56.3 ? 0 : toCam(f.x, f.y, fz, c).d - 150;
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
      ctx.globalAlpha = o.k.op * clamp((o.q.d - 300) / 1100) * (1 - fx.night * 0.85);
      ctx.save(); ctx.translate(o.sx, o.sy); ctx.rotate(c.roll * D2R);
      ctx.drawImage(o.k.im, -o.w / 2, -o.h / 2, o.w, o.h); ctx.restore();
    }
    cb.globalAlpha = 1; cf.globalAlpha = 1;
  }

  const haze = $('#haze'), iQ = $('#iQ'), iBurst = $('#iBurst');
  function render(T) {
    T = clamp(T, 0, DURATION);
    tl.seek(T, true);
    const t = T - INTRO; // main-film clock (negative during the hook)

    // camera with shake, handheld drift and beat bumps
    const s = sumEvents(shakes, t);
    const bp = beatPulse(t);
    const n1 = Math.sin(t * 61.3) + Math.sin(t * 37.1 + 1.3) * 0.7;
    const n2 = Math.sin(t * 53.7 + 2.1) + Math.sin(t * 29.3) * 0.6;
    const n3 = Math.sin(t * 47.9 + 0.7);
    const hx = Math.sin(t * 0.9) * 6 + Math.sin(t * 1.7 + 1) * 3;
    const hy = Math.sin(t * 1.1 + 2) * 5 + Math.sin(t * 2.3) * 2;
    const x = cam.x + n1 * s * 20 + hx;
    const y = cam.y + n2 * s * 15 + hy;
    const z = cam.z - bp * 70;
    const roll = cam.roll + n3 * s * 1.3 + Math.sin(t * 0.7) * 0.3 + Math.sin(t * 2.6) * 2.2 * fx.sway;
    const yaw = cam.yaw, pitch = cam.pitch;
    world.style.transform =
      `translateZ(${P}px) rotateZ(${roll}deg) rotateX(${pitch}deg) rotateY(${yaw}deg) translate3d(${-x}px,${-y}px,${-z}px)`;

    // sky parallax follows the camera
    sky.grad.style.transform = `translateY(${pitch * 26 - y * 0.05}px) rotate(${-roll * 0.6}deg)`;
    sky.sun.style.transform = `translate(${-yaw * 34 - x * 0.004}px, ${pitch * 26}px)`;
    sky.rays.style.transform = `translate(${-yaw * 34 - x * 0.004}px, ${pitch * 26}px) rotate(${t * 3}deg)`;
    night.style.opacity = fx.night;
    ice.style.opacity = fx.ice;
    beams.forEach((b, i) => { b.style.transform = `rotate(${Math.sin(t * 1.3 + i * 1.7) * 28}deg)`; b.style.opacity = 0.35 + 0.35 * bp; });

    // procedural details
    gsap.set(raysB, { rotation: t * 9 });
    gsap.set(raysG, { rotation: -t * 9 });
    if (t > 54.88) gsap.set(badge, { rotation: Math.sin((t - 54.88) * 2.4) * 7 });
    flakes.forEach((f, i) => gsap.set(f, { rotation: t * (i % 2 ? -24 : 18) }));
    if (t > 19 && t < 24.5) {
      // coverflow: cards ride the ring but turn most of the way back toward the lens
      const rr = gsap.getProperty(ringEl, 'rotationY');
      kits.forEach((k, i) => {
        let a = ((i * 60 + rr) % 360 + 540) % 360 - 180;
        gsap.set(k, { rotationY: -a * 0.72 });
        k.style.setProperty('--fade', clamp((112 - Math.abs(a)) / 40).toFixed(3));
      });
    }
    if (t > 23.9 && t < 31) {
      partyEls.forEach(el => gsap.set(el, { scale: 1 + bp * 0.035 }));
      eqBars.forEach((b, i) => {
        const v = 0.25 + 0.75 * Math.abs(Math.sin(t * (3 + (i % 5) * 0.7) + i * 1.3)) * (0.45 + 0.55 * bp);
        b.style.height = (40 + v * 260).toFixed(0) + 'px';
      });
    }

    // overlays
    flashEl.style.opacity = clamp(sumEvents(flashes, t));
    flareEl.style.opacity = fx.flare;
    flareCore.style.left = fx.flareX + 'px'; flareCore.style.top = '360px';
    $('#flare .streak').style.transform = `translateX(${fx.flareX - 960}px)`;
    hud.style.opacity = fx.hud;
    haze.style.opacity = t < 0 ? clamp((t + 0.35) / 0.35) * 0.85 : 0.85 * Math.pow(1 - clamp(t / 1.3), 2);
    if (t > -1.25 && t < 0) { gsap.set(iQ, { rotation: 12 + Math.sin((t + 1.25) * 7) * 5 * Math.exp(-(t + 1.25) * 1.5) }); gsap.set(iBurst, { rotation: (t + 1.25) * 14 }); }

    // particles
    cb.clearRect(0, 0, W, H); cf.clearRect(0, 0, W, H);
    drawClouds(t, { x, y, z, yaw, pitch, roll });
    powderFx(cb, t, env(t, 13.6, 19.1, 0.4, 0.6), false);
    powderFx(cf, t, env(t, 13.6, 18.6, 0.4, 0.6), true);
    notesFx(cf, t, env(t, 24.1, 30.6, 0.5, 0.4));
    bubblesFx(cf, t, env(t, 30.9, 37.7, 0.6, 0.4));
    snowFx(cf, t, env(t, 37.6, 44.9, 0.3, 0.5));
    confettiRain(cf, t, Math.max(env(t, 2.9, 6.0, 0.6, 0.8) * 0.8, env(t, 45.3, 56.2, 0.6, 0.6) * 0.55, env(t, 58.3, 62.5, 0.6, 0.5)));
    confettiBursts(cf, t);
    sparklesFx(cf, t, Math.max(env(t, 47.8, 50.6, 0.3, 0.4), env(t, 54.9, 56.2, 0.3, 0.4), env(t, 58.5, 62.5, 0.5, 0.5) * 0.8));
    speedFx(cf, t, fx.speed);
    holiFx(cf, t);
  }

  /* ---------------- boot ---------------- */
  async function ready() {
    await Promise.all(['500 20px NS', '700 20px NS', '900 20px NS', '400 20px QK'].map(f => document.fonts.load(f, '亲子彩虹跑0.1元')));
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
