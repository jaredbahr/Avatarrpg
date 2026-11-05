// a still of the live game: node tools/v12zshot.js url x y zoom out.png [advanceMs]
const { chromium } = require('playwright');
(async () => {
  const [,, url, x, y, z, out, adv] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await p.goto(url + '?record=1'); await p.waitForFunction(() => window.__ready);
  await p.evaluate(([x, y, z]) => { kaya.x = +x; kaya.y = +y; kaya.path = []; window.__g.zoom(+z); }, [x, y, z]);
  await p.evaluate(ms => window.__adv(ms), +(adv || 800)); await p.screenshot({ path: out }); await b.close();
})();
