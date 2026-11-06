const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(process.argv[2] + '?record=1'); await p.waitForFunction(() => window.__ready);
  const t = await p.evaluate(() => window.__shadowTable());
  const all = t.map(r => r.darker), mean = all.reduce((a, b) => a + b, 0) / all.length;
  for (const r of t.filter(r => r.k.startsWith('house'))) console.log(r.k, 'visible', r.visible, 'shadow lum', r.shadow, 'ground', r.ground, 'darker', (r.darker * 100).toFixed(0) + '%');
  console.log('all objects: n', t.length, 'min darker', (Math.min(...all) * 100).toFixed(0) + '%', 'mean', (mean * 100).toFixed(0) + '%', 'below 25%:', t.filter(r => r.darker < 0.25).map(r => r.k + '@' + r.x));
  await b.close();
})();
