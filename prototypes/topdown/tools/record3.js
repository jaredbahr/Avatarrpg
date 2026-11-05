const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, url, dir, mode] = process.argv; const dry = mode === 'dry';
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
  const log = async m => console.log(m, JSON.stringify(await st()), (t / 1000).toFixed(1));
  const go = async (x, y, max = 9000) => {
    await p.evaluate(([x, y]) => window.__g.walkTo(x, y), [x, y]);
    for (let e = 0; e < max; e += FR) { await frame(); const s = await st(); if (!s.moving && !s.path) break; }
    await log(`go ${x},${y}`);
  };
  // 1. overview at normal zoom: idle, look-around, then every heading with eased stops and a full reversal
  await run(900); await p.evaluate(() => window.__g.look()); await run(2100);
  await hold(['r'], 1400); await run(450);
  await hold(['u', 'r'], 800); await hold(['u'], 400);
  await hold(['l'], 1500); await hold(['d', 'l'], 800); await hold(['d'], 600);
  await hold(['d', 'r'], 800); await hold(['u', 'l'], 800); await run(500);
  await log('dirs');
  // 2. bridge and the south bank with the cat, then back
  await go(288, 400); await go(296, 590); await go(430, 625); await run(900);
  await go(288, 545); await go(288, 400);
  // 3. the stall
  await go(518, 306); await run(1300);
  await p.evaluate(() => window.__g.talk()); await run(2800);
  await p.evaluate(() => window.__g.advance()); await run(3000);
  await p.evaluate(() => window.__g.advance()); await run(400);
  await go(420, 270);
  // 4. close-up at 6x: breathing, a look-around, then a walk loop in four headings
  await p.evaluate(() => window.__g.zoom(6)); await run(1600);
  await p.evaluate(() => window.__g.look()); await run(2000);
  await hold(['l'], 1700); await run(500);
  await hold(['d'], 900); await run(400);
  await hold(['r'], 1700); await run(500);
  await hold(['u', 'l'], 1000); await hold(['u'], 500); await run(700);
  await p.evaluate(() => window.__g.zoom(3)); await run(300);
  // 5. back along the lane past the villager (then the Fire Jab)
  await run(300);
  // 6. Fire Jab at the dummy, normal zoom
  await go(392, 250); await p.evaluate(() => window.__g.face('east')); await run(500);
  await p.evaluate(() => window.__g.jab()); await run(1600);
  // 7. close-up at 6x: every heading of the Fire Jab beside the dummy
  await p.evaluate(() => window.__g.zoom(6)); await run(800);
  for (const d of ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']) {
    await p.evaluate(d => window.__g.face(d), d); await run(350);
    await p.evaluate(() => window.__g.jab()); await run(1150);
  }
  await p.evaluate(() => window.__g.face('east')); await p.evaluate(() => window.__g.jab()); await run(1500);
  await p.evaluate(() => window.__g.zoom(3)); await run(1200);
  console.log('frames', n, 'secs', (t / 1000).toFixed(1));
  await b.close();
})();
