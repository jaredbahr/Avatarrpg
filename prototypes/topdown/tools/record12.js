// v12 tour: waterfall, bridge, a house close-up, the lamps, the cat. Usage: node tools/record12.js file://.../badan-topdown.html frames [dry]
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, url, dir, mode] = process.argv; const dry = mode === 'dry';
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + '?record=1'); await p.waitForFunction(() => window.__ready);
  let n = 0, t = 0; const FR = 1000 / 30;
  const frame = async () => { await p.evaluate(ms => window.__adv(ms), FR); t += FR; if (!dry) await p.screenshot({ path: `${dir}/f${String(n).padStart(5, '0')}.png` }); n++; };
  const run = async ms => { for (let e = 0; e < ms; e += FR) await frame(); };
  const st = () => p.evaluate(() => window.__g.state());
  const go = async (x, y, max = 12000) => { await p.evaluate(([x, y]) => window.__g.walkTo(x, y), [x, y]); for (let e = 0; e < max; e += FR) { await frame(); const s = await st(); if (!s.moving && !s.path) break; } };
  const tp = async (x, y, z) => { await p.evaluate(([x, y, z]) => { kaya.x = x; kaya.y = y; kaya.path = []; window.__g.zoom(z); }, [x, y, z]); await run(150); };
  const face = d => p.evaluate(d => window.__g.face(d), d);
  // 1 the waterfall: the canal's last stretch to the lip, then the fall
  await tp(260, 480, 4); await go(130, 480); await go(90, 480); await face('west'); await run(1600);
  await p.evaluate(() => window.__g.zoom(5)); await run(2200);
  await tp(70, 540, 4); await face('north'); await run(3600);
  // 2 the bridge: a walk over it, then a close look
  await tp(508, 520, 4); await go(508, 404); await p.evaluate(() => window.__g.zoom(6)); await run(1500);
  await go(508, 500); await run(1200);
  await p.evaluate(() => window.__g.zoom(5)); await tp(560, 505, 6); await face('west'); await run(2200);
  // 3 a house close-up (Mira's), the doorstep and the foot
  await tp(640, 400, 5); await go(690, 372); await face('north'); await run(2800);
  await tp(900, 380, 5); await go(912, 368); await face('north'); await run(2200);
  // 4 the lamps by the east road
  await tp(900, 520, 5); await go(980, 510); await face('north'); await run(3800);
  // 5 the cat on the south lawn, and the rim trees at the bottom-right
  await tp(400, 840, 4); await go(395, 852); await face('south'); await run(6000);
  await tp(1090, 770, 4); await go(1070, 800); await face('east'); await run(2000);
  console.log('frames', n, 'secs', (t / 1000).toFixed(1), 'errors', errs);
  await b.close();
})();
