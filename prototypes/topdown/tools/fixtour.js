// fixes pass: close-up stills (30 fps of game time) of the fixed clips. node tools/fixtour.js <board.html> <framesDir>
const { chromium } = require('playwright'); const fs = require('fs');
const [,, board, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
let n = 0;
const tele = (k, i, x, y) => `{ const u = UNITS.filter(u => u.k === '${k}')[${i}]; u.cx = ${x}; u.cy = ${y}; u.x = feetX(u, ${x}); u.y = feetY(u, ${y}); u.path = []; }`;
async function scene(b, q, zoom, setup, acts, label) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + board + '?record=1&' + q); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await p.evaluate(z => window.__zoom(z), zoom); await p.evaluate(setup);
  const shot = async (k) => { for (let i = 0; i < k; i++) { await p.evaluate(() => { const u = window.__fuu; if (u) window.__focus(u.x, u.y - 22); window.__adv(1000 / 30); }); await p.screenshot({ path: `${dir}/f${String(n++).padStart(5, '0')}.png` }); } };
  for (const a of acts) {
    if (a.focus) await p.evaluate(a.focus);
    if (a.run) { await p.evaluate(`(() => { ${a.run}; return 0; })()`); }
    if (a.wait) await shot(a.wait);
    if (a.until) { for (let i = 0; i < 400 && !(await p.evaluate(a.until)); i++) await shot(1); await shot(a.after || 15); }
  }
  console.log(label, 'frames so far', n, 'errors', errs); await p.close();
}
const ab = (k, i, name, x, y) => `window.__done = false; useAbility(UNITS.filter(u => u.k === '${k}')[${i}], '${name}', [${x}, ${y}]).then(() => { window.__done = true; })`;
const foc = (k, i = 0) => `window.__fuu = UNITS.filter(u => u.k === '${k}')[${i}]; window.__focus(window.__fuu.x, window.__fuu.y - 22)`;
const DONE = () => window.__done;
(async () => {
  const b = await chromium.launch();
  // A. Sura: walk, then her strike, ice sweep, healing; the south view last
  await scene(b, 'level=forest', 4, `${tele('sura', 0, 8, 5)} ${tele('thug', 0, 13, 5)} ${tele('thug', 1, 11, 8)} ${tele('kaya', 0, 5, 6)} ${tele('bo', 0, 4, 4)}`, [
    { focus: foc('sura'), wait: 36 },
    { run: `window.__done = false; moveUnit(UNITS.filter(u => u.k === 'sura')[0], 10, 5).then(() => { window.__done = true; })`, until: DONE, after: 12 },
    { run: ab('sura', 0, 'water_whip', 13, 5), until: DONE, after: 20 },
    { run: ab('sura', 0, 'ice_path', 12, 5), until: DONE, after: 20 },
    { run: ab('sura', 0, 'healing_stream', 10, 5), until: DONE, after: 20 },
    { run: ab('sura', 0, 'water_whip', 11, 8), until: DONE, after: 24 },
    { run: `window.__done = false; moveUnit(UNITS.filter(u => u.k === 'sura')[0], 10, 7).then(() => { window.__done = true; })`, until: DONE, after: 10 },
  ], 'sura');
  // B. the Driller's slam toward the west, south-west, north-west and south
  await scene(b, 'level=floor', 3, `${tele('kaya', 0, 12, 5)} ${tele('sura', 0, 12, 8)} ${tele('bo', 0, 12, 2)} ${tele('qbender', 0, 18, 8)}`, [
    { focus: foc('grumbler'), wait: 36 },
    { run: ab('grumbler', 0, 'driller_slam', 13, 5), until: DONE, after: 25 },
    { run: ab('grumbler', 0, 'driller_slam', 13, 7), until: DONE, after: 25 },
    { run: ab('grumbler', 0, 'driller_slam', 13, 3), until: DONE, after: 25 },
  ], 'driller');
  // C. Kaya: the plain-fisted jab and blast (the fire is /vfx)
  await scene(b, 'level=forest', 4, `${tele('kaya', 0, 9, 5)} ${tele('thug', 0, 11, 5)} ${tele('thug', 1, 13, 5)}`, [
    { focus: foc('kaya'), wait: 36 },
    { run: ab('kaya', 0, 'fire_jab', 11, 5), until: DONE, after: 25 },
    { run: ab('kaya', 0, 'fire_blast', 13, 5), until: DONE, after: 30 },
  ], 'kaya');
  // D. the deserter's punch-blast, the quarry bender's throw, Ruon walking and cutting
  await scene(b, 'level=gate', 4, `${tele('deserter', 0, 12, 5)} ${tele('kaya', 0, 9, 5)}`, [
    { focus: foc('deserter'), wait: 36 },
    { run: ab('deserter', 0, 'fire_blast', 9, 5), until: DONE, after: 30 },
  ], 'deserter');
  await scene(b, 'level=gate&variant=bluffed', 4, `${tele('qbender', 0, 16, 6)} ${tele('kaya', 0, 13, 6)}`, [
    { focus: foc('qbender'), wait: 36 },
    { run: ab('qbender', 0, 'rock_throw', 13, 6), until: DONE, after: 30 },
  ], 'qbender');
  await scene(b, 'level=cutting', 4, `${tele('ruon', 0, 6, 5)} ${tele('merc', 0, 11, 5)} ${tele('merc', 1, 17, 8)}`, [
    { focus: foc('ruon'), wait: 36 },
    { run: `window.__done = false; moveUnit(UNITS.filter(u => u.k === 'ruon')[0], 9, 5).then(() => { window.__done = true; })`, until: DONE, after: 12 },
    { run: ab('ruon', 0, 'ruon_sabre', 11, 5), until: DONE, after: 40 },
  ], 'ruon');
  console.log('total frames', n); await b.close();
})();
