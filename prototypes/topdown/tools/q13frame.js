// is the boss in view? node tools/q13frame.js page.html zoom [variant]: steps an auto-played floor fight and reports frames where the Grumbler's sprite leaves the view
const { chromium } = require('playwright');
(async () => {
  const [,, page, zoom, variant] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`file://${page}?level=floor&record=1&variant=${variant || 'base'}`); await p.waitForFunction(() => window.__ready);
  await p.evaluate(z => window.__zoom(z), +zoom); await p.evaluate(() => window.__auto());
  let streak = 0, longest = {}, actT = 0, bad = 0, worst = 0, rounds = new Set(), t = 0, badRounds = new Set();
  for (let i = 0; i < 9000; i++) {
    await p.evaluate(() => window.__adv(100)); t += 0.1;
    const r = await p.evaluate(() => { const u = UNITS.find(u => u.k === 'grumbler'); if (!u || u.ko > 0 && u.ko >= 700) return null; const D = ASSETS.driller, v = D.rot[u.dir] || D.rot.west, clip = u.anim === 'attack' && D.slam && D.slam[u.dir] ? D.slam[u.dir] : (D.idle && D.idle[u.dir]) || v;
      return { act: S.active === u, tgt: !!(S.preview || S.ab), round: S.round, left: u.x - clip.w / 2 - cam.rx, right: u.x + clip.w / 2 - cam.rx, vw: view.w, top: u.y + u.shove[1] - clip.h + 6 - cam.ry, bot: u.y + u.shove[1] + 6 - cam.ry, vh: view.h, over: S.over, hp: u.hp }; });
    if (!r) { if (t > 3) break; continue; }
    actT = r.act ? actT + 0.1 : 0;
    const inter = r.bot > 0 && r.top < r.vh && r.right > 0 && r.left < r.vw, cut = Math.max(0, -r.top, r.bot - r.vh, -r.left, r.right - r.vw), full = cut === 0;
    const relevant = actT > 1.2 || (inter && !full && process.env.PARTIAL);   // the boss's own turn, or any frame where it is only part in view
    streak = inter && !full ? streak + 0.1 : 0; if (process.env.SHOTR && r.round == process.env.SHOTR && streak > (process.env.SHOTS || 2.5) && !global.done) { global.done = 1; await p.screenshot({ path: process.env.SHOTF }); console.log(JSON.stringify(r)); } if (streak > (longest[r.round] || 0)) longest[r.round] = +streak.toFixed(1);
    if (relevant && !full) { bad++; if (cut > worst && process.env.SHOT) await p.screenshot({ path: process.env.SHOT }); worst = Math.max(worst, cut); badRounds.add(r.round + (r.act ? 'a' : 'p')); }
    if (r.over) break;
  }
  console.log('t', t.toFixed(1), 'frames out of view', bad, 'worst px', worst, 'rounds', [...badRounds], 'longest partial streak (s) per round', JSON.stringify(longest), 'errors', errs); await b.close();
})();
