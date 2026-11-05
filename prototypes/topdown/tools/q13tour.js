// quarry-only tour at game speed (30 fps, 1x): node tools/q13tour.js page.html outDir
// each board: fast-forward (no frames) to a moment worth seeing, then record real-time frames
const { chromium } = require('playwright'); const fs = require('fs');
const SEG = [
  { level: 'road', zoom: 2, ff: () => true, dur: 11, cap: 'The Switchbacks' },
  { level: 'gate', zoom: 3, ff: s => s.fire, lead: 1.0, dur: 15, cap: 'The Quarry Gate' },
  { level: 'cutting', zoom: 2, ff: s => s.t > 5, dur: 13, cap: 'The Cutting' },
  { level: 'floor', zoom: 3, ff: s => s.boss, lead: 3.5, dur: 19, cap: 'The Quarry Floor' },
];
(async () => {
  const [,, page, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); let n = 0; const meta = [];
  for (const sg of SEG) {
    await p.goto(`file://${page}?level=${sg.level}&record=1&variant=base`); await p.waitForFunction(() => window.__ready);
    await p.evaluate(z => window.__zoom(z), sg.zoom); await p.evaluate(() => window.__auto());
    let t = 0;
    const probe = () => p.evaluate(() => ({ fire: window.__state().surf.includes('f'), boss: !!(S.active && S.active.k === 'grumbler' && S.round >= 3), over: S.over }));
    // find the moment, then rewind by re-running (the engine is deterministic) so the lead-in is recorded
    let hit = 0; for (let i = 0; i < 3000; i++) { const s = Object.assign(await probe(), { t }); if (sg.ff(s)) { hit = t; break; } await p.evaluate(() => window.__adv(100)); t += 0.1; }
    const start = Math.max(0, hit - (sg.lead || 0));
    await p.goto(`file://${page}?level=${sg.level}&record=1&variant=base`); await p.waitForFunction(() => window.__ready);
    await p.evaluate(z => window.__zoom(z), sg.zoom); await p.evaluate(() => window.__auto());
    for (let s = 0; s < start; s += 0.1) await p.evaluate(() => window.__adv(100));
    const f0 = n; for (let i = 0; i < sg.dur * 30; i++) { await p.evaluate(() => window.__adv(1000 / 30)); await p.screenshot({ path: `${dir}/f${String(n++).padStart(5, '0')}.png` }); }
    meta.push({ level: sg.level, from: f0, to: n - 1, startGameS: +start.toFixed(1), cap: sg.cap }); console.log(sg.level, 'start', start.toFixed(1), 'frames', n - f0);
  }
  fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta)); console.log('errors', errs); await b.close();
})();
