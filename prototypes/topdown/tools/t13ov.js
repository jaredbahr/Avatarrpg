// overview of a board level at 1x: node tools/t13ov.js page.html level out.png [variant]
const { chromium } = require('playwright');
(async () => {
  const [,, page, level, out, variant] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 680 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`file://${page}?overview=1&zoom=1&level=${level}` + (variant ? '&variant=' + variant : '')); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }).catch(e => errs.push('timeout'));
  await p.screenshot({ path: out }); console.log(level, 'errors', errs); await b.close();
})();
