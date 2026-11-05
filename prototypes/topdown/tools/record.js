const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, url, dir, dryArg] = process.argv; const dry = dryArg === 'dry';
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(url + '?record=1'); await p.waitForFunction(() => window.__ready);
  let n = 0, t = 0; const FR = 1000 / 30;
  const frame = async () => { await p.evaluate(ms => window.__adv(ms), FR); t += FR; if (!dry) await p.screenshot({ path: `${dir}/f${String(n).padStart(5, '0')}.png` }); n++; };
  const run = async ms => { for (let e = 0; e < ms; e += FR) await frame(); };
  const hold = async (ks, ms) => { await p.evaluate(k => window.__g.hold(k), ks); await run(ms); await p.evaluate(() => window.__g.release()); };
  const st = () => p.evaluate(() => window.__g.state());
  const go = async (x, y, max = 8000) => {
    await p.evaluate(([x, y]) => window.__g.walkTo(x, y), [x, y]);
    for (let e = 0; e < max; e += FR) { await frame(); const s = await st(); if (!s.moving && !s.path) break; }
    console.log('at', JSON.stringify(await st()), 'wanted', x, y, 't', (t / 1000).toFixed(1));
  };
  await run(1500);
  await hold(['r'], 1100); await hold(['u', 'r'], 600); await hold(['u'], 300);
  await hold(['l'], 1000); await hold(['d', 'l'], 600); await hold(['d'], 300);
  await hold(['d', 'r'], 600); await hold(['u', 'l'], 600); await run(400);
  console.log('dirs done', JSON.stringify(await st()), (t / 1000).toFixed(1));
  await go(12, 12); await go(13, 19); await run(300); await go(19, 20); await run(1200);
  await go(13, 17); await go(12, 12); await go(16, 10); await run(1400);
  await p.evaluate(() => window.__g.talk()); await run(2900);
  await p.evaluate(() => window.__g.advance()); await run(3200);
  await p.evaluate(() => window.__g.advance()); await run(500);
  await go(3, 9); await run(800); await go(8, 7); await run(1800);
  console.log('frames', n, 'secs', (t / 1000).toFixed(1));
  await b.close();
})();
