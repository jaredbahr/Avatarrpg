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
// v12 (item 1): the canal pours over the west lip. The water runs on to the cliff edge (baked), flows faster toward it, curls over a lighter
// crest and falls as a narrow stream down the face and into the void, thinning to spray and mist. Every moving part is a function of `clock`.
const FALL = { lip: 50, x0: 38, top: 438, bot: 463, len: 190 };
function drawSpill() {
  const { lip, x0, top, bot, len } = FALL, X = x => Math.round(x) - cam.rx, Y = y => Math.round(y) - cam.ry;
  const R = (x, y, w, h, c, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(X(x), Y(y), w, h); ctx.globalAlpha = 1; };
  const hh = (a, b, k) => hash2(a, b, k);
  // the surface speeds up toward the lip: streaks that lengthen as they near it
  for (let i = 0; i < 12; i++) {
    const sp = 24 + (i % 4) * 8, ph = (clock * sp / 1000 + i * 9.7) % 70, x = 124 - ph * 1.0 + 0, near = 1 - (x - lip) / 76, L = 2 + Math.round(near * 5);
    if (x < lip + 2) continue; R(Math.max(lip + 1, x - 0), top + 2 + (i * 7) % 22, Math.min(L, Math.round(x - lip)), 1, i % 3 ? '#86c2bd' : '#4a8f98', 0.5 + near * 0.5);
  }
  // the lip: the water rolls over, a crest of light and foam
  R(lip - 6, top, 6, bot - top, '#23435a'); R(lip - 6, top, 6, 1, '#4a8f98'); R(lip - 6, bot - 1, 6, 1, '#1c3447');
  for (let y = top; y < bot; y++) {
    const f = hh(y, (clock / 70) | 0, 71);
    R(lip - 4, y, 1, 1, f < 0.5 ? '#bfe3dc' : '#86c2bd'); R(lip - 3, y, 2, 1, f < 0.3 ? '#e8f4ee' : '#a9d7d0'); R(lip - 1, y, 1, 1, '#4a8f98');
  }
  // the stream: a narrow sheet at the canal's rows that stays one body, then frays; streaks of light scroll down it
  const bands = Math.ceil((len + (bot - top)) / 5);
  for (let k = 0; k < bands; k++) {
    const y = top + k * 5, t = k / bands, a = Math.max(0, 1 - t * 0.95), w = 12 + (t > 0.5 ? Math.round((t - 0.5) * 10) : 0);
    const jl = Math.round((hh(k, 3, 73) - 0.5) * 2), left = lip - 6 - w + 6 + jl;
    R(left, y, lip - 1 - left, 5, '#3b8497', a * 0.92); R(left + 3, y, 2, 5, '#5aa5ab', a * 0.5);
    R(left, y, 1, 5, '#23435a', a); R(lip - 7, y, 1, 5, '#23435a', a * 0.8);
  }
  for (let i = 0; i < 30; i++) {
    const sp = 100 + (i % 5) * 22, p = ((clock * sp / 1000) + i * 37) % len, t = p / len, c = x0 + 1 + ((i * 5) % 11), L = 4 + (i % 3) * 3;
    R(c, top + p, 1, Math.min(L, len - p), i % 3 === 0 ? '#f2fbf6' : i % 3 === 1 ? '#a9d7d0' : '#5aa5ab', 1 * (1 - t * 0.9));
  }
  // spray off the lip, and mist where it lands in the dark
  for (let k = 0; k < 14; k++) {
    const t = ((clock / 620) + k / 14) % 1, x = lip - 8 - t * 9 - (k % 3), y = top + (k * 5) % 26 + t * t * 26 - 2;
    R(x, y, 1, 1, '#e8f4ee', 0.9 * (1 - t));
  }
  for (let j = 0; j < 18; j++) {
    const t = ((clock / 1900) + j / 18) % 1, sz = 3 + Math.round(t * 8), x = x0 - 3 + ((j * 7) % 16) - t * 16, y = bot + len - 20 + (j % 4) * 5 - t * 26;
    R(x, y, sz, Math.max(2, sz - 2), '#cfe9e6', 0.5 * (1 - t)); R(x + 1, y + 1, Math.max(1, sz - 3), 1, '#ffffff', 0.18 * (1 - t));
  }
  for (let j = 0; j < 10; j++) {   // mid-fall droplets thrown off the sheet
    const t = ((clock / 900) + j / 10) % 1, p = (j * 41) % 120, x = x0 - 1 - t * 8, y = bot + 8 + p + t * 12;
    R(x, y, 1, 1, '#bfe3dc', 0.7 * (1 - t) * (1 - p / 150));
  }
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
  // figures: the same shadow colour and hard edge as everything else, a flat ellipse under the feet
  for (const a of [kaya, ...people, cat]) { const hard = vt(Math.round(a.x / T), Math.round(a.y / T)) === 'C', b = feetBlob((a.name === 'cat' ? 26 : a.name === 'pella' ? 16 : 21) * 0.6 / 0.65, hard ? 205 : 170); ctx.drawImage(b, Math.round(a.x - b.width / 2) - cam.rx, Math.round(a.y - b.height / 2) - cam.ry); }   // Imagination bodyBlob: an ellipse 60% of the figure's opaque width, a third as tall, under the feet
  drawSpill();
  const list = OBJ.filter(o => !o.flat).map(o => ({ y: o.base, x: o.x, f: () => {
    if (o === dummy && dummy.hit >= 0) {
      const t = dummy.hit, k = Math.exp(-t / 220) * Math.cos(t / 55), dx = Math.round(4 * k * (dummy.hx || 1)), dy = Math.round(1.5 * k * (dummy.hy || 0));
      ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx + dx, o.y - cam.ry + dy);
      if (t < 90) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx + dx, o.y - cam.ry + dy); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      return;
    }
    ctx.drawImage(IMG['ob:' + o.k], o.x - cam.rx, o.y - cam.ry);
  } }));
  // grass growing up over the bases of everything standing on the lawn (drawn just in front of each object)
  for (const [o, kit] of FRINGE) list.push({ y: o.base + 0.5, x: o.x, f: () => { const dx = o === dummy && dummy.hit >= 0 ? 0 : 0; ctx.drawImage(kit.fringe, o.x - kit.m - cam.rx + dx, o.y - kit.m - cam.ry); } });
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
    const cx = l.x + LANTERN.x - cam.rx, cy = l.y + LANTERN.y - cam.ry;   // v12: the lantern's own glass, measured from the sprite
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
  plaque('TO THE FOREST ROAD >', exitSign.x + 30, exitSign.y - 12);
  plaque('RIVERSIDE', riverSign.x + 30, riverSign.y - 12);
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
// the lantern's lit glass in the lamp sprite (warm, bright pixels): the glow is centred on it, in sprite coordinates
let LANTERN = { x: 28, y: 29 };
function findLantern() {
  const im = IMG['ob:lamp'], c = mkCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, im.width, im.height).data; let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 190) { const p = i / 4; sx += p % im.width; sy += (p / im.width) | 0; n++; }
  if (n) LANTERN = { x: Math.round(sx / n), y: Math.round(sy / n) };
}
Promise.all(loads).then(() => {
  findLantern(); findChimneys(); bakeGround(); resize(); updateCamera(16); render();
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
      state: () => ({ x: kaya.x, y: kaya.y, sx: Math.round(kaya.x) - cam.rx, sy: Math.round(kaya.y) - cam.ry, moving: kaya.moving, path: kaya.path.length, pts: kaya.path.map(q => q.map(Math.round)), dlg: dlg.open, near: nearP && nearP.def.id, heading: kaya.heading }),
    };
    window.__ready = true; return;
  }
  let last = performance.now();
  const loop = now => { update(Math.min(50, now - last)); last = now; render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
