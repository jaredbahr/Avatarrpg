const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, dir, ...pages] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  const SEQ = [[[], 500], [['d'], 1800], [[], 450], [['r'], 1800], [[], 450], [['u', 'r'], 1300], [[], 450], [['u'], 1800], [[], 700]];
  await Promise.all(pages.map(async (spec) => {
    const [tag, url] = spec.split('=');
    const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await p.goto(url + '?record=1&zoom=4&nodummy=1'); await p.waitForFunction(() => window.__ready);
    let n = 0; const FR = 1000 / 30;
    for (const [keys, ms] of SEQ) {
      await p.evaluate(k => window.__g.hold(k), keys);
      for (let e = 0; e < ms; e += FR) {
        await p.evaluate(ms => window.__adv(ms), FR);
        const s = await p.evaluate(() => window.__g.state());
        const r = await p.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return { l: b.left, t: b.top }; });
        await p.screenshot({ path: `${dir}/${tag}_${String(n).padStart(4, '0')}.png`, clip: { x: Math.round(r.l + s.sx * 4 - 140), y: Math.round(r.t + s.sy * 4 - 250), width: 280, height: 300 } });
        n++;
      }
    }
    console.log(tag, n); await p.close();
  }));
  await b.close();
})();
