// node tools/pacevid.js <html> <framesDir> <gameSeconds> : the forest fight from its opening, auto-played, one frame per 1000/30 ms of game time (1x), screenshots at 1280x720
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, file, dir, secs] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('file://' + require('path').resolve(file) + '?record=1&level=forest'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await p.evaluate(() => window.__auto());
  const N = Math.round(+secs * 30);
  for (let i = 0; i < N; i++) { await p.evaluate(() => window.__adv(1000 / 30)); await p.screenshot({ path: `${dir}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 }); }
  const s = await p.evaluate(() => window.__state()); console.log(JSON.stringify({ over: s.over, round: s.round, result: s.result })); await b.close();
})();
