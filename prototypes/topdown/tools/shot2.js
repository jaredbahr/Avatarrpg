const { chromium } = require('playwright');
(async () => {
  const [,, url, out, w, h, dpr, mobile, wait] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, isMobile: mobile === '1', hasTouch: mobile === '1' });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(+(wait || 1500));
  await p.screenshot({ path: out }); console.log('errors', errs); await b.close();
})();
