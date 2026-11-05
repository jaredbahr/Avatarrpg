const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, url, dir, mode] = process.argv; const dry = mode === 'dry'; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(url + '?record=1&zoom=2'); await p.waitForFunction(() => window.__ready);
  const FR = 1000 / 30; let n = 0;
  const frame = async () => { await p.evaluate(ms => window.__adv(ms), FR); if (!dry) await p.screenshot({ path: `${dir}/f${String(n).padStart(5, '0')}.png` }); n++; };
  await p.evaluate(() => window.__auto());
  let lastLog = 0;
  for (let i = 0; i < 30 * 120; i++) {
    await frame();
    if (i - lastLog > 150) { lastLog = i; console.log((i / 30).toFixed(1), JSON.stringify(await p.evaluate(() => window.__state()))); }
    const st = await p.evaluate(() => window.__state()); if (st.over) { for (let k = 0; k < 90; k++) await frame(); break; }
  }
  console.log('frames', n, 'secs', (n / 30).toFixed(1)); await b.close();
})();
