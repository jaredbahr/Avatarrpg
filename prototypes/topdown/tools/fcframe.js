const { chromium } = require('playwright');
(async () => {
  const [,, url, out, ...secs] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(url + '?record=1&zoom=2'); await p.waitForFunction(() => window.__ready); await p.evaluate(() => window.__auto());
  let t = 0; for (const s of secs.map(Number)) { while (t < s) { await p.evaluate(() => window.__adv(33.3)); t += 1 / 30; } await p.screenshot({ path: `${out}_${s}.png` }); }
  await b.close();
})();
