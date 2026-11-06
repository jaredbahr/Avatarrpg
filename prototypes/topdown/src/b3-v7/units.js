// ---------- the units. Every figure is PixelLab's posed frames (create-character-v3 at 48 px, skeleton-v3 clips), drawn as-is.
// v3: all eight headings for the whole cast (PixelLab's own diagonal and west rows: no mirrored strips, so no weapon swaps hands),
// one pose per ability (CLIP below), and the Driller, a 2x2 machine drawn from its eight PixelLab views and object animations.
const STATS = {
  kaya:     { name: 'Kaya', side: 'party', cycle: 30 },
  sura:     { name: 'Sura', side: 'party', cycle: 28 },
  bo:       { name: 'Bo', side: 'party', cycle: 28 },
  ruon:     { name: 'Ruon', side: 'party', cycle: 28, ally: true },
  thug:     { name: 'Bandit', side: 'foe', cycle: 28 },
  slinger:  { name: 'Slinger', side: 'foe', cycle: 28 },
  bruiser:  { name: 'Bruiser', side: 'foe', cycle: 30 },
  deserter: { name: 'Deserter', side: 'foe', cycle: 28 },
  qbender:  { name: 'Bender', side: 'foe', cycle: 30 },
  merc:     { name: 'Mercenary', side: 'foe', cycle: 28 },
  xbow:     { name: 'Crossbow', side: 'foe', cycle: 28 },
  grumbler: { name: 'Grumbler', side: 'foe', cycle: 40, size: 2 },
};
// which posed clip each ability plays (falls back to 'attack')
const CLIP = { ice_path: 'ice', healing_stream: 'heal', earth_wall: 'wall', stone_stance: 'stance', oil_flask: 'throw', torch_toss: 'throw' };
const UNITS = [];
const feetX = (u, cx) => ((u.size || 1) > 1 ? GX + (cx + 1) * CS : cellX(cx)), feetY = (u, cy) => ((u.size || 1) > 1 ? GY + (cy + 2) * CS - 10 : cellY(cy));
function mkUnit(k, cx, cy, face) {
  const s = STATS[k], u = { k, name: s.name, side: s.side, size: s.size || 1, cx, cy, hp: 1, max: 1, mv: 0, dir: face,
    anim: 'idle', at: 0, path: [], dist: 0, flash: -1, ko: -1, moved: false, acted: false, phase: Math.floor(rnd() * 900), shove: [0, 0], st: [] };
  u.x = feetX(u, cx); u.y = feetY(u, cy);
  UNITS.push(u); return u;
}
function dirTo(dx, dy) { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); return DIRS[(a + 8) % 8]; }
const TINT = document.createElement('canvas'); TINT.width = TINT.height = 128;
let clock = 0;
function rowFor(clip, dir) {
  let row = clip.dirs.indexOf(dir); if (row >= 0) return row;
  const i = DIRS.indexOf(dir); let best = 0, bd = 9;
  clip.dirs.forEach((d, r) => { const k = Math.abs(((DIRS.indexOf(d) - i + 12) % 8) - 4); if (4 - k < bd) { bd = 4 - k; best = r; } });
  return best;
}
function drawClip(u, clipName, frame, dir, alpha = 1, lift = 0) {
  const clip = ASSETS.chars[u.k][clipName], row = rowFor(clip, dir), img = IMG[`ch:${u.k}:${clipName}`];
  const x = Math.round(u.x + u.shove[0]) - AX - cam.rx, y = Math.round(u.y + u.shove[1]) - AY - cam.ry + lift;
  drawSprite(u, img, (frame % clip.frames) * CELL, row * CELL, CELL, CELL, x, y, alpha);
  if (u.st && has(u, 'frozen')) { ctx.fillStyle = 'rgba(232,244,248,0.85)'; ctx.fillRect(x + 28, y + AY - 2, 24, 1); ctx.fillRect(x + 27, y + AY - 30, 1, 28); ctx.fillRect(x + 52, y + AY - 30, 1, 28); }
}
function drawSprite(u, img, sx, sy, sw, sh, x, y, alpha = 1) {
  if (alpha < 1) ctx.globalAlpha = alpha;
  const tint = u.st && (has(u, 'frozen') ? 'rgba(200,232,246,0.62)' : has(u, 'chilled') ? 'rgba(170,215,235,0.35)' : has(u, 'wet') ? 'rgba(110,170,190,0.18)' : has(u, 'inspired') ? 'rgba(242,212,122,0.14)' : null);
  if (tint) {   // frost and wet: the figure's own pixels tinted (source-atop on a scratch cell), never a box
    const tg = TINT.getContext('2d'); tg.clearRect(0, 0, 128, 128); tg.globalCompositeOperation = 'source-over';
    tg.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = tint; tg.fillRect(0, 0, sw, sh);
    if (has(u, 'wet')) { tg.fillStyle = 'rgba(232,244,240,0.55)'; for (let i = 0; i < 6; i++) tg.fillRect(sw / 2 - 10 + ((i * 7 + (clock / 200 | 0)) % 20), sh / 3 + i * 6, 1, 1); }
    tg.globalCompositeOperation = 'source-over';
    ctx.drawImage(TINT, 0, 0, sw, sh, x, y, sw, sh);
  } else ctx.drawImage(img, sx, sy, sw, sh, x, y, sw, sh);
  if (u.flash >= 0 && u.flash < 160) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * (1 - u.flash / 160); ctx.drawImage(img, sx, sy, sw, sh, x, y, sw, sh); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1;
}
// the Driller: its PixelLab view for the heading (nearest of its eight), the rumbling idle and the slam where animated
// fixes pass: the slam has per-frame times (a long hold at the top of the wind-up, a short drop onto the hit frame)
const SLAM_K = 0.8, slamMs = (v, i) => (i === v.hit ? v.ms[i] : v.ms[i] * SLAM_K);   // pacing pass: wind-up and recovery 20% shorter, the landing frame (and its hit-stop) untouched
function slamFrame(v, at) { if (!v.ms) return Math.min(v.n - 1, Math.floor(at / 56)); let t = 0; for (let i = 0; i < v.n; i++) { t += slamMs(v, i); if (at < t) return i; } return v.n - 1; }
function slamTimes(v) { if (!v.ms) return { hit: 56 * Math.round(v.n * 0.55), end: 56 * v.n }; let t = 0, h = 0; for (let i = 0; i < v.n; i++) { if (i === v.hit) h = t; t += slamMs(v, i); } return { hit: h, end: t }; }
function drillerDraw(u) {
  const D = ASSETS.driller, d = D.rot[u.dir] ? u.dir : 'west';
  let img = IMG[`dr:rot:${d}`], v = D.rot[d], f = 0;
  const clip = u.anim === 'attack' && D.slam && D.slam[d] ? 'slam' : D.idle && D.idle[d] && u.ko < 0 ? 'idle' : null;
  if (clip) { v = D[clip][d]; img = IMG[`dr:${clip}:${d}`]; f = clip === 'slam' ? slamFrame(v, u.at) : Math.floor((clock + u.phase) / 110) % v.n; }
  const x = Math.round(u.x + u.shove[0] - v.w / 2) - cam.rx, y = Math.round(u.y + u.shove[1] - v.h + 6) - cam.ry;
  if (u.ko >= 0) { ctx.filter = 'brightness(0.72) saturate(0.7)'; drawSprite(u, img, f * v.w, 0, v.w, v.h, x, y); ctx.filter = 'none'; return; }
  drawSprite(u, img, f * v.w, 0, v.w, v.h, x, y);
}
function unitDraw(u) {
  if (u.k === 'grumbler') return drillerDraw(u);
  const ch = ASSETS.chars[u.k];
  if (u.ko >= 0) {   // knocked out: they sink and fade over 0.7 s, one dark blink first
    const t = u.ko, a = Math.max(0, 1 - t / 700); if (!a) return;
    return drawClip(u, 'idle', 0, u.dir, a, Math.min(6, Math.round(t / 110)));
  }
  if (u.anim === 'bend') return drawClip(u, MOVES[u.move.k].clip, Math.max(0, moveFrame(u)), u.move.dir);
  if (u.anim === 'attack' && ch[u.clip || 'attack']) { const c = ch[u.clip || 'attack']; return drawClip(u, u.clip || 'attack', atkFrame(u.at, c.frames), u.dir); }
  if (u.path.length && ch.walk) return drawClip(u, 'walk', Math.floor(u.dist / (STATS[u.k].cycle / ch.walk.frames)), u.dir);
  if (ch.idle) { const calm = (ch.idle.calm || {})[u.dir] || [0]; const n = calm.length, k = Math.floor((clock + u.phase) / 420) % (2 * n - 2 || 1); return drawClip(u, 'idle', calm[k < n ? k : 2 * n - 2 - k], u.dir); }
  drawClip(u, 'rot', 0, u.dir);
}
// pacing pass (2026-11-06): the same clips, tighter holds. Anticipation frames 62 ms (was 80), the strike frame 84 (was 80, so the blow
// still lands on a held frame), recovery frames 46 (was 80). Heavy blows keep their hit-stop (hitStop below). Walking 130 px/s (was 92).
const ATK = { pre: 62, hit: 84, post: 46 }, WALK_PX = 130;
const atkStrike = n => Math.round(n * 0.55);
function atkTimes(n) { const s = atkStrike(n); return { strike: ATK.pre * s, end: ATK.pre * s + ATK.hit + ATK.post * Math.max(0, n - s - 1) }; }
function atkFrame(at, n) { const s = atkStrike(n); if (at < ATK.pre * s) return Math.floor(at / ATK.pre); const a = at - ATK.pre * s; if (a < ATK.hit) return Math.min(n - 1, s); return Math.min(n - 1, s + 1 + Math.floor((a - ATK.hit) / ATK.post)); }
let hitStop = 0;   // heavy blows freeze the action for a few frames (the slam, the club, the driller)
function updateUnits(dt) {
  if (hitStop > 0) { hitStop -= dt; for (const u of UNITS) if (u.flash >= 0) u.flash = Math.min(u.flash, 40); return; }
  for (const u of UNITS) {
    if (u.flash >= 0) { u.flash += dt; if (u.flash > 400) u.flash = -1; }
    if (u.ko >= 0) u.ko += dt;
    u.shove = u.shove.map(v => v * Math.exp(-dt / 90));
    if (u.path.length) {
      const [nx, ny] = u.path[0], tx = feetX(u, nx), ty = feetY(u, ny), dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy), st = (u.fast || WALK_PX) * dt / 1000;
      if (!u.fast) u.dir = dirTo(dx, dy);
      if (d <= st) { u.x = tx; u.y = ty; u.cx = nx; u.cy = ny; u.path.shift(); u.dist += d; if (!u.path.length) { u.fast = 0; if (u.arrive) { const f = u.arrive; u.arrive = null; f(); } } }
      else { u.x += dx / d * st; u.y += dy / d * st; u.dist += st; }
    }
    if (u.anim === 'attack') {
      u.at += dt; if (u.k === 'grumbler' && ASSETS.driller.slam && ASSETS.driller.slam[u.dir]) { const T = slamTimes(ASSETS.driller.slam[u.dir]); if (!u.struck && u.at >= T.hit) { u.struck = true; u.onStrike && u.onStrike(); } if (u.at >= T.end) { u.anim = 'idle'; u.clip = null; u.done && u.done(); } continue; }
      const n = u.k === 'grumbler' ? (ASSETS.driller.slam && ASSETS.driller.slam[u.dir] ? ASSETS.driller.slam[u.dir].n : 8) : ((ASSETS.chars[u.k] || {})[u.clip || 'attack'] || { frames: 8 }).frames, T = atkTimes(n);
      if (!u.struck && u.at >= T.strike) { u.struck = true; u.onStrike && u.onStrike(); }
      if (u.at >= T.end) { u.anim = 'idle'; u.clip = null; u.done && u.done(); }
    }
    if (u.anim === 'bend') updateBend(u, dt);
  }
}
