// Drive tutorial-demo.html frame by frame. node tools/tutrec.js <url> <framesDir|dry> [maxMinutes]
// Fights and walks are stepped at 2x game time per video frame (the recording runs about 4 minutes); talk at 1x.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, url, dir, maxMin] = process.argv; const dry = dir === 'dry'; if (!dry) fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'record=1' + (process.env.TUTQ || ''));
  await p.waitForFunction(() => window.__shell);
  let n = 0, game = 0, last = '', t0 = Date.now(); const FR = 1000 / 30, SPEED = { fight: 3.5, walk: 2.5, 'fight-intro': 1.2, talk: 1.5, after: 2, start: 1, end: 1 };
  while (true) {
    const sh = await p.evaluate(() => ({ ...window.__shell, errs: window.__errs.slice() }));
    if (sh.phase !== last) { console.log(`${(game / 1000).toFixed(1)}s video ${(n / 30).toFixed(1)}s phase ${sh.phase}`); last = sh.phase; }
    if (sh.done && sh.phase === 'end') { for (let i = 0; i < 150; i++) { await p.evaluate(ms => window.__adv(ms), FR); if (!dry) await p.screenshot({ path: `${dir}/f${String(n).padStart(5, '0')}.png` }); n++; } break; }
    if (n / 30 > (+maxMin || 8) * 60) { console.log('TIMEOUT'); break; }
    const ms = FR * (SPEED[sh.phase] || 1); await p.evaluate(ms => window.__adv(ms), ms); game += ms;
    if (!dry || n % 30 === 0) { if (!dry) await p.screenshot({ path: `${dir}/f${String(n).padStart(5, '0')}.png` }); }
    n++;
  }
  const fe = await p.evaluate(() => window.__errs);
  console.log('frames', n, 'video s', (n / 30).toFixed(1), 'game s', (game / 1000).toFixed(1), 'wall s', ((Date.now() - t0) / 1000).toFixed(0));
  console.log('page errors', errs, 'frame errors', fe);
  await b.close();
})();
