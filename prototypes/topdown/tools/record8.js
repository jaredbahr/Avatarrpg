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
  // v8: the spawn on the road by the flooded ford, over the bridge to the north court and Mira
  await run(800);
  await go(508, 500); await go(508, 404);
  await talk('mira', 1700);
  // west along the north bank to Dorin's practice dummy: a Fire Jab and a Flame Whip
  await go(268, 390);
  await p.evaluate(() => window.__g.face('west')); await p.evaluate(() => window.__g.zoom(5)); await run(400);
  await p.evaluate(() => window.__g.move('jab')); await run(1600);
  await p.evaluate(() => window.__g.move('whip')); await run(1800);
  await p.evaluate(() => window.__g.zoom(3)); await run(200);
  // east along the north lane to the watch post on the plaza
  await go(760, 352); await talk('hanru', 1500);
  // out along the east road to the forest marker, where the road runs off the edge into the dark
  await go(1040, 548); await go(1112, 548); await run(800);
  // down the riverside path to the south edge, and a close look at the steps going over
  await go(850, 700); await go(850, 850); await run(600);
  await p.evaluate(() => window.__g.zoom(5)); await run(1800);
  await p.evaluate(() => window.__g.zoom(3)); await run(600);
  console.log('frames', n, 'secs', (t / 1000).toFixed(1));
  await b.close();
})();
