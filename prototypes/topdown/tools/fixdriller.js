// fixes pass: the Driller's slam in every heading, close up. node tools/fixdriller.js <board.html> <outdir> [headings]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, url, dir, hs] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 480 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + url + '?level=floor&record=1'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await p.evaluate(() => window.__zoom(4));
  const heads = (hs || 'west,south-west,north-west,south,east,north,north-east,south-east').split(',');
  for (const d of heads) {
    await p.evaluate(d => { const u = UNITS.find(u => u.k === 'grumbler'); u.dir = d; u.anim = 'idle'; window.__focus(u.x, u.y - 20); }, d);
    for (let i = 0; i < 50; i++) await p.evaluate(() => window.__adv(33));
    await p.evaluate(d => { const u = UNITS.find(u => u.k === 'grumbler'); u.anim = 'attack'; u.at = 0; u.struck = false; u.onStrike = () => { window.__hit = window.__t; }; u.done = null; window.__t = 0; }, d);
    let n = 0; const ms = 33;
    for (let i = 0; i < 80; i++) { await p.evaluate(ms => { window.__t += ms; window.__adv(ms); }, ms); if (i % 2 === 0) await p.screenshot({ path: `${dir}/${d}_${String(n++).padStart(2, '0')}.png` }); }
    console.log(d, 'hit at', await p.evaluate(() => window.__hit), 'ms');
  }
  console.log('errors', errs); await b.close();
})();
