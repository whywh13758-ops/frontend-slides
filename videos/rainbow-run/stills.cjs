// Usage: node stills.cjs out_dir t1 t2 ...   — snapshot frames for review
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const args = process.argv.slice(2);
  const pi = args.indexOf('--page');
  const PAGE = pi >= 0 ? args.splice(pi, 2)[1] : 'index.html';
  const [outDir, ...times] = args;
  const browser = await chromium.launch({ args: ['--run-all-compositor-stages-before-draw', '--disable-checker-imaging', '--disable-low-res-tiling', '--disable-partial-raster'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('file://' + path.resolve(__dirname, PAGE) + '?render=1');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  for (const t of times.map(Number)) {
    await page.evaluate(t => window.renderAt(t), t);
    await page.screenshot({ path: path.join(outDir, `t${String(t).padStart(5, '0')}.png`) });
  }
  await browser.close();
})();
