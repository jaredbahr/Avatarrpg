// ---------- surfaces drawn in the pixel family: each surface's cells become one organic shape (cell centres blended,
// edges broken with noise, never the tile's square), then a texture per surface; fire and steam animate on top
const BW = GW * CS, BH = GH * CS;
function organicMask(isOn, seedK, edge = 0.5, amp = 1, wide = false) {   // Uint8 mask over the board, 1 where the field passes the threshold
  const m = new Uint8Array(BW * BH);
  const v = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH ? 0 : isOn(x, y) ? 1 : 0);
  for (let py = 0; py < BH; py++) for (let px = 0; px < BW; px++) {
    const fx = px / CS - 0.5, fy = py / CS - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), sx = fx - ix, sy = fy - iy;
    const s0 = sx * sx * (3 - 2 * sx), s1 = sy * sy * (3 - 2 * sy);
    const a0 = v(ix, iy), a1 = v(ix + 1, iy), a2 = v(ix, iy + 1), a3 = v(ix + 1, iy + 1); if (!(a0 + a1 + a2 + a3)) continue;
    const f = a0 * (1 - s0) * (1 - s1) + a1 * s0 * (1 - s1) + a2 * (1 - s0) * s1 + a3 * s0 * s1;
    const n = wide ? vnoise(px, py, seedK, 17) * 0.32 + vnoise(px, py, seedK + 2, 7) * 0.16 + vnoise(px, py, seedK + 1, 2.5) * 0.05 : (vnoise(px, py, seedK, 9) * 0.16 + vnoise(px, py, seedK + 1, 2.5) * 0.06) * amp;
    if (f + n > edge) m[py * BW + px] = 1;
  }
  return m;
}
const SURF_LAYER = document.createElement('canvas'); SURF_LAYER.width = BW; SURF_LAYER.height = BH;
let FIRE_PTS = [], STEAM_PTS = [], surfDirty = true; const FIRE_BORN = new Map(); const FIRE_GLOW = document.createElement('canvas'); FIRE_GLOW.width = BW; FIRE_GLOW.height = BH;
function bakeSurfaces() {
  const g = SURF_LAYER.getContext('2d'), id = g.createImageData(BW, BH), d = id.data;
  const on = sid => (x, y) => { const c = cellOf(BOARD, x, y); return c && c.surface && c.surface.id === sid && !(sid === 'water' && c.c === '~'); };
  const put = (i, r, gg, b, a) => { d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = a; };
  const near = (m, x, y) => !m[y * BW + x - 1] || !m[y * BW + x + 1] || !m[(y - 1) * BW + x] || !m[(y + 1) * BW + x];
  FIRE_PTS = []; STEAM_PTS = [];
  for (const sid of ['mud', 'water', 'oil', 'ice', 'fire']) {
    const m = organicMask(on(sid), { mud: 101, water: 103, oil: 105, ice: 107, fire: 109 }[sid], 0.5, 1, true);   // v3: slow noise, so a 3x3 pool never reads square
    for (let y = 1; y < BH - 1; y++) for (let x = 1; x < BW - 1; x++) {
      const i = y * BW + x; if (!m[i]) continue; const e = near(m, x, y), h = hash2(x, y, 131);
      if (sid === 'water') e ? put(i, 40, 62, 66, 230) : put(i, 58 + h * 12, 104 + h * 14, 112 + h * 10, 190);
      if (sid === 'mud') { const v = vnoise(x, y, 143, 6), rut = Math.abs(vnoise(x, y, 145, 11)) < 0.05; e ? put(i, 46, 34, 30, 235) : rut ? put(i, 52, 38, 32, 235) : v > 0.45 ? put(i, 120, 92, 66, 225) : put(i, 74 + h * 12 + v * 14, 54 + h * 8 + v * 8, 40, 225); }   // v3: wet ruts and lit ridges, not a flat brown
      if (sid === 'oil') {   // v3: spilled lamp oil: a glossy dark brown film, the ground faintly through it, a lit rim and a few highlights
        const sheen = vnoise(x, y, 141, 7), lit = !m[i - BW] || !m[i - 1];
        e ? put(i, lit ? 120 : 30, lit ? 96 : 22, lit ? 70 : 20, 235) : sheen > 0.62 ? put(i, 150, 126, 96, 200) : sheen > 0.45 ? put(i, 84, 62, 52, 200) : put(i, 44 + h * 8, 32, 28, 190); }
      if (sid === 'ice') { const crack = Math.abs(vnoise(x, y, 151, 6)) < 0.04; e ? put(i, 120, 160, 178, 240) : crack ? put(i, 240, 250, 252, 230) : put(i, 168 + h * 20, 208 + h * 14, 222, 200); }
      if (sid === 'fire') { const v = vnoise(x, y, 113, 4), ember = h < 0.035 && !e; ember ? put(i, 242, 140 + h * 1500, 60, 235) : e ? put(i, 50, 33, 37, 150) : v > 0.35 ? put(i, 92, 38, 26, 200) : put(i, 40 + v * 20, 28, 26, 205); }
    }
  }
  { const fm = organicMask(on('fire'), 109, 0.38, 1, true), gg = FIRE_GLOW.getContext('2d'), gid = gg.createImageData(BW, BH); for (let i = 0; i < fm.length; i++) if (fm[i]) { gid.data[i * 4] = 242; gid.data[i * 4 + 1] = 120; gid.data[i * 4 + 2] = 50; gid.data[i * 4 + 3] = 255; } gg.putImageData(gid, 0, 0);
    // flame sites: a jittered lattice over the burning shape, big flames inside, small licks at the rim; a cell that has just
    // caught shows only small licks for its first half second, so the fire visibly creeps from cell to cell
    const core = organicMask(on('fire'), 109, 0.62, 1, true), now = new Set();
    for (const c of BOARD.cells) if (c.surface && c.surface.id === 'fire') { const k = c.x + ',' + c.y; now.add(k); if (!FIRE_BORN.has(k)) FIRE_BORN.set(k, clock); }
    for (const k of [...FIRE_BORN.keys()]) if (!now.has(k)) FIRE_BORN.delete(k);
    const m = organicMask(on('fire'), 109, 0.5, 1, true);
    // clumps, not a carpet: sites on a loose lattice, kept only where a slow noise says the fire is fierce; between them the
    // ground is charred and glowing
    for (let gy = 5; gy < BH; gy += 12) for (let gx = 5 + (gy % 24 ? 7 : 0); gx < BW; gx += 14) {
      const x = gx + Math.round((hash2(gx, gy, 118) - 0.5) * 10), y = gy + Math.round((hash2(gx, gy, 119) - 0.5) * 7);
      if (x < 0 || y < 0 || x >= BW || y >= BH || !m[y * BW + x]) continue;
      const fierce = vnoise(x, y, 125, 30); if (fierce < -0.45) continue;
      const inner = core[y * BW + x], r = hash2(x, y, 120);
      const k = inner && fierce > 0.1 && r < 0.45 && ASSETS.vfx13.fire_ground_c ? 'fire_ground_c' : inner && r < 0.8 ? 'fire_ground_a' : 'fire_ground_b';
      FIRE_PTS.push([x, y, Math.floor(hash2(x, y, 117) * 997), k, Math.floor(x / CS) + ',' + Math.floor(y / CS)]);
    } }
  const sm = organicMask(on('steam'), 161, 0.42);
  for (let y = 0; y < BH; y += 9) for (let x = 0; x < BW; x += 9) if (sm[y * BW + x]) STEAM_PTS.push([x, y, Math.floor(hash2(x, y, 163) * 4000)]);
  g.putImageData(id, 0, 0); surfDirty = false;
}
function drawSurfaces() {
  if (surfDirty) bakeSurfaces();
  ctx.drawImage(SURF_LAYER, GX - cam.rx, GY - cam.ry);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12 + 0.05 * Math.sin(clock / 90) + 0.03 * Math.sin(clock / 37);
  ctx.drawImage(FIRE_GLOW, GX - cam.rx, GY - cam.ry); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
function drawSteam() {   // drawn over the figures: soft grey puffs that drift up and right and loop
  for (const [x, y, ph] of STEAM_PTS) {
    const t = (clock + ph) % 4000 / 4000, X = GX + x + Math.round(t * 10) - cam.rx, Y = GY + y - Math.round(t * 16) - cam.ry, r = 6 + Math.round(Math.sin(t * Math.PI) * 4), a = Math.sin(t * Math.PI) * 0.34;
    // v3: a puff is a stepped pixel ellipse with a lit cap, never a box
    const ell = (cx, cy, rw, rh, col) => { ctx.fillStyle = col; for (let j = -rh; j <= rh; j++) { const w = Math.round(rw * Math.sqrt(Math.max(0, 1 - (j / (rh + 0.5)) ** 2))); if (w) ctx.fillRect(cx - w, cy + j, 2 * w, 1); } };
    ell(X, Y, r, Math.max(2, (r * 0.6) | 0), `rgba(232,236,232,${a})`); ell(X - 2, Y - 2, r >> 1, Math.max(1, (r * 0.3) | 0), `rgba(255,255,255,${a * 0.6})`);
  }
}
// ---------- previews without a grid: the reachable ground as a warm, dithered-edge tint; the blow's area likewise in red
const PREVIEW = document.createElement('canvas'); PREVIEW.width = BW; PREVIEW.height = BH; let previewKey = '';
function bakePreview(cells, col, key) {
  if (key === previewKey) return; previewKey = key;
  const g = PREVIEW.getContext('2d'); g.clearRect(0, 0, BW, BH); if (!cells || !cells.size) return;
  const m = organicMask((x, y) => cells.has(x + ',' + y), 171, 0.5, 1, true), id = g.createImageData(BW, BH), d = id.data;   // v3: wide, slow noise breaks the long straight runs
  for (let y = 1; y < BH - 1; y++) for (let x = 1; x < BW - 1; x++) {
    const i = y * BW + x; if (!m[i]) continue;
    const edge = !m[i - 1] || !m[i + 1] || !m[i - BW] || !m[i + BW], edge2 = !m[i - 2] || !m[i + 2] || !m[i - 2 * BW] || !m[i + 2 * BW];
    const a = edge ? ((x + y) % 2 ? 190 : 60) : edge2 ? ((x + y) % 2 ? 0 : 90) : 46;   // a dithered rim, a faint wash inside
    d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = a;
  }
  g.putImageData(id, 0, 0);
}
function footsteps(path, from) {   // a short dotted trail of paired footprints, then a ring at the destination
  let px = from.x, py = from.y, k = 0;
  for (const [cx, cy] of path) {
    const tx = cellX(cx), ty = cellY(cy) - 2, n = Math.max(1, Math.round(Math.hypot(tx - px, ty - py) / 9));
    for (let i = 1; i <= n; i++) { const x = px + (tx - px) * i / n, y = py + (ty - py) * i / n, side = (k++ % 2) ? 2 : -2, ox = (ty - py) ? side : 0, oy = (tx - px) ? side : 0;
      const X = Math.round(x + ox) - cam.rx, Y = Math.round(y + oy) - cam.ry; ctx.fillStyle = 'rgba(50,33,37,0.7)'; ctx.fillRect(X, Y, 2, 2); ctx.fillStyle = 'rgba(242,212,122,0.55)'; ctx.fillRect(X, Y - 1, 2, 1); }
    px = tx; py = ty;
  }
  if (path.length) ring(px, py + 2, [242, 212, 122]);
}
function ring(x, y, col, w = 10, h = 4) {   // a pixel ellipse outline on the ground
  ctx.fillStyle = `rgb(${col})`;
  for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(t) * w) - cam.rx, Math.round(y + Math.sin(t) * h) - cam.ry, 1, 1); }
}
// ---------- a 3x5 pixel font, the whole alphabet, for the forecast tooltip and the status pips
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
  H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101',
  O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', ' ': '000000000000000', '%': '101001010100101',
  '-': '000000111000000', '+': '000010111010000', '!': '010010010000010', '.': '000000000000010', ':': '000010000010000',
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
};
function ptext(s, x, y, col, shadow = '#1c1719') { [...s.toUpperCase()].forEach((ch, i) => { const g = FONT[ch] || FONT[' ']; for (let k = 0; k < 15; k++) if (g[k] === '1') { const X = x + i * 4 + (k % 3), Y = y + Math.floor(k / 3); if (shadow) { ctx.fillStyle = shadow; ctx.fillRect(X + 1, Y + 1, 1, 1); } ctx.fillStyle = col; ctx.fillRect(X, Y, 1, 1); } }); }
function tooltip(x, y, lines) {   // a small cream plaque with dark letters, beside the target
  const w = Math.max(...lines.map(l => l.s.length)) * 4 + 5, h = lines.length * 7 + 4, X = Math.round(x) - cam.rx, Y = Math.round(y) - cam.ry - h;
  ctx.fillStyle = '#1c1719'; ctx.fillRect(X - 1, Y - 1, w + 2, h + 2); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(X, Y, w, h);
  lines.forEach((l, i) => ptext(l.s, X + 3, Y + 2 + i * 7, l.col || '#5a3d2b', null));
}

// the flames: PixelLab ground flames (fire_ground_a / _b, /vfx loops), one per site, each on its own phase; drawn in the y-sorted
// list so a figure in front of a flame hides it and one behind is hidden by it
function flameList(list) {
  if (!ASSETS.vfx13 || !ASSETS.vfx13.fire_ground_a) return;
  for (const [x, y, ph, k0, cellk] of FIRE_PTS) {
    const age = clock - (FIRE_BORN.get(cellk) ?? -9999), k = age < 500 ? 'fire_ground_b' : k0, m = ASSETS.vfx13[k];
    if (age < 120 && hash2(x, y, 121) < 0.6) continue;
    list.push({ y: GY + y + 1, f: () => { const f = Math.floor((clock + ph * 13) / 85) % m.n; ctx.drawImage(IMG['vx:' + k], f * m.w, 0, m.w, m.h, GX + x - m.px - cam.rx, GY + y - m.py - cam.ry, m.w, m.h); } });
  }
}
