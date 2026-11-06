// stills of the live game for the houses: node tools/v14shots.js url prefix   -> qcrops/<prefix>-<name>-{1x,3x}.png-ish full viewport shots, then cropped by python
const { chromium } = require('playwright');
(async () => {
  const [,, url, prefix] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + '?record=1'); await p.waitForFunction(() => window.__ready);
  for (const z of [1, 3]) {
    await p.evaluate(z => window.__g.zoom(z), z);
    // house door positions (world): front of each house
    const H = await p.evaluate(() => OBJ.filter(o => o.kind === 'house').map(o => ({ k: o.k, x: o.x, y: o.y, w: o.w, h: o.h, base: o.base })));
    for (const h of H) {
      await p.evaluate(([x, y]) => { kaya.x = x; kaya.y = y; kaya.path = []; }, [h.x + h.w / 2, h.base + 40]);
      await p.evaluate(() => window.__adv(600));
      await p.screenshot({ path: `v14/shot_${prefix}_${h.k}_${z}x.png` });
    }
  }
  console.log('errors', errs); await b.close();
})();
