// ---------- the units: Kaya, Sura and Bo against the thug, the slinger and the bruiser (enc_forest_road spawns)
const STATS = {
  kaya:    { name: 'Kaya',    hp: 30, mv: 4, side: 'party', cycle: 30 },
  sura:    { name: 'Sura',    hp: 28, mv: 4, side: 'party', cycle: 28, atk: { label: 'Water Lash', min: 1, max: 3, dmg: 7, kind: 'water' } },
  bo:      { name: 'Bo',      hp: 36, mv: 3, side: 'party', cycle: 28, atk: { label: 'Stone Fist', min: 1, max: 1, dmg: 11, kind: 'earth' } },
  thug:    { name: 'Bandit',  hp: 28, mv: 4, side: 'foe', cycle: 28, atk: { label: 'Club Swing', min: 1, max: 1, dmg: 7, kind: 'club' } },
  slinger: { name: 'Slinger', hp: 22, mv: 4, side: 'foe', cycle: 28, atk: { label: 'Sling Stone', min: 2, max: 5, dmg: 5, kind: 'stone' } },
  bruiser: { name: 'Bruiser', hp: 42, mv: 3, side: 'foe', cycle: 30, atk: { label: 'Heavy Slam', min: 1, max: 1, dmg: 11, kind: 'slam' } },
};
const UNITS = [];
function mkUnit(k, cx, cy, face) {
  const s = STATS[k], u = { k, name: s.name, side: s.side, cx, cy, x: cellX(cx), y: cellY(cy), hp: s.hp, max: s.hp, mv: s.mv, dir: face,
    anim: 'idle', at: 0, path: [], dist: 0, flash: -1, ko: -1, moved: false, acted: false, phase: Math.floor(rnd() * 900), shove: [0, 0] };
  UNITS.push(u); return u;
}
function dirTo(dx, dy, four) {
  if (four) return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'east' : 'west') : (dy >= 0 ? 'south' : 'north');
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); return DIRS[(a + 8) % 8];
}
const TINT = document.createElement('canvas'); TINT.width = TINT.height = 80;
// ---------- drawing a unit (frames are PixelLab's, packed with their feet on the cell's foot point)
let clock = 0;
function drawClip(u, clipName, frame, dir, alpha = 1, lift = 0) {
  const clip = ASSETS.chars[u.k][clipName]; let row = clip.dirs.indexOf(dir);
  if (row < 0) { const i = DIRS.indexOf(dir); let best = 0, bd = 9; clip.dirs.forEach((d, r) => { const k = Math.abs(((DIRS.indexOf(d) - i + 12) % 8) - 4); if (4 - k < bd) { bd = 4 - k; best = r; } }); row = best; }
  const x = Math.round(u.x + u.shove[0]) - AX - cam.rx, y = Math.round(u.y + u.shove[1]) - AY - cam.ry + lift;
  if (alpha < 1) ctx.globalAlpha = alpha;
  const tint = u.st && (has(u, 'frozen') ? 'rgba(200,232,246,0.62)' : has(u, 'chilled') ? 'rgba(170,215,235,0.35)' : has(u, 'wet') ? 'rgba(110,170,190,0.18)' : null);
  if (tint) {   // frost and wet: the figure's own pixels tinted (source-atop on a scratch cell), never a box
    TINT.getContext('2d').clearRect(0, 0, CELL, CELL); const tg = TINT.getContext('2d'); tg.globalCompositeOperation = 'source-over';
    tg.drawImage(IMG[`ch:${u.k}:${clipName}`], (frame % clip.frames) * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
    tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = tint; tg.fillRect(0, 0, CELL, CELL);
    if (has(u, 'wet')) { tg.fillStyle = 'rgba(232,244,240,0.55)'; for (let i = 0; i < 6; i++) tg.fillRect(30 + ((i * 7 + (clock / 200 | 0)) % 20), 26 + i * 6, 1, 1); }
    ctx.drawImage(TINT, x, y);
  } else ctx.drawImage(IMG[`ch:${u.k}:${clipName}`], (frame % clip.frames) * CELL, row * CELL, CELL, CELL, x, y, CELL, CELL);
  if (u.st && has(u, 'frozen')) { ctx.fillStyle = 'rgba(232,244,248,0.85)'; ctx.fillRect(x + 28, y + AY - 2, 24, 1); ctx.fillRect(x + 27, y + AY - 30, 1, 28); ctx.fillRect(x + 52, y + AY - 30, 1, 28); }
  if (u.flash >= 0 && u.flash < 160) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * (1 - u.flash / 160); ctx.drawImage(IMG[`ch:${u.k}:${clipName}`], (frame % clip.frames) * CELL, row * CELL, CELL, CELL, x, y, CELL, CELL); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1;
}
function unitDraw(u) {
  const ch = ASSETS.chars[u.k];
  if (u.ko >= 0) {   // knocked out: they sink and fade over 0.7 s, one dark blink first
    const t = u.ko, a = Math.max(0, 1 - t / 700); if (!a) return;
    return drawClip(u, 'idle', 0, u.dir, a, Math.min(6, Math.round(t / 110)));
  }
  if (u.anim === 'bend') return drawClip(u, MOVES[u.move.k].clip, Math.max(0, moveFrame(u)), u.move.dir);
  if (u.anim === 'attack' && ch.attack) return drawClip(u, 'attack', Math.min(ch.attack.frames - 1, Math.floor(u.at / ATK_MS)), u.dir);
  if (u.path.length && ch.walk) return drawClip(u, 'walk', Math.floor(u.dist / (STATS[u.k].cycle / ch.walk.frames)), u.dir);
  if (ch.idle) { const calm = (ch.idle.calm || {})[u.dir] || [0]; const n = calm.length, k = Math.floor((clock + u.phase) / 420) % (2 * n - 2 || 1); return drawClip(u, 'idle', calm[k < n ? k : 2 * n - 2 - k], u.dir); }
  drawClip(u, 'rot', 0, u.dir);
}
const ATK_MS = 80, WALK_PX = 92;
function updateUnits(dt) {
  for (const u of UNITS) {
    if (u.flash >= 0) { u.flash += dt; if (u.flash > 400) u.flash = -1; }
    if (u.ko >= 0) u.ko += dt;
    u.shove = u.shove.map(v => v * Math.exp(-dt / 90));
    if (u.path.length) {
      const [nx, ny] = u.path[0], tx = cellX(nx), ty = cellY(ny), dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy), st = WALK_PX * dt / 1000;
      u.dir = dirTo(dx, dy, u.k !== 'kaya');
      if (d <= st) { u.x = tx; u.y = ty; u.cx = nx; u.cy = ny; u.path.shift(); u.dist += d; if (!u.path.length && u.arrive) { const f = u.arrive; u.arrive = null; f(); } }
      else { u.x += dx / d * st; u.y += dy / d * st; u.dist += st; }
    }
    if (u.anim === 'attack') { u.at += dt; const n = ASSETS.chars[u.k].attack.frames; if (!u.struck && u.at >= ATK_MS * Math.round(n * 0.55)) { u.struck = true; u.onStrike && u.onStrike(); } if (u.at >= ATK_MS * n) { u.anim = 'idle'; u.done && u.done(); } }
    if (u.anim === 'bend') updateBend(u, dt);
  }
}
