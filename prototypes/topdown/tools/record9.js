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
  const st = () => p.evaluate(() => window.__g.state());
  const log = async m => console.log(m, JSON.stringify(await st()), (t / 1000).toFixed(1));
  const go = async (x, y, max = 16000) => {
    await p.evaluate(([x, y]) => window.__g.walkTo(x, y), [x, y]);
    for (let e = 0; e < max; e += FR) { await frame(); const s = await st(); if (!s.moving && !s.path) break; }
    await log(`go ${x},${y}`);
  };
  const talk = async (id, beat = 2600) => {
    await p.evaluate(id => window.__g.talkTo(id), id);
    for (let e = 0; e < 9000; e += FR) { await frame(); if ((await st()).dlg) break; }
    await log('talk ' + id);
    for (let k = 0; k < 6 && (await st()).dlg; k++) { await run(k < 3 ? beat : 120); await p.evaluate(() => window.__g.advance()); await run(k < 3 ? 200 : 60); }
  };
  // v9: the spawn by the flooded ford, over the bridge to the north court and Mira
  await run(600);
  await go(508, 500); await go(508, 404);
  await talk('mira', 1400);
  // west along the north bank to Dorin's practice dummy: a Fire Jab and a Flame Whip
  await go(268, 390);
  await p.evaluate(() => window.__g.face('west')); await p.evaluate(() => window.__g.zoom(5)); await run(300);
  await p.evaluate(() => window.__g.move('jab')); await run(1500);
  await p.evaluate(() => window.__g.move('whip')); await run(1700);
  await p.evaluate(() => window.__g.zoom(3)); await run(200);
  // along the north lane past the houses, down by the watch post, out the east road and over the edge
  await go(700, 360); await go(860, 500); await go(1100, 540); await go(1200, 544); await run(400);
  // back, and down the riverside path to the south edge and its steps (5x close look)
  await go(880, 640); await go(880, 880); await run(300);
  await p.evaluate(() => window.__g.zoom(5)); await run(1100);
  await p.evaluate(() => window.__g.zoom(3)); await run(400);
  console.log('frames', n, 'secs', (t / 1000).toFixed(1));
  await b.close();
})();
