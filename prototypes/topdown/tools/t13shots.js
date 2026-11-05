// timed stills of an auto-played board: node tools/t13shots.js url zoom outprefix t1,t2,... [cond]
// each t is game seconds; a still is saved at each; 'fire' as cond waits for the first burning cell first
const { chromium } = require('playwright');
(async () => {
  const [,, url, zoom, pre, ts, cond] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'record=1'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await p.evaluate(z => window.__zoom && window.__zoom(z), +zoom); await p.evaluate(() => window.__auto());
  let t = 0;
  if (cond === 'fire') for (let k = 0; k < 600; k++) { await p.evaluate(() => window.__adv(100)); t += 0.1; if ((await p.evaluate(() => window.__state().surf)).includes('f')) break; }
  const t0 = cond ? t : 0;
  for (const [i, s0] of ts.split(',').map(Number).entries()) { const s = t0 + s0; while (t < s) { await p.evaluate(() => window.__adv(100)); t += 0.1; } await p.screenshot({ path: `${pre}_${i}.png` }); }
  console.log('t', t.toFixed(1), 'errors', errs); await b.close();
})();
