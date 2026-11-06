const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, url, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(url + '?record=1'); await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => window.__g.walkTo(392, 250)); await p.evaluate(() => window.__adv(6000));
  await p.evaluate(() => window.__g.zoom(6)); await p.evaluate(() => window.__g.face('east')); await p.evaluate(() => window.__adv(1500));
  const FR = 1000 / 30; let n = 0;
  const s = await p.evaluate(() => window.__g.state()); const r = await p.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return { l: b.left, t: b.top }; });
  const clip = { x: Math.round(r.l + s.sx * 6 - 170), y: Math.round(r.t + s.sy * 6 - 400), width: 640, height: 480 };
  for (let k = 0; k < 2; k++) {
    await p.evaluate(() => window.__g.jab());
    for (let e = 0; e < 1900; e += FR) { await p.evaluate(ms => window.__adv(ms), FR); if (k === 1) await p.screenshot({ path: `${dir}/j${String(n++).padStart(4, '0')}.png`, clip }); }
  }
  console.log('frames', n); await b.close();
})();
