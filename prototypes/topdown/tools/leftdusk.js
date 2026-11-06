// usage: node tools/leftdusk.js tutorial-demo.html outPrefix   (start=home: the walk home) -> out_a.png (arrival) out_b.png (square)
const { chromium } = require('playwright');
(async () => {
  const [,, url, out] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url + '?record=1&start=home' + (process.env.TUTQ||'')); await p.waitForFunction(() => window.__shell);
  let n = 0; const shots = { 1200: 'a', 3200: 'b', 5600: 'c' }; let t = 0;
  while (true) {
    const sh = await p.evaluate(() => ({ ...window.__shell })); if (sh.phase === 'walk') break; await p.evaluate(ms => window.__adv(ms), 100); if (n++ > 400) break;
  }
  for (let k = 0; k < 60; k++) {
    await p.evaluate(ms => window.__adv(ms), 100); t += 100;
    if (shots[t]) await p.screenshot({ path: `${out}_${shots[t]}.png` });
  }
  console.log('errors', errs); await b.close();
})();
