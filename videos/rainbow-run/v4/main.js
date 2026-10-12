/* v4 — 派星天护节 · 亲子彩虹跑
 * One morphing element carries the story: search → “青鸟飞鱼来了” → player (此生不换, volume up)
 * → star guest → phone photo album (swipe through the events) → lockup.
 * A single paused GSAP timeline + render(t) keeps every frame deterministic for the renderer.
 */
(() => {
  'use strict';
  const W = 1920, H = 1080, MORE = 2.45, DURATION = 47 + MORE;  // MORE: the “不止明星” beat inserted after the star
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  if (RENDER) document.body.classList.add('render');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const env = (t, t0, t1, fin = 0.4, fout = 0.5) => (t < t0 || t > t1 ? 0 : Math.min(clamp((t - t0) / fin), clamp((t1 - t) / fout)));
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const NAVY = '#0c1631';
  const tl = gsap.timeline({ paused: true });
  const cam = { s: 1, x: 0, y: 0, rx: 0, ry: 0 };
  const fx = { burst: 0, night: 0, vol: 20, eq: 0 };
  const island = $('#island');

  /* ---------- prep ---------- */
  // 虎虎 photo: placeholder art until ../assets/huhu.png exists
  $$('img.huhu').forEach(img => {
    const miss = () => img.parentElement.classList.add('missing');
    img.addEventListener('error', miss);
    if (img.complete && !img.naturalWidth) miss();
  });
  function splitChars(el) {
    [...el.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const f = document.createDocumentFragment();
        for (const c of n.textContent) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; f.appendChild(s); }
        n.replaceWith(f);
      } else if (n.nodeType === 1) splitChars(n);
    });
  }
  $$('.split').forEach(splitChars);
  const eq = $('#eq');
  for (let i = 0; i < 64; i++) eq.appendChild(document.createElement('i'));
  const scrambles = [];
  $$('.scr').forEach(el => { el._txt = el.textContent; el.textContent = ''; });
  const checkPath = $('#checkPath'); const CL = checkPath.getTotalLength();
  gsap.set(checkPath, { strokeDasharray: CL, strokeDashoffset: CL });

  // layers: centred in the island except the ones anchored to its top edge
  $$('.L').forEach(l => {
    if (l.id === 'Lsearch' || l.id === 'Lsug') return;
    if (l.id === 'Lplayer') gsap.set(l, { xPercent: -50, top: 0 });
    else gsap.set(l, { xPercent: -50, yPercent: -50 });
  });

  /* ---------- island states ---------- */
  const ST = {
    bar: { width: 1040, height: 120, borderRadius: 60, backgroundColor: '#ffffff', y: -140 },
    sug: { width: 1040, height: 600, borderRadius: 44, backgroundColor: '#ffffff', y: 100 },
    circle: { width: 130, height: 130, borderRadius: 65, backgroundColor: NAVY, y: 0 },
    pill: { width: 880, height: 130, borderRadius: 65, backgroundColor: NAVY, y: 0 },
    player: { width: 1180, height: 420, borderRadius: 48, backgroundColor: NAVY, y: -20 },
    playerV: { width: 1180, height: 540, borderRadius: 48, backgroundColor: NAVY, y: 40 },
    star: { width: 1560, height: 820, borderRadius: 48, backgroundColor: NAVY, y: 0 },
    grid: { width: 1560, height: 860, borderRadius: 48, backgroundColor: '#ffffff', y: 0 },
    more: { width: 1240, height: 300, borderRadius: 150, backgroundColor: NAVY, y: 0 },
    view: { width: 1500, height: 840, borderRadius: 44, backgroundColor: '#0b0f1e', y: 0 },
    endpill: { width: 980, height: 130, borderRadius: 65, backgroundColor: NAVY, y: 0 },
    end: { width: 1400, height: 820, borderRadius: 52, backgroundColor: '#ffffff', y: 0 },
  };
  gsap.set(island, { xPercent: -50, yPercent: -50, ...ST.bar });

  /* ---------- helpers ---------- */
  const E = 'expo.inOut';
  function morph(t, st, dur = 0.6, blur = 6) {
    tl.to(island, { ...ST[st], duration: dur, ease: E }, t);
    tl.to(island, { filter: `blur(${blur}px)`, duration: dur * 0.45, ease: 'power2.in' }, t);
    tl.to(island, { filter: 'blur(0px)', duration: dur * 0.55, ease: 'power2.out' }, t + dur * 0.45);
  }
  const show = (sel, t, dur = 0.6) => tl.fromTo(sel, { autoAlpha: 0, filter: 'blur(16px)', scale: 0.96 }, { autoAlpha: 1, filter: 'blur(0px)', scale: 1, duration: dur, ease: 'expo.out', immediateRender: true }, t);
  const hide = (sel, t, dur = 0.32) => tl.to(sel, { autoAlpha: 0, filter: 'blur(12px)', scale: 1.02, duration: dur, ease: 'power2.in' }, t);
  const cur = (t, dur, x, y, ease = 'power3.inOut') => tl.to('#cursor', { x, y, duration: dur, ease }, t);
  function click(t) {
    tl.to('#cursor svg', { scale: 0.8, duration: 0.07, ease: 'power2.out' }, t);
    tl.to('#cursor svg', { scale: 1, duration: 0.22, ease: 'power2.out' }, t + 0.07);
    tl.fromTo('#cursor .ring', { scale: 0.2, opacity: 0.9 }, { scale: 1.5, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, t);
  }
  const press = (sel, t) => { tl.to(sel, { scale: 0.94, duration: 0.08 }, t); tl.to(sel, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, t + 0.08); };
  // camera: bring UI point (px,py) to the frame centre at zoom s
  const focus = (t, dur, px, py, s, ease = 'power3.inOut', extra = {}) =>
    tl.to(cam, { s, x: -(px - 960) * s, y: -(py - 540) * s, duration: dur, ease, ...extra }, t);
  const flashes = [], bursts = [], beats = [];
  const flash = (t, a = 0.4, k = 6) => flashes.push([t, a, k]);
  const burst = (t, x, y, n = 160, seed = 1) => bursts.push([t, x, y, n, seed]);
  const scramble = (sel, t, dur = 0.8) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (el._txt === undefined) { el._txt = el.textContent; el.textContent = ''; }
    scrambles.push({ el, t0: t, dur });
  };
  const chars = sel => $$(sel).flatMap(el => $$('.ch', el));
  // sound design cues, synthesised offline by audio/make_audio.py
  const sfx = [];
  const S = (t, type, o = {}) => sfx.push({ t, type, ...o });

  /* ======================================================================
     TIMELINE
     ====================================================================== */
  gsap.set('#cursor', { x: 1560, y: 980 });

  /* ---- 1 · 搜索：吉安… → 听说 吉安周末有大事发生？ (0 – 6.3) ---- */
  tl.fromTo(island, { opacity: 0, scale: 0.86, filter: 'blur(18px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', immediateRender: true }, 0.05);
  show('#Lsearch', 0.15, 0.7);
  S(0.05, 'appear');
  focus(0, 0.01, 960, 400, 1.42);
  focus(0.3, 1.0, 960, 410, 1.3, 'sine.inOut');
  focus(1.3, 0.8, 960, 600, 1.0, 'power3.inOut');
  focus(3.75, 0.6, 960, 420, 1.3, 'power3.inOut');
  cur(0.3, 0.65, 1110, 420);
  click(0.98); S(0.98, 'click');
  [1.08, 1.22, 2.2, 2.34].forEach(k => S(k, 'key'));
  tl.to(island, { boxShadow: '0 40px 90px rgba(12,40,110,.22), 0 0 0 6px rgba(47,125,255,.25)', duration: 0.3 }, 1.0);
  morph(1.35, 'sug', 0.6, 3); S(1.35, 'whoosh', { dur: 0.6, dir: 1, g: 0.5 });
  show('#Lsug', 1.45, 0.5);
  tl.fromTo('#sugA .row', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out', stagger: 0.06, immediateRender: true }, 1.5);
  tl.to('#sugA', { autoAlpha: 0, filter: 'blur(10px)', duration: 0.25 }, 2.4); S(2.45, 'tick', { g: 0.5 });
  tl.fromTo('#sugB .row', { opacity: 0, y: 22, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out', stagger: 0.06, immediateRender: true }, 2.5);
  cur(2.75, 0.75, 800, 852);
  tl.fromTo('#sugHover', { opacity: 0, y: 0 }, { opacity: 1, y: 104, duration: 0.25, immediateRender: false }, 2.85);
  tl.to('#sugHover', { y: 312, duration: 0.5, ease: 'power3.inOut' }, 3.0);
  [2.9, 3.12, 3.34].forEach(k => S(k, 'tick', { g: 0.35 }));
  click(3.55); S(3.55, 'click'); S(3.62, 'type');
  press('#sugB .row.hot', 3.55);
  hide('#Lsug', 3.75, 0.3);
  morph(3.75, 'bar', 0.5, 3); S(3.75, 'whoosh', { dur: 0.5, dir: -1, g: 0.45 });
  tl.to(island, { boxShadow: '0 40px 90px rgba(12,40,110,.22), 0 0 0 0px rgba(47,125,255,0)', duration: 0.3 }, 3.9);
  cur(3.9, 0.8, 1380, 760);
  hide('#Lsearch', 4.35, 0.25);
  morph(4.35, 'circle', 0.55, 8); S(4.35, 'whoosh', { dur: 0.55, dir: -1, g: 0.7 }); S(4.75, 'spin', { dur: 0.55 });
  focus(4.35, 0.6, 960, 540, 1.65, 'power3.inOut');
  show('#Lspin', 4.75, 0.3);
  hide('#Lspin', 5.3, 0.15);
  show('#Lcheck', 5.32, 0.2);
  tl.to(checkPath, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, 5.35); S(5.35, 'ding');
  hide('#Lcheck', 5.85, 0.2);

  /* ---- 2 · 青鸟飞鱼来了！ → 播放《此生不换》 → 音量拉满 (5.9 – 10.9) ---- */
  morph(5.9, 'pill', 0.6, 6); S(5.9, 'whoosh', { dur: 0.6, dir: 1, g: 0.7 }); S(6.15, 'chime');
  focus(5.9, 0.7, 960, 540, 1.4, 'power3.inOut');
  show('#Lpill', 6.15, 0.6);
  tl.fromTo('#Lpill .art', { scale: 0.3 }, { scale: 1, duration: 0.7, ease: 'back.out(2)', immediateRender: true }, 6.15);
  hide('#Lpill', 7.25, 0.3);
  morph(7.25, 'player', 0.65, 6); S(7.25, 'whoosh', { dur: 0.65, dir: 1, g: 0.8 });
  show('#Lplayer', 7.5, 0.6);
  focus(7.25, 0.7, 960, 520, 1.06, 'power3.inOut');
  cur(7.8, 0.6, 1146, 660);
  click(8.45); S(8.45, 'click', { g: 1.2 });
  press('#Lplayer .pp', 8.45);
  tl.set('#Lplayer .play', { autoAlpha: 1 }, 0);
  tl.set('#Lplayer .pause', { autoAlpha: 0 }, 0);
  tl.to('#Lplayer .play', { autoAlpha: 0, scale: 0.4, duration: 0.18 }, 8.5);
  tl.fromTo('#Lplayer .pause', { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)', immediateRender: false }, 8.55);
  morph(8.95, 'playerV', 0.5, 2); S(8.95, 'whoosh', { dur: 0.5, dir: 1, g: 0.35 });
  focus(8.95, 0.7, 960, 600, 1.06);
  cur(9.1, 0.5, 692, 788);
  click(9.62); S(9.62, 'click'); S(9.7, 'riser', { dur: 1.02 });
  tl.to(fx, { vol: 100, duration: 1.0, ease: 'power2.inOut' }, 9.7);
  tl.to('#cursor', { x: 1383, duration: 1.0, ease: 'power2.inOut' }, 9.7);
  // BOOM — the whole thing comes alive
  flash(10.72, 0.55, 4);
  burst(10.72, 960, 560, 220, 3); S(10.72, 'boom');
  tl.fromTo(fx, { burst: 0 }, { burst: 1, duration: 0.25, ease: 'power2.out', immediateRender: false }, 10.7);
  tl.to(fx, { burst: 0.55, duration: 1.2, ease: 'power2.inOut' }, 11.0);
  tl.to(fx, { eq: 1, duration: 0.6 }, 10.7);
  focus(10.7, 0.12, 960, 600, 1.13, 'power2.out');
  focus(10.85, 0.9, 960, 540, 1.0, 'expo.out');
  for (let b = 10.72; b < 17.6; b += 0.5) beats.push(b);

  /* ---- 3 · 明星嘉宾 青鸟飞鱼-虎虎 (10.9 – 17.6) ---- */
  hide('#Lplayer', 10.9, 0.3);
  morph(10.95, 'star', 0.7, 8); S(10.95, 'whoosh', { dur: 0.7, dir: 1, g: 0.6 });
  show('#Lstar', 11.25, 0.7);
  tl.fromTo('#Lstar .photo', { scale: 1.15, x: -40 }, { scale: 1, x: 0, duration: 1.4, ease: 'expo.out', immediateRender: true }, 11.25);
  scramble('#Lstar .lab .scr', 11.45, 0.8);
  tl.fromTo(chars('#Lstar .n1'), { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: 0.08, immediateRender: true }, 11.6);
  [0, 1, 2, 3].forEach(i => S(11.6 + i * 0.08, 'key', { g: 0.6 }));
  S(11.97, 'thump'); S(12.09, 'thump', { g: 0.8 });
  tl.fromTo(chars('#Lstar .n2'), { scale: 2.6, opacity: 0, y: -40 }, { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.12, immediateRender: true }, 11.95);
  tl.fromTo('#Lstar .date', { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)', immediateRender: true }, 12.35); S(12.35, 'pop', { g: 0.9 });
  [12.6, 13.05, 13.5].forEach(k => S(k, 'tick', { g: 0.5 }));
  tl.fromTo('#Lstar .row', { opacity: 0, x: 40, filter: 'blur(8px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out', stagger: 0.45, immediateRender: true }, 12.6);
  tl.fromTo('#Lstar .now', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', immediateRender: true }, 13.8);
  const rowsEl = $('#Lstar .rows'), colEl = $('#Lstar .col');
  const rowY = i => 540 - 410 + colEl.offsetTop + rowsEl.offsetTop + i * 86 + 43;
  focus(12.9, 1.6, 1180, rowY(1) - 10, 1.28);
  cur(12.4, 0.8, 1020, rowY(0) + 4);
  tl.fromTo('#starHover', { opacity: 0, y: 0 }, { opacity: 1, y: 0, duration: 0.3, immediateRender: false }, 13.2);
  cur(13.9, 0.5, 1040, rowY(1) + 4); tl.to('#starHover', { y: 86, duration: 0.45, ease: 'power3.inOut' }, 13.9); S(13.95, 'tick', { g: 0.4 });
  cur(14.7, 0.5, 1060, rowY(2) + 4); tl.to('#starHover', { y: 172, duration: 0.45, ease: 'power3.inOut' }, 14.7); S(14.75, 'tick', { g: 0.4 });
  focus(15.6, 1.3, 960, 540, 1.0);
  tl.to('#starHover', { opacity: 0, duration: 0.3 }, 15.8);
  cur(15.8, 0.9, 1460, 960);

  /* ---- 4 · 手机相册：点开 → 一张张滑 (17.6 – 37.4) ---- */
  tl.to(fx, { eq: 0, duration: 0.6 }, 17.4);
  tl.to(fx, { burst: 0, duration: 0.8 }, 17.4);
  hide('#Lstar', 17.6, 0.3);
  morph(17.65, 'grid', 0.7, 8); S(17.65, 'whoosh', { dur: 0.7, dir: 1, g: 0.6 });
  for (let i = 0; i < 10; i++) S(18.0 + i * 0.045, 'pop', { g: 0.35, p: 1 + i * 0.05 });
  show('#Lgrid', 17.95, 0.5);
  tl.fromTo('#Lgrid .tile', { scale: 0.6, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: { each: 0.045, from: 'start' }, immediateRender: true }, 18.0);
  cur(18.7, 0.65, 378, 424);
  click(19.42); S(19.42, 'click');
  press('#Lgrid .tile[data-i="0"]', 19.42);
  // shared-element: the tapped tile grows into the full-screen viewer
  tl.set('#flyer', { autoAlpha: 1, left: 60, top: 160, width: 275, height: 302, borderRadius: 20 }, 19.55);
  tl.to('#flyer', { left: 268, top: 92, width: 963, height: 470, borderRadius: 22, duration: 0.75, ease: E }, 19.55); S(19.55, 'whoosh', { dur: 0.75, dir: 1, g: 0.7 });
  morph(19.55, 'view', 0.75, 0);
  hide('#Lgrid', 19.6, 0.4);
  tl.set('#Lview', { autoAlpha: 1, filter: 'blur(0px)', scale: 1 }, 20.28);
  tl.set('#flyer', { autoAlpha: 0 }, 20.32);
  tl.fromTo('#Lview .top, #Lview .film', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', immediateRender: true }, 20.3);
  cur(20.0, 0.8, 1560, 1000);

  // swipes: [time, page]
  const SW = [[22.2, 1], [23.9, 2], [26.0, 3], [27.5, 4], [28.8, 5], [30.0, 6], [31.2, 7], [32.7, 8], [34.5, 9]];
  SW.forEach(([t, p]) => {
    cur(t - 0.45, 0.35, 1420, 600, 'power2.out');
    click(t - 0.08); S(t - 0.08, 'click', { g: 0.45 }); S(t, 'swipe');
    tl.to('#cursor', { x: 640, duration: 0.5, ease: 'power3.inOut' }, t);
    tl.to('#strip', { x: -1500 * p, duration: 0.72, ease: 'expo.inOut' }, t);
    tl.to(cam, { ry: -2.4, duration: 0.36, ease: 'power2.out' }, t);
    tl.to(cam, { ry: 0, duration: 0.6, ease: 'power2.inOut' }, t + 0.36);
    tl.fromTo(`#strip .pg:nth-child(${p + 1}) .fg img`, { scale: 1.12 }, { scale: 1.0, duration: 3.2, ease: 'power2.out', immediateRender: false }, t);
  });
  tl.fromTo('#strip .pg:nth-child(1) .fg img', { scale: 1.12 }, { scale: 1.0, duration: 3.6, ease: 'power2.out', immediateRender: true }, 19.6);
  // captions per event group
  const capIn = (c, t) => {
    tl.set(`#Lview .cap[data-c="${c}"]`, { autoAlpha: 1 }, t);
    tl.fromTo(`#Lview .cap[data-c="${c}"] > *`, { opacity: 0, y: 50, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', stagger: 0.09, immediateRender: false }, t);
  };
  const capOut = (c, t) => tl.to(`#Lview .cap[data-c="${c}"]`, { autoAlpha: 0, filter: 'blur(10px)', duration: 0.3 }, t);
  capIn(0, 20.55); capOut(0, 23.85);
  capIn(1, 24.5); capOut(1, 27.45);
  capIn(2, 27.85); capOut(2, 32.65);
  capIn(3, 33.25);
  [[27.6, 0], [28.9, 1], [30.1, 2], [31.3, 3]].forEach(([t, i], k, a) => {
    tl.fromTo(`#showSub span:nth-child(${i + 1})`, { opacity: 0, y: 30, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out', immediateRender: false }, t + 0.25);
    if (k < a.length - 1) tl.to(`#showSub span:nth-child(${i + 1})`, { opacity: 0, y: -26, filter: 'blur(8px)', duration: 0.3 }, a[k + 1][0]);
  });
  tl.to(fx, { night: 1, duration: 0.7 }, 24.0);
  tl.to(fx, { night: 0, duration: 0.7 }, 27.5);
  // double-tap hearts
  [[25.15, 1180, 520], [35.4, 1000, 470]].forEach(([t, x, y]) => {
    cur(t - 0.55, 0.45, x, y, 'power2.inOut');
    click(t - 0.12); click(t + 0.05); S(t - 0.12, 'click', { g: 0.45 }); S(t + 0.05, 'click', { g: 0.45 }); S(t + 0.1, 'heart');
    tl.fromTo('#heart', { scale: 0, opacity: 1, rotation: -12 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.45, ease: 'back.out(2.6)', immediateRender: false }, t + 0.08);
    tl.to('#heart', { scale: 1.2, opacity: 0, y: -60, duration: 0.45, ease: 'power2.in' }, t + 0.75);
    tl.set('#heart', { y: 0 }, t + 1.3);
  });
  focus(20.4, 16.8, 960, 540, 1.035, 'sine.inOut');

  /* ---- 5 · 落版 (37.4 – 47) ---- */
  hide('#Lview', 37.4, 0.35);
  morph(37.45, 'endpill', 0.75, 10); S(37.42, 'whoosh', { dur: 0.75, dir: -1, g: 0.9 });
  focus(37.45, 0.75, 960, 540, 1.0);
  show('#Lendpill', 37.95, 0.6); S(37.95, 'chime', { g: 0.8 });
  tl.fromTo('#Lendpill .art', { scale: 0.3, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.8, ease: 'back.out(2)', immediateRender: true }, 37.95);
  hide('#Lendpill', 39.05, 0.3);
  morph(39.05, 'end', 0.7, 8); S(39.05, 'whoosh', { dur: 0.7, dir: 1, g: 0.9 }); S(39.6, 'thump', { g: 0.7 });
  show('#Lend', 39.35, 0.7);
  tl.fromTo('#Lend .kick', { letterSpacing: '70px', opacity: 0 }, { letterSpacing: '22px', opacity: 1, duration: 1.6, ease: 'expo.out', immediateRender: true }, 39.4);
  tl.fromTo('#Lend .title', { y: 60, opacity: 0, filter: 'blur(14px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out', immediateRender: true }, 39.55);
  tl.fromTo('#Lend .when, #Lend .cta', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.15, immediateRender: true }, 40.1);
  tl.fromTo('#Lend .qr', { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2)', immediateRender: true }, 40.4);
  scramble('#Lend .eng', 39.9, 0.9);
  cur(40.6, 0.9, 1080, 832);
  click(41.7); S(41.7, 'click', { g: 1.1 }); S(41.76, 'success');
  press('#Lend .cta', 41.7);
  flash(41.75, 0.25, 6);
  burst(41.8, 960, 690, 160, 9);
  cur(42.4, 1.4, 1700, 1040);
  focus(39.05, 7.9, 960, 540, 1.04, 'sine.inOut');

  /* ---- 3.5 · 周末不止明星，还有更多精彩 (17.6 – 20.05) ----
     Everything authored from the album on is pushed back by MORE seconds. */
  tl.shiftChildren(MORE, false, 17.62);
  const shiftEv = list => list.forEach(e => { if (Array.isArray(e)) { if (e[0] >= 17.62) e[0] += MORE; } else if (e.t >= 17.62) e.t += MORE; });
  [flashes, bursts, sfx].forEach(shiftEv);
  morph(17.62, 'more', 0.6, 8); S(17.62, 'whoosh', { dur: 0.6, dir: -1, g: 0.7 });
  focus(17.62, 0.7, 960, 540, 1.22, 'power3.inOut');
  show('#Lmore', 17.85, 0.4);
  tl.fromTo(chars('#Lmore .m1'), { scale: 2.4, opacity: 0, y: -30 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: 0.07, immediateRender: true }, 17.9);
  for (let i = 0; i < 6; i++) S(17.92 + i * 0.07, 'thump', { g: 0.45, p: 1 + i * 0.04 });
  tl.to('#Lmore .m1', { opacity: 0, y: -60, filter: 'blur(12px)', duration: 0.35, ease: 'power2.in' }, 18.95);
  tl.fromTo('#Lmore .m2', { opacity: 0, y: 70, filter: 'blur(14px)', scale: 0.9 }, { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, duration: 0.7, ease: 'expo.out', immediateRender: true }, 19.1);
  S(18.98, 'whoosh', { dur: 0.4, dir: 1, g: 0.4 }); S(19.12, 'sparkle');
  tl.fromTo('#Lmore .m3', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', immediateRender: true }, 19.3);
  burst(19.15, 960, 520, 120, 13);
  hide('#Lmore', 20.0, 0.25);
  focus(20.0, 0.7, 960, 540, 1.0, 'power3.inOut');

  tl.set({}, {}, DURATION);
  window.SFX = sfx;
  window.MUSIC = { play: 8.5, vol: [9.7, 10.7, 20, 100], drop: 10.72, bpm: 120, starEnd: 17.6, album: 17.62 + MORE, endPill: 37.4 + MORE, cta: 41.7 + MORE, end: DURATION,
    party: [23.9 + MORE, 27.5 + MORE], frozen: [32.7 + MORE, 37.4 + MORE] };
  // fast segments get sub-frame motion blur in render.cjs
  window.FAST = [[0.9, 1.1], [1.3, 2.0], [3.5, 4.2], [4.3, 5.0], [5.85, 6.6], [7.2, 8.0], [8.9, 9.5], [9.7, 11.7], [17.6, 18.5], [18.9, 19.4],
    ...[[17.6, 18.5], [19.5, 20.4], ...SW.map(([t]) => [t - 0.1, t + 0.8]), [37.4, 38.3], [39.0, 39.9]].map(([a, b]) => [a + MORE, b + MORE])];

  /* ======================================================================
     PARTICLES
     ====================================================================== */
  const cb = $('#fxBack').getContext('2d'), cf = $('#fxFront').getContext('2d');
  const mk = (n, seed, f) => { const r = rng(seed); return Array.from({ length: n }, () => f(r)); };
  function sprite(size, stops) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
  }
  const glow = ['255,246,214', '255,255,255', '255,140,200', '120,210,255', '255,210,90', '170,140,255'].map(t => sprite(64, [[0, `rgba(${t},1)`], [0.25, `rgba(${t},.85)`], [1, `rgba(${t},0)`]]));
  const bokehS = sprite(128, [[0, 'rgba(255,255,255,.5)'], [0.75, 'rgba(255,255,255,.4)'], [0.88, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
  const bokeh = mk(26, 4, r => ({ x: r() * W, y: r() * H, r: 10 + r() * 40, vx: (r() - 0.5) * 12, vy: -5 - r() * 10, a: 0.2 + r() * 0.4, ph: r() * 6 }));
  const burstP = {};
  bursts.forEach(([t, , , n, seed]) => {
    burstP[t] = mk(n, seed, r => { const a = r() * Math.PI * 2, s = 300 + r() * 1200; return { vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.75, sz: 6 + r() * 20, c: (r() * 6) | 0, ph: r() * 6, tw: 6 + r() * 10 }; });
  });
  const snow = mk(130, 61, r => { const d = 0.25 + r() * 0.75; return { x: r() * W, y: r() * (H + 100), d, v: 50 + d * 140, ph: r() * 6, sw: 10 + r() * 40, r: 2 + d * 6 }; });
  const sparks = mk(22, 71, r => ({ x: 160 + r() * (W - 320), y: 100 + r() * (H - 300), ph: r() * 6, s: 10 + r() * 22, sp: 1.5 + r() * 2.5 }));

  /* ======================================================================
     RENDER
     ====================================================================== */
  const camEl = $('#cam'), bgBurst = $('#bg .burst'), bgNight = $('#bg .night'), flashEl = $('#flash');
  const clouds = $$('#bg .cl');
  const qtext = $('#qtext'), qph = $('#qph'), caret = $('#Lsearch .caret');
  const spin = $('#Lspin svg'), waves = $$('.wave i');
  const pFill = $('#pFill'), pKnob = $('#pKnob'), pT0 = $('#pT0'), pT1 = $('#pT1'), nowFill = $('#nowFill');
  const vFill = $('#vFill'), vKnob = $('#vKnob'), vNum = $('#vNum');
  const eqBars = [...eq.children], strip = $('#strip'), film = $$('#film i'), vWhen = $('#vWhen'), vIdx = $('#vIdx');
  const rbx = $$('.rb, .rbx');
  const TYPE = [[0, ''], [1.08, '吉'], [1.22, '吉安'], [2.2, '吉安周'], [2.34, '吉安周末'], [3.62, '听说 吉安周末有大事发生？']];
  const WHEN = ['10月17日 17:00 · 亲子彩虹跑', '10月17日 17:00 · 亲子彩虹跑', '10月17日 20:00 · 乐队欢乐party', '10月17日 20:00 · 乐队欢乐party',
    '10月16-18日 · 精彩演出不断', '10月16-18日 · 精彩演出不断', '10月16-18日 · 精彩演出不断', '10月16-18日 · 精彩演出不断', '10月16日 19:00 · 狂欢星期五', '10月16日 19:00 · 狂欢星期五'];
  const SCR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const sumEv = (list, t) => { let a = 0; for (const [ti, amp, k] of list) if (t >= ti && t < ti + 2.5) a += amp * Math.exp(-(t - ti) * k); return a; };
  const beatP = t => { let p = 0; for (const b of beats) if (t >= b && t < b + 0.5) p = Math.exp(-(t - b) * 7); return p; };
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function render(t) {
    t = clamp(t, 0, DURATION);
    tl.seek(t, true);
    const bp = beatP(t);

    // camera (+ beat breathing during the star section)
    const s = cam.s * (1 + bp * 0.012 * fx.eq);
    camEl.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${s}) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg)`;

    // background life
    clouds.forEach((c, i) => { c.style.transform = `translateX(${Math.sin(t * 0.12 + i * 1.7) * 60 + t * (i % 2 ? 6 : -5)}px)`; });
    bgBurst.style.opacity = fx.burst * (0.85 + 0.15 * bp);
    bgBurst.style.transform = `scale(${1 + bp * 0.04 * fx.eq})`;
    bgNight.style.opacity = fx.night;
    flashEl.style.opacity = clamp(sumEv(flashes, t));

    // search typing + caret
    let q = ''; for (const [k, v] of TYPE) if (t >= k) q = v;
    if (qtext.textContent !== q) qtext.textContent = q;
    qph.style.opacity = q ? 0 : 1;
    const typing = TYPE.some(([k]) => t >= k && t < k + 0.25);
    caret.style.opacity = t > 0.98 && t < 4.3 ? (typing || Math.floor(t * 2.6) % 2 === 0 ? 1 : 0) : 0;
    spin.style.transform = `rotate(${t * 420}deg)`;

    // sound waves + EQ
    waves.forEach((w, i) => { const v = 0.35 + 0.65 * Math.abs(Math.sin(t * (5 + i * 1.3) + i)); w.style.height = (10 + v * 30 * (0.6 + 0.4 * bp)).toFixed(1) + 'px'; });
    eq.style.opacity = fx.eq;
    if (fx.eq > 0) eqBars.forEach((b, i) => { const d = Math.abs(i - 31.5) / 32; const v = (0.25 + 0.75 * Math.abs(Math.sin(t * (2.4 + (i % 7) * 0.5) + i * 0.9))) * (0.45 + 0.55 * bp) * (1 - d * 0.55); b.style.height = (24 + v * 230).toFixed(0) + 'px'; });

    // player progress / volume
    const el = Math.max(0, t - 8.5);
    const pr = clamp(el / 258);
    pFill.style.width = pr * 100 + '%'; pKnob.style.left = pr * 100 + '%';
    pT0.textContent = mmss(el); pT1.textContent = '-' + mmss(258 - el);
    nowFill.style.width = (pr * 100 + 2).toFixed(2) + '%';
    const v = fx.vol;
    vFill.style.width = ((v - 0) / 100 * 100) + '%'; vKnob.style.left = v + '%'; vNum.textContent = Math.round(v);

    // scrambles
    for (const sc of scrambles) {
      const txt = sc.el._txt, u = (t - sc.t0) / sc.dur; let out = '';
      if (u >= 1) out = txt;
      else if (u > 0) { const n = Math.floor(u * txt.length), f = Math.floor(t * 30); for (let i = 0; i < txt.length; i++) out += i < n || txt[i] === ' ' ? txt[i] : (i < n + 6 ? SCR[Math.floor(hash(f, i) * SCR.length)] : ''); }
      if (sc.el.textContent !== out) sc.el.textContent = out;
    }
    rbx.forEach(e => { e.style.backgroundPosition = `${(t * 26) % 200}% 0`; });

    // photo viewer chrome follows the strip
    const sx = -gsap.getProperty(strip, 'x') / 1500;
    const idx = clamp(Math.round(sx), 0, 9);
    if (vWhen.textContent !== WHEN[idx]) vWhen.textContent = WHEN[idx];
    vIdx.textContent = idx + 1;
    film.forEach((f, i) => { const k = clamp(1 - Math.abs(i - sx)); f.style.opacity = 0.45 + 0.55 * k; f.style.transform = `scale(${1 + 0.28 * k})`; f.style.boxShadow = `0 0 0 ${2 * k}px rgba(255,255,255,${k})`; });

    // particles
    cb.clearRect(0, 0, W, H); cf.clearRect(0, 0, W, H);
    for (const p of bokeh) {
      const x = ((p.x + p.vx * t) % (W + 200) + W + 200) % (W + 200) - 100, y = ((p.y + p.vy * t) % (H + 200) + H + 200) % (H + 200) - 100;
      cb.globalAlpha = p.a * (0.7 + 0.3 * Math.sin(t + p.ph)) * (1 - fx.night * 0.5); cb.drawImage(bokehS, x - p.r, y - p.r, p.r * 2, p.r * 2);
    }
    cb.globalAlpha = 1;
    cf.globalCompositeOperation = 'lighter';
    for (const [tb, cx, cy] of bursts) {
      const u = t - tb; if (u < 0 || u > 3.2) continue;
      const damp = (1 - Math.exp(-2.4 * u)) / 2.4;
      for (const p of burstP[tb]) {
        const x = cx + p.vx * damp, y = cy + p.vy * damp + 50 * u * u, tw = 0.55 + 0.45 * Math.sin(u * p.tw + p.ph);
        cf.globalAlpha = clamp((3.2 - u) / 1.4) * tw; const sz = p.sz * (0.6 + 0.4 * tw);
        cf.drawImage(glow[p.c], x - sz, y - sz, sz * 2, sz * 2);
      }
    }
    cf.globalCompositeOperation = 'source-over';
    const sn = env(t, 32.8 + MORE, 37.5 + MORE, 0.5, 0.4);
    if (sn > 0) for (const p of snow) {
      const y = ((p.y + p.v * t) % (H + 100)) - 50, x = p.x + Math.sin(t * 0.9 + p.ph) * p.sw, sz = p.r * 2.2;
      cf.globalAlpha = sn * (0.4 + 0.6 * p.d); cf.drawImage(glow[1], x - sz, y - sz, sz * 2, sz * 2);
    }
    const sp = Math.max(env(t, 10.8, 17.4, 0.4, 0.6) * 0.8, env(t, 18.9, 20.0, 0.3, 0.4) * 0.8, env(t, 39.6 + MORE, 50, 0.6, 0.4) * 0.7);
    if (sp > 0) { cf.fillStyle = '#fff'; for (const p of sparks) { const k = Math.max(0, Math.sin(t * p.sp + p.ph)); cf.globalAlpha = sp * k; cf.drawImage(glow[0], p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); } }
    cf.globalAlpha = 1;
  }

  /* ---------- boot ---------- */
  async function ready() {
    const txt = sel => $$(sel).map(e => e.textContent).join('') + '？';
    await Promise.all([
      document.fonts.load('400 40px "YouSheBiaoTiHei"', txt('.ys, #Lstar .n2')),
      document.fonts.load('400 40px "Smiley Sans Oblique"', txt('.sm, #Lstar .n1, #showSub')),
      ...['500 20px NS', '700 20px NS', '900 20px NS', '600 20px MS', '700 20px MS', '800 20px MS'].map(f => document.fonts.load(f, '吉安周末ABC0123')),
    ]);
    await document.fonts.ready;
    await Promise.all($$('img').map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
    await Promise.all($$('img').map(img => (img.naturalWidth && img.decode ? img.decode().catch(() => {}) : null)));
  }
  window.DURATION = DURATION;
  window.renderAt = t => render(t);
  ready().then(() => {
    render(0); window.__ready = true;
    if (RENDER) return;
    const stage = $('#stage');
    const fit = () => { const k = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${k})`; };
    addEventListener('resize', fit); fit();
    const fixed = params.get('t'); if (fixed !== null) { render(+fixed); return; }
    let t0 = performance.now(), paused = false, tp = 0;
    addEventListener('keydown', e => {
      if (e.code === 'Space') { paused = !paused; if (!paused) t0 = performance.now() - tp * 1000; }
      if (e.code === 'ArrowRight') t0 -= 2000; if (e.code === 'ArrowLeft') t0 += 2000;
    });
    const loop = now => { if (!paused) { tp = ((now - t0) / 1000) % DURATION; render(tp); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
})();
