// v12 play test: the live loop for 3 s (page errors), then Kaya walks over the bridge, past the lamps, and talks to Mira
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2];
  const b = await chromium.launch(); const errs = [];
  let p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(3000);
  await p.keyboard.down('d'); await p.waitForTimeout(600); await p.keyboard.up('d');
  const p2 = await b.newPage({ viewport: { width: 1280, height: 720 } }); p2.on('pageerror', e => errs.push(e.message)); p2.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p2.goto(url + '?record=1'); await p2.waitForFunction(() => window.__ready);
  const go = async (x, y) => { await p2.evaluate(([x, y]) => window.__g.walkTo(x, y), [x, y]); for (let i = 0; i < 700; i++) { await p2.evaluate(() => window.__adv(33)); const s = await p2.evaluate(() => window.__g.state()); if (!s.moving && !s.path) return s; } return p2.evaluate(() => window.__g.state()); };
  const s1 = await go(508, 520), s2 = await go(508, 404), s3 = await go(948, 520);
  console.log('start', 'bridge south', s1.x | 0, s1.y | 0, 'north bank', s2.x | 0, s2.y | 0, 'lamps', s3.x | 0, s3.y | 0);
  await p2.evaluate(() => window.__g.talkTo('mira')); for (let i = 0; i < 600; i++) { await p2.evaluate(() => window.__adv(33)); if ((await p2.evaluate(() => window.__g.state())).dlg) break; }
  console.log('dialogue open', (await p2.evaluate(() => window.__g.state())).dlg, 'errors', errs); await b.close();
})();
