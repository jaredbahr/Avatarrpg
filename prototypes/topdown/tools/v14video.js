// badan-houses.mp4: Kaya walks past houses, in front and behind (depth sort). node tools/v14video.js url framesDir [dry]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, url, dir, mode] = process.argv; const dry = mode === 'dry'; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + '?record=1'); await p.waitForFunction(() => window.__ready);
  let n = 0, t = 0; const FR = 1000 / 30;
  const frame = async () => { await p.evaluate(ms => window.__adv(ms), FR); t += FR; if (!dry) await p.screenshot({ path: `${dir}/f${String(n).padStart(5, '0')}.png` }); n++; };
  const run = async ms => { for (let e = 0; e < ms; e += FR) await frame(); };
  const st = () => p.evaluate(() => window.__g.state());
  const go = async (x, y, max = 20000) => { await p.evaluate(([x, y]) => window.__g.walkTo(x, y), [x, y]); let e = 0; for (; e < max; e += FR) { await frame(); const s = await st(); if (!s.moving && !s.path) break; } const s = await st(); console.log('go', x, y, 'ended', Math.round(s.x), Math.round(s.y), 'ms', Math.round(e)); };
  const tp = async (x, y, z) => { await p.evaluate(([x, y, z]) => { kaya.x = x; kaya.y = y; kaya.path = []; window.__g.zoom(z); }, [x, y, z]); await run(200); };
  // north row, in front: Gao, Mira, Ne
  await tp(400, 372, 3); await go(700, 374); await go(930, 372);
  // behind the north row, east to west
  await tp(1010, 214, 3); await go(660, 214, 12000); await go(430, 214, 9000);
  // south row, in front
  await tp(420, 846, 3); await go(740, 850); await go(1000, 848, 9000);
  // behind the south row
  await tp(1090, 700, 3); await go(780, 700, 9000); await go(560, 700, 9000);
  await run(600);
  console.log('frames', n, 'secs', (n / 30).toFixed(1), 'errors', errs); await b.close();
})();
