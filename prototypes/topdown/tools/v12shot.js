const { chromium } = require('playwright');
(async () => {
  const [,, url, out] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1248, height: 992 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + '?overview=1&zoom=1'); await p.waitForFunction(() => window.__ready, null, { timeout: 30000 }).catch(() => {});
  await p.screenshot({ path: out }); console.log('errors', errs); await b.close();
})();
