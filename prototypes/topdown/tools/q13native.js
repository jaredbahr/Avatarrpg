// native canvas of each quarry board (overview): node tools/q13native.js page.html outprefix [variant-for-gate]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, page, pre] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 680 } });
  for (const level of ['road', 'gate', 'cutting', 'floor']) {
    const errs = []; p.removeAllListeners('pageerror'); p.on('pageerror', e => errs.push(e.message));
    await p.goto(`file://${page}?overview=1&zoom=1&level=${level}`); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    const u = await p.evaluate(() => document.getElementById('c').toDataURL('image/png'));
    fs.writeFileSync(`${pre}_${level}.png`, Buffer.from(u.split(',')[1], 'base64')); console.log(level, errs);
  }
  await b.close();
})();
