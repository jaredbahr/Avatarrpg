const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, url, dir, script] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url + '?record=1&zoom=4'); await p.waitForFunction(() => window.__ready);
  let n = 0; const FR = 1000 / 30;
  const shot = async () => {
    const s = await p.evaluate(() => window.__g.state()); const r = await p.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return { l: b.left, t: b.top }; });
    await p.screenshot({ path: `${dir}/p${String(n++).padStart(4, '0')}.png`, clip: { x: Math.round(r.l + s.sx * 4 - 200), y: Math.round(r.t + s.sy * 4 - 260), width: 400, height: 300 } });
  };
  const steps = JSON.parse(script);
  for (const [cmd, arg, ms] of steps) {
    if (cmd === 'hold') await p.evaluate(k => window.__g.hold(k), arg);
    if (cmd === 'rel') await p.evaluate(() => window.__g.release());
    if (cmd === 'jab') await p.evaluate(() => window.__g.jab());
    if (cmd === 'face') await p.evaluate(d => window.__g.face(d), arg);
    for (let e = 0; e < ms; e += FR) { await p.evaluate(ms => window.__adv(ms), FR); await shot(); }
  }
  console.log('frames', n, 'errors', errs); await b.close();
})();
