const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(process.argv[2] + '?record=1'); await p.waitForFunction(() => window.__ready);
  const r = await p.evaluate(() => {
    const d = ground.getContext('2d').getImageData(0, 0, PW, PH).data, lum = (x, y) => { const i = (y * PW + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
    return OBJ.filter(o => o.kind === 'house').map(o => {
      const A = alphaOf(IMG['ob:' + o.k]); let x1 = 0; for (let y = o.h - 6; y < o.h; y++) for (let x = 0; x < o.w; x++) if (A[y * o.w + x]) x1 = Math.max(x1, x);
      const avg = (xa, xb, ya, yb) => { let s = 0, n = 0; for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { s += lum(x, y); n++; } return s / n; };
      const X = o.x + x1, B = o.base, cast = avg(X + 5, X + 16, B - 14, B - 4), ref = avg(X + 42, X + 52, B - 14, B - 4), front = avg(o.x + x1 - 80, o.x + x1 - 60, B + 9, B + 14), lane = avg(o.x + x1 - 80, o.x + x1 - 60, B + 24, B + 30);
      return { k: o.k, cast: +cast.toFixed(1), ground: +ref.toFixed(1), darkerSide: +(1 - cast / ref).toFixed(2), frontStrip: +front.toFixed(1), lane: +lane.toFixed(1), darkerFront: +(1 - front / lane).toFixed(2) };
    });
  });
  for (const x of r) console.log(JSON.stringify(x)); await b.close();
})();
