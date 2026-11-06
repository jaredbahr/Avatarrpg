// node tools/portshots.js <url> <outDir> [query]   screenshots of dialogue moments (1x) + frames of every portrait dialogue for the demo video.
// Steps the tutorial's own clock (record mode); fights and walks fast, talk at 1.5x. Frames only while a dialogue box with a portrait is up.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, url, dir, q] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const phone = process.env.PHONE === '1';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: phone ? 2 : 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url + '?record=1' + (q || '')); await p.waitForFunction(() => window.__shell);
  const want = new Set((process.env.WANT || 'Elder Mira,Pella,Kaya,Captain Ruon,Jin').split(',')), got = new Set(); let n = 0, vid = 0, prev = '', same = 0;
  const FR = 1000 / 30, SPEED = { fight: 3.5, walk: 2.5, 'fight-intro': 1.2, talk: 1.5, after: 2, start: 1, end: 1 };
  const probe = () => p.evaluate(() => {
    const info = d => { const e = d.getElementById('dlg'); if (!e || e.style.display !== 'block') return null; const im = e.querySelector('img'); return { who: (e.querySelector('b') || {}).textContent, text: (e.querySelector('span') || {}).textContent, p: e.classList.contains('hasp'), src: im && im.getAttribute('src') ? 1 : 0 }; };
    let a = info(document); let f = null; try { f = info(document.getElementById('area').contentDocument); } catch (e) { }
    return { sh: window.__shell, d: a || f, errs: window.__errs.slice() };
  });
  while (n < 40000) {
    const s = await probe(); if (s.sh.done && s.sh.phase === 'end') break;
    const d = s.d; let ms = FR * (SPEED[s.sh.phase] || 1);
    if (d && d.p) {
      const k = d.who; same = d.text === prev ? same + 1 : 0; prev = d.text; const full = same >= 6;
      if (process.env.VIDEO) { await p.screenshot({ path: `${dir}/v${String(vid++).padStart(5, '0')}.png` }); if (vid > 780) break; }
      if (want.has(k) && !got.has(k) && full && d.text.length > 40) { await p.screenshot({ path: `${dir}/shot-${k.replace(/\W+/g, '_')}.png` }); got.add(k); console.log('shot', k, '|', d.text.slice(0, 50)); }
      ms = FR * 1.5;
    }
    await p.evaluate(ms => window.__adv(ms), ms); n++;
    if (!process.env.VIDEO && got.size >= want.size) break;
  }
  console.log('done shots', [...got], 'frames', vid, 'errs', errs);
  await b.close();
})();
