// a 3x5 pixel font for the bubbles and the way-marks
const GLYPH = {
  A: ['010', '101', '111', '101', '101'], D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'], O: ['111', '101', '101', '101', '111'],
  R: ['110', '101', '110', '101', '101'], S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'],
  V: ['101', '101', '101', '101', '010'], ' ': ['000', '000', '000', '000', '000'], '>': ['100', '010', '001', '010', '100'],
};
function pixText(s, x, y, col) { ctx.fillStyle = col; [...s].forEach((c, i) => (GLYPH[c] || GLYPH[' ']).forEach((r, j) => [...r].forEach((b, k) => { if (b === '1') ctx.fillRect(x + i * 4 + k, y + j, 1, 1); }))); }
function plaque(s, cx, y) {   // a small cream plaque with dark letters, whole pixels
  const w = s.length * 4 + 3, x = Math.round(cx - w / 2) - cam.rx, yy = y - cam.ry;
  ctx.fillStyle = '#1c1719'; ctx.fillRect(x - 1, yy - 1, w + 2, 9); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(x, yy, w, 7);
  pixText(s, x + 2, yy + 1, '#5a3d2b');
}
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
  for (const r of rings) drawFx('fx:ring', MV.vfx.ring, r.x, r.y, r.t);
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flashes) {
    if (f.t < 0) continue;
    const k = 1 - f.t / f.life, x = Math.round(f.x) - cam.rx, y = Math.round(f.y) - cam.ry, r = f.r;
    ctx.fillStyle = `rgba(242,180,90,${0.22 * k})`; ctx.fillRect(x - r, y - (r >> 1), 2 * r, r); ctx.fillRect(x - r + 3, y - (r >> 1) - 1, 2 * r - 6, r + 2);
    ctx.fillStyle = `rgba(250,220,140,${0.28 * k})`; ctx.fillRect(x - (r >> 1), y - (r >> 2), r, r >> 1);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const a of [kaya, ...people]) shadow(a.x, a.y, a.name === 'pella' ? 7 : 9);
  shadow(cat.x, cat.y, 8);
  const list = OBJ.filter(o => !o.flat).map(o => ({ y: o.base, x: o.x, f: () => {
    if (o === dummy && dummy.hit >= 0) {
      const t = dummy.hit, k = Math.exp(-t / 220) * Math.cos(t / 55), dx = Math.round(4 * k * (dummy.hx || 1)), dy = Math.round(1.5 * k * (dummy.hy || 0));
      ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx + dx, o.y - cam.ry + dy);
      if (t < 90) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx + dx, o.y - cam.ry + dy); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      return;
    }
    ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx, o.y - cam.ry);
  } }));
  for (const s of shots) list.push({ y: s.g, x: s.x, f: () => drawFx('fx:ball:' + s.d, MV.vfx.ball[s.d], s.x, s.g - s.h, s.t) });
  for (const a of arcs) list.push({ y: a.sort, x: a.x, f: () => drawFx('fx:whip:' + a.d, MV.vfx.whip[a.d], a.x, a.y, a.t) });
  for (const a of [kaya, ...people]) list.push({ y: a.y, x: a.x, f: () => personDraw(a) });
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
  for (const p of petals) { const k = p.age / p.life; ctx.fillStyle = k < 0.7 ? '#e09a6a' : 'rgba(224,154,106,0.5)'; ctx.fillRect(Math.round(p.x) - cam.rx, Math.round(p.y) - cam.ry, (p.age / 200 | 0) % 3 ? 2 : 1, 1); }
  for (const f of flies) { const up = (f.t / 120 | 0) % 2, x = Math.round(f.x) - cam.rx, y = Math.round(f.y) - cam.ry; ctx.fillStyle = f.col; ctx.fillRect(x - 1, y - up, 1, 1 + up); ctx.fillRect(x + 1, y - up, 1, 1 + up); ctx.fillStyle = '#3a2e2c'; ctx.fillRect(x, y, 1, 1); }
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
  // way-marks: the forest road at the east edge, the riverside path
  plaque('TO THE FOREST ROAD >', Math.min(exitSign.x + 6, PW - 44), exitSign.y - 12);
  plaque('RIVERSIDE', riverSign.x + 9, riverSign.y - 12);
  if (OVERVIEW) return;
  nearP = dlg.open ? null : findNear();
  document.getElementById('act').disabled = !nearP && !dlg.open;
  if (nearP) {
    const h = nearP.name === 'pella' ? 50 : 62;
    const bx = Math.round(nearP.x) - 10 - cam.rx, by = Math.round(nearP.y) - h - cam.ry + (Math.floor(clock / 400) % 2);
    ctx.fillStyle = '#1c1719'; ctx.fillRect(bx - 1, by - 1, 21, 9); ctx.fillRect(bx + 8, by + 8, 3, 1); ctx.fillRect(bx + 9, by + 9, 1, 1);
    ctx.fillStyle = '#f6eed6'; ctx.fillRect(bx, by, 19, 7); ctx.fillRect(bx + 9, by + 7, 1, 1);
    pixText('TALK', bx + 2, by + 1, '#5e1a20');
  }
}
function update(dt) {
  clock += dt;
  if (kaya.look >= 0) kaya.look += dt;
  updateKaya(dt); updateMove(dt); updateFx(dt);
  for (const p of people) updatePerson(p, dt);
  updateCat(dt); updateAmbient(dt); updateCamera(dt);
  if (dlg.open) { dlg.shown = Math.min(dlg.who.def.lines[dlg.i].length, dlg.shown + dt * 0.045); renderDialog(); }
  if (tapMark) { tapMark.t -= dt; if (tapMark.t <= 0) tapMark = null; }
}
Promise.all(loads).then(() => {
  bakeGround(); resize(); updateCamera(16); render();
  if (OVERVIEW) {   // the whole map at 1x, no UI: let the residents settle for a moment first
    for (let i = 0; i < 120; i++) { clock += 16; for (const p of people) updatePerson(p, 16); updateCat(16); updateAmbient(16); }
    cam.rx = cam.ry = 0; render(); window.__ready = true; return;
  }
  if (REC) {
    window.__adv = ms => { while (ms > 0) { const d = Math.min(1000 / 60, ms); update(d); ms -= d; } render(); };
    window.__g = {
      hold: ks => { held.clear(); ks.forEach(k => held.add(k)); kaya.path = []; }, release: () => held.clear(),
      walkTo, talk: interact, advance: advanceDialog,
      talkTo: id => { const p = people.find(q => q.def.id === id); const [x, y] = besideSpot(p); walkTo(x, y); pendingTalk = p; },
      where: id => { const p = people.find(q => q.def.id === id); return [p.x, p.y]; },
      zoom: z => { zoomOverride = z; resize(); cam.init = false; updateCamera(16); render(); },
      look: () => { kaya.look = 0; },
      move: startMove, busy: () => !!move || shots.length > 0,
      face: d => { kaya.want = kaya.face = DIRS.indexOf(d) * Math.PI / 4; },
      state: () => ({ x: kaya.x, y: kaya.y, sx: Math.round(kaya.x) - cam.rx, sy: Math.round(kaya.y) - cam.ry, moving: kaya.moving, path: kaya.path.length, dlg: dlg.open, near: nearP && nearP.def.id, heading: kaya.heading }),
    };
    window.__ready = true; return;
  }
  let last = performance.now();
  const loop = now => { update(Math.min(50, now - last)); last = now; render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
