const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://'+process.argv[2]+'?record=1&start=home'); await p.waitForFunction(() => window.__shell);
  for (let i=0;i<40;i++){ await p.evaluate(ms => window.__adv(ms), 250); const s=await p.evaluate(()=>({...window.__shell, fade:document.getElementById('fade').style.opacity})); console.log(i,JSON.stringify(s)); await new Promise(r=>setTimeout(r,100)); }
  await b.close();
})();
