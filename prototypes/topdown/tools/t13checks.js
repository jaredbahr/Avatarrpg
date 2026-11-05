// the tutorial pass's measurable checks per quarry board: shadow contrast per object, the longest straight terrain edge
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const page = process.argv[2], out = {};
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 680 } });
  for (const level of ['road', 'gate', 'cutting', 'floor']) {
    const errs = []; p.removeAllListeners('pageerror'); p.on('pageerror', e => errs.push(e.message));
    await p.goto(`file://${page}?overview=1&zoom=1&level=${level}`); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    const c = await p.evaluate(() => window.__checks());
    const sh = c.shadows.filter(r => r.visible >= 20), min = sh.reduce((a, r) => Math.min(a, r.darker), 1);
    out[level] = { errors: errs, objects: sh.length, minDarker: min, meanDarker: +(sh.reduce((a, r) => a + r.darker, 0) / sh.length).toFixed(3), under25: sh.filter(r => r.darker < 0.25), edges: c.edges, straight: c.straight, table: sh };
    console.log(level, 'objects', sh.length, 'min', min, 'under25', out[level].under25.map(r => r.k + '@' + r.x + ',' + r.y + ' ' + r.darker), 'edge', JSON.stringify(c.edges), 'straight', JSON.stringify(c.straight), 'errors', errs);
  }
  fs.writeFileSync('t13/checks.json', JSON.stringify(out, null, 1)); await b.close();
})();
