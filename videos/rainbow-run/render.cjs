// Render index.html to MP4 with motion blur (sub-frame accumulation).
// Usage: node render.cjs [out.mp4] [--fps 30] [--sub 4] [--workers 4] [--from 0] [--to 62]
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const out = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : 'out/rainbow-run.mp4');
// --page v4/index.html renders another composition in this folder
const FPS = +opt('fps', 30), SUB = +opt('sub', 4), WORKERS = +opt('workers', 4);
const SHUTTER = 0.5; // 180° shutter
const PAGE = path.resolve(__dirname, opt('page', 'index.html'));
const ARGS = ['--run-all-compositor-stages-before-draw', '--disable-checker-imaging', '--disable-low-res-tiling', '--disable-partial-raster'];

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.seg-'));
  const browser = await chromium.launch({ args: ARGS });
  const probe = await browser.newPage();
  await probe.goto('file://' + PAGE + '?render=1');
  await probe.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const dur = await probe.evaluate(() => window.DURATION);
  const FAST = await probe.evaluate(() => window.FAST || []);
  const isFast = t => FAST.some(([a, b]) => t >= a && t < b);
  await probe.close();
  const from = +opt('from', 0), to = Math.min(+opt('to', dur), dur);
  const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
  const per = Math.ceil((f1 - f0) / WORKERS);
  const started = Date.now();
  let done = 0;

  async function worker(w) {
    const a = f0 + w * per, b = Math.min(f1, a + per);
    if (a >= b) return null;
    const seg = path.join(tmp, `seg${w}.mp4`);
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('file://' + PAGE + '?render=1');
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
    // pre-roll so every tween initialises in timeline order
    await page.evaluate(t1 => { for (let t = 0; t < t1; t += 0.25) window.renderAt(t); }, a / FPS);
    const vf = SUB > 1 ? `tmix=frames=${SUB},select='not(mod(n+1\\,${SUB}))',setpts=N/${FPS}/TB` : 'null';
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS * SUB), '-i', '-',
      '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-threads', '1', seg]);
    ff.stderr.on('data', d => process.stderr.write(d));
    const closed = new Promise(r => ff.on('close', r));
    for (let i = a; i < b; i++) {
      // slow moments: one sample repeated; fast moves: SUB samples across a 180° shutter
      const blur = SUB > 1 && isFast(i / FPS);
      let buf;
      for (let k = 0; k < SUB; k++) {
        if (blur || k === 0) {
          await page.evaluate(t => window.renderAt(t), i / FPS + (blur ? (k / SUB) * (SHUTTER / FPS) : 0));
          buf = await page.screenshot({ type: 'jpeg', quality: 94 });
        }
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      done++;
      if (done % 30 === 0) {
        const el = (Date.now() - started) / 1000, total = f1 - f0;
        process.stdout.write(`\r${done}/${total} frames  ${el.toFixed(0)}s elapsed  ~${(el / done * (total - done)).toFixed(0)}s left   `);
      }
    }
    ff.stdin.end();
    await closed;
    await page.close();
    return seg;
  }

  const segs = (await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)))).filter(Boolean);
  await browser.close();
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nwrote ${out} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
})();
