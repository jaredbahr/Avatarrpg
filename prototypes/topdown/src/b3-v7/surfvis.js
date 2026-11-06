// ---------- surfaces drawn in the pixel family: each surface's cells become one organic shape (cell centres blended,
// edges broken with noise, never the tile's square), then a texture per surface; fire and steam animate on top
const BW = GW * CS, BH = GH * CS;
// polish pass 2: a surface lies only on the walkable ground under its cells. GOK is 1 where a patch may be painted: the ground's own
// class (never a ledge face, a rock top, the void, a pit), not a blocked or walled cell, not the foot of a prop; and a patch stays
// within a quarter tile (CAP px) of its authored cells, so the rule cells read correctly
const CAP = 9;
let GOKC = null, GOKLEVEL = '';
function groundOK() {
  const key = LEVEL_KEY + (CLS ? 1 : 0); if (GOKC && GOKLEVEL === key) return GOKC;
  const g = new Uint8Array(BW * BH), forest = LV.ground === 'forest', okc = forest ? [1, 1, 0, 1] : [1, 1, 0, 0, 1, 0, 0, 0, 0, 0];
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const wx = GX + x, wy = GY + y, i = wy * PW + wx; if (!CLS || !okc[CLS[i]]) continue;
    if (!forest && QB && QB.face[i]) continue; g[y * BW + x] = 1; }
  for (const o of OBJ) { if (!o.flat) continue;   // flat ground dressing (the rails) is never covered; a standing prop simply stands on its patch, so no notch is cut
    for (let wy = Math.max(GY, o.y); wy < Math.min(GY + BH, o.y + o.h); wy++) for (let wx = Math.max(GX, o.x); wx < Math.min(GX + BW, o.x + o.w); wx++) g[(wy - GY) * BW + (wx - GX)] = 0; }
  GOKLEVEL = key; return (GOKC = g);
}
function clipMask(m, isOn) {
  const g = groundOK(), blocked = new Uint8Array(GW * GH), on = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = cellOf(BOARD, x, y); blocked[y * GW + x] = !c || (LEGEND[ROWS[y][x]] && LEGEND[ROWS[y][x]].blocked) || c.wall > 0 ? 1 : 0; on[y * GW + x] = isOn(x, y) ? 1 : 0; }
  // distance (px) to the nearest authored cell's box; the cap on it wanders between 3 and CAP px, so the limit is never a straight line
  const odist = (px, py) => { let best = 99; const cx0 = Math.floor(px / CS), cy0 = Math.floor(py / CS);
    for (let cy = Math.max(0, cy0 - 1); cy <= Math.min(GH - 1, cy0 + 1); cy++) for (let cx = Math.max(0, cx0 - 1); cx <= Math.min(GW - 1, cx0 + 1); cx++) if (on[cy * GW + cx]) {
      const dx = Math.max(0, cx * CS - px, px - (cx * CS + CS - 1)), dy = Math.max(0, cy * CS - py, py - (cy * CS + CS - 1)); best = Math.min(best, Math.hypot(dx, dy)); }
    return best; };
  const near = (px, py) => { const d = odist(px, py); return d <= 0 || d < 3.5 + (CAP - 3.5) * Math.min(1, Math.max(0, 0.5 + 0.9 * vnoise(px, py, 191, 8) + 0.5 * vnoise(px, py, 193, 3.5))); };
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const i = y * BW + x, cell = Math.floor(y / CS) * GW + Math.floor(x / CS);
    if (m[i] && (!g[i] || blocked[cell] || !near(x, y))) m[i] = 0;
    // the cell's own core is always covered (where the ground allows it), so the rule's cells are never read short
    else if (!m[i] && g[i] && on[cell] && !blocked[cell] && x % CS > 12 && x % CS < CS - 12 && y % CS > 12 && y % CS < CS - 12) m[i] = 1;
  }
  // the clip edge is soft: a patch stands off the ledge by a wandering 0-4 px, then two majority passes round every corner
  const bad = new Uint8Array(BW * BH); for (let i = 0; i < bad.length; i++) bad[i] = g[i] ? 0 : 1;
  const nb = insideDist(bad, 5);
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const i = y * BW + x; if (m[i] && nb[i] && nb[i] <= Math.round(3.4 * (0.5 + 0.5 * vnoise(x, y, 197, 7)))) m[i] = 0; }
  for (let pass = 0; pass < 2; pass++) { const src = m.slice();
    for (let y = 2; y < BH - 2; y++) for (let x = 2; x < BW - 2; x++) { const i = y * BW + x; let c = 0; for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) c += src[i + j * BW + k];
      if (c >= 15) m[i] = g[i] ? 1 : 0; else if (c <= 9) m[i] = 0; } }
  return m;
}
function insideDist(m, cap = 8) {   // 0 outside; 1 at the edge, rising inward (4-neighbour chamfer, capped)
  const D = new Uint8Array(BW * BH);
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const i = y * BW + x; if (!m[i]) continue; D[i] = Math.min(cap, 1 + Math.min(x && D[i - 1] || 0, y && D[i - BW] || 0)); if (!x || !y) D[i] = 1; }
  for (let y = BH - 1; y >= 0; y--) for (let x = BW - 1; x >= 0; x--) { const i = y * BW + x; if (!m[i]) continue; const r = x < BW - 1 ? D[i + 1] : 0, d = y < BH - 1 ? D[i + BW] : 0; D[i] = Math.min(D[i], 1 + Math.min(r, d)); }
  return D;
}
function organicMask(isOn, seedK, edge = 0.5, amp = 1, wide = false) {   // Uint8 mask over the board, 1 where the field passes the threshold
  const m = new Uint8Array(BW * BH);
  if (wide) return clipMask(metaMask(isOn, seedK, edge), isOn);
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
// polish pass: a pool or a burn is a union of soft round blobs, one per cell (each centre nudged, each a slightly different size), never a
// box with chamfers: the field is the sum of (1 - d^2/r^2)^2 over the cells around the pixel, cut by a slow, wide noise
function metaMask(isOn, seedK, edge) {
  const m = new Uint8Array(BW * BH), on = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (isOn(x, y)) on.push([x + 0.5 + (hash2(x, y, seedK + 31) - 0.5) * 0.6, y + 0.5 + (hash2(x, y, seedK + 32) - 0.5) * 0.6, 0.92 + (hash2(x, y, seedK + 33) - 0.5) * 0.24, x, y]);
  if (!on.length) return m;
  const grid = new Map(); for (const o of on) grid.set(o[3] + ',' + o[4], o);
  const thr = edge * 0.62;
  for (let py = 0; py < BH; py++) for (let px = 0; px < BW; px++) {
    const cx = px / CS, cy = py / CS, ix = Math.floor(cx), iy = Math.floor(cy); let f = 0;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const o = grid.get((ix + j) + ',' + (iy + k)); if (!o) continue; const d2 = ((cx - o[0]) ** 2 + (cy - o[1]) ** 2) / (o[2] * o[2]); if (d2 < 1) f += (1 - d2) ** 2; }
    if (!f) continue;
    const n = vnoise(px, py, seedK, 21) * 0.2 + vnoise(px, py, seedK + 2, 9) * 0.09 + vnoise(px, py, seedK + 1, 2.5) * 0.03;
    if (f + n * Math.max(0, 1 - f / (thr * 2.6)) > thr) m[py * BW + px] = 1;   // the noise fades inside, so a pool never opens a hole
  }
  return m;
}
const SURF_LAYER = document.createElement('canvas'); SURF_LAYER.width = BW; SURF_LAYER.height = BH;
let FIRE_PTS = [], STEAM_PTS = [], surfDirty = true; const SPARK = []; const FIRE_BORN = new Map(); const FIRE_GLOW = document.createElement('canvas'); FIRE_GLOW.width = BW; FIRE_GLOW.height = BH;

// ---- mud and oil are drawn as materials, opaque pixels only. Light comes from the upper left: a wet rim catches it on the upper-left inside
// of the patch, a darker damp ring sits just inside the outline, and a few glints twinkle (SPARK, drawn each frame)
const litEdge = (m, x, y, k) => !m[(y - k) * BW + x - k] || !m[(y - k) * BW + x] && !m[y * BW + x - k];   // ground (not patch) lies up-left of this pixel
function mudPx(m, D, x, y, i, e, h, put, SPARK) {
  const d = D[i], lit = litEdge(m, x, y, 3);
  if (e) { put(i, 38, 27, 24, 255); return; }                       // the outline, a darker tone of the mud (never black)
  if (d <= 2) { put(i, 60, 42, 32, 255); if (d === 2 && lit && h < 0.3) put(i, 120, 88, 60, 255); return; }   // the damp rim, darker, with a wet catch where the light hits it
  const n = vnoise(x, y, 143, 8) * 0.6 + vnoise(x, y, 147, 3) * 0.3 + (h - 0.5) * 0.18;
  const rut = Math.abs(vnoise(x + y * 0.35, y, 145, 15)) < 0.045, rutLit = Math.abs(vnoise(x + y * 0.35 - 1, y - 1, 145, 15)) >= 0.045 && rut === false && Math.abs(vnoise(x + y * 0.35 + 1, y + 1, 145, 15)) < 0.045;
  const pool = vnoise(x, y, 149, 5.5) > 0.62 && d > 4;                // a few wet hollows: slick, bluer, with a sky glint on the upper-left lip
  if (pool) {
    const up = vnoise(x - 2, y - 2, 149, 5.5) <= 0.5; put(i, 74, 62, 58, 255);
    if (up && h < 0.55) put(i, 150, 112, 78, 255);
    else if (vnoise(x + 2, y + 2, 149, 5.5) <= 0.5) put(i, 52, 40, 36, 255);
    
    return;
  }
  if (rut) { put(i, 52, 36, 29, 255); return; }                      // wheel and boot ruts, wet dark
  if (rutLit && h < 0.45) { put(i, 112, 82, 56, 255); return; }                  // the lit crest of a rut, on its upper-left
  put(i, ...(n > 0.34 ? [128, 94, 64] : n > 0.14 ? [104, 76, 52] : n > -0.12 ? [86, 62, 44] : [70, 50, 38]), 255);   // clumps: four tones, hard steps
  if (h > 0.9994 && n > 0.0) SPARK.push([x, y, 214, 176, 126, Math.floor(h * 4000) % 5, 1, 1]);   // a rare warm wet fleck
}
function oilPx(m, D, x, y, i, e, h, put, SPARK) {
  const d = D[i], lit = litEdge(m, x, y, 7);
  if (e) { put(i, 66, 50, 40, 255); return; }                         // where it meets the sand the oil soaks in: a thin, slightly lighter wet-brown edge
  if (d === 2) { put(i, 38, 29, 27, 255); return; }
  // ONE soft highlight band on the upper-left: a pale, desaturated two-tone streak, broken so it is never a continuous line
  if (lit && d >= 3 && d <= 6 && vnoise(x, y, 157, 14) > -0.2) { const c = d === 3 || d === 6 ? [70, 62, 58] : [136, 126, 114]; put(i, ...c, 255); return; }
  // at most a faint, thin, low-saturation rainbow along one short contour
  if (d >= 5 && Math.abs(vnoise(x, y, 155, 26)) < 0.016 && vnoise(x, y, 159, 30) > 0.5 && vnoise(x, y, 171, 9) > 0.1) { const t = vnoise(x, y, 161, 40); put(i, ...(t < 0 ? [84, 104, 100] : [110, 94, 112]), 255); return; }
  const w = vnoise(x, y, 141, 18), w2 = vnoise(x, y, 143, 7); put(i, ...(w > 0.25 ? [38, 30, 28] : w2 > 0.3 ? [31, 25, 24] : [24, 19, 19]), 255);   // a deep warm black in three close tones
}
function bakeSurfaces() {
  const g = SURF_LAYER.getContext('2d'), id = g.createImageData(BW, BH), d = id.data;
  const on = sid => (x, y) => { const c = cellOf(BOARD, x, y); return c && c.surface && c.surface.id === sid && !(sid === 'water' && c.c === '~'); };
  const put = (i, r, gg, b, a) => { d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = a; };
  const near = (m, x, y) => !m[y * BW + x - 1] || !m[y * BW + x + 1] || !m[(y - 1) * BW + x] || !m[(y + 1) * BW + x];
  FIRE_PTS = []; STEAM_PTS = []; SPARK.length = 0;
  for (const sid of ['mud', 'water', 'oil', 'ice', 'fire']) {
    const m = organicMask(on(sid), { mud: 101, water: 103, oil: 105, ice: 107, fire: 109 }[sid], sid === 'water' ? 0.3 : 0.5, 1, true);   // v3: slow noise, so a 3x3 pool never reads square
    const D = insideDist(m);
    for (let y = 1; y < BH - 1; y++) for (let x = 1; x < BW - 1; x++) {
      const i = y * BW + x; if (!m[i]) continue; const e = near(m, x, y), h = hash2(x, y, 131);
      if (sid === 'water') e ? put(i, 40, 62, 66, 230) : put(i, 58 + h * 12, 104 + h * 14, 112 + h * 10, 190);
      if (sid === 'mud') mudPx(m, D, x, y, i, e, h, put, SPARK);
      if (sid === 'oil') oilPx(m, D, x, y, i, e, h, put, SPARK);
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
    // polish pass: far sparser. A jittered lattice ~1.6x looser than v3's, a slow "hole" noise that leaves charred, glowing ground between the
    // clumps, and each clump is one main flame plus up to two smaller ones beside it, in mixed sizes (a roaring tongue only deep inside)
    for (let gy = 6; gy < BH; gy += 17) for (let gx = 6 + ((gy / 17 | 0) % 2 ? 10 : 0); gx < BW; gx += 20) {
      const x = gx + Math.round((hash2(gx, gy, 118) - 0.5) * 16), y = gy + Math.round((hash2(gx, gy, 119) - 0.5) * 12);
      if (x < 0 || y < 0 || x >= BW || y >= BH || !m[y * BW + x]) continue;
      const fierce = vnoise(x, y, 125, 34), hole = vnoise(x, y, 127, 21); if (fierce < -0.35 || hole < -0.28 || hash2(x, y, 128) < 0.12) continue;
      const inner = core[y * BW + x], r = hash2(x, y, 120);
      const pick = (xx, yy, rr, deep) => rr < 0.2 && deep && fierce > 0.05 && ASSETS.vfx13.fire_ground_c ? 'fire_ground_c' : rr < 0.62 && deep ? 'fire_ground_a' : rr < 0.75 ? 'fire_ground_a' : 'fire_ground_b';
      const add = (xx, yy, k) => { if (xx < 0 || yy < 0 || xx >= BW || yy >= BH || !m[yy * BW + xx]) return; FIRE_PTS.push([xx, yy, Math.floor(hash2(xx, yy, 117) * 997), k, Math.floor(xx / CS) + ',' + Math.floor(yy / CS)]); };
      add(x, y, pick(x, y, r, inner));
      const extra = Math.floor(hash2(x, y, 122) * 3);   // 0, 1 or 2 licks beside the main flame
      for (let e = 0; e < extra; e++) add(x + Math.round((hash2(x, y, 123 + e) - 0.5) * 22), y + Math.round((hash2(x, y, 126 + e) - 0.5) * 12), 'fire_ground_b');
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
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) for (const [x, y, r, g2, b, ph, w, hh] of SPARK) { if ((Math.floor(clock / 380) + ph) % 4) continue; ctx.fillStyle = `rgb(${r},${g2},${b})`; ctx.fillRect(GX + x - cam.rx, GY + y - cam.ry, w, hh); }   // glints twinkle on a stepped clock, never a fade
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
