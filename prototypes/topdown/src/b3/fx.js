// ---------- Kaya's bends (the v4 frames and fire VFX, untouched) and the other blows' simple pixel effects
const MV = ASSETS.moves;
const VEC8 = { east: [1, 0], 'south-east': [0.7071, 0.7071], south: [0, 1], 'south-west': [-0.7071, 0.7071], west: [-1, 0], 'north-west': [-0.7071, -0.7071], north: [0, -1], 'north-east': [0.7071, -0.7071] };
const MOVES = {
  jab:   { label: 'Fire Jab',   clip: 'jab',   ms: [70, 70, 70, 80, 50, 140, 90, 70, 70, 70, 80] },
  whip:  { label: 'Flame Whip', clip: 'whip',  ms: null },
  stomp: { label: 'Fire Stomp', clip: 'stomp', ms: null },
  blast: { label: 'Fire Blast', clip: 'blast', ms: null },   // v3: Fire Blast has its own pose (skeleton-v3, both palms driven forward)
};
for (const k of ['whip', 'stomp', 'blast']) { if (!ASSETS.chars.kaya[k]) continue; const n = ASSETS.chars.kaya[k].frames; MOVES[k].ms = Array.from({ length: n }, (_, i) => (i === MV[k].strike ? 150 : 70)); }
if (!ASSETS.chars.kaya.blast) MOVES.blast = MOVES.jab;
for (const k in MOVES) MOVES[k].strike = MV[k].strike;
const shots = [], bursts = [], embers = [], flashes = [], arcs = [], rings = [], bolts = [], dusts = [], nums = [];
let shake = 0, shakeAmp = 2;
function moveFrame(u) { let t = u.move.t; const ms = MOVES[u.move.k].ms; for (let i = 0; i < ms.length; i++) { if (t < ms[i]) return i; t -= ms[i]; } return -1; }
function startBend(u, k, dir, onStrike, done) { u.anim = 'bend'; u.move = { k, t: 0, dir, fired: false, onStrike, done }; u.dir = dir; }
function updateBend(u, dt) {
  u.move.t += dt; const f = moveFrame(u);
  if (f >= MOVES[u.move.k].strike && !u.move.fired) { u.move.fired = true; u.move.onStrike && u.move.onStrike(); }
  if (f < 0) { const done = u.move.done; u.anim = 'idle'; u.move = null; done && done(); }
}
// the Fire Jab: a fireball flies from her fist along the ground line to the target
function fireJab(u, tx, ty, onHit) {
  const d = u.move.dir, [ux, uy] = VEC8[d], [fx, fy] = MV.jab.fist[d] || [ux * 14, -22];
  const sx = u.x + fx, sy = u.y + fy, gy = u.y + uy * 6;
  bursts.push({ d, x: sx, y: sy, t: 0 });
  shots.push({ d, x: sx + ux * 4, g: gy + uy * 4, h: gy - sy, tx, ty, t: 0, onHit });
  flashes.push({ x: sx, y: gy, t: 0, life: 220, r: 12 }); shake = 150; shakeAmp = 1;
}
function fireWhip(u) { const d = u.move.dir, [ux, uy] = VEC8[d]; arcs.push({ d, x: u.x + ux * 12, y: u.y - 22 + uy * 12, t: 0, sort: u.y + (uy < 0 ? -6 : 6) }); for (let i = -1; i <= 1; i++) flashes.push({ x: u.x + ux * 36 - uy * 22 * i, y: u.y + uy * 30 + ux * 10 * i, t: -60 * (i + 1), life: 260, r: 12 }); shake = 140; shakeAmp = 1; }
function fireStomp(u) { rings.push({ x: u.x, y: u.y, t: 0 }); flashes.push({ x: u.x, y: u.y, t: 0, life: 360, r: 26 }); shake = 260; shakeAmp = 2; }
// a thrown thing (a sling stone, a water lash): a short arc from hand to target, then an impact
function throwBolt(kind, fromU, to, onHit, look) { const d = Math.hypot(to.x - fromU.x, to.y - fromU.y); bolts.push({ kind, look, x0: fromU.x, y0: fromU.y - 24, x1: to.x, y1: to.y - 16, t: 0, life: kind === 'water' ? 360 : kind === 'bolt' ? Math.max(160, d * 1.1) : Math.max(260, d * 2), onHit }); }
// v3: the painted effects (PixelLab /vfx, lite artist): one-shots placed by their own pivot; flipped (never rotated) to face west
const vfxs = [];
function vfxAt(k, x, y, o = {}) { if (ASSETS.vfx13 && ASSETS.vfx13[k]) vfxs.push({ k, x, y, t: 0, flip: !!o.flip }); }
function drawVfx(v) { const m = ASSETS.vfx13[v.k], f = fxFrame(m, v.t), img = IMG['vx:' + v.k]; if (f < 0 || v.t >= m.total) return;
  const X = Math.round(v.x) - (v.flip ? m.w - m.px : m.px) - cam.rx, Y = Math.round(v.y) - m.py - cam.ry;
  if (v.flip) { ctx.save(); ctx.translate(X + m.w, Y); ctx.scale(-1, 1); ctx.drawImage(img, f * m.w, 0, m.w, m.h, 0, 0, m.w, m.h); ctx.restore(); }
  else ctx.drawImage(img, f * m.w, 0, m.w, m.h, X, Y, m.w, m.h); }
function impact(kind, x, y) {
  if (kind === 'water') for (let i = 0; i < 14; i++) dusts.push({ x, y: y - 14, vx: (rnd() - 0.5) * 90, vy: -40 - rnd() * 60, t: 0, life: 420, col: i % 3 ? '#86c2bd' : '#e8f4f0' });
  if (kind === 'earth' || kind === 'slam') { for (let i = 0; i < 18; i++) dusts.push({ x: x + (rnd() - 0.5) * 18, y, vx: (rnd() - 0.5) * 110, vy: -30 - rnd() * 50, t: 0, life: 520, col: i % 2 ? '#7d5434' : '#a08a6c' }); shake = kind === 'slam' ? 260 : 160; shakeAmp = 2; }
  if (kind === 'club' || kind === 'stone') { flashes.push({ x, y, t: 0, life: 160, r: 8, white: true }); shake = 110; shakeAmp = 1; }
}
const NAMES = []; function showName(s) { NAMES.push(s); const el = document.getElementById('name'); el.textContent = s; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function popNum(u, n, col = '#f6eed6') { nums.push({ x: u.x, y: u.y - 50 - (nums.filter(q => q.t < 300).length % 3) * 7, s: String(n), t: 0, col }); }
function popText(u, s, col = '#f6eed6') { nums.push({ x: u.x, y: u.y - 58 - (nums.filter(q => q.t < 400).length % 3) * 7, s, t: 0, col, life: 1300 }); }
function popTextAt(x, y, s, col = '#f6eed6') { nums.push({ x, y, s, t: 0, col, life: 1500 }); }
function updateFx(dt) {
  for (const s of shots) {
    const dx = s.tx - s.x, dy = s.ty - s.g, d = Math.hypot(dx, dy), st = 320 * dt / 1000; s.t += dt;
    if (d <= st) { s.done = true; embers.push({ x: s.tx, y: s.ty - s.h, t: 0 }); flashes.push({ x: s.tx, y: s.ty, t: 0, life: 260, r: 14 }); shake = 120; shakeAmp = 1; s.onHit && s.onHit(); continue; }
    s.x += dx / d * st; s.g += dy / d * st; s.h = Math.max(8, s.h - 6 * dt / 1000); flashes.push({ x: s.x, y: s.g, t: 0, life: 90, r: 7 });
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
  for (const b of bolts) { b.t += dt; if (b.t >= b.life && !b.done) { b.done = true; impact(b.kind, b.x1, b.y1 + 16); b.onHit && b.onHit(); } }
  for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].done) bolts.splice(i, 1);
  for (const p of dusts) { p.t += dt; p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += 260 * dt / 1000; }
  for (let i = dusts.length - 1; i >= 0; i--) if (dusts[i].t > dusts[i].life) dusts.splice(i, 1);
  for (const n of nums) n.t += dt; for (let i = nums.length - 1; i >= 0; i--) if (nums[i].t > (nums[i].life || 900)) nums.splice(i, 1);
  for (const a of [bursts, embers, flashes, arcs, rings, vfxs]) for (const b of a) b.t += dt;
  for (let i = vfxs.length - 1; i >= 0; i--) if (vfxs[i].t > ASSETS.vfx13[vfxs[i].k].total) vfxs.splice(i, 1);
  const len = v => v.ms.reduce((a, b) => a + b, 0), drop = (a, l) => { while (a.length && a[0].t > l) a.shift(); };
  drop(bursts, len(MV.vfx.burst.east)); drop(embers, len(MV.vfx.embers)); drop(arcs, len(MV.vfx.whip.east)); drop(rings, len(MV.vfx.ring));
  for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].t > flashes[i].life) flashes.splice(i, 1);
  if (shake > 0) shake -= dt;
}
function fxFrame(v, t) { let i = 0; while (i < v.n - 1 && t >= v.ms[i]) { t -= v.ms[i]; i++; } return i; }
function drawFx(key, v, x, y, t) { if (t < 0) return; const f = fxFrame(v, t); ctx.drawImage(IMG[key], f * v.w, 0, v.w, v.h, Math.round(x) - v.px - cam.rx, Math.round(y) - v.py - cam.ry, v.w, v.h); }
function drawBolts() {
  for (const b of bolts) {
    const k = Math.min(1, b.t / b.life), x = b.x0 + (b.x1 - b.x0) * k, y = b.y0 + (b.y1 - b.y0) * k - Math.sin(k * Math.PI) * (b.kind === 'stone' ? 18 : 8);
    const X = Math.round(x) - cam.rx, Y = Math.round(y) - cam.ry;
    if (b.kind === 'stone' && b.look === 'rock') { ctx.fillStyle = '#3a2e2c'; ctx.fillRect(X - 4, Y - 3, 8, 6); ctx.fillStyle = '#7d5434'; ctx.fillRect(X - 3, Y - 2, 6, 4); ctx.fillStyle = '#a6713f'; ctx.fillRect(X - 3, Y - 2, 3, 2); }
    else if (b.kind === 'stone') { ctx.fillStyle = '#322125'; ctx.fillRect(X - 2, Y - 1, 4, 3); ctx.fillStyle = '#85807f'; ctx.fillRect(X - 1, Y - 1, 2, 2); }
    else if (b.kind === 'bolt') { const ang = Math.atan2(b.y1 - b.y0, b.x1 - b.x0); for (let i = 0; i < 7; i++) { ctx.fillStyle = i < 2 ? '#aea89c' : i < 6 ? '#7d5434' : '#e8d8b0'; ctx.fillRect(Math.round(X - Math.cos(ang) * i), Math.round(Y - Math.sin(ang) * i), 1, 1); } }
    else if (b.kind === 'jar') { ctx.fillStyle = '#3a2e2c'; ctx.fillRect(X - 3, Y - 4, 6, 7); ctx.fillStyle = '#c4643f'; ctx.fillRect(X - 2, Y - 3, 4, 5); ctx.fillStyle = '#e09a6a'; ctx.fillRect(X - 2, Y - 3, 1, 3); ctx.fillStyle = '#3a2e2c'; ctx.fillRect(X - 1, Y - 6, 2, 2); }
    else if (b.kind === 'torch') { const m = ASSETS.vfx13 && ASSETS.vfx13.torch; if (m) { const f = Math.floor(b.t / 70) % m.n; ctx.drawImage(IMG['vx:torch'], f * m.w, 0, m.w, m.h, X - m.px, Y - m.py, m.w, m.h); } }
    else { // a ribbon of water: a few trailing pixels behind the head
      for (let i = 0; i < 6; i++) { const kk = Math.max(0, k - i * 0.05), xx = b.x0 + (b.x1 - b.x0) * kk, yy = b.y0 + (b.y1 - b.y0) * kk - Math.sin(kk * Math.PI) * 8; ctx.fillStyle = i < 2 ? '#e8f4f0' : i < 4 ? '#86c2bd' : '#4a8f98'; ctx.fillRect(Math.round(xx) - cam.rx - 1, Math.round(yy) - cam.ry - 1, i < 2 ? 3 : 2, 2); }
    }
  }
  for (const p of dusts) { ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x) - cam.rx, Math.round(p.y) - cam.ry, 2, 2); }
}
