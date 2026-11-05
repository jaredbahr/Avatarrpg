// a free spot beside a resident to talk from: east, west or north of them, nearest to Kaya first
function besideSpot(p) {
  const c = [[p.x + 30, p.y + 2], [p.x - 30, p.y + 2], [p.x, p.y - 26], [p.x + 26, p.y - 18], [p.x - 26, p.y - 18]].filter(([x, y]) => !solidAt(x, y, FOOT_W + 2, FOOT_H + 2) && navFree(Math.floor(x / NG), Math.floor(y / NG)));   // a spot the path grid can reach, not one wedged against a table
  c.sort((a, b) => Math.hypot(a[0] - kaya.x, a[1] - kaya.y) - Math.hypot(b[0] - kaya.x, b[1] - kaya.y));
  return c[0] || [p.x + 30, p.y + 4];
}
// ---------- talk: the nearest resident Kaya is standing beside
let nearP = null;
function findNear() {
  if (kaya.moving || move) return null;
  let best = null, bd = 48;
  for (const p of talkable) { const d = Math.hypot(kaya.x - p.x, (kaya.y - p.y) * 1.3); if (d < bd) { bd = d; best = p; } }
  return best;
}
function interact() { if (dlg.open) return advanceDialog(); const p = findNear(); if (p) openDialog(p); }
const cv = document.getElementById('c');
cv.addEventListener('pointerdown', e => {
  if (dlg.open) { advanceDialog(); return; }
  hideHint();
  const r = cv.getBoundingClientRect();
  const wx = (e.clientX - r.left) / r.width * view.w + cam.rx, wy = (e.clientY - r.top) / r.height * view.h + cam.ry;
  const hit = talkable.find(p => Math.abs(wx - p.x) < 14 && wy > p.y - 50 && wy < p.y + 6);
  if (hit) {
    if (findNear() === hit) { openDialog(hit); return; }
    const [bx, by] = besideSpot(hit); walkTo(bx, by); pendingTalk = hit; return;
  }
  pendingTalk = null; walkTo(wx, wy); tapMark = { x: wx, y: wy, t: 500 };
});
function updateKaya(dt) {
  if (dlg.open || move) { kaya.drive(0, 0, dt); return; }
  const [ix, iy] = inputDir();
  if (ix || iy) kaya.drive(ix, iy, dt); else kaya.follow(dt);
  if (pendingTalk && !kaya.path.length && findNear() === pendingTalk) { const p = pendingTalk; pendingTalk = null; openDialog(p); }
}

// ---------- dialogue
const dlg = { open: false, i: 0, shown: 0, who: null };
const dlgEl = document.getElementById('dlg'), dlgName = document.getElementById('dlgName'), dlgText = document.getElementById('dlgText');
function openDialog(p) {
  dlg.who = p; p.talking = true; kaya.want = Math.atan2(p.y - kaya.y, p.x - kaya.x);
  dlg.open = true; dlg.i = 0; dlg.shown = 0; dlgEl.style.display = 'block'; held.clear(); renderDialog();
}
function advanceDialog() {
  const L = dlg.who.def.lines, full = L[dlg.i].length;
  if (dlg.shown < full) { dlg.shown = full; renderDialog(); return; }
  dlg.i++; dlg.shown = 0;
  if (dlg.i >= L.length) { dlg.open = false; dlg.who.talking = false; dlg.who = null; dlgEl.style.display = 'none'; return; }
  renderDialog();
}
function renderDialog() { dlgName.textContent = dlg.who.def.name; dlgText.textContent = dlg.who.def.lines[dlg.i].slice(0, Math.floor(dlg.shown)); }
let hintGone = false;
function hideHint() { if (!hintGone) { hintGone = true; document.getElementById('hint').style.opacity = 0; } }

// ---------- ambient life: chimney smoke, canal glints, birds, falling blossom, two butterflies over the garden
const smoke = []; let smokeT = 0;
const glints = Array.from({ length: 60 }, () => ({ x: 160 + rnd() * 480, y: CANAL_TOP + 12 + Math.floor(rnd() * 36), ph: rnd() * 2000, sp: 3 + rnd() * 5 }));
const birds = []; let birdT = 2500;
const petals = []; let petalT = 0;
const flies = [0, 1].map(i => ({ x: 248 + i * 30, y: 680, t: i * 900, col: i ? '#f2d47a' : '#f6eed6' }));
function updateAmbient(dt) {
  smokeT -= dt;
  if (smokeT <= 0) { smokeT = 240; for (const [x, y] of CHIMNEYS) smoke.push({ x: x + rnd() * 3 - 2, y: y - 1, age: 0, life: 3600 + rnd() * 1400, vx: 2 + rnd() * 3, vy: -6 - rnd() * 3 }); }
  for (const p of smoke) { p.age += dt; p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vx += 1.4 * dt / 1000; }
  while (smoke.length && smoke[0].age > smoke[0].life) smoke.shift();
  for (const g of glints) { g.ph += dt; g.x += g.sp * dt / 1000; if (g.x > 636) g.x -= 476; }
  birdT -= dt;
  if (birdT <= 0) { birdT = 9000 + rnd() * 5000; const y0 = 30 + rnd() * 400; birds.push({ x: -10, y: y0, vx: 46, vy: 10, t: 0 }, { x: -26, y: y0 + 12, vx: 46, vy: 10, t: 180 }); }
  for (const b of birds) { b.t += dt; b.x += b.vx * dt / 1000; b.y += b.vy * dt / 1000; }
  while (birds.length && birds[0].x > PW + 40) birds.shift();
  petalT -= dt;
  if (petalT <= 0) { petalT = 420; const t = BLOSSOMS[Math.floor(rnd() * BLOSSOMS.length)]; petals.push({ x: t.x + 8 + rnd() * (t.w - 16), y: t.y + 10 + rnd() * 30, age: 0, life: 2600 + rnd() * 1200, ph: rnd() * 6 }); }
  for (const p of petals) { p.age += dt; p.y += 9 * dt / 1000; p.x += Math.sin(p.age / 300 + p.ph) * 6 * dt / 1000; }
  while (petals.length && petals[0].age > petals[0].life) petals.shift();
  for (const f of flies) { f.t += dt; f.x = 248 + 40 * Math.sin(f.t / 1700 + f.col.length) + 10 * Math.sin(f.t / 310); f.y = 672 + 14 * Math.sin(f.t / 1300) + 4 * Math.sin(f.t / 170); }
}
