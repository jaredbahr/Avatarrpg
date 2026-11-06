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
    for (let k = 0; k < 6 && (await st()).dlg; k++) { await run(beat); await p.evaluate(() => window.__g.advance()); await run(200); }
  };
  // the spawn on the west road, then over the bridge to the market court
  await run(1200);
  await go(330, 350); await go(412, 236);
  await talk('mira');
  await talk('gao');
  // east across the court, down through the dry crossing, to the watch post
  await go(560, 250); await go(575, 330); await talk('hanru');
  // the south court, Pella, and a close look at the residents going about their day
  await go(500, 420); await talk('pella', 3200);
  await p.evaluate(() => window.__g.zoom(5)); await run(3200);
  await go(470, 470); await run(1600);
  await p.evaluate(() => window.__g.zoom(3)); await run(400);
  // back over the bridge to Dorin's practice dummy on the north bank: a Fire Jab and a Flame Whip
  await go(412, 340); await go(412, 236); await go(178, 236);
  await p.evaluate(() => window.__g.face('west')); await p.evaluate(() => window.__g.zoom(5)); await run(500);
  await p.evaluate(() => window.__g.move('jab')); await run(1700);
  await p.evaluate(() => window.__g.move('whip')); await run(1900);
  await p.evaluate(() => window.__g.zoom(3)); await run(300);
  // out along the road to the forest marker
  await go(412, 236); await go(412, 340); await go(975, 344);
  await run(2200);
  console.log('frames', n, 'secs', (t / 1000).toFixed(1));
  await b.close();
})();
