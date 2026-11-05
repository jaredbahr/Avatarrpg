'use strict';
// Ba Dan Lane v3. v2 plus a motion layer: Kaya is drawn as five parts of PixelLab's own frame (legs, coat hem,
// torso+arms, head, ponytail), each nudged by whole pixels from springs and the walk phase.
// Ba Dan Lane v2. Every sprite and tile is PixelLab output (see README). The engine supplies the motion:
// continuous movement with eased starts and stops, walk frames advanced by distance travelled (not by time),
// facing that sweeps through the in-between headings, and a smoothed whole-pixel camera.
const T = 32, MW = 26, MH = 21, PW = MW * T, PH = MH * T;
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']; // index * 45deg, y down
const Q = new URLSearchParams(location.search);
const REC = Q.get('record') === '1';
if (REC) document.body.classList.add('rec');
let seed = 1234567;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const CELL = ASSETS.cell, AX = ASSETS.ax, AY = ASSETS.ay;

// ---------- tuning
const WALK_SPEED = 60;            // px/s (v2: 66); slower, because the layer's longer stride makes each step cover more ground
const CYCLE_PX = 38;              // ground per 12-frame cycle (v2: 30); the stride offsets add ~4 px a step, so the feet stay planted
const ACCEL = 9, DECEL = 11;      // exponential ease rates in and out (1/s)
const TURN = Math.PI * 3.2;       // rad/s: a 180-degree turn sweeps through the diagonals in ~0.3 s

// ---------- images
const IMG = {};
const load = (key, src) => new Promise(r => { const i = new Image(); i.onload = () => { IMG[key] = i; r(); }; i.src = src; });
const loads = [];
for (const [k, s] of Object.entries(ASSETS.tiles)) loads.push(load('tile:' + k, s));
for (const [k, v] of Object.entries(ASSETS.variants)) loads.push(load('var:' + k, v.src));
for (const [c, clips] of Object.entries(ASSETS.chars)) for (const [n, v] of Object.entries(clips)) loads.push(load(`ch:${c}:${n}`, v.src));
for (const [k, v] of Object.entries(ASSETS.objects)) loads.push(load('ob:' + k, v.src));
for (const [k, v] of Object.entries(ASSETS.vfx)) { if (v.src) loads.push(load('fx:' + k, v.src)); else for (const [d, w] of Object.entries(v)) loads.push(load(`fx:${k}:${d}`, w.src)); }

// ---------- terrain (Wang corners on a vertex grid): G grass, C cobble, W water, D dirt
const ROAD = { 18: [8, 10], 19: [9, 11], 20: [10, 13], 21: [12, 14] };
function vt(x, y) {
  if (y === 14 || y === 15) return 'W';
  if ((y >= 6 && y <= 10) || y === 13 || y === 16) return 'C';
  const r = ROAD[y]; if (r && x >= r[0] && x <= r[1]) return 'D';
  return 'G';
}
const setFor = a => { const u = [...new Set(a)].sort().join(''); return { G: 'gc', C: 'gc', W: 'canal', D: 'dirt', CG: 'gc', CW: 'canal', DG: 'dirt' }[u]; };

// ---------- objects (centre x, base y in px) and their foot blockers
const OBJ = [], SOLID = [];
function put(k, cx, by, o = {}) {
  const a = ASSETS.objects[k]; const ob = { k, x: Math.round(cx - a.w / 2), y: by - a.h, w: a.w, h: a.h, base: by, flat: !!o.flat };
  OBJ.push(ob);
  if (o.foot) { const [fw, fh] = o.foot; SOLID.push({ x: cx - fw / 2, y: by - fh, w: fw, h: fh }); }
  return ob;
}
put('house_cream', 92, 192, { foot: [140, 120] });
put('house_green', 252, 192, { foot: [140, 120] });
put('house_ochre', 412, 192, { foot: [138, 120] });
put('tree_blossom', 506, 180, { foot: [14, 10] });
put('teahouse', 620, 192, { foot: [170, 110] });
put('tree', 776, 168, { foot: [22, 12] });
put('bush', 816, 196, { foot: [26, 10] });
const lamps = [put('lamp', 172, 204, { foot: [10, 6] }), put('lamp', 522, 204, { foot: [10, 6] }), put('lamp', 340, 404, { foot: [10, 6] })];
put('stall', 640, 324, { foot: [118, 34] });
const dummy = put('dummy', 452, 246, { foot: [16, 10] }); dummy.hit = -1;
put('pots', 566, 322, { foot: [24, 10] });
put('barrels', 732, 286, { foot: [30, 10] });
put('crates', 734, 314, { foot: [32, 12] });
put('well', 800, 312, { foot: [66, 30] });
put('bench', 110, 384, { foot: [34, 8] });
put('flowers', 204, 396, { flat: true });
put('flowers', 640, 396, { flat: true });
put('bush', 812, 404, { foot: [26, 10] });
const bridge = put('bridge', 288, 512, { flat: true });
put('sign', 372, 602, { foot: [12, 8] });
put('tree', 96, 650, { foot: [22, 12] });
put('tree_blossom', 740, 616, { foot: [14, 10] });
put('bush', 220, 662, { foot: [26, 10] });
for (const [x, y] of [[40, 570], [470, 560], [560, 650], [620, 580], [790, 660], [150, 560]]) put('tuft', x, y, { flat: true });
// the canal is solid except over the bridge deck
SOLID.push({ x: 0, y: 13 * T + 10, w: bridge.x + 6, h: 2 * T + 4 }, { x: bridge.x + bridge.w - 6, y: 13 * T + 10, w: PW, h: 2 * T + 4 });
const CHIMNEYS = [[92 - 75 + 120, 192 - 178 + 5], [412 - 74 + 114, 192 - 185 + 11]];
const FOOT_W = 12, FOOT_H = 6;
function solidAt(x, y, w = FOOT_W, h = FOOT_H) {
  const l = x - w / 2, t = y - h, r = x + w / 2, b = y;
  if (l < 2 || r > PW - 2 || t < 2 || b > PH - 2) return true;
  for (const s of SOLID) if (l < s.x + s.w && r > s.x && t < s.y + s.h && b > s.y) return true;
  return false;
}

// ---------- ground layer, baked once (variants scattered on the plain grass and cobble cells)
const ground = document.createElement('canvas'); ground.width = PW; ground.height = PH;
function bakeGround() {
  const g = ground.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const c = [vt(x, y), vt(x + 1, y), vt(x, y + 1), vt(x + 1, y + 1)];
    const s = setFor(c) || 'gc', key = ASSETS.tileKey[s];
    const idx = parseInt(c.map(v => (key['1'] === v ? '1' : '0')).join(''), 2);
    const pure = c.every(v => v === c[0]);
    const vr = pure && ASSETS.variants[c[0]];
    if (vr && rnd() < (c[0] === 'G' ? 0.45 : 0.3)) {
      const pool = c[0] === 'C' ? (rnd() < 0.12 ? [4, 5, 6, 7] : [0, 1, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15]) : [...Array(vr.n).keys()];
      const n = pool[Math.floor(rnd() * pool.length)]; g.drawImage(IMG['var:' + c[0]], n * T, 0, T, T, x * T, y * T, T, T);
    } else g.drawImage(IMG['tile:' + s], (idx % 4) * T, (idx >> 2) * T, T, T, x * T, y * T, T, T);
  }
  for (const o of OBJ) if (o.flat) g.drawImage(IMG['ob:' + o.k], o.x, o.y);
}

// ---------- actors
const angOf = d => DIRS.indexOf(d) * Math.PI / 4;
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
class Actor {
  constructor(name, x, y, face = 'south', speed = WALK_SPEED) {
    Object.assign(this, { name, x, y, vx: 0, vy: 0, face: angOf(face), want: angOf(face), speed, dist: 0, idleT: 0, look: -1, path: [], cycle: CYCLE_PX });
  }
  get heading() { const i = ((Math.round(this.face / (Math.PI / 4)) % 8) + 8) % 8; return DIRS[i]; }
  get moving() { return Math.hypot(this.vx, this.vy) > 6; }
  // ix, iy: desired direction (unit or zero). Eased velocity, axis-separated collision so walls slide.
  drive(ix, iy, dt, maxSpeed = this.speed) {
    const s = dt / 1000, tx = ix * maxSpeed, ty = iy * maxSpeed;
    const k = 1 - Math.exp(-(ix || iy ? ACCEL : DECEL) * s);
    this.vx += (tx - this.vx) * k; this.vy += (ty - this.vy) * k;
    if (Math.abs(this.vx) < 0.5 && !ix) this.vx = 0; if (Math.abs(this.vy) < 0.5 && !iy) this.vy = 0;
    const ox = this.x, oy = this.y;
    const nx = this.x + this.vx * s; if (!solidAt(nx, this.y, this.fw, this.fh) && !this.bump(nx, this.y)) this.x = nx; else this.vx = 0;
    const ny = this.y + this.vy * s; if (!solidAt(this.x, ny, this.fw, this.fh) && !this.bump(this.x, ny)) this.y = ny; else this.vy = 0;
    const moved = Math.hypot(this.x - ox, this.y - oy); this.dist += moved;
    if (ix || iy) this.want = Math.atan2(iy, ix);
    // sweep the facing toward the wanted heading at a fixed turn rate, so a reversal passes through the diagonals
    const d = wrap(this.want - this.face), st = TURN * s;
    this.face = Math.abs(d) <= st ? this.want : wrap(this.face + Math.sign(d) * st);
    if (moved > 0.05 || ix || iy) { this.idleT = 0; this.look = -1; } else this.idleT += dt;
    return moved;
  }
  bump(x, y) { for (const o of ACTORS) if (o !== this && o.solid && Math.abs(o.x - x) < 14 && Math.abs(o.y - y) < 8 && Math.hypot(o.x - x, o.y - y) < Math.hypot(o.x - this.x, o.y - this.y)) return true; return false; }
  // steer along this.path; ease into the last point
  follow(dt) {
    if (!this.path.length) return this.drive(0, 0, dt);
    const [px, py] = this.path[0], dx = px - this.x, dy = py - this.y, d = Math.hypot(dx, dy);
    const last = this.path.length === 1;
    if (d < (last ? 1.5 : 7)) { this.path.shift(); if (!this.path.length) { this.arrive && this.arrive(); } return this.drive(0, 0, dt); }
    const sp = last ? Math.min(this.speed, 18 + d * 3.2) : this.speed;
    return this.drive(dx / d, dy / d, dt, sp);
  }
}
const kaya = new Actor('kaya', 300, 270, 'south');
const shop = new Actor('shopkeeper', 548, 300, 'south'); shop.solid = true;
const vill = new Actor('villager', 70, 304, 'east', 44); vill.solid = true;
const cat = new Actor('cat', 440, 588, 'east', 26); cat.cycle = 22; cat.fw = 10; cat.fh = 4;
const ACTORS = [kaya, shop, vill, cat];
kaya.solid = true;

// ---------- pathing: A* on a 16 px nav grid, then string-pulled into straight runs
const NG = 16, NW = PW / NG, NH = PH / NG;
const navFree = (cx, cy) => !solidAt(cx * NG + 8, cy * NG + 11, FOOT_W + 2, FOOT_H + 2) && !(Math.abs(cx * NG + 8 - shop.x) < 14 && Math.abs(cy * NG + 11 - shop.y) < 10);
function lineFree(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
  for (let i = 1; i <= n; i++) { const t = i / n; if (solidAt(ax + (bx - ax) * t, ay + (by - ay) * t, FOOT_W + 2, FOOT_H + 2)) return false; }
  return true;
}
function astar(sx, sy, gx, gy) {
  const s = [Math.floor(sx / NG), Math.floor(sy / NG)];
  let g = [Math.floor(gx / NG), Math.floor(gy / NG)];
  if (!navFree(...g)) { // nearest free cell to the tap
    let best = null, bd = 1e9;
    for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) if (navFree(x, y)) { const d = Math.hypot(x - g[0], y - g[1]); if (d < bd) { bd = d; best = [x, y]; } }
    if (!best) return null; g = best; gx = g[0] * NG + 8; gy = g[1] * NG + 11;
  }
  const key = (x, y) => y * NW + x, open = [[0, s[0], s[1]]], from = new Map(), cost = new Map([[key(...s), 0]]);
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]); const [, x, y] = open.shift();
    if (x === g[0] && y === g[1]) {
      const pts = []; let k = key(x, y);
      while (from.has(k)) { pts.unshift([(k % NW) * NG + 8, Math.floor(k / NW) * NG + 11]); k = from.get(k); }
      if (pts.length) pts[pts.length - 1] = [gx, gy];
      // string-pull: keep only the corners a straight walk cannot skip
      const out = []; let ax = sx, ay = sy, i = 0;
      while (i < pts.length) { let j = pts.length - 1; while (j > i && !lineFree(ax, ay, pts[j][0], pts[j][1])) j--; out.push(pts[j]); [ax, ay] = pts[j]; i = j + 1; }
      return out;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= NW || ny >= NH || !navFree(nx, ny)) continue;
      if (dx && dy && (!navFree(x + dx, y) || !navFree(x, y + dy))) continue;
      const c = cost.get(key(x, y)) + (dx && dy ? 1.414 : 1);
      if (c < (cost.get(key(nx, ny)) ?? 1e9)) { cost.set(key(nx, ny), c); from.set(key(nx, ny), key(x, y)); open.push([c + Math.hypot(g[0] - nx, g[1] - ny), nx, ny]); }
    }
  }
  return null;
}
function walkTo(x, y) { const p = astar(kaya.x, kaya.y, x, y); kaya.path = p || []; return !!p; }

// ---------- input
const held = new Set(), padDirs = new Set(); let pendingTalk = false, tapMark = null;
const KEYS = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
addEventListener('keydown', e => {
  if (KEYS[e.code]) { held.add(KEYS[e.code]); kaya.path = []; pendingTalk = false; hideHint(); e.preventDefault(); }
  if (['KeyE', 'Enter'].includes(e.code)) { interact(); e.preventDefault(); }
  if (['Space', 'KeyJ'].includes(e.code) && !e.repeat) { if (dlg.open) advanceDialog(); else startJab(); e.preventDefault(); }
});
addEventListener('keyup', e => { if (KEYS[e.code]) held.delete(KEYS[e.code]); });
addEventListener('blur', () => held.clear());
for (const b of document.querySelectorAll('#pad button')) {
  const [dx, dy] = b.dataset.d.split(',').map(Number); const k = dx < 0 ? 'l' : dx > 0 ? 'r' : dy < 0 ? 'u' : 'd';
  const on = e => { e.preventDefault(); padDirs.add(k); b.classList.add('on'); kaya.path = []; pendingTalk = false; hideHint(); };
  const off = e => { e.preventDefault(); padDirs.delete(k); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
}
document.getElementById('act').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
document.getElementById('bend').addEventListener('pointerdown', e => { e.preventDefault(); hideHint(); startJab(); });
function inputDir() {
  const s = new Set([...held, ...padDirs]);
  const x = (s.has('r') ? 1 : 0) - (s.has('l') ? 1 : 0), y = (s.has('d') ? 1 : 0) - (s.has('u') ? 1 : 0), n = Math.hypot(x, y) || 1;
  return [x / n, y / n];
}
const nearShop = () => Math.hypot(kaya.x - shop.x, (kaya.y - shop.y) * 1.3) < 46 && !kaya.moving;
function interact() { if (dlg.open) return advanceDialog(); if (nearShop()) openDialog(); }
const cv = document.getElementById('c');
cv.addEventListener('pointerdown', e => {
  if (dlg.open) { advanceDialog(); return; }
  hideHint();
  const r = cv.getBoundingClientRect();
  const wx = (e.clientX - r.left) / r.width * view.w + cam.rx, wy = (e.clientY - r.top) / r.height * view.h + cam.ry;
  if (Math.abs(wx - shop.x) < 14 && wy > shop.y - 50 && wy < shop.y + 6) {
    if (nearShop()) { openDialog(); return; }
    walkTo(shop.x - 30, shop.y + 4); pendingTalk = true; return;
  }
  pendingTalk = false; walkTo(wx, wy); tapMark = { x: wx, y: wy, t: 500 };
});

function updateKaya(dt) {
  if (dlg.open || jab) { kaya.drive(0, 0, dt); return; }
  const [ix, iy] = inputDir();
  if (ix || iy) kaya.drive(ix, iy, dt); else kaya.follow(dt);
  if (pendingTalk && !kaya.path.length && nearShop()) { pendingTalk = false; openDialog(); }
}
// villager: strolls the lane and back, pausing at each end
const villRoute = [[70, 304], [470, 304]]; let villLeg = 1, villWait = 0;
function updateVillager(dt) {
  if (villWait > 0) { villWait -= dt; vill.drive(0, 0, dt); vill.want = angOf('south'); return; }
  if (!vill.path.length) { vill.path = [villRoute[villLeg]]; vill.arrive = () => { villLeg = 1 - villLeg; villWait = 2600; }; }
  vill.follow(dt);
}
// cat: pads east and west along the south bank, settles down between walks
const catRoute = [[440, 588], [640, 588]]; let catLeg = 1, catSit = 0, catSitT = 0;
function updateCat(dt) {
  if (catSit > 0) { catSit -= dt; catSitT += dt; cat.drive(0, 0, dt); return; }
  if (!cat.path.length) { cat.path = [catRoute[catLeg]]; cat.arrive = () => { catLeg = 1 - catLeg; catSit = 5200; catSitT = 0; }; }
  cat.follow(dt);
  const h = cat.heading; if (h !== 'east' && h !== 'west') cat.face = cat.vx >= 0 ? 0 : Math.PI;
}
function updateShop(dt) {
  shop.drive(0, 0, dt);
  shop.want = nearShop() || dlg.open ? Math.atan2(kaya.y - shop.y, kaya.x - shop.x) : angOf('south');
}

// ---------- dialogue (original lines)
const LINES = [
  ['Old Hesa', 'Mind the canal steps, Kaya. The moss is slick after the rain.'],
  ['Old Hesa', 'Here, take a sun-pear for the road. A fire burns brighter on a full belly.'],
];
const dlg = { open: false, i: 0, shown: 0 };
const dlgEl = document.getElementById('dlg'), dlgName = document.getElementById('dlgName'), dlgText = document.getElementById('dlgText');
function openDialog() { kaya.want = Math.atan2(shop.y - kaya.y, shop.x - kaya.x); dlg.open = true; dlg.i = 0; dlg.shown = 0; dlgEl.style.display = 'block'; held.clear(); renderDialog(); }
function advanceDialog() {
  const full = LINES[dlg.i][1].length;
  if (dlg.shown < full) { dlg.shown = full; renderDialog(); return; }
  dlg.i++; dlg.shown = 0;
  if (dlg.i >= LINES.length) { dlg.open = false; dlgEl.style.display = 'none'; return; }
  renderDialog();
}
function renderDialog() { dlgName.textContent = LINES[dlg.i][0]; dlgText.textContent = LINES[dlg.i][1].slice(0, Math.floor(dlg.shown)); }
let hintGone = false;
function hideHint() { if (!hintGone) { hintGone = true; document.getElementById('hint').style.opacity = 0; } }

// ---------- ambient life
const smoke = []; let smokeT = 0;
const glints = Array.from({ length: 60 }, () => ({ x: rnd() * PW, y: 14 * T - 6 + Math.floor(rnd() * 44), ph: rnd() * 2000, sp: 3 + rnd() * 5 }));
const birds = []; let birdT = 2500;
function updateAmbient(dt) {
  smokeT -= dt;
  if (smokeT <= 0) { smokeT = 240; for (const [x, y] of CHIMNEYS) smoke.push({ x: x + rnd() * 3 - 2, y: y - 1, age: 0, life: 3600 + rnd() * 1400, vx: 2 + rnd() * 3, vy: -6 - rnd() * 3 }); }
  for (const p of smoke) { p.age += dt; p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vx += 1.4 * dt / 1000; }
  while (smoke.length && smoke[0].age > smoke[0].life) smoke.shift();
  for (const g of glints) { g.ph += dt; g.x += g.sp * dt / 1000; if (g.x > PW) g.x -= PW; }
  birdT -= dt;
  if (birdT <= 0) { birdT = 9000 + rnd() * 5000; const y0 = 30 + rnd() * 300; birds.push({ x: -10, y: y0, vx: 46, vy: 10, t: 0 }, { x: -26, y: y0 + 12, vx: 46, vy: 10, t: 180 }); }
  for (const b of birds) { b.t += dt; b.x += b.vx * dt / 1000; b.y += b.vy * dt / 1000; }
  while (birds.length && birds[0].x > PW + 40) birds.shift();
}

// ---------- motion layer (Kaya). All offsets are whole pixels; nothing is rotated or resampled.
const L = ASSETS.layers;
const VEC8 = { east: [1, 0], 'south-east': [0.7071, 0.7071], south: [0, 1], 'south-west': [-0.7071, 0.7071], west: [-1, 0], 'north-west': [-0.7071, -0.7071], north: [0, -1], 'north-east': [0.7071, -0.7071] };
const MOTION = {
  BOB_DOWN: 1, BOB_UP: 2,          // body: +1 px on contact, -2 px on passing (3 px of travel)
  HEAD_KEEP: 0.5,                  // the head takes half the bob (counter-bob)
  SHIFT: 1,                        // weight shift toward the planted foot, front/back and diagonal views
  STRIDE: 2, STRIDE_DIAG: 1,       // legs pushed apart on contact: side views 2 px each way, diagonals 1
  SPRING_K: 90, SPRING_C: 5,       // hem/ponytail springs: underdamped (zeta 0.26), so a stop overshoots ~1 px and settles
  HEM_DRAG: 1.0, TAIL_DRAG: 2.0,   // px of trailing at full walking speed
  LAG_HEM: 1.5, LAG_TAIL: 2,       // follow-through lag behind the bob, in walk frames
  LEAN: 1 / 300,                   // px of lean per px/s^2: back on a start (anticipation), forward on a stop (settle)
  BREATH_MS: 3400,                 // idle breath period; chest, arms and head rise 1 px at the top
};
function spring(k = MOTION.SPRING_K, c = MOTION.SPRING_C) { return { x: 0, y: 0, vx: 0, vy: 0, k, c }; }
function stepSpring(s, tx, ty, dt) {
  const t = dt / 1000;
  s.vx += (s.k * (tx - s.x) - s.c * s.vx) * t; s.vy += (s.k * (ty - s.y) - s.c * s.vy) * t;
  s.x += s.vx * t; s.y += s.vy * t;
  s.x = Math.max(-3, Math.min(3, s.x)); s.y = Math.max(-3, Math.min(3, s.y));
}
const rig = { hem: spring(), tail: spring(), lean: spring(260, 20), pvx: 0, pvy: 0, ax: 0, ay: 0, lastHeading: 'south', breath: 0, off: null };
let jab = null;            // { t, dir, fired }
const JAB_MS = [70, 70, 70, 80, 50, 140, 90, 70, 70, 70, 80];   // per base frame; frame 5 is the held extension
const JAB_PUSH = [0, 0, -1, -2, 3, 3, 2, 2, 1, 0, 0];             // px along the heading: pull back, lunge, hold, recover
const shots = [], bursts = [], embers = [], flashes = []; let shake = 0;
function startJab() {
  if (jab || dlg.open) return;
  jab = { t: 0, dir: kaya.heading, fired: false }; kaya.path = []; kaya.look = -1;
}
function jabFrame() { let t = jab.t; for (let i = 0; i < JAB_MS.length; i++) { if (t < JAB_MS[i]) return i; t -= JAB_MS[i]; } return -1; }
function fireShot() {
  const d = jab.dir, [ux, uy] = VEC8[d], [fx, fy] = L.fist[d] || [ux * 14, -22];
  const sx = kaya.x + fx, sy = kaya.y + fy;                       // fist on screen (world px)
  const gy = kaya.y + uy * 6, h = gy - sy;                        // ground point under it, and its height
  bursts.push({ d, x: sx, y: sy, t: 0, g: gy });
  shots.push({ d, ux, uy, x: sx + ux * 4, g: gy + uy * 4, h, dist: 0, t: 0 });
  flashes.push({ x: sx, y: gy, t: 0, life: 220, r: 12 });
  shake = 170;
  rig.hem.vx -= ux * 70; rig.hem.vy -= uy * 30; rig.tail.vx -= ux * 110; rig.tail.vy -= 50;   // the coat and ponytail whip back
}
function updateJab(dt) {
  if (!jab) return;
  jab.t += dt; const f = jabFrame();
  if (f >= L.strike && !jab.fired) { jab.fired = true; fireShot(); }
  if (f < 0) jab = null;
}
function updateFx(dt) {
  for (const s of shots) {
    const st = 300 * dt / 1000; s.x += s.ux * st; s.g += s.uy * st; s.dist += st; s.t += dt; s.h = Math.max(8, s.h - 6 * dt / 1000);
    flashes.push({ x: s.x, y: s.g, t: 0, life: 90, r: 7 });
    const hitD = !s.done && Math.abs(s.x - (dummy.x + dummy.w / 2)) < 12 && Math.abs(s.g - dummy.base) < 12;
    if (hitD) { dummy.hit = 0; dummy.hx = s.ux; dummy.hy = s.uy; }
    if (hitD || s.dist > 112) { s.done = true; embers.push({ x: s.x, y: s.g - s.h, t: 0 }); flashes.push({ x: s.x, y: s.g, t: 0, life: 260, r: 14 }); if (hitD) shake = 120; }
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
  for (const a of [bursts, embers, flashes]) { for (const b of a) b.t += dt; }
  const bl = ASSETS.vfx.burst.east.ms.reduce((a, b) => a + b, 0), el = ASSETS.vfx.embers.ms.reduce((a, b) => a + b, 0);
  while (bursts.length && bursts[0].t > bl) bursts.shift();
  while (embers.length && embers[0].t > el) embers.shift();
  for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].t > flashes[i].life) flashes.splice(i, 1);
  if (dummy.hit >= 0) { dummy.hit += dt; if (dummy.hit > 900) dummy.hit = -1; }
  if (shake > 0) shake -= dt;
}
// the rig: walk phase, bob, weight shift, stride, springs, lean, breath -> integer offsets per part
function updateRig(dt) {
  const s = dt / 1000, sp = Math.hypot(kaya.vx, kaya.vy), spN = Math.min(1, sp / WALK_SPEED);
  const ax = (kaya.vx - rig.pvx) / Math.max(s, 1e-3), ay = (kaya.vy - rig.pvy) / Math.max(s, 1e-3);
  rig.pvx = kaya.vx; rig.pvy = kaya.vy;
  rig.ax += (ax - rig.ax) * Math.min(1, s * 20); rig.ay += (ay - rig.ay) * Math.min(1, s * 20);
  const h = kaya.heading, [hx, hy] = VEC8[h];
  const ph = kaya.dist / CYCLE_PX * 12 - L.phase;                 // walk phase in frames, 0 = contact
  const th = 2 * Math.PI * ph / 6;
  const walking = sp > 6 && !jab;
  // turn: kick the coat and ponytail sideways
  if (h !== rig.lastHeading) {
    const [px] = VEC8[rig.lastHeading]; rig.hem.vx += (px - hx) * 30; rig.tail.vx += (px - hx) * 45; rig.lastHeading = h;
  }
  const swayH = walking ? 0.7 * Math.sin(th - 2 * Math.PI * MOTION.LAG_HEM / 6) * spN : 0;
  const swayT = walking ? 0.9 * Math.cos(th - 2 * Math.PI * MOTION.LAG_TAIL / 6) * spN : 0;
  stepSpring(rig.hem, -kaya.vx / WALK_SPEED * MOTION.HEM_DRAG + swayH * Math.abs(hx), -kaya.vy / WALK_SPEED * 0.5, dt);
  stepSpring(rig.tail, -kaya.vx / WALK_SPEED * MOTION.TAIL_DRAG + swayT * 0.3, -spN * 0.6 + swayT, dt);
  stepSpring(rig.lean, Math.max(-1.4, Math.min(1.4, -rig.ax * MOTION.LEAN)), Math.max(-1.4, Math.min(1.4, -rig.ay * MOTION.LEAN)), dt);
  rig.breath = (clock % MOTION.BREATH_MS) / MOTION.BREATH_MS;
  // assemble
  const o = { legs: [0, 0], back: [0, 0], front: [0, 0], hem: [0, 0], torso: [0, 0], head: [0, 0], tail: [0, 0], split: 0, sideSign: Math.sign(hx) };
  if (walking) {
    const c = Math.cos(th), bob = spN * (c > 0 ? MOTION.BOB_DOWN * c : MOTION.BOB_UP * c);   // + down at contact, - up at passing
    const body = Math.round(bob), head = Math.round(bob * MOTION.HEAD_KEEP);
    o.torso[1] += body; o.hem[1] += body; o.head[1] += head; o.tail[1] += head;
    if (h !== 'east' && h !== 'west') {   // weight shift toward the planted foot (alternates each step)
      const side = Math.sign(Math.sin(Math.PI * ph / 6)) * MOTION.SHIFT * (spN > 0.5 ? 1 : 0);
      o.torso[0] += side; o.head[0] += side; o.hem[0] += side;
    }
    if (h !== 'north' && h !== 'south') { // longer stride on contact where the legs show
      const st = (hx && !hy) ? MOTION.STRIDE : MOTION.STRIDE_DIAG;
      o.split = Math.round(st * spN * Math.max(0, c));
    }
  } else if (!jab) {
    const up = Math.sin(2 * Math.PI * rig.breath) > 0.35 ? -1 : 0;     // breath: chest, arms and head rise together
    o.torso[1] += up; o.head[1] += up; o.tail[1] += up;
  }
  const lx = Math.round(rig.lean.x), ly = Math.round(rig.lean.y);
  o.torso[0] += lx; o.head[0] += lx; o.tail[0] += lx; o.torso[1] += ly; o.head[1] += ly; o.tail[1] += ly;
  if (jab) {
    const f = jabFrame(), p = f >= 0 ? JAB_PUSH[f] : 0, px = Math.round(p * hx), py = Math.round(p * hy * 0.7);
    for (const [k, w] of [['torso', 1], ['head', 1], ['tail', 1], ['hem', 0.67], ['legs', 0.34]]) { o[k][0] += Math.round(px * w); o[k][1] += Math.round(py * w); }
  }
  o.hem[0] += Math.round(rig.hem.x); o.hem[1] += Math.round(Math.max(-1, Math.min(1, rig.hem.y)));
  o.tail[0] += Math.round(rig.tail.x); o.tail[1] += Math.round(Math.max(-2, Math.min(1, rig.tail.y)));
  // keep neighbouring parts within 2 px of each other so the overlap rows always cover the seams
  const clampTo = (a, b) => { a[0] = Math.max(b[0] - 2, Math.min(b[0] + 2, a[0])); a[1] = Math.max(b[1] - 2, Math.min(b[1] + 2, a[1])); };
  clampTo(o.hem, o.legs); clampTo(o.torso, o.hem); clampTo(o.head, o.torso); clampTo(o.tail, o.head);
  rig.off = o;
}
// draw one frame of a clip as parts. Each part is a band of rows of the same frame, drawn bottom-up, and each upper
// band also draws OVER rows below its cut, so a part moved up never opens a transparent gap.
const OVER = 2;
function drawRigged(a, clipName, frame, dir) {
  const clip = ASSETS.chars[a.name][clipName]; let row = clip.dirs.indexOf(dir); if (row < 0) row = 0;
  const img = IMG[`ch:${a.name}:${clipName}`], sx = (frame % clip.frames) * CELL, sy = row * CELL;
  const bx = Math.round(a.x) - AX - cam.rx, by = Math.round(a.y) - AY - cam.ry, o = rig.off;
  const yHead = AY + L.bands.head, yTorso = AY + L.bands.torso, yHem = AY + L.bands.hem;
  const part = (x0, x1, y0, y1, off) => { if (x1 > x0 && y1 > y0) ctx.drawImage(img, sx + x0, sy + y0, x1 - x0, y1 - y0, bx + x0 + off[0], by + y0 + off[1], x1 - x0, y1 - y0); };
  // legs: split at the hip into back and front halves, pushed apart on contact
  if (o.split) {
    const s = o.sideSign || 1, back = [o.legs[0] - s * o.split, o.legs[1]], front = [o.legs[0] + s * o.split, o.legs[1]];
    // the back leg is drawn first and runs OVER px under the front one, so pushing them apart never opens a slit
    if (s > 0) { part(0, AX + OVER, yHem, CELL, back); part(AX, CELL, yHem, CELL, front); } else { part(AX - OVER, CELL, yHem, CELL, back); part(0, AX, yHem, CELL, front); }
  } else part(0, CELL, yHem, CELL, o.legs);
  part(0, CELL, yTorso, yHem + OVER, o.hem);
  part(0, CELL, yHead, yTorso + OVER, o.torso);
  const t = L.tail[dir];
  if (t) {
    // likewise the ponytail runs OVER px under the head
    if (t.side < 0) { part(0, t.x + OVER, 0, yHead + OVER, o.tail); part(t.x, CELL, 0, yHead + OVER, o.head); }
    else { part(t.x - OVER, CELL, 0, yHead + OVER, o.tail); part(0, t.x, 0, yHead + OVER, o.head); }
  } else part(0, CELL, 0, yHead + OVER, o.head);
}
function kayaDraw() {
  const ch = ASSETS.chars.kaya, sp = Math.hypot(kaya.vx, kaya.vy);
  if (jab) { const f = Math.max(0, jabFrame()); return drawRigged(kaya, 'jab', f, jab.dir); }
  if (sp > 6) return drawRigged(kaya, 'walk', Math.floor(kaya.dist / (CYCLE_PX / ch.walk.frames)), kaya.heading);
  if (ch.look && kaya.look < 0 && kaya.idleT > 5200 && ch.look.dirs.includes(kaya.heading) && rnd() < 0.004) kaya.look = 0;
  if (kaya.look >= 0) { const f = Math.floor(kaya.look / 120); if (f < ch.look.frames) return drawRigged(kaya, 'look', f, kaya.heading); kaya.look = -1; kaya.idleT = 0; }
  drawRigged(kaya, 'idle', Math.floor(clock / 130), kaya.heading);
}
function fxFrame(v, t) { let i = 0; while (i < v.n - 1 && t >= v.ms[i]) { t -= v.ms[i]; i++; } return i; }
function drawFx(key, v, x, y, t) { const f = fxFrame(v, t); ctx.drawImage(IMG[key], f * v.w, 0, v.w, v.h, Math.round(x) - v.px - cam.rx, Math.round(y) - v.py - cam.ry, v.w, v.h); }

// ---------- view and camera
const ctx = cv.getContext('2d');
const view = { w: 400, h: 240, zd: 3, zc: 3 }, cam = { x: 0, y: 0, rx: 0, ry: 0, init: false };
let zoomOverride = Q.get('zoom') ? +Q.get('zoom') : 0;
function resize() {
  const dpr = window.devicePixelRatio || 1, cw = innerWidth, ch = innerHeight;
  const zc = zoomOverride || Math.max(2, Math.min(3, Math.floor(Math.min(cw, ch) / 180)));
  const zd = Math.max(1, Math.round(zc * dpr));
  Object.assign(view, { zc, zd, w: Math.min(PW, Math.ceil(cw * dpr / zd)), h: Math.min(PH, Math.ceil(ch * dpr / zd)) });
  cv.width = view.w; cv.height = view.h; cv.style.width = (view.w * zd / dpr) + 'px'; cv.style.height = (view.h * zd / dpr) + 'px';
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);
function updateCamera(dt) {
  // aim a little ahead of her and slightly north of her feet; ease toward it; draw at whole pixels
  const tx = kaya.x + kaya.vx * 0.35 - view.w / 2, ty = kaya.y - 26 + kaya.vy * 0.35 - view.h * 0.64;
  const cx = Math.max(0, Math.min(PW - view.w, tx)), cy = Math.max(0, Math.min(PH - view.h, ty));
  if (!cam.init) { cam.x = cx; cam.y = cy; cam.init = true; }
  const k = 1 - Math.exp(-4.5 * dt / 1000); cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k;
  cam.rx = Math.round(cam.x); cam.ry = Math.round(cam.y);
  if (shake > 0) { const m = shake > 90 ? 2 : 1; cam.rx += Math.round((rnd() * 2 - 1) * m); cam.ry += Math.round((rnd() * 2 - 1) * m); }
}

// ---------- drawing
let clock = 0;
function drawClip(a, clipName, frame, dir) {
  const clip = ASSETS.chars[a.name][clipName]; let row = clip.dirs.indexOf(dir);
  if (row < 0) { // nearest available heading
    const i = DIRS.indexOf(dir); let best = 0, bd = 9;
    clip.dirs.forEach((d, r) => { const k = Math.abs(((DIRS.indexOf(d) - i + 12) % 8) - 4); if (4 - k < bd) { bd = 4 - k; best = r; } }); row = best;
  }
  ctx.drawImage(IMG[`ch:${a.name}:${clipName}`], (frame % clip.frames) * CELL, row * CELL, CELL, CELL, Math.round(a.x) - AX - cam.rx, Math.round(a.y) - AY - cam.ry, CELL, CELL);
}
function shadow(x, y, wd) {
  const sx = Math.round(x) - cam.rx, sy = Math.round(y) - cam.ry;
  ctx.fillStyle = 'rgba(28,23,25,0.26)';
  ctx.fillRect(sx - wd, sy - 2, wd * 2, 3); ctx.fillRect(sx - wd + 3, sy - 3, wd * 2 - 6, 1); ctx.fillRect(sx - wd + 3, sy + 1, wd * 2 - 6, 1);
}
function personDraw(a) {
  const ch = ASSETS.chars[a.name], sp = Math.hypot(a.vx, a.vy);
  if (ch.walk && sp > 6) return drawClip(a, 'walk', Math.floor(a.dist / (a.cycle / ch.walk.frames)), a.heading);
  // occasional look-around after standing a while, facing the camera
  if (ch.look && a.look < 0 && a.idleT > 5200 && ch.look.dirs.includes(a.heading) && rnd() < 0.004) a.look = 0;
  if (a.look >= 0) {
    const f = Math.floor(a.look / 120);
    if (f < ch.look.frames) return drawClip(a, 'look', f, a.heading);
    a.look = -1; a.idleT = 0;
  }
  if (ch.idle) return drawClip(a, 'idle', Math.floor((clock + (a.phase || 0)) / 130), a.heading);
  drawClip(a, 'rot', 0, a.heading);
}
function catDraw() {
  const ch = ASSETS.chars.cat;
  if (Math.hypot(cat.vx, cat.vy) > 3) return drawClip(cat, 'walk', Math.floor(cat.dist / (cat.cycle / ch.walk.frames)), cat.heading);
  if (catSit > 0) { const n = ch.sit.frames, f = Math.floor(catSitT / 120); return drawClip(cat, 'sit', f < n ? f : n - 1 - (Math.floor(catSitT / 700) % 2), 'south-west'); }
  drawClip(cat, 'rot', 0, cat.heading);
}
const GLYPH = { T: ['111', '010', '010', '010', '010'], A: ['010', '101', '111', '101', '101'], L: ['100', '100', '100', '100', '111'], K: ['101', '101', '110', '101', '101'] };
function pixText(s, x, y, col) { ctx.fillStyle = col; [...s].forEach((c, i) => GLYPH[c].forEach((r, j) => [...r].forEach((b, k) => { if (b === '1') ctx.fillRect(x + i * 4 + k, y + j, 1, 1); }))); }
function render() {
  ctx.fillStyle = '#1c1719'; ctx.fillRect(0, 0, view.w, view.h);
  ctx.drawImage(ground, cam.rx, cam.ry, view.w, view.h, 0, 0, view.w, view.h);
  for (const g of glints) {
    const ph = (g.ph % 1800) / 1800; if (ph > 0.5) continue;
    const gx = Math.round(g.x), dim = ph < 0.12 || ph > 0.38, len = dim ? 2 : 3;
    if (gx + len > bridge.x - 1 && gx < bridge.x + bridge.w + 1) continue;
    ctx.fillStyle = dim ? '#4a8f98' : '#86c2bd'; ctx.fillRect(gx - cam.rx, g.y - cam.ry, len, 1);
  }
  if (tapMark) { ctx.fillStyle = `rgba(246,238,214,${tapMark.t / 600})`; const x = Math.round(tapMark.x) - cam.rx, y = Math.round(tapMark.y) - cam.ry; ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 2, 1, 5); }
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flashes) {   // warm light on the ground: two stepped pixel discs, no smoothing
    const k = 1 - f.t / f.life, x = Math.round(f.x) - cam.rx, y = Math.round(f.y) - cam.ry, r = f.r;
    ctx.fillStyle = `rgba(242,180,90,${0.22 * k})`; ctx.fillRect(x - r, y - (r >> 1), 2 * r, r); ctx.fillRect(x - r + 3, y - (r >> 1) - 1, 2 * r - 6, r + 2);
    ctx.fillStyle = `rgba(250,220,140,${0.28 * k})`; ctx.fillRect(x - (r >> 1), y - (r >> 2), r, r >> 1);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const a of [kaya, shop, vill]) shadow(a.x, a.y, 9);
  shadow(cat.x, cat.y, 8);
  const list = OBJ.filter(o => !o.flat).map(o => ({ y: o.base, x: o.x, f: () => {
    if (o === dummy && dummy.hit >= 0) {   // recoil: knocked along the hit, wobbling back, whole pixels
      const t = dummy.hit, k = Math.exp(-t / 220) * Math.cos(t / 55), dx = Math.round(4 * k * (dummy.hx || 1)), dy = Math.round(1.5 * k * (dummy.hy || 0));
      ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx + dx, o.y - cam.ry + dy);
      if (t < 90) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx + dx, o.y - cam.ry + dy); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      return;
    }
    ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx, o.y - cam.ry);
  } }));
  for (const a of [shop, vill]) list.push({ y: a.y, x: a.x, f: () => personDraw(a) });
  list.push({ y: kaya.y, x: kaya.x, f: kayaDraw });
  for (const s of shots) list.push({ y: s.g, x: s.x, f: () => drawFx('fx:ball:' + s.d, ASSETS.vfx.ball[s.d], s.x, s.g - s.h, s.t) });
  list.push({ y: cat.y, x: cat.x, f: catDraw });
  list.sort((a, b) => a.y - b.y || a.x - b.x).forEach(d => d.f());
  for (const b of bursts) drawFx('fx:burst:' + b.d, ASSETS.vfx.burst[b.d], b.x, b.y, b.t);
  for (const e of embers) drawFx('fx:embers', ASSETS.vfx.embers, e.x, e.y, e.t);
  ctx.globalCompositeOperation = 'lighter';
  lamps.forEach((l, i) => {
    const fl = 0.5 + 0.5 * Math.sin(clock / 90 + i * 2.1) * Math.sin(clock / 37 + i);
    const cx = l.x + Math.round(l.w / 2) - cam.rx, cy = l.y + 12 - cam.ry;
    ctx.fillStyle = `rgba(242,212,122,${0.08 + 0.07 * fl})`; ctx.fillRect(cx - 8, cy - 5, 16, 10); ctx.fillRect(cx - 5, cy - 8, 10, 16);
    ctx.fillStyle = `rgba(242,212,122,${0.14 + 0.14 * fl})`; ctx.fillRect(cx - 3, cy - 3, 6, 6);
  });
  ctx.globalCompositeOperation = 'source-over';
  for (const p of smoke) {
    const k = p.age / p.life, s = 2 + Math.floor(k * 4);
    ctx.fillStyle = k < 0.3 ? 'rgba(246,238,214,0.8)' : k < 0.65 ? 'rgba(232,216,176,0.6)' : `rgba(174,168,156,${(1 - k) * 1.4})`;
    ctx.fillRect(Math.round(p.x) - cam.rx, Math.round(p.y) - cam.ry, s, s);
  }
  for (const b of birds) {
    const up = Math.floor(b.t / 160) % 2, x = Math.round(b.x) - cam.rx, y = Math.round(b.y) - cam.ry;
    ctx.fillStyle = 'rgba(28,23,25,0.18)'; ctx.fillRect(x + 8, y + 34, 4, 1);
    ctx.fillStyle = '#1c1719';
    for (const [px, py] of up ? [[0, 0], [1, 1], [2, 1], [3, 2], [4, 1], [5, 1], [6, 0]] : [[0, 3], [1, 2], [2, 1], [3, 2], [4, 1], [5, 2], [6, 3]]) ctx.fillRect(x + px, y + py, 1, 1);
  }
  const near = nearShop() && !dlg.open;
  document.getElementById('act').disabled = !near && !dlg.open;
  if (near) {
    const bx = Math.round(shop.x) - 10 - cam.rx, by = Math.round(shop.y) - 62 - cam.ry + (Math.floor(clock / 400) % 2);
    ctx.fillStyle = '#1c1719'; ctx.fillRect(bx - 1, by - 1, 21, 9); ctx.fillRect(bx + 8, by + 8, 3, 1); ctx.fillRect(bx + 9, by + 9, 1, 1);
    ctx.fillStyle = '#f6eed6'; ctx.fillRect(bx, by, 19, 7); ctx.fillRect(bx + 9, by + 7, 1, 1);
    pixText('TALK', bx + 2, by + 1, '#5e1a20');
  }
}
function update(dt) {
  clock += dt;
  if (kaya.look >= 0) kaya.look += dt;
  updateKaya(dt); updateJab(dt); updateRig(dt); updateFx(dt); updateShop(dt); updateVillager(dt); updateCat(dt); updateAmbient(dt); updateCamera(dt);
  if (dlg.open) { dlg.shown = Math.min(LINES[dlg.i][1].length, dlg.shown + dt * 0.045); renderDialog(); }
  if (tapMark) { tapMark.t -= dt; if (tapMark.t <= 0) tapMark = null; }
}
shop.phase = 700; vill.phase = 300;
Promise.all(loads).then(() => {
  bakeGround(); resize(); updateRig(16); updateCamera(16); render();
  if (REC) {
    window.__adv = ms => { while (ms > 0) { const d = Math.min(1000 / 60, ms); update(d); ms -= d; } render(); };
    window.__g = {
      hold: ks => { held.clear(); ks.forEach(k => held.add(k)); kaya.path = []; }, release: () => held.clear(),
      walkTo, talk: interact, advance: advanceDialog,
      zoom: z => { zoomOverride = z; resize(); cam.init = false; updateCamera(16); render(); },
      look: () => { kaya.look = 0; },
      jab: startJab, busy: () => !!jab || shots.length > 0,
      face: d => { kaya.want = kaya.face = DIRS.indexOf(d) * Math.PI / 4; },
      state: () => ({ x: kaya.x, y: kaya.y, sx: Math.round(kaya.x) - cam.rx, sy: Math.round(kaya.y) - cam.ry, moving: kaya.moving, path: kaya.path.length, dlg: dlg.open, near: nearShop(), heading: kaya.heading }),
    };
    window.__ready = true; return;
  }
  let last = performance.now();
  const loop = now => { update(Math.min(50, now - last)); last = now; render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
