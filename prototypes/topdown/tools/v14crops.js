// raw game shots of every house at zoom 1 and 3, Kaya on the lane in front: node tools/v14crops.js url outPrefix   -> <outPrefix>_<house>_{1x,3x}.png
const { chromium } = require('playwright');
(async () => {
  const [,, url, prefix] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + '?record=1'); await p.waitForFunction(() => window.__ready);
  const H = await p.evaluate(() => OBJ.filter(o => o.kind === 'house').map(o => ({ k: o.k, x: o.x, y: o.y, w: o.w, h: o.h, base: o.base })));
  for (const z of [1, 3]) {
    await p.evaluate(z => window.__g.zoom(z), z);
    for (const h of H) {
      await p.evaluate(([x, y]) => { kaya.x = x; kaya.y = y; kaya.path = []; }, [h.x + h.w / 2 + 30, h.base + 34]);
      await p.evaluate(() => window.__adv(500));
      const r = await p.evaluate(([h, z]) => { const mx = Math.max(0, h.x - 40), my = Math.max(0, h.y - 14); cam.rx = Math.round(z === 3 ? Math.max(0, h.x - 6) : mx); cam.ry = Math.round(z === 3 ? Math.max(0, h.y - 6) : my); cam.x = cam.rx; cam.y = cam.ry; render(); return [cam.rx, cam.ry]; }, [h, z]);
      const w = z === 3 ? 1280 : Math.min(1280, h.w + 80), hh = z === 3 ? 960 : h.h + 110;
      await p.screenshot({ path: `${prefix}_${h.k}_${z}x.png`, clip: { x: 0, y: 0, width: w, height: hh } });
    }
  }
  console.log('errors', errs); await b.close();
})();
