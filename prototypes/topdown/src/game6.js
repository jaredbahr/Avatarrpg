'use strict';
// Ba Dan Lane v6: v2 Kaya (unchanged base and coat) with a relaxed walk take, the v4 bends, v2's pace; no motion layer.
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
const WALK_SPEED = 66;            // px/s, v2's pace (v5 walks the v2 way)
const CYCLE_PX = 30;              // v2's cadence: ground per 12-frame cycle
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
for (const [k, v] of Object.entries(ASSETS.moves.vfx)) { if (v.src) loads.push(load('fx:' + k, v.src)); else for (const [d, w] of Object.entries(v)) loads.push(load(`fx:${k}:${d}`, w.src)); }

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
const dummy = Q.get('nodummy') === '1' ? put('dummy', 812, 560, { foot: [16, 10] }) : put('dummy', 452, 246, { foot: [16, 10] }); dummy.hit = -1;   // ?nodummy=1 moves it aside (used by the walk comparison)
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
  const mk = { KeyJ: 'jab', KeyK: 'whip', KeyL: 'stomp' }[e.code];
  if (mk && !e.repeat) { if (dlg.open) advanceDialog(); else startMove(mk); e.preventDefault(); }
  if (e.code === 'Space' && !e.repeat) { if (dlg.open) advanceDialog(); else startMove(lastMove); e.preventDefault(); }
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
for (const b of document.querySelectorAll('[data-move]')) b.addEventListener('pointerdown', e => { e.preventDefault(); hideHint(); startMove(b.dataset.move); });
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
  if (dlg.open || move) { kaya.drive(0, 0, dt); return; }
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

// ---------- bending moves (v4). The body is PixelLab's posed frames drawn as-is; the code only adds the fire,
// a whole-pixel screen shake, a ground flash and the dummy's reaction.
const MV = ASSETS.moves;
const VEC8 = { east: [1, 0], 'south-east': [0.7071, 0.7071], south: [0, 1], 'south-west': [-0.7071, 0.7071], west: [-1, 0], 'north-west': [-0.7071, -0.7071], north: [0, -1], 'north-east': [0.7071, -0.7071] };
const MOVES = {
  jab:   { label: 'Fire Jab',    clip: 'jab',   ms: [70, 70, 70, 80, 50, 140, 90, 70, 70, 70, 80] },
  whip:  { label: 'Flame Whip',  clip: 'whip',  ms: null },
  stomp: { label: 'Fire Stomp',  clip: 'stomp', ms: null },
};
for (const k of ['whip', 'stomp']) {   // 70 ms a frame, the strike frame held twice as long
  const n = ASSETS.chars.kaya[k].frames; MOVES[k].ms = Array.from({ length: n }, (_, i) => (i === MV[k].strike ? 150 : 70));
}
for (const k in MOVES) MOVES[k].strike = MV[k].strike;
let move = null;            // { k, t, dir, fired }
const shots = [], bursts = [], embers = [], flashes = [], arcs = [], rings = []; let shake = 0, shakeAmp = 2;
let lastMove = 'jab';
function startMove(k) {
  if (move || dlg.open) return;
  lastMove = k; move = { k, t: 0, dir: kaya.heading, fired: false }; kaya.path = []; kaya.look = -1;
  const lab = document.getElementById('moveName'); if (lab) { lab.textContent = MOVES[k].label; lab.classList.remove('show'); void lab.offsetWidth; lab.classList.add('show'); }
}
function moveFrame() { let t = move.t; const ms = MOVES[move.k].ms; for (let i = 0; i < ms.length; i++) { if (t < ms[i]) return i; t -= ms[i]; } return -1; }
function hitDummy(ux, uy) { dummy.hit = 0; dummy.hx = ux; dummy.hy = uy; }
function dummyVec() { const dx = dummy.x + dummy.w / 2 - kaya.x, dy = dummy.base - kaya.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d, d]; }
function strike() {
  const d = move.dir, [ux, uy] = VEC8[d];
  if (move.k === 'jab') {
    const [fx, fy] = MV.jab.fist[d] || [ux * 14, -22];
    const sx = kaya.x + fx, sy = kaya.y + fy, gy = kaya.y + uy * 6;
    bursts.push({ d, x: sx, y: sy, t: 0 });
    shots.push({ d, ux, uy, x: sx + ux * 4, g: gy + uy * 4, h: gy - sy, dist: 0, t: 0 });
    flashes.push({ x: sx, y: gy, t: 0, life: 220, r: 12 }); shake = 150; shakeAmp = 1;
  }
  if (move.k === 'whip') {   // a crescent swept across the tiles in front of her
    const cx = kaya.x + ux * 12, cy = kaya.y - 22 + uy * 12;
    arcs.push({ d, x: cx, y: cy, t: 0, sort: kaya.y + (uy < 0 ? -6 : 6) });
    for (let i = -1; i <= 1; i++) flashes.push({ x: kaya.x + ux * 36 - uy * 22 * i, y: kaya.y + uy * 30 + ux * 10 * i, t: -60 * (i + 1), life: 260, r: 12 });
    shake = 140; shakeAmp = 1;
    const [vx, vy, dist] = dummyVec();
    if (dist < 110 && vx * ux + vy * uy > 0.45) { dummy.delay = 120; dummy.pendingHit = [ux, uy]; }
  }
  if (move.k === 'stomp') {   // a ring of flame racing out along the ground around her
    rings.push({ x: kaya.x, y: kaya.y, t: 0 });
    flashes.push({ x: kaya.x, y: kaya.y, t: 0, life: 360, r: 26 });
    shake = 260; shakeAmp = 2;
    const [vx, vy, dist] = dummyVec();
    if (dist < 96) { dummy.delay = Math.round(dist * 2.4); dummy.pendingHit = [vx, vy]; }
  }
}
function updateMove(dt) {
  if (!move) return;
  move.t += dt; const f = moveFrame();
  if (f >= MOVES[move.k].strike && !move.fired) { move.fired = true; strike(); }
  if (f < 0) move = null;
}
function updateFx(dt) {
  for (const s of shots) {
    const st = 300 * dt / 1000; s.x += s.ux * st; s.g += s.uy * st; s.dist += st; s.t += dt; s.h = Math.max(8, s.h - 6 * dt / 1000);
    flashes.push({ x: s.x, y: s.g, t: 0, life: 90, r: 7 });
    const hitD = !s.done && Math.abs(s.x - (dummy.x + dummy.w / 2)) < 12 && Math.abs(s.g - dummy.base) < 12;
    if (hitD) hitDummy(s.ux, s.uy);
    if (hitD || s.dist > 112) { s.done = true; embers.push({ x: s.x, y: s.g - s.h, t: 0 }); flashes.push({ x: s.x, y: s.g, t: 0, life: 260, r: 14 }); if (hitD) { shake = 120; shakeAmp = 1; } }
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
  for (const a of [bursts, embers, flashes, arcs, rings]) for (const b of a) b.t += dt;
  const len = v => v.ms.reduce((a, b) => a + b, 0);
  const drop = (a, l) => { while (a.length && a[0].t > l) a.shift(); };
  drop(bursts, len(MV.vfx.burst.east)); drop(embers, len(MV.vfx.embers)); drop(arcs, len(MV.vfx.whip.east)); drop(rings, len(MV.vfx.ring));
  for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].t > flashes[i].life) flashes.splice(i, 1);
  if (dummy.pendingHit) { dummy.delay -= dt; if (dummy.delay <= 0) { hitDummy(...dummy.pendingHit); dummy.pendingHit = null; } }
  if (dummy.hit >= 0) { dummy.hit += dt; if (dummy.hit > 900) dummy.hit = -1; }
  if (shake > 0) shake -= dt;
}
function fxFrame(v, t) { let i = 0; while (i < v.n - 1 && t >= v.ms[i]) { t -= v.ms[i]; i++; } return i; }
function drawFx(key, v, x, y, t) { if (t < 0) return; const f = fxFrame(v, t); ctx.drawImage(IMG[key], f * v.w, 0, v.w, v.h, Math.round(x) - v.px - cam.rx, Math.round(y) - v.py - cam.ry, v.w, v.h); }

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
  if (shake > 0) { cam.rx += Math.round((rnd() * 2 - 1) * shakeAmp); cam.ry += Math.round((rnd() * 2 - 1) * shakeAmp); }
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
  if (a === kaya && move) return drawClip(a, MOVES[move.k].clip, Math.max(0, moveFrame()), move.dir);
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
  for (const r of rings) drawFx('fx:ring', MV.vfx.ring, r.x, r.y, r.t);   // on the ground, under everyone
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flashes) {
    if (f.t < 0) continue;
    const k = 1 - f.t / f.life, x = Math.round(f.x) - cam.rx, y = Math.round(f.y) - cam.ry, r = f.r;
    ctx.fillStyle = `rgba(242,180,90,${0.22 * k})`; ctx.fillRect(x - r, y - (r >> 1), 2 * r, r); ctx.fillRect(x - r + 3, y - (r >> 1) - 1, 2 * r - 6, r + 2);
    ctx.fillStyle = `rgba(250,220,140,${0.28 * k})`; ctx.fillRect(x - (r >> 1), y - (r >> 2), r, r >> 1);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const a of [kaya, shop, vill]) shadow(a.x, a.y, 9);
  shadow(cat.x, cat.y, 8);
  const list = OBJ.filter(o => !o.flat).map(o => ({ y: o.base, x: o.x, f: () => {
    if (o === dummy && dummy.hit >= 0) {   // recoil along the hit, wobbling back; a white flash for the first frames
      const t = dummy.hit, k = Math.exp(-t / 220) * Math.cos(t / 55), dx = Math.round(4 * k * (dummy.hx || 1)), dy = Math.round(1.5 * k * (dummy.hy || 0));
      ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx + dx, o.y - cam.ry + dy);
      if (t < 90) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx + dx, o.y - cam.ry + dy); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      return;
    }
    ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx, o.y - cam.ry);
  } }));
  for (const s of shots) list.push({ y: s.g, x: s.x, f: () => drawFx('fx:ball:' + s.d, MV.vfx.ball[s.d], s.x, s.g - s.h, s.t) });
  for (const a of arcs) list.push({ y: a.sort, x: a.x, f: () => drawFx('fx:whip:' + a.d, MV.vfx.whip[a.d], a.x, a.y, a.t) });
  for (const a of [kaya, shop, vill]) list.push({ y: a.y, x: a.x, f: () => personDraw(a) });
  list.push({ y: cat.y, x: cat.x, f: catDraw });
  list.sort((a, b) => a.y - b.y || a.x - b.x).forEach(d => d.f());
  for (const b of bursts) drawFx('fx:burst:' + b.d, MV.vfx.burst[b.d], b.x, b.y, b.t);
  for (const e of embers) drawFx('fx:embers', MV.vfx.embers, e.x, e.y, e.t);
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
  updateKaya(dt); updateMove(dt); updateFx(dt); updateShop(dt); updateVillager(dt); updateCat(dt); updateAmbient(dt); updateCamera(dt);
  if (dlg.open) { dlg.shown = Math.min(LINES[dlg.i][1].length, dlg.shown + dt * 0.045); renderDialog(); }
  if (tapMark) { tapMark.t -= dt; if (tapMark.t <= 0) tapMark = null; }
}
shop.phase = 700; vill.phase = 300;
Promise.all(loads).then(() => {
  bakeGround(); resize(); updateCamera(16); render();
  if (REC) {
    window.__adv = ms => { while (ms > 0) { const d = Math.min(1000 / 60, ms); update(d); ms -= d; } render(); };
    window.__g = {
      hold: ks => { held.clear(); ks.forEach(k => held.add(k)); kaya.path = []; }, release: () => held.clear(),
      walkTo, talk: interact, advance: advanceDialog,
      zoom: z => { zoomOverride = z; resize(); cam.init = false; updateCamera(16); render(); },
      look: () => { kaya.look = 0; },
      move: startMove, busy: () => !!move || shots.length > 0,
      face: d => { kaya.want = kaya.face = DIRS.indexOf(d) * Math.PI / 4; },
      state: () => ({ x: kaya.x, y: kaya.y, sx: Math.round(kaya.x) - cam.rx, sy: Math.round(kaya.y) - cam.ry, moving: kaya.moving, path: kaya.path.length, dlg: dlg.open, near: nearShop(), heading: kaya.heading }),
    };
    window.__ready = true; return;
  }
  let last = performance.now();
  const loop = now => { update(Math.min(50, now - last)); last = now; render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
