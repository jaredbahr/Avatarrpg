// node tools/pacerun.js <board.html> <level> [variant] [speed]  -> prints JSON {profile, state} for one full auto-played fight at 1x game time
// (steps 1000/30 ms of game time per __adv, exactly what a 30 fps real-time run does; speed multiplies the step like the HUD toggle does)
const { chromium } = require('playwright');
(async () => {
  const [,, file, level, variant, speed, skip] = process.argv;  // speed 1|2|3 plays through __advReal (the real loop's scaling); skip=1 also taps 'skip' every 2.5 s of wall time
  let steps = 0;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(file) + `?record=1&level=${level}` + (variant && variant !== '-' ? `&variant=${variant}` : ''));
  await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  if (speed && speed !== '1') await p.evaluate(s => window.__setSpeed && window.__setSpeed(+s), speed);
  await p.evaluate(() => window.__auto());
  // one 1000/30 ms tick per call, so promise continuations (the next wait, the next turn) run between ticks exactly as they do under requestAnimationFrame
  for (let i = 0; i < 60000; i++) { steps++; if (await p.evaluate(([real, sk, n]) => { if (sk && n % 75 === 20) window.__skip(); real ? window.__advReal(1000 / 30) : window.__adv(1000 / 30); return window.__profDone(); }, [!!(speed && speed !== '1') || skip === '1', skip === '1', steps])) break; }
  const prof = await p.evaluate(() => window.__profRes()), st = await p.evaluate(() => window.__evState());
  console.log(JSON.stringify({ prof, st, errs, wallMs: steps * 1000 / 30 }));
  await b.close();
})();
