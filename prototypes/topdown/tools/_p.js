const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+process.argv[2]+'?record=1');await p.waitForFunction(()=>window.__ready);
console.log(JSON.stringify(await p.evaluate(()=>({fist:ASSETS.moves.jab.fist,jd:ASSETS.chars.kaya.jab.dirs,jf:ASSETS.chars.kaya.jab.frames,strike:ASSETS.moves.jab.strike,burst:Object.fromEntries(Object.entries(ASSETS.moves.vfx.burst).map(([k,v])=>[k,[v.px,v.py,v.w,v.h,v.n]]))}))));await b.close()})()
