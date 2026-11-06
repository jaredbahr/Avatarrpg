// usage: node tools/leftlvl.js board.html level outPrefix  -> frames at 2.3, 2.7, 3.1 s of game time after the auto start
const { chromium } = require('playwright');
(async () => {
  const [,, url, level, out] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url + '?record=1&level=' + level); await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => window.__zoom(3)); await p.evaluate(() => window.__auto());
  const at = { 2300: 'a', 2800: 'b', 3300: 'c' }; let t = 0;
  while (t < 3400) { await p.evaluate(() => window.__adv(100)); t += 100; if (at[t]) await p.screenshot({ path: `${out}_${at[t]}.png` }); }
  console.log('errors', errs); await b.close();
})();
