const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, url, out] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url + '?record=1&zoom=4'); await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => window.__g.walkTo(392, 250)); await p.evaluate(() => window.__adv(6000));
  const shots = [];
  for (const mv of ['jab', 'whip', 'stomp']) for (const d of ['east', 'south', 'north']) {
    await p.evaluate(d => window.__g.face(d), d); await p.evaluate(() => window.__adv(300));
    await p.evaluate(m => window.__g.move(m), mv);
    for (const t of [380, 160, 160]) { await p.evaluate(ms => window.__adv(ms), t); const s = await p.evaluate(() => window.__g.state());
      const r = await p.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return { l: b.left, t: b.top }; });
      const f = `work/pr4_${mv}_${d}_${t}_${shots.length}.png`; await p.screenshot({ path: f, clip: { x: Math.round(r.l + s.sx * 4 - 240), y: Math.round(r.t + s.sy * 4 - 300), width: 480, height: 400 } }); shots.push(f); }
    await p.evaluate(() => window.__adv(1200));
  }
  fs.writeFileSync(out, JSON.stringify(shots)); console.log('errors', errs); await b.close();
})();
