const { chromium } = require('playwright');
(async () => {
  const [,, url, out, q] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 680 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url + '?' + (q || 'overview=1')); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }).catch(e => errs.push('timeout'));
  await p.waitForTimeout(300); await p.screenshot({ path: out }); console.log('errors', JSON.stringify(errs)); await b.close();
})();
