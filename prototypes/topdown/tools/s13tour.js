// surfaces tour at game speed (30 fps, 3x): node tools/s13tour.js page.html outDir  (scripted paints on the quarry floor, no fight)
const { chromium } = require('playwright'); const fs = require('fs');
const EV = [
  [0, 'focus', 9.5, 4.5], [5.5, 'fire', [[7, 3], [8, 3]]], [7.5, 'fire', [[7, 2], [8, 2], [11, 3], [12, 3]]], [9.5, 'fire', [[11, 2], [12, 2], [7, 8], [8, 8]]], [13, 'focus', 4.5, 5.5],
  [14, 'water', [[3, 5], [4, 5], [3, 6], [4, 6], [2, 6]]], [18, 'ice', [[3, 5], [4, 5], [3, 6], [4, 6]]], [22, 'focus', 7.5, 5.5], [23, 'steam', [[6, 5], [7, 5], [6, 6], [7, 6]]],
  [29, 'clear', [[6, 5], [7, 5], [6, 6], [7, 6]]], [29.2, 'focus', 10.5, 5.5], [31, 'mud', [[8, 5], [9, 5], [8, 6]]], [34, 'oil', [[13, 5], [14, 5], [13, 6]]], [37, 'focus', 12, 5.5],
];
(async () => {
  const [,, page, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`file://${page}?level=floor&record=1&variant=base`); await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => window.__zoom(3));
  let n = 0, ei = 0;
  for (let f = 0; f < 40 * 30; f++) {
    const t = f / 30;
    while (ei < EV.length && EV[ei][0] <= t) { const [, k, a, bb] = EV[ei++];
      await p.evaluate(([k, a, bb]) => { if (k === 'focus') window.__focus(GX + a * CS, GY + bb * CS); else { for (const [x, y] of a) { const c = cellOf(BOARD, x, y); if (c) c.surface = k === 'clear' ? null : { id: k, dur: 3, spread: 0 }; } surfDirty = true; } }, [k, a, bb]); }
    await p.evaluate(() => window.__adv(1000 / 30)); await p.screenshot({ path: `${dir}/f${String(n++).padStart(5, '0')}.png` });
  }
  console.log('frames', n, 'errors', errs); await b.close();
})();
