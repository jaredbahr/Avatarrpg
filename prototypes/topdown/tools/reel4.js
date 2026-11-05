const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, url, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(url + '?record=1'); await p.waitForFunction(() => window.__ready);
  await p.evaluate(() => window.__g.walkTo(380, 262)); await p.evaluate(() => window.__adv(6000));
  await p.evaluate(() => window.__g.zoom(6)); await p.evaluate(() => window.__adv(1500));
  const FR = 1000 / 30; let n = 0; const caps = [];
  const run = async (ms, cap) => { for (let e = 0; e < ms; e += FR) { await p.evaluate(ms => window.__adv(ms), FR); await p.screenshot({ path: `${dir}/r${String(n).padStart(5, '0')}.png` }); caps.push(cap); n++; } };
  const NAMES = { jab: 'FIRE JAB', whip: 'FLAME WHIP', stomp: 'FIRE STOMP' };
  for (const mv of ['jab', 'whip', 'stomp']) for (const d of ['east', 'south', 'north']) {
    await p.evaluate(d => window.__g.face(d), d); await run(300, `${NAMES[mv]} · ${d}`);
    for (let k = 0; k < 2; k++) { await p.evaluate(m => window.__g.move(m), mv); await run(1500, `${NAMES[mv]} · ${d}`); }
  }
  fs.writeFileSync(`${dir}/caps.json`, JSON.stringify(caps)); console.log('frames', n); await b.close();
})();
