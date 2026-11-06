const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, v1, v2, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  const SEQ = [[[], 700], [['d'], 1700], [[], 700], [['r'], 1700], [[], 700], [['u', 'r'], 1500], [[], 900]];
  for (const [tag, url] of [['v2', v1 + '?record=1&zoom=4'], ['v3', v2 + '?record=1&zoom=4']]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await p.goto(url); await p.waitForFunction(() => window.__ready);
    let n = 0; const FR = 1000 / 30;
    for (const [keys, ms] of SEQ) {
      await p.evaluate(k => window.__g.hold(k), keys);
      for (let e = 0; e < ms; e += FR) {
        await p.evaluate(ms => window.__adv(ms), FR);
        const s = await p.evaluate(() => window.__g.state());
        const r = await p.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return { l: b.left, t: b.top }; });
        const z = 4, W = 320, H = 320;
        const cx = r.l + s.sx * z, cy = r.t + s.sy * z;
        await p.screenshot({ path: `${dir}/${tag}_${String(n).padStart(4, '0')}.png`, clip: { x: Math.round(cx - W / 2), y: Math.round(cy - H + 70), width: W, height: H } });
        n++;
      }
    }
    await p.evaluate(() => window.__g.release());
    console.log(tag, n); await p.close();
  }
  await b.close();
})();
