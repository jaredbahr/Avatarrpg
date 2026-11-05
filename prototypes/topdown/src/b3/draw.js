// ---------- camera and the frame (v2: no grid; the board shows itself through the world: tinted ground, footprints, rings)
const view = { w: 640, h: 360, zc: 2, zd: 2 }, cam = { x: 0, y: 0, rx: 0, ry: 0, init: false };
let focus = null, zoomOverride = Q.get('zoom') ? +Q.get('zoom') : 0;
function resize() {
  const dpr = window.devicePixelRatio || 1, cw = innerWidth, ch = innerHeight;
  const zc = OVERVIEW ? 1 : zoomOverride || Math.max(1, Math.min(3, Math.floor(Math.min(cw / 400, ch / 300))));
  const zd = Math.max(1, Math.round(zc * dpr));
  Object.assign(view, { zc, zd, w: Math.min(PW, Math.ceil(cw * dpr / zd)), h: Math.min(PH, Math.ceil(ch * dpr / zd)) });
  cv.width = view.w; cv.height = view.h; cv.style.width = (view.w * zd / dpr) + 'px'; cv.style.height = (view.h * zd / dpr) + 'px'; ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);
function updateCamera(dt) {
  const f = focus || { x: GX + 10 * CS, y: GY + 6 * CS };
  const tx = f.x - view.w / 2, ty = f.y - 20 - view.h / 2;
  let cx = Math.max(0, Math.min(PW - view.w, tx)), cy = Math.max(0, Math.min(PH - view.h, ty));
  // polish pass: the boss is big (up to 116 x 106 px). Whenever any of it is in the frame the camera is nudged until all of it is, so a midpoint
  // between the Grumbler and its target never cuts the machine off at the bottom or a side (round 5 and 8 of the floor fight did)
  for (const u of typeof UNITS !== 'undefined' ? UNITS : []) {
    if (u.k !== 'grumbler' || u.ko >= 0) continue;
    const bt = u.y - 106 + 6 - 4, bb = u.y + 12, bl = u.x - 64, br = u.x + 64;
    if (bb > cy && bt < cy + view.h && br > cx && bl < cx + view.w) {
      if (view.h >= bb - bt) { if (bb > cy + view.h) cy = bb - view.h; if (bt < cy) cy = bt; }
      if (view.w >= br - bl) { if (br > cx + view.w) cx = br - view.w; if (bl < cx) cx = bl; }
      cx = Math.max(0, Math.min(PW - view.w, cx)); cy = Math.max(0, Math.min(PH - view.h, cy));
    }
  }
  if (!cam.init) { cam.x = cx; cam.y = cy; cam.init = true; }
  const k = 1 - Math.exp(-3.2 * dt / 1000); cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k;
  cam.rx = Math.round(cam.x); cam.ry = Math.round(cam.y);
  if (shake > 0) { cam.rx += Math.round((rnd() * 2 - 1) * shakeAmp); cam.ry += Math.round((rnd() * 2 - 1) * shakeAmp); }
}
function drawPreviews() {
  const u = S.active;
  if (u && u.side === 'party' && !STATS[u.k].ally && !S.walk && !S.ab && u.anim === 'idle' && u.mv > 0 && !OVERVIEW) {   // where they can walk: a warm wash with a dithered rim
    const R = reach(u), cells = new Set([...R].filter(([, v]) => !v.ally).map(([k]) => k));
    bakePreview(cells, [242, 196, 120], 'mv' + u.k + u.cx + ',' + u.cy + ',' + u.mv);
    ctx.drawImage(PREVIEW, GX - cam.rx, GY - cam.ry);
  } else if (S.preview) {   // the blow's area, in ember red
    const cells = new Set(S.preview.tiles.map(t => t + ''));
    bakePreview(cells, [214, 92, 70], 'ab' + S.preview.ab + S.preview.t + u.cx + ',' + u.cy);
    ctx.drawImage(PREVIEW, GX - cam.rx, GY - cam.ry);
  }
  if (S.walk) footsteps(S.walk.path, S.walk.u);
  if (u && u.side === 'party' && S.ab && !S.preview) for (const [x, y] of validTargets(BOARD, u, S.ab)) { const t = unitOn(BOARD, x, y); if (t) ring(t.x, t.y, [242, 140, 110], 9, 3); }
  if (S.preview) for (const d of S.preview.dmg) ring(d.u.x, d.u.y, d.u.side === 'party' ? [242, 212, 122] : [242, 120, 96], 10, 4);
  if (u && !S.walk) ring(u.x, u.y + 1, u.side === 'party' ? [242, 212, 122] : [201, 71, 58], 9, 3);
}
function drawTooltip() {
  const p = S.preview; if (!p) return;
  const lines = [];
  for (const d of p.dmg) lines.push({ s: `${d.u.name} -${d.n} ${d.chance}%`, col: d.u.side === 'party' ? '#8a4b3c' : '#5a3d2b' });
  for (const h of p.heals) lines.push({ s: `${h.u.name} +${h.n}`, col: '#4f7d4a' });
  for (const st of p.statuses) lines.push({ s: `${st.u.name} ${STAT[st.id].name} ${Math.round(st.chance * 100)}%`, col: '#3a5a7a' });
  for (const t of p.tips) lines.push({ s: t, col: '#a0442e' });
  if (!lines.length) lines.push({ s: 'No effect', col: '#5a3d2b' });
  tooltip(cellX(p.t[0]) + 14, cellY(p.t[1]) - 34, lines);
}
function hpBar(u) {   // under the feet, so it never sits over anyone's head; shown when hurt, acting or targeted
  if (u.hp <= 0) return;
  const show = u.hp < u.max || S.active === u || (S.preview && S.preview.dmg.some(d => d.u === u)); if (!show) return;
  const w = 18, X = Math.round(u.x) - w / 2 - cam.rx, Y = Math.round(u.y) + 4 - cam.ry, f = Math.round((w - 2) * u.hp / u.max);
  ctx.fillStyle = '#1c1719'; ctx.fillRect(X, Y, w, 4); ctx.fillStyle = '#5a3d2b'; ctx.fillRect(X + 1, Y + 1, w - 2, 2);
  ctx.fillStyle = u.side === 'party' ? '#7aa05a' : '#c9473a'; ctx.fillRect(X + 1, Y + 1, f, 2);
  u.st.forEach((s, i) => { ctx.fillStyle = STATUS_COL[s.id] || '#fff'; ctx.fillRect(X + w + 2 + i * 4, Y, 3, 3); });
}
function render() {
  ctx.fillStyle = '#1c1719'; ctx.fillRect(0, 0, view.w, view.h);
  ctx.drawImage(ground, cam.rx, cam.ry, view.w, view.h, 0, 0, view.w, view.h);
  if (BOARD) drawSurfaces();
  if (BOARD) drawPreviews();
  for (const r of rings) drawFx('fx:ring', MV.vfx.ring, r.x, r.y, r.t);
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flashes) {
    if (f.t < 0) continue; const k = 1 - f.t / f.life, x = Math.round(f.x) - cam.rx, y = Math.round(f.y) - cam.ry, r = f.r;
    // v3: a stepped pixel ellipse (two rings), never a box
    const ell = (rr, col) => { ctx.fillStyle = col; const h = Math.max(1, rr >> 1); for (let j = -h; j <= h; j++) { const w = Math.round(rr * Math.sqrt(1 - (j / (h + 0.5)) ** 2)); ctx.fillRect(x - w, y + j, 2 * w, 1); } };
    ell(r, f.white ? `rgba(246,238,214,${0.4 * k})` : `rgba(242,180,90,${0.2 * k})`);
    if (!f.white) ell(r >> 1, `rgba(250,220,140,${0.26 * k})`);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const u of UNITS) {
    if (u.ko >= 700 && u.k !== 'grumbler') continue;
    const c = CLS && CLS[Math.round(u.y) * PW + Math.round(u.x)], hard = LV.ground === 'forest' ? c === 1 : c !== 4;
    const b = feetBlob((u.k === 'grumbler' ? 76 : u.k === 'bruiser' ? 30 : 21) * 0.6 / 0.65, hard ? 205 : 170);
    ctx.globalAlpha = u.ko >= 0 && u.k !== 'grumbler' ? Math.max(0, 1 - u.ko / 700) : 1; ctx.drawImage(b, Math.round(u.x + u.shove[0] - b.width / 2) - cam.rx, Math.round(u.y + u.shove[1] - b.height / 2) - cam.ry); ctx.globalAlpha = 1;
  }
  const list = OBJ.filter(o => !o.flat && !o.gone).map(o => ({ y: o.base, f: () => ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx, o.y - cam.ry) }));
  for (const [o, kit] of FRINGE) if (!o.gone) list.push({ y: o.base + 0.5, f: () => ctx.drawImage(kit.fringe, o.x - kit.m - cam.rx, o.y - kit.m - cam.ry) });
  for (const w of WALLS) { const c = cellOf(BOARD, w.x, w.y); if (!c || c.wall <= 0) continue; const im = IMG['ob:earth_wall'], rise = Math.min(1, w.t / 260), h = Math.round(im.height * rise);
    list.push({ y: cellY(w.y) + 4, f: () => { ctx.fillStyle = 'rgba(50,33,37,0.5)'; ctx.fillRect(Math.round(cellX(w.x) - im.width / 2) + 3 - cam.rx, cellY(w.y) + 1 - cam.ry, im.width - 2, 4); ctx.drawImage(im, 0, 0, im.width, h, Math.round(cellX(w.x) - im.width / 2) - cam.rx, cellY(w.y) + 4 - h - cam.ry, im.width, h); } }); }
  for (const u of UNITS) list.push({ y: u.y + 0.2, f: () => { unitDraw(u); if (u.st && has(u, 'burning') && u.hp > 0) drawFx('fx:embers', MV.vfx.embers, u.x + 2, u.y - 12, (clock + u.phase) % MV.vfx.embers.ms.reduce((a, b) => a + b, 0)); } });
  for (const s of shots) list.push({ y: s.g, f: () => drawFx('fx:ball:' + s.d, MV.vfx.ball[s.d], s.x, s.g - s.h, s.t) });
  for (const a of arcs) list.push({ y: a.sort, f: () => drawFx('fx:whip:' + a.d, MV.vfx.whip[a.d], a.x, a.y, a.t) });
  if (BOARD) flameList(list);
  for (const v of vfxs) list.push({ y: v.y + 24, f: () => drawVfx(v) });
  list.sort((a, b) => a.y - b.y).forEach(d => d.f());
  for (const b of bursts) drawFx('fx:burst:' + b.d, MV.vfx.burst[b.d], b.x, b.y, b.t);
  for (const e of embers) drawFx('fx:embers', MV.vfx.embers, e.x, e.y, e.t);
  if (BOARD) drawSteam();
  drawBolts();
  if (!OVERVIEW && BOARD) for (const u of UNITS) hpBar(u);
  for (const n of nums) { const y = Math.round(n.y - n.t * 0.018) - cam.ry; ptext(n.s, Math.round(n.x) - n.s.length * 2 - cam.rx, y, n.col); }
  if (BOARD) drawTooltip();
}
// ---------- boot
let last = 0;
function update(dt) {
  clock += dt;
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const r = timers[i].r; timers.splice(i, 1); r(); } }
  for (let i = gtimers.length - 1; i >= 0; i--) { gtimers[i].t -= dt; if (gtimers[i].t <= 0) { const f = gtimers[i].f; gtimers.splice(i, 1); f(); } }
  for (const w of WALLS) w.t += dt;
  updateUnits(dt); updateFx(dt); updateCamera(dt);
}
let PARLEY = null;
Promise.all(loads).then(() => {
  if (LV.ground === 'forest') placeForest(); else placeQuarry();
  PROPLIST = placeProps();
  const variant = (AREA && AREA.variant) || Q.get('variant') || 'base';
  for (const [k, x, y, d] of LV.party) mkUnit(k, x, y, d);
  for (const [k, x, y, d] of LV.allies || []) mkUnit(k, x, y, d);
  for (const [k, x, y, d] of (LV.foes ? LV.foes[variant] || LV.foes.base : [])) mkUnit(k, x, y, d);
  if (LV.ground === 'forest') CLS = bakeForest(); else { QB = bakeQuarry(); CLS = QB.cls; groundObjects(QB); window.__checks = () => ({ shadows: shadowTableQ(), edges: edgeRunsQ(), straight: straightQ() }); }
  setupBoard(); resize(); focus = UNITS[0]; updateCamera(16); render();
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect(), wx = (e.clientX - r.left) / r.width * view.w + cam.rx, wy = (e.clientY - r.top) / r.height * view.h + cam.ry;
    tapCell(Math.floor((wx - GX) / CS), Math.floor((wy - GY) / CS));
  });
  setTop('');
  const begin = auto => { if (MODE === 'explore') runExplore(auto); else runBattle(auto); };
  // the tutorial shell holds a board until its dialogue is done (the gate's parley), then starts it
  window.AREA_API = { start: o => { PARLEY = null; begin(REC || (o && o.auto)); }, state: () => ({ over: S.over, result: S.result, round: S.round, exited }) };
  if (OVERVIEW) { cam.rx = cam.ry = 0; render(); window.__ready = true; return; }
  if (REC) {
    window.__adv = ms => { while (ms > 0) { const d = Math.min(1000 / 30, ms); update(d); ms -= d; } render(); };
    window.__auto = () => begin(true);
    window.__zoom = z => { zoomOverride = z; resize(); };
    window.__focus = (x, y) => { focus = x == null ? null : { x, y }; };
    window.__state = () => ({ names: NAMES.join('|'), over: S.over, result: S.result, round: S.round, exited, hp: UNITS.map(u => [u.k, u.hp, u.cx, u.cy, u.st.map(s => s.id).join('+')]), surf: BOARD.cells.filter(c => c.surface && c.c !== '~' && c.c !== 'r').map(c => c.surface.id[0]).join('') });
    window.__ready = true; tellShell({ type: 'ready' }); return;
  }
  if (!(AREA && AREA.hold)) begin(Q.get('auto') === '1');
  const loop = now => { const dt = last ? Math.min(50, now - last) : 16; last = now; update(dt); render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop); tellShell({ type: 'ready' });
});
