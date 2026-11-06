// Re-record the whole tutorial (leftovers pass). node tools/tutrec2.js <url> <out.mp4|dry>
// Walks, dialogue and the cards at 1x; fights at FIGHTX (default 2x). The speed is shown on screen (bottom-right badge).
// Frames are piped straight into ffmpeg (1280x720, 30 fps, h264). Env: SPEEDS='{"fight":2,...}' overrides per phase.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
(async () => {
  const [,, url, out] = process.argv; const dry = out === 'dry';
  const SPEED = Object.assign({ start: 1, talk: 1, walk: 1, 'fight-intro': 1, fight: 2, after: 1, end: 1 }, JSON.parse(process.env.SPEEDS || '{}'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'record=1'); await p.waitForFunction(() => window.__shell);
  await p.evaluate(() => { const d = document.createElement('div'); d.id = 'spdbadge'; d.style.cssText = 'position:fixed;right:14px;bottom:12px;z-index:99999;font:bold 20px/1 monospace;letter-spacing:.08em;color:#f6eed6;background:rgba(28,23,25,.72);border:1px solid #d9a441;padding:7px 12px;pointer-events:none'; document.body.appendChild(d); });
  let ff = null; if (!dry) { ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-vcodec', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] }); }
  const FR = 1000 / 30; let n = 0, game = 0, last = '', per = {}, curSp = 0, phaseT = 0;   // phaseT: game ms since the phase began
  const shot = async () => { if (dry) return; const png = await p.screenshot({ type: 'png' }); if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r)); };
  while (true) {
    const sh = await p.evaluate(() => ({ ...window.__shell }));
    if (sh.phase !== last) { phaseT = 0; console.log(`game ${(game / 1000).toFixed(1)}s video ${(n / 30).toFixed(1)}s phase ${sh.phase} x${SPEED[sh.phase] || 1}`); last = sh.phase; }
    let sp = SPEED[sh.phase] || 1; if (sh.phase === 'fight' && phaseT < 3600) sp = 1;   // the opening banner and the level-up moment play at 1x
    if (sp !== curSp) { curSp = sp; await p.evaluate(s => { document.getElementById('spdbadge').textContent = 'SPEED ' + s + 'x'; }, sp); }
    if (sh.done && sh.phase === 'end') { for (let i = 0; i < 150; i++) { await p.evaluate(ms => window.__adv(ms), FR); await shot(); n++; } break; }
    if (n / 30 > 12 * 60) { console.log('TIMEOUT'); break; }
    const ms = FR * sp; await p.evaluate(ms => window.__adv(ms), ms); game += ms; phaseT += ms; per[sh.phase] = (per[sh.phase] || 0) + FR; await shot(); n++;
  }
  if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); }
  console.log('frames', n, 'video s', (n / 30).toFixed(1), 'game s', (game / 1000).toFixed(1)); console.log('video s per phase', JSON.stringify(Object.fromEntries(Object.entries(per).map(([k, v]) => [k, +(v / 1000).toFixed(1)]))));
  console.log('page errors', errs, 'frame errors', await p.evaluate(() => window.__errs)); await b.close();
})();
