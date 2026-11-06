// smoke: load a board page in record mode, auto-play for N seconds of game time, report errors and state; screenshot at the end
// usage: node tools/t13smoke.js url secs out.png [zoom]
const { chromium } = require('playwright');
(async () => {
  const [,, url, secs, out, zoom] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'record=1'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  if (zoom) await p.evaluate(z => window.__zoom(z), +zoom);
  await p.evaluate(() => window.__auto());
  const t0 = Date.now();
  for (let t = 0; t < +secs * 1000; t += 1000) { await p.evaluate(() => window.__adv(1000)); const s = await p.evaluate(() => window.__state()); if (s.over || s.exited) break; }
  const s = await p.evaluate(() => window.__state());
  await p.screenshot({ path: out });
  console.log(JSON.stringify({ over: s.over, result: s.result, round: s.round, exited: s.exited, hp: s.hp, wall: (Date.now() - t0) / 1000 }));
  console.log('names', s.names.split('|').slice(-12).join('\n'));
  console.log('errors', errs.slice(0, 8));
  await b.close();
})();
