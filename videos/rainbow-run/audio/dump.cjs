// Export the sound cues a composition registers (window.SFX / window.MUSIC) as JSON.
// Usage: node audio/dump.cjs v4/index.html audio/cues.json
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const [page = 'v4/index.html', out = 'audio/cues.json'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const p = await browser.newPage();
  await p.goto('file://' + path.resolve(__dirname, '..', page) + '?render=1');
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const cues = await p.evaluate(() => ({ duration: window.DURATION, sfx: window.SFX, music: window.MUSIC }));
  fs.writeFileSync(path.resolve(out), JSON.stringify(cues, null, 1));
  console.log(`${cues.sfx.length} cues, ${cues.duration}s → ${out}`);
  await browser.close();
})();
