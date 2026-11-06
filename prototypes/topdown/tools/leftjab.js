// usage: node tools/leftjab.js board.html outprefix [tag]  -> per-heading strike crops (3x) of Kaya's jab with the /vfx burst, stitched by leftcombine.py
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, url, outDir] = process.argv; fs.mkdirSync(outDir, { recursive: true });
  const D8 = ['south','south-east','east','north-east','north','north-west','west','south-west'];
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url + '?record=1'); await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => window.__zoom(3));
  for (const d of D8) {
    await p.evaluate(() => window.__adv(800));
    await p.evaluate(dd => { window.__fired = false; window.__jabTest('jab', dd, () => { window.__fired = true; }); }, d);
    let n = 0;
    while (!(await p.evaluate(() => window.__fired)) && n++ < 90) await p.evaluate(() => window.__adv(1000 / 30));
    for (let k = 0; k < 3; k++) {
      const pos = await p.evaluate(() => window.__unitPos('kaya'));
      const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { l: c.left, t: c.top }; });
      const cx = r.l + (pos.x - pos.rx) * 3, cy = r.t + (pos.y - pos.ry) * 3;
      await p.screenshot({ path: `${outDir}/${d}_${k}.png`, clip: { x: Math.round(cx - 150), y: Math.round(cy - 190), width: 300, height: 260 } });
      await p.evaluate(() => window.__adv(2 * 1000 / 30));
    }
  }
  console.log('errors', errs); await b.close();
})();
