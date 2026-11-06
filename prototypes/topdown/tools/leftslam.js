// usage: node tools/leftslam.js board.html outPrefix dir  -> a frame every 100 ms of the Driller's slam (floor board, 3x)
const { chromium } = require('playwright');
(async () => {
  const [,, url, out, dir] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url + '?record=1&level=floor'); await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => window.__zoom(3)); const u0 = await p.evaluate(() => window.__unitPos('grumbler')); await p.evaluate(([x, y]) => window.__focus(x, y), [u0.x, u0.y]); await p.evaluate(() => window.__adv(1500));
  await p.evaluate(d => window.__slamTest(d), dir);
  for (let k = 0; k < 16; k++) {
    const pos = await p.evaluate(() => window.__unitPos('grumbler')); const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { l: c.left, t: c.top }; });
    await p.screenshot({ path: `${out}_${String(k).padStart(2, '0')}.png`, clip: { x: Math.round(r.l + (pos.x - pos.rx) * 3 - 150), y: Math.round(r.t + (pos.y - pos.ry) * 3 - 230), width: 300, height: 280 } });
    await p.evaluate(() => window.__adv(100));
  }
  console.log('errors', errs); await b.close();
})();
