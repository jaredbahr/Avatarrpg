// phone-width check of the speed toggle: node tools/pacephone.js <html> <out.png>
const { chromium } = require('playwright');
(async () => {
  const [,, file, out] = process.argv; const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(file)); await p.waitForTimeout(6000);
  const box = async () => p.evaluate(() => { const r = e => { const b = document.querySelector(e).getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return { spd: r('#spd'), canvas: r('canvas'), top: r('#top'), bar: r('#bar'), label: document.getElementById('spd').textContent }; });
  console.log('before', JSON.stringify(await box()));
  const s = (await box()).spd; await p.touchscreen.tap(s[0] + s[2] / 2, s[1] + s[3] / 2); await p.waitForTimeout(200);
  console.log('after 1 tap', (await box()).label); await p.touchscreen.tap(s[0] + s[2] / 2, s[1] + s[3] / 2); await p.waitForTimeout(200); console.log('after 2 taps', (await box()).label);
  await p.screenshot({ path: out });
  await p.reload(); await p.waitForTimeout(3000); console.log('after reload (same session)', (await box()).label, 'errs', errs);
  await b.close();
})();
