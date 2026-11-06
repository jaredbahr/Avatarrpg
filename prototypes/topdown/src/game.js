'use strict';
// Ba Dan Lane: a top-down visual-direction test. Every sprite and tile is PixelLab output (see README);
// smoke, water glints, lamp glow, birds, shadows and the TALK bubble are drawn here as plain pixels.
const T = 16, MW = 30, MH = 22, PW = MW * T, PH = MH * T;
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const VEC = { south: [0, 1], 'south-east': [1, 1], east: [1, 0], 'north-east': [1, -1], north: [0, -1], 'north-west': [-1, -1], west: [-1, 0], 'south-west': [-1, 1] };
const dirOf = (dx, dy) => DIRS.find(d => VEC[d][0] === Math.sign(dx) && VEC[d][1] === Math.sign(dy)) || 'south';
const REC = /[?&]record=1/.test(location.search);
if (REC) document.body.classList.add('rec');

// seeded rng so a recording is repeatable
let seed = 1234567;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

// ---------- images
const IMG = {};
function load(key, src) { return new Promise(r => { const i = new Image(); i.onload = () => { IMG[key] = i; r(); }; i.src = src; }); }
const loads = [];
for (const [k, s] of Object.entries(ASSETS.tiles)) loads.push(load('tile:' + k, s));
for (const [c, clips] of Object.entries(ASSETS.chars)) for (const [n, v] of Object.entries(clips)) loads.push(load(`ch:${c}:${n}`, v.src));
for (const [k, v] of Object.entries(ASSETS.objects)) loads.push(load('ob:' + k, v.src));

// ---------- terrain on a vertex grid (Wang corners): G grass, C cobble, W water, D dirt
function vt(x, y) {
  if (y === 15 || y === 16) return 'W';
  if ((y >= 6 && y <= 11) || y === 14 || y === 17) return 'C';
  if ((x >= 12 && x <= 14 && y >= 19) || (y >= 20 && y <= 21 && x >= 12)) return 'D';
  return 'G';
}
const SETS = { G: 'gc', C: 'gc', W: 'canal', D: 'dirt' };
function setFor(a) {
  const u = [...new Set(a)];
  if (u.length === 1) return SETS[u[0]];
  const s = u.sort().join('');
  return { CG: 'gc', CW: 'canal', DG: 'dirt' }[s];
}

// ---------- objects: centre x, base y (px). flat ones are baked into the ground layer
const OBJ = [];
const blocked = Array.from({ length: MH }, () => new Array(MW).fill(false));
function put(k, cx, by, o = {}) {
  const a = ASSETS.objects[k]; const x = Math.round(cx - a.w / 2), y = by - a.h;
  OBJ.push({ k, x, y, w: a.w, h: a.h, base: by, flat: !!o.flat });
  for (const [tx, ty, w = 1, h = 1] of o.block || []) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (blocked[ty + j]) blocked[ty + j][tx + i] = true;
  return OBJ[OBJ.length - 1];
}
const rectBlock = (x0, x1, y0, y1) => [[Math.floor(x0 / T), Math.floor(y0 / T), Math.floor((x1 - 1) / T) - Math.floor(x0 / T) + 1, Math.floor((y1 - 1) / T) - Math.floor(y0 / T) + 1]];
// north row of buildings, doors on the lane
put('house_cream', 46, 112, { block: rectBlock(10, 82, 40, 112) });
put('house_green', 128, 112, { block: rectBlock(92, 164, 40, 112) });
put('house_ochre', 210, 112, { block: rectBlock(176, 246, 40, 112) });
put('tree_blossom', 263, 104, { block: [[16, 5]] });
put('teahouse', 330, 112, { block: rectBlock(286, 374, 48, 112) });
put('tree', 428, 92, { block: [[26, 5]] });
put('bush', 466, 100, { block: [[29, 5]] });
put('bush', 252, 112, { block: [[15, 6]] });
// the lane
const lamps = [put('lamp', 87, 118, { block: [[5, 7]] }), put('lamp', 271, 118, { block: [[16, 7]] }), put('lamp', 232, 222, { block: [[14, 13]] })];
put('stall', 330, 176, { block: [[18, 8, 6, 3]] });
put('pots', 279, 174, { block: [[17, 10]] });
put('barrels', 392, 150, { block: [[24, 9]] });
put('crates', 392, 172, { block: [[24, 10]] });
put('well', 448, 172, { block: [[26, 9, 3, 2]] });
// grass strip and canal
put('bench', 56, 206, { block: [[3, 12]] });
put('flowers', 104, 216, { flat: true });
put('flowers', 330, 216, { flat: true });
put('bush', 466, 220, { block: [[29, 13]] });
const bridge = put('bridge', 208, 284, { flat: true });
// south bank, dirt road leaving the map
put('sign', 248, 300, { block: [[15, 18]] });
put('tree', 60, 334, { block: [[3, 20]] });
put('tree_blossom', 424, 316, { block: [[26, 19]] });
put('bush', 150, 330, { block: [[9, 20]] });
for (const [x, y] of [[40, 292], [188, 348], [330, 300], [462, 344], [110, 316], [300, 350]]) put('tuft', x, y, { flat: true });
// water is solid except under the bridge
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
  const c = [vt(x, y), vt(x + 1, y), vt(x, y + 1), vt(x + 1, y + 1)];
  if (c.includes('W') && !(x === 12 || x === 13)) blocked[y][x] = true;
}
const CHIMNEYS = [[67, 30], [229, 30]];

// ---------- ground layer, baked once
const ground = document.createElement('canvas'); ground.width = PW; ground.height = PH;
function bakeGround() {
  const g = ground.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const c = [vt(x, y), vt(x + 1, y), vt(x, y + 1), vt(x + 1, y + 1)];
    const s = setFor(c) || 'gc'; const key = ASSETS.tileKey[s];
    const idx = parseInt(c.map(v => (key['1'] === v ? '1' : '0')).join(''), 2);
    g.drawImage(IMG['tile:' + s], (idx % 4) * T, (idx >> 2) * T, T, T, x * T, y * T, T, T);
  }
  for (const o of OBJ) if (o.flat) g.drawImage(IMG['ob:' + o.k], o.x, o.y);
}

// ---------- walkers
const FOOT = 39;
class Walker {
  constructor(name, tx, ty, speed) {
    Object.assign(this, { name, tx, ty, speed, dir: 'south', path: [], moving: false, dist: 0, t: 0, idleT: 0 });
    this.x = tx * T + 8; this.y = ty * T + 12;
  }
  canStep(nx, ny) {
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || blocked[ny][nx]) return false;
    if (occupied(nx, ny, this)) return false;
    if (nx !== this.tx && ny !== this.ty) {
      if (blocked[this.ty][nx] || blocked[ny][this.tx]) return false;
    }
    return true;
  }
  step(dx, dy) {
    const nx = this.tx + dx, ny = this.ty + dy;
    this.dir = dirOf(dx, dy);
    if (!this.canStep(nx, ny)) return false;
    this.fx = this.x; this.fy = this.y; this.ntx = nx; this.nty = ny; this.moving = true; this.t = 0;
    this.len = Math.hypot(dx, dy) * T; return true;
  }
  update(dt) {
    if (this.moving) {
      this.t += this.speed * dt / 1000; this.dist += this.speed * dt / 1000;
      const k = Math.min(1, this.t / this.len);
      this.x = this.fx + (this.ntx * T + 8 - this.fx) * k; this.y = this.fy + (this.nty * T + 12 - this.fy) * k;
      if (k >= 1) { this.tx = this.ntx; this.ty = this.nty; this.moving = false; this.arrived && this.arrived(); }
      this.idleT = 0;
    } else this.idleT += dt;
  }
}
const kaya = new Walker('kaya', 7, 9, 56);
const shop = new Walker('shopkeeper', 17, 9, 0);
const vill = new Walker('villager', 2, 11, 34);
const cat = new Walker('cat', 19, 18, 22);
const npcs = [shop, vill];
function occupied(x, y, who) {
  for (const w of [kaya, shop, vill]) {
    if (w === who) continue;
    if ((w.tx === x && w.ty === y) || (w.moving && w.ntx === x && w.nty === y)) return true;
  }
  return false;
}

// villager: back and forth along the lane, a pause at each end
const villRoute = [[2, 11], [15, 11]]; let villLeg = 1, villWait = 0;
function updateVillager(dt) {
  vill.update(dt);
  if (vill.moving) return;
  if (villWait > 0) { villWait -= dt; vill.dir = 'south'; return; }
  const [gx, gy] = villRoute[villLeg];
  if (vill.tx === gx && vill.ty === gy) { villLeg = 1 - villLeg; villWait = 1800; return; }
  vill.step(Math.sign(gx - vill.tx), Math.sign(gy - vill.ty));
}
// cat: pads along the south bank, settles down for a while, gets up again
const catRoute = [[18, 18], [25, 18]]; let catLeg = 1, catSit = 0;
function updateCat(dt) {
  cat.update(dt);
  if (cat.moving) return;
  if (catSit > 0) { catSit -= dt; cat.sitT = (cat.sitT || 0) + dt; return; }
  const [gx] = catRoute[catLeg];
  if (cat.tx === gx) { catLeg = 1 - catLeg; catSit = 4200; cat.sitT = 0; return; }
  const dx = Math.sign(gx - cat.tx); cat.dir = dx > 0 ? 'east' : 'west';
  cat.fx = cat.x; cat.fy = cat.y; cat.ntx = cat.tx + dx; cat.nty = cat.ty; cat.moving = true; cat.t = 0; cat.len = T;
}

// ---------- input
const held = new Set(); let pendingTalk = false;
const KEYS = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
addEventListener('keydown', e => {
  if (KEYS[e.code]) { held.add(KEYS[e.code]); kaya.path = []; pendingTalk = false; hideHint(); e.preventDefault(); }
  if (['KeyE', 'Space', 'Enter'].includes(e.code)) { interact(); e.preventDefault(); }
});
addEventListener('keyup', e => { if (KEYS[e.code]) held.delete(KEYS[e.code]); });
addEventListener('blur', () => held.clear());
const padDirs = new Set();
for (const b of document.querySelectorAll('#pad button')) {
  const [dx, dy] = b.dataset.d.split(',').map(Number); const k = dx < 0 ? 'l' : dx > 0 ? 'r' : dy < 0 ? 'u' : 'd';
  const on = e => { e.preventDefault(); padDirs.add(k); b.classList.add('on'); kaya.path = []; pendingTalk = false; hideHint(); };
  const off = e => { e.preventDefault(); padDirs.delete(k); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
}
document.getElementById('act').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });

function inputDir() {
  const s = new Set([...held, ...padDirs]);
  return [(s.has('r') ? 1 : 0) - (s.has('l') ? 1 : 0), (s.has('d') ? 1 : 0) - (s.has('u') ? 1 : 0)];
}
function bfs(sx, sy, goal) {
  const prev = new Map(), q = [[sx, sy]], key = (x, y) => y * MW + x; prev.set(key(sx, sy), null);
  while (q.length) {
    const [x, y] = q.shift();
    if (goal(x, y)) { const p = []; let k = key(x, y); while (k !== key(sx, sy)) { p.unshift([k % MW, (k / MW) | 0]); k = prev.get(k); } return p; }
    for (const d of DIRS) {
      const [dx, dy] = VEC[d], nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || blocked[ny][nx] || prev.has(key(nx, ny))) continue;
      if (dx && dy && (blocked[y][nx] || blocked[ny][x])) continue;
      if ((nx === shop.tx && ny === shop.ty)) continue;
      prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]);
    }
  }
  return null;
}
function walkTo(tx, ty) {
  let goal = (x, y) => x === tx && y === ty;
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH || blocked[ty][tx] || (tx === shop.tx && ty === shop.ty)) {
    // nearest walkable tile to the one asked for
    let best = null, bd = 1e9;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (blocked[y][x] || (x === shop.tx && y === shop.ty)) continue;
      const d = Math.hypot(x - tx, y - ty); if (d < bd) { bd = d; best = [x, y]; }
    }
    goal = (x, y) => x === best[0] && y === best[1];
  }
  const p = bfs(kaya.tx, kaya.ty, goal); if (p) kaya.path = p;
  return !!p;
}
function nearShop() { return Math.max(Math.abs(kaya.tx - shop.tx), Math.abs(kaya.ty - shop.ty)) <= 1 && !kaya.moving; }
function interact() {
  if (dlg.open) return advanceDialog();
  if (nearShop()) openDialog();
}
const cv = document.getElementById('c');
cv.addEventListener('pointerdown', e => {
  if (dlg.open) { advanceDialog(); return; }
  hideHint();
  const r = cv.getBoundingClientRect();
  const wx = (e.clientX - r.left) / r.width * view.w + cam.x, wy = (e.clientY - r.top) / r.height * view.h + cam.y;
  const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
  // a tap on the shopkeeper (her tile or her head above it) talks, walking over first if needed
  if (tx === shop.tx && (ty === shop.ty || ty === shop.ty - 1)) {
    if (nearShop()) { openDialog(); return; }
    const p = bfs(kaya.tx, kaya.ty, (x, y) => Math.max(Math.abs(x - shop.tx), Math.abs(y - shop.ty)) <= 1);
    if (p) { kaya.path = p; pendingTalk = true; }
    return;
  }
  pendingTalk = false; walkTo(tx, ty); tapMark = { x: tx, y: ty, t: 600 };
});
let tapMark = null;

function updateKaya(dt) {
  kaya.update(dt);
  if (kaya.moving || dlg.open) return;
  const [dx, dy] = inputDir();
  if (dx || dy) {
    if (!kaya.step(dx, dy)) { if (dx && dy) { if (!kaya.step(dx, 0)) kaya.step(0, dy); kaya.dir = dirOf(dx, dy); } }
    if (!kaya.moving) kaya.dir = dirOf(dx, dy);
    return;
  }
  if (kaya.path.length) {
    const [nx, ny] = kaya.path[0];
    if (kaya.step(nx - kaya.tx, ny - kaya.ty)) kaya.path.shift();
    else if (blocked[ny][nx]) kaya.path = [];
    return;
  }
  if (pendingTalk && nearShop()) { pendingTalk = false; openDialog(); }
}

// ---------- dialogue (original lines)
const LINES = [
  ['Old Hesa', 'Mind the canal steps, Kaya. The moss is slick after the rain.'],
  ['Old Hesa', 'Here, take a sun-pear for the road. A fire burns brighter on a full belly.'],
];
const dlg = { open: false, i: 0, shown: 0 };
const dlgEl = document.getElementById('dlg'), dlgName = document.getElementById('dlgName'), dlgText = document.getElementById('dlgText');
function faceEachOther() {
  kaya.dir = dirOf(shop.tx - kaya.tx, shop.ty - kaya.ty); shop.dir = dirOf(kaya.tx - shop.tx, kaya.ty - shop.ty);
}
function openDialog() { faceEachOther(); dlg.open = true; dlg.i = 0; dlg.shown = 0; dlgEl.style.display = 'block'; held.clear(); renderDialog(); }
function advanceDialog() {
  const full = LINES[dlg.i][1].length;
  if (dlg.shown < full) { dlg.shown = full; renderDialog(); return; }
  dlg.i++; dlg.shown = 0;
  if (dlg.i >= LINES.length) { dlg.open = false; dlgEl.style.display = 'none'; shop.dir = 'south'; return; }
  renderDialog();
}
function renderDialog() { dlgName.textContent = LINES[dlg.i][0]; dlgText.textContent = LINES[dlg.i][1].slice(0, Math.floor(dlg.shown)); }
let hintGone = false;
function hideHint() { if (!hintGone) { hintGone = true; document.getElementById('hint').style.opacity = 0; } }

// ---------- ambient life
const smoke = []; let smokeT = 0;
const glints = Array.from({ length: 34 }, () => ({ x: rnd() * PW, y: 238 + Math.floor(rnd() * 26), ph: rnd() * 2000, sp: 2 + rnd() * 4 }));
const birds = []; let birdT = 2500;
function updateAmbient(dt) {
  smokeT -= dt;
  if (smokeT <= 0) { smokeT = 260; for (const [x, y] of CHIMNEYS) smoke.push({ x: x + rnd() * 2 - 2, y: y - 1, age: 0, life: 3200 + rnd() * 1200, vx: 1.5 + rnd() * 2.5, vy: -4 - rnd() * 2 }); }
  for (const p of smoke) { p.age += dt; p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vx += 1.2 * dt / 1000; }
  while (smoke.length && smoke[0].age > smoke[0].life) smoke.shift();
  for (const g of glints) { g.ph += dt; g.x += g.sp * dt / 1000; if (g.x > PW) g.x -= PW; }
  birdT -= dt;
  if (birdT <= 0) {
    birdT = 9000 + rnd() * 5000; const y0 = 20 + rnd() * 200;
    birds.push({ x: -10, y: y0, vx: 38, vy: 9, t: 0 }, { x: -24, y: y0 + 10, vx: 38, vy: 9, t: 180 });
  }
  for (const b of birds) { b.t += dt; b.x += b.vx * dt / 1000; b.y += b.vy * dt / 1000; }
  while (birds.length && birds[0].x > PW + 40) birds.shift();
}

// ---------- drawing
const ctx = cv.getContext('2d');
const view = { w: 320, h: 180, zd: 4 }, cam = { x: 0, y: 0, ox: 0, oy: 0 };
function resize() {
  const dpr = window.devicePixelRatio || 1, cw = innerWidth, ch = innerHeight;
  const zc = Math.max(2, Math.min(4, Math.floor(Math.min(cw, ch) / 128)));
  const zd = Math.max(1, Math.round(zc * dpr));
  view.zd = zd; view.w = Math.min(PW, Math.ceil(cw * dpr / zd)); view.h = Math.min(PH, Math.ceil(ch * dpr / zd));
  cv.width = view.w; cv.height = view.h;
  cv.style.width = (view.w * zd / dpr) + 'px'; cv.style.height = (view.h * zd / dpr) + 'px';
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);

function drawChar(w, clipName, frame, dirName) {
  const ch = ASSETS.chars[w.name], clip = ch[clipName]; let row = clip.dirs.indexOf(dirName);
  if (row < 0) row = 0;
  const img = IMG[`ch:${w.name}:${clipName}`];
  ctx.drawImage(img, (frame % clip.frames) * 48, row * 48, 48, 48, Math.round(w.x) - 24 - cam.x, Math.round(w.y) - clip.foot - cam.y, 48, 48);
}
function shadow(x, y, wd) {
  ctx.fillStyle = 'rgba(28,23,25,0.28)';
  const sx = Math.round(x) - cam.x, sy = Math.round(y) - cam.y;
  ctx.fillRect(sx - wd, sy - 1, wd * 2, 2); ctx.fillRect(sx - wd + 2, sy - 2, wd * 2 - 4, 1); ctx.fillRect(sx - wd + 2, sy + 1, wd * 2 - 4, 1);
}
let clock = 0;
function humanDraw(w) {
  const ch = ASSETS.chars[w.name];
  if (w.moving && ch.walk) return drawChar(w, 'walk', Math.floor(w.dist / 4), w.dir);
  if (ch.idle) return drawChar(w, 'idle', Math.floor(clock / 260), w.dir);
  drawChar(w, 'rot', 0, w.dir);
}
function catDraw() {
  if (cat.moving) return drawChar(cat, 'walk', Math.floor(cat.dist / 2.5), cat.dir);
  if (cat.sitT !== undefined && catSit > 0) {
    const n = ASSETS.chars.cat.sit.frames; const f = Math.floor(cat.sitT / 140);
    return drawChar(cat, 'sit', f < n ? f : n - 1 - (Math.floor(cat.sitT / 600) % 2), 'south-west');
  }
  drawChar(cat, 'rot', 0, cat.dir);
}
const GLYPH = { T: ['111', '010', '010', '010', '010'], A: ['010', '101', '111', '101', '101'], L: ['100', '100', '100', '100', '111'], K: ['101', '101', '110', '101', '101'] };
function pixText(s, x, y, col) {
  ctx.fillStyle = col;
  [...s].forEach((c, i) => GLYPH[c].forEach((r, j) => [...r].forEach((b, k) => { if (b === '1') ctx.fillRect(x + i * 4 + k, y + j, 1, 1); })));
}
function render() {
  ctx.fillStyle = '#1c1719'; ctx.fillRect(0, 0, view.w, view.h);
  cam.x = Math.round(Math.max(0, Math.min(PW - view.w, kaya.x - view.w / 2)));
  cam.y = Math.round(Math.max(0, Math.min(PH - view.h, kaya.y - 12 - view.h * 0.6)));
  ctx.drawImage(ground, cam.x, cam.y, view.w, view.h, 0, 0, view.w, view.h);
  // canal glints, off the bridge deck
  for (const g of glints) {
    const ph = (g.ph % 1800) / 1800; if (ph > 0.5) continue;
    const gx = Math.round(g.x), len = ph < 0.12 || ph > 0.38 ? 1 : 2;
    if (gx + len > bridge.x - 1 && gx < bridge.x + bridge.w + 1) continue;
    ctx.fillStyle = ph < 0.12 || ph > 0.38 ? '#4a8f98' : '#86c2bd'; ctx.fillRect(gx - cam.x, g.y - cam.y, len + 1, 1);
  }
  if (tapMark) { ctx.strokeStyle = 'rgba(246,238,214,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(tapMark.x * T + 0.5 - cam.x, tapMark.y * T + 0.5 - cam.y, T - 1, T - 1); }
  for (const w of [kaya, shop, vill]) shadow(w.x, w.y, 6);
  shadow(cat.x, cat.y, 5);
  const list = OBJ.filter(o => !o.flat).map(o => ({ y: o.base, x: o.x, f: () => ctx.drawImage(IMG['ob:' + o.k], o.x - cam.x, o.y - cam.y) }));
  for (const w of [kaya, shop, vill]) list.push({ y: w.y, x: w.x, f: () => humanDraw(w) });
  list.push({ y: cat.y, x: cat.x, f: catDraw });
  list.sort((a, b) => a.y - b.y || a.x - b.x).forEach(d => d.f());
  // lamp glow: a two-ring pixel halo that flickers
  ctx.globalCompositeOperation = 'lighter';
  lamps.forEach((l, i) => {
    const fl = 0.5 + 0.5 * Math.sin(clock / 90 + i * 2.1) * Math.sin(clock / 37 + i);
    const cx = l.x + 5 - cam.x, cy = l.y + 9 - cam.y;
    ctx.fillStyle = `rgba(242,212,122,${0.10 + 0.08 * fl})`;
    ctx.fillRect(cx - 5, cy - 3, 10, 6); ctx.fillRect(cx - 3, cy - 5, 6, 10);
    ctx.fillStyle = `rgba(242,212,122,${0.16 + 0.14 * fl})`; ctx.fillRect(cx - 2, cy - 2, 4, 4);
  });
  ctx.globalCompositeOperation = 'source-over';
  for (const p of smoke) {
    const k = p.age / p.life, s = 2 + Math.floor(k * 3);
    ctx.fillStyle = k < 0.3 ? 'rgba(246,238,214,0.8)' : k < 0.65 ? 'rgba(232,216,176,0.6)' : `rgba(174,168,156,${(1 - k) * 1.4})`;
    ctx.fillRect(Math.round(p.x) - cam.x, Math.round(p.y) - cam.y, s, s);
  }
  for (const b of birds) {
    const up = Math.floor(b.t / 160) % 2, x = Math.round(b.x) - cam.x, y = Math.round(b.y) - cam.y;
    ctx.fillStyle = 'rgba(28,23,25,0.18)'; ctx.fillRect(x + 6, y + 26, 3, 1);
    ctx.fillStyle = '#1c1719';
    for (const [px, py] of up ? [[0, 0], [1, 1], [2, 1], [3, 1], [4, 0]] : [[0, 2], [1, 1], [2, 1], [3, 1], [4, 2]]) ctx.fillRect(x + px, y + py, 1, 1);
  }
  // TALK prompt
  const near = nearShop() && !dlg.open;
  document.getElementById('act').disabled = !near && !dlg.open;
  if (near) {
    const bx = Math.round(shop.x) - 10 - cam.x, by = Math.round(shop.y) - 46 - cam.y + (Math.floor(clock / 400) % 2);
    ctx.fillStyle = '#1c1719'; ctx.fillRect(bx - 1, by - 1, 21, 9); ctx.fillRect(bx + 8, by + 8, 3, 1); ctx.fillRect(bx + 9, by + 9, 1, 1);
    ctx.fillStyle = '#f6eed6'; ctx.fillRect(bx, by, 19, 7);
    ctx.fillStyle = '#f6eed6'; ctx.fillRect(bx + 9, by + 7, 1, 1);
    pixText('TALK', bx + 2, by + 1, '#5e1a20');
  }
}
function update(dt) {
  clock += dt;
  updateKaya(dt); updateVillager(dt); updateCat(dt); updateAmbient(dt);
  if (dlg.open) { dlg.shown = Math.min(LINES[dlg.i][1].length, dlg.shown + dt * 0.045); renderDialog(); }
  if (tapMark) { tapMark.t -= dt; if (tapMark.t <= 0) tapMark = null; }
}
// ---------- boot
Promise.all(loads).then(() => {
  bakeGround(); resize(); render();
  if (REC) {
    window.__adv = ms => { while (ms > 0) { const d = Math.min(1000 / 60, ms); update(d); ms -= d; } render(); };
    window.__g = {
      hold: ks => { held.clear(); ks.forEach(k => held.add(k)); }, release: () => held.clear(),
      walkTo, talk: interact, advance: advanceDialog,
      state: () => ({ tx: kaya.tx, ty: kaya.ty, moving: kaya.moving, path: kaya.path.length, dlg: dlg.open, near: nearShop() }),
    };
    window.__ready = true;
    return;
  }
  let last = performance.now();
  const loop = now => { update(Math.min(50, now - last)); last = now; render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
