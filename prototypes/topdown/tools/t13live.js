const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(4000);
  for (let i = 0; i < 3; i++) { await p.mouse.click(195, 700); await p.waitForTimeout(400); }
  await p.waitForTimeout(6000); await p.screenshot({ path: process.argv[3] });
  console.log('errors', errs, await p.evaluate(() => [window.__shell.phase, window.__errs])); await b.close(); })();
