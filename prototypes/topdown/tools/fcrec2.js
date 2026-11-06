const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, url, dir, mode] = process.argv; const dry = mode === 'dry'; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERR', e.message, e.stack && e.stack.split('\n')[1]));
  await p.goto(url + '?record=1&zoom=2'); await p.waitForFunction(() => window.__ready);
  const FR = 1000 / 30; let n = 0, lastNames = '';
  const frame = async () => { await p.evaluate(ms => window.__adv(ms), FR); if (!dry) await p.screenshot({ path: `${dir}/f${String(n).padStart(5, '0')}.png` }); n++; };
  await p.evaluate(() => window.__auto());
  for (let i = 0; i < 30 * 200; i++) {
    await frame();
    const st = await p.evaluate(() => window.__state());
    if (st.names !== lastNames) { console.log((n / 30).toFixed(1), st.names.split('|').slice(-1)[0], 'r' + st.round, JSON.stringify(st.hp.map(h => h[0][0] + h[1] + (h[4] ? ':' + h[4] : ''))), st.surf); lastNames = st.names; }
    if (st.over) { for (let k = 0; k < 90; k++) await frame(); break; }
  }
  console.log('frames', n, 'secs', (n / 30).toFixed(1)); await b.close();
})();
