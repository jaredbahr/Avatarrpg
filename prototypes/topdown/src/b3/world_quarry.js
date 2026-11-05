// ---------- the quarry boards (tutorial pass): every pixel is classed from the authored rows, with the cell values blended between
// cell centres and broken by two octaves of value noise, so no edge follows the cell grid. Raised rock (the legend's elevation
// 1 and 2: ledges, terraces, the cut walls) is drawn with PixelLab's terrace set: its top texture on the shelf, its cut face
// hanging below the shelf's front edge (13 px a tier), a lit lip, a dark foot and a short cast to the lower right. The board
// sits on a mass of rock that ends in the rim cliff over the void; the road mouths run off the rim.
const Q_FACE = 13;
const qcell = (x, y) => {   // the authored character, extended past the board: a walkable edge cell carries on (an exit), the rest is rock
  const cx = Math.max(0, Math.min(GW - 1, x)), cy = Math.max(0, Math.min(GH - 1, y)), c = ROWS[cy][cx];
  if (x === cx && y === cy) return LEVEL_KEY === 'gate' && y === GH - 1 && (c === '#' || c === 'G') ? 'X' : c === 'o' && (ROWS[cy][Math.max(0, cx - 1)] === '=' || ROWS[cy][Math.min(GW - 1, cx + 1)] === '=') ? '=' : c;
  if (c === 'o' && (ROWS[cy][Math.max(0, cx - 1)] === '=' || ROWS[cy][Math.min(GW - 1, cx + 1)] === '=')) return '=';   // spilled oil lies on the road; it does not cut it
  const L = LEG(c); if (L.blocked || L.elev) return 'X';
  if (LV.ground === 'quarry' && LEVEL_KEY === 'road' && c === ',') return 'T';
  return c === '=' || c === '.' || c === ',' ? c : 'X';
};
function cellField(fn, wx, wy) {   // smoothstep-blended cell indicator at a world pixel
  const fx = (wx - GX) / CS - 0.5, fy = (wy - GY) / CS - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), sx0 = fx - ix, sy0 = fy - iy;
  const sx = sx0 * sx0 * (3 - 2 * sx0), sy = sy0 * sy0 * (3 - 2 * sy0);
  return fn(qcell(ix, iy)) * (1 - sx) * (1 - sy) + fn(qcell(ix + 1, iy)) * sx * (1 - sy) + fn(qcell(ix, iy + 1)) * (1 - sx) * sy + fn(qcell(ix + 1, iy + 1)) * sx * sy;
}
// the rock mass: an inset rectangle with soft organic bites, open where a road leaves the board
function inQMass(wx, wy) {
  const n = vnoise(wx, wy, 201, 30) * 14 + vnoise(wx, wy, 203, 9) * 7 + vnoise(wx, wy, 205, 17) * 9;
  const L = 18 + n, R = PW - 18 - n, Tp = 22 + n, B = PH - 46 + n;
  if (wy >= Tp && wy <= B && wx >= L && wx <= R) return true;
  // a road mouth: the road's own rows carry it out to the frame
  const cy = Math.floor((wy - GY) / CS);
  if (cy >= 0 && cy < GH && wy >= Tp && wy <= B) { const c = wx < L ? ROWS[cy][0] : ROWS[cy][GW - 1]; if (c === '=' || (LEVEL_KEY === 'road' && c === '.')) return true; }
  return false;
}
const tex = {};
function texData(key) {
  if (tex[key]) return tex[key];
  const im = IMG['q:' + key], c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  return (tex[key] = { d: x.getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height });
}
function sample(key, x, y) { const t = texData(key), i = (((y % t.h) + t.h) % t.h * t.w + (((x % t.w) + t.w) % t.w)) * 4; return [t.d[i], t.d[i + 1], t.d[i + 2]]; }
// polish pass: the shelf rock is not one tile repeated. A warped Voronoi quilt of ~60 px regions, each drawn from one of four plain rock
// tiles with its own flip, turn and offset; the region borders dither over 3 px, and a slow tone drift runs across several tiles
const ROCKN = 4;
function quilt(keys, x, y, R, sk) {   // keys: texture names; each region takes one, flipped/turned/offset at random
  const wx = x + vnoise(x, y, sk + 1, 22) * 18 + vnoise(x, y, sk + 2, 7) * 4, wy = y + vnoise(x, y, sk + 3, 22) * 18 + vnoise(x, y, sk + 4, 7) * 4;
  let best = 1e9, second = 1e9, bi = 0, bj = 0, sj = 0, sk2 = 0;
  const cx = Math.floor(wx / R), cy = Math.floor(wy / R);
  for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const gx = cx + j, gy = cy + k, px = (gx + 0.15 + hash2(gx, gy, sk + 11) * 0.7) * R, py = (gy + 0.15 + hash2(gx, gy, sk + 12) * 0.7) * R, d = (wx - px) ** 2 + (wy - py) ** 2;
    if (d < best) { second = best; sj = bi; sk2 = bj; best = d; bi = gx; bj = gy; } else if (d < second) { second = d; sj = gx; sk2 = gy; }
  }
  let gx = bi, gy = bj;
  if (Math.sqrt(second) - Math.sqrt(best) < 3 && hash2(x, y, sk + 13) < 0.5) { gx = sj; gy = sk2; }   // a dithered border
  const t = Math.floor(hash2(gx, gy, sk + 14) * keys.length), f = Math.floor(hash2(gx, gy, sk + 15) * 8), ox = Math.floor(hash2(gx, gy, sk + 16) * 32), oy = Math.floor(hash2(gx, gy, sk + 17) * 32);
  let u = (x + ox) & 31, v = (y + oy) & 31; if (f & 1) u = 31 - u; if (f & 2) v = 31 - v; if (f & 4) { const q = u; u = v; v = q; }
  return sample(keys[t], u, v);
}
const ROCK_KEYS = ['rock0', 'rock1', 'rock2', 'rock3'];
function rockTop(x, y) {
  const c = quilt(ROCK_KEYS, x, y, 58, 300), b = 1 + vnoise(x, y, 321, 70) * 0.12 + vnoise(x, y, 322, 24) * 0.05;
  return c.map(a => Math.max(0, Math.min(255, a * b)));
}
// the sand: one plain tile, quilted the same way, with a slow warm/cool drift and pale dust drifts over tens of tiles
function sandFloor(x, y) {
  const c = quilt(['floor'], x, y, 74, 400), n1 = vnoise(x, y, 421, 90), n2 = vnoise(x, y, 422, 34), dust = vnoise(x, y, 423, 26) > 0.42 ? 1.045 : 1;
  const warm = 0.012 + n1 * 0.016 + n2 * 0.008, b = (1 + n1 * 0.04 + n2 * 0.025) * dust;
  return [c[0] * b * (1 + warm), c[1] * b, c[2] * b * (1 - warm * 1.6)].map(a => Math.max(0, Math.min(255, a)));
}
// road stubs that end inside the board: { side, xEnd, yc, half } in px (left or right edge, the road's last cell column, its rows)
function roadStubs() {
  const out = []; if (LEVEL_KEY === 'road') return out;
  for (const side of [0, 1]) {
    const R = ch => ch === '=' || ch === 'o', end = r => { const row = ROWS[r]; if (side === 0) { if (!R(row[0])) return -1; let e = 0; while (e + 1 < GW && R(row[e + 1])) e++; return e >= GW - 1 ? -1 : e; } if (!R(row[GW - 1])) return -1; let e = GW - 1; while (e - 1 >= 0 && R(row[e - 1])) e--; return e <= 0 ? -1 : e; };
    let y = 0; while (y < GH) { const e0 = end(y); if (e0 < 0) { y++; continue; } let y1 = y; while (y1 + 1 < GH && end(y1 + 1) === e0) y1++;
      const sideCol = side ? e0 : e0, adj = (y > 0 && ROWS[y - 1][sideCol] === '=') || (y1 < GH - 1 && ROWS[y1 + 1][sideCol] === '=');   // a band beside more road is not an end
      if (!adj) out.push({ side, xEnd: side ? GX + e0 * CS : GX + (e0 + 1) * CS, yc: GY + (y + y1 + 1) * CS / 2, half: (y1 - y + 1) * CS / 2 }); y = y1 + 1; }
  }
  return out;
}
const STUBS = roadStubs();
function stubTip(x, y) {   // > 0 where a stub's end should round off into a tongue
  let t = 0;
  for (const b of STUBS) { const L = 70, u = b.side ? ((b.xEnd - x) < L ? 1 - (x - (b.xEnd - L)) / L : -1) : 0; const dx = b.side ? (b.xEnd - x) : (x - b.xEnd);
    const f = (dx + L) / L; if (f <= 0.35) continue; const v = Math.abs(y - b.yc) / b.half; t = Math.max(t, (Math.min(1.2, f) - 0.35) * 0.55 + Math.max(0, v - 0.45) * (f - 0.35) * 1.6 - 0.0); }
  return t;
}
function bakeQuarry() {
  const g = ground.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
  const id = g.createImageData(PW, PH), d = id.data, lev = new Int8Array(PW * PH), cls = new Uint8Array(PW * PH);   // cls: 0 floor 1 road 2 water 3 pit 4 grass 5 rock-top 6 face 9 void
  const nv = (x, y) => vnoise(x, y, 211, 17) * 0.24 + vnoise(x, y, 212, 7) * 0.16 + vnoise(x, y, 213, 3) * 0.07;
  const nvar = ASSETS.qtiles_nvar || 0;
  // 1. levels and classes
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const i = y * PW + x;
    if (!inQMass(x, y)) { lev[i] = -1; cls[i] = 9; continue; }
    const n = nv(x, y), h1 = cellField(c => (LEG(c).elev >= 1 ? 1 : 0), x, y) + n, h2 = cellField(c => (LEG(c).elev >= 2 ? 1 : 0), x, y) + n;
    lev[i] = h2 > 0.5 ? 2 : h1 > 0.5 ? 1 : 0;
    if (lev[i]) { cls[i] = 5; continue; }
    const m = vnoise(x, y, 221, 19) * 0.26 + vnoise(x, y, 222, 8) * 0.16 + vnoise(x, y, 223, 3) * 0.07;
    const fp = cellField(c => (c === 'P' ? 1 : 0), x, y), fw = cellField(c => (c === 'W' || c === '~' ? 1 : 0), x + Math.round(vnoise(y, 3, 224, 17) * 10), y + Math.round(vnoise(x, 4, 225, 17) * 8));
    if (fp > 0.08 && fp + m * 1.4 > 0.62) cls[i] = 3;          // only near a pit or a pool: the noise alone never opens a speck of either
    else if (fw > 0.08 && fw + m * 1.7 > 0.55) cls[i] = 2;
    else {   // v3: the strongest of road, grass and floor wins (no band of a third ground between two others)
      const fr = cellField(c => (c === '=' ? 1 : 0), x + Math.round(vnoise(y, 5, 228, 26) * 13 + vnoise(y, 6, 230, 8) * 4), y + Math.round(vnoise(x, 7, 227, 36) * 14 + vnoise(x, 8, 226, 13) * 5)) + m * 1.7 - stubTip(x, y), fg = (gf => (gf > 0.03 || cellField(c => (c === '~' || c === 'W' ? 1 : 0), x, y) > 0.03 ? gf - m : -9))(cellField(c => (c === ',' || c === 'T' ? 1 : 0), x, y)), ff = cellField(c => (c !== '=' && c !== ',' && c !== 'T' && c !== '~' && c !== 'W' && !LEG(c).elev ? 1 : 0), x, y) + vnoise(x, y, 229, 13) * 0.2;
      cls[i] = fr >= fg && fr >= ff ? 1 : fg >= ff ? 4 : 0;
    }
  }
  // 2. the cut faces: below a higher shelf, Q_FACE px a tier (the face belongs to the shelf above it)
  const face = new Uint8Array(PW * PH), faceH = new Uint8Array(PW * PH);
  for (let x = 0; x < PW; x++) for (let y = 1; y < PH; y++) {
    const i = y * PW + x; if (lev[i] < 0) continue;
    for (let k = 1; k <= 2 * Q_FACE + 3 && y - k >= 0; k++) {
      const up = lev[(y - k) * PW + x]; if (up <= lev[i]) { if (face[(y - k) * PW + x]) continue; else break; }
      const F = (up - lev[i]) * Q_FACE + Math.round(vnoise(x, y - k, 231, 6) * 2);
      if (k <= F) { face[i] = k; faceH[i] = F; } break;
    }
  }
  // 3. paint
  const fl = () => 'floor';   // v3: no per-tile variants on the floor (they read as square patches); the grit below breaks it up instead
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const i = y * PW + x; let c;
    if (cls[i] === 9) {   // the void, and the rim's face where the mass ends above it
      let k = 0; while (k < 40 && y - k - 1 >= 0 && cls[(y - k - 1) * PW + x] === 9) k++;
      const above = y - k - 1 >= 0 ? cls[(y - k - 1) * PW + x] : 9;
      if (above !== 9 && k < 34) { c = sample('rim', x, Math.min(40, k)); const f = 1 - k / 40; c = c.map((v, j) => v * f + [20, 14, 17][j] * (1 - f)); }
      else c = [27, 20, 23];
    } else if (face[i]) {
      const k = face[i], F = faceH[i]; c = sample('face', x, Math.max(0, 41 - (F - k)));   // the strip ends on the set's own foot line
      const sh = 1 - 0.22 * k / F; c = c.map(v => v * sh);
      if (k === 1) c = c.map(v => Math.min(255, v * 1.22 + 10));         // the lit lip
      if (k === F) c = c.map((v, j) => v * 0.55 + [0x32, 0x21, 0x25][j] * 0.45);   // the foot's occlusion line
    } else if (cls[i] === 5) c = rockTop(x, y);
    else if (cls[i] === 1) c = quilt(['road'], x, y, 70, 440).map((a, j) => a * (1 + vnoise(x, y, 441, 60) * 0.07));
    else if (cls[i] === 2) c = sample('water', x, y);
    else if (cls[i] === 4) c = vnoise(x, y, 41, 46) + vnoise(x, y, 43, 9) * 0.25 > 0.98 ? sample('grass', x, y) : sample(hash2(Math.floor(x / T), Math.floor(y / T), 245) < 0.5 ? 'moss0' : 'moss1', x, y);
    else if (cls[i] === 3) { const r = vnoise(x, y, 251, 5); c = r > 0.3 ? [40, 30, 32] : [27, 20, 23]; }
    else { c = sandFloor(x, y); }
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
  }
  // 3b. polish pass: the road frays into the sand (worn ground a few px further out, in specks, never a line) and, where a stub
  // ends inside the board, its two wheel ruts carry on a short way, fading
  { const RAD = 9, tmp = new Float32Array(PW * PH), fld = new Float32Array(PW * PH);
    for (let y = 0; y < PH; y++) { let acc = 0; for (let x = -RAD; x < PW; x++) { if (x + RAD < PW) acc += cls[y * PW + x + RAD] === 1 ? 1 : 0; if (x - RAD - 1 >= 0) acc -= cls[y * PW + x - RAD - 1] === 1 ? 1 : 0; if (x >= 0) tmp[y * PW + x] = acc / (2 * RAD + 1); } }
    for (let x = 0; x < PW; x++) { let acc = 0; for (let y = -RAD; y < PH; y++) { if (y + RAD < PH) acc += tmp[(y + RAD) * PW + x]; if (y - RAD - 1 >= 0) acc -= tmp[(y - RAD - 1) * PW + x]; if (y >= 0) fld[y * PW + x] = acc / (2 * RAD + 1); } }
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const i = y * PW + x; if (cls[i] !== 0 || face[i] || fld[i] < 0.03) continue;
      if (hash2(x, y, 461) < fld[i] * 1.1 + vnoise(x, y, 462, 5) * 0.2 - 0.05) { const c = quilt(['road'], x, y, 70, 440); const a = 0.8; d[i * 4] = d[i * 4] * (1 - a) + c[0] * a; d[i * 4 + 1] = d[i * 4 + 1] * (1 - a) + c[1] * a; d[i * 4 + 2] = d[i * 4 + 2] * (1 - a) + c[2] * a; cls[i] = 0; } }
    for (const bd of STUBS) {
      const dir = bd.side ? -1 : 1, yr = Math.round(bd.yc); let x0 = bd.side ? PW - 1 : 0; while (x0 >= 0 && x0 < PW && cls[yr * PW + x0] !== 1) x0 += dir; while (x0 >= 0 && x0 < PW && cls[yr * PW + x0] === 1) x0 += dir;
      for (const off of [-8, 8]) { let yy = bd.yc + off; for (let s = 0; s < 130; s++) { const x = x0 + dir * (s + 6); yy += vnoise(s, off, 471, 14) * 0.4; const Y = Math.round(yy);
        if (x < 2 || x >= PW - 2) break; if ((s % 17) > 12 - Math.floor(s / 22) || hash2(s, off, 472) < s / 150) continue;
        for (let h = 0; h < 2; h++) { const i = (Y + h) * PW + x; if (face[i] || cls[i] === 1 || cls[i] === 9) continue; const m = h ? 0.7 : 0.8; d[i * 4] *= m; d[i * 4 + 1] *= m * 0.95; d[i * 4 + 2] *= m * 0.84; } } }
    }
  }
  // 4. edges: a shelf's sides (dark on the right, lit on the left), the cast of a face and a right side on the lower ground,
  // the floor darkening into the road's verge and the grass edge, the pit's lip
  const mix = (i, col, a) => { for (let k = 0; k < 3; k++) d[i * 4 + k] = d[i * 4 + k] * (1 - a) + col[k] * a; };
  const SH = [0x32, 0x21, 0x25];
  for (let y = 1; y < PH - 1; y++) for (let x = 2; x < PW - 2; x++) {
    const i = y * PW + x; if (cls[i] === 9 || face[i]) continue; const L = lev[i];
    if (lev[i - 1] > L && !face[i - 1]) mix(i, SH, 0.5); else if (lev[i - 2] > L && !face[i - 2]) mix(i, SH, 0.3);    // the shelf's right side, in shade
    if (lev[i + 1] > L && !face[i + 1]) mix(i, [246, 238, 214], 0.18);                                                 // its left side, lit
    if (lev[i] > 0 && lev[i + 1] < L && !face[i + 1]) mix(i, SH, 0.25);
    // the cast: a short band to the lower right of every face foot and every right side (hard edge, ART_DIRECTION §2)
    let cast = false;
    for (let k = 1; k <= 6 && !cast; k++) { const j = (y - k) * PW + (x - Math.round(k * 0.6)); if (j > 0 && face[j] && face[j] === faceH[j]) cast = true; }
    for (let k = 1; k <= 5 && !cast; k++) { const j = (y - Math.round(k * 0.4)) * PW + x - k; if (j > 0 && lev[j] > L && !face[j]) cast = true; }
    if (cast) mix(i, SH, cls[i] === 1 || cls[i] === 0 ? 0.42 : 0.36);
    if (cls[i] === 0 && (cls[i - 1] === 1 || cls[i + 1] === 1 || cls[i - PW] === 1 || cls[i + PW] === 1)) mix(i, [90, 61, 43], 0.28);
    if (cls[i] === 0 && (cls[i - 1] === 4 || cls[i + 1] === 4 || cls[i - PW] === 4 || cls[i + PW] === 4)) mix(i, SH, 0.22);
    if (cls[i] !== 3 && (cls[i + PW] === 3 || cls[i - 1] === 3)) mix(i, SH, 0.55);
    if (cls[i] === 2 && (cls[i - PW] !== 2 || cls[i - 1] !== 2)) mix(i, SH, 0.45);                                    // the pool's bank throws a dark lip
    if (cls[i] !== 2 && cls[i] !== 9 && !lev[i] && (cls[i + PW] === 2 || cls[i + 1] === 2 || cls[i - 1] === 2 || cls[i - PW] === 2)) mix(i, [58, 46, 44], 0.5);   // wet ground at the edge
  }
  g.putImageData(id, 0, 0);
  // grass tufts creeping onto the road and the gravel
  for (let k = 0; k < 1400; k++) {
    const x = 2 + Math.floor(hash2(k, 1, 271) * (PW - 4)), y = 2 + Math.floor(hash2(k, 2, 271) * (PH - 4)), i = y * PW + x;
    if (!(cls[i] === 1 || cls[i] === 0) || ![-2, 2].some(o => cls[i + o] === 4 || cls[i + o * PW] === 4)) continue;
    for (let b = 0; b < 3; b++) { const len = 2 + Math.floor(hash2(k, b, 272) * 3), lean = b - 1; for (let s = 0; s < len; s++) { g.fillStyle = s >= len - 1 ? GR[4] : GR[2]; g.fillRect(x + Math.round(lean * s * 0.5), y + 1 - s, 1, 1); } }
  }
  // polish pass: sparse hairline cracks, scree chips and the odd dry tuft on the shelf rock (each on its own spot, never a lattice)
  for (let gy = 0; gy < PH / 70; gy++) for (let gx = 0; gx < PW / 70; gx++) {
    if (hash2(gx, gy, 331) > 0.55) continue;
    let x = Math.floor((gx + hash2(gx, gy, 332)) * 70), y = Math.floor((gy + hash2(gx, gy, 333)) * 70), ang = hash2(gx, gy, 334) * 6.283;
    const len = 12 + Math.floor(hash2(gx, gy, 335) * 22);
    for (let s = 0; s < len; s++) {
      ang += (hash2(gx, s, 336) - 0.5) * 0.9; x += Math.cos(ang) * 1.2; y += Math.sin(ang) * 1.2; const X = Math.round(x), Y = Math.round(y), i = Y * PW + X;
      if (X < 1 || Y < 1 || X >= PW - 1 || Y >= PH - 1 || cls[i] !== 5 || face[i]) break;
      g.fillStyle = s > len - 4 ? '#6f666b' : '#4f464c'; g.fillRect(X, Y, 1, 1); if (s % 5 === 2) { g.fillStyle = '#9d979a'; g.fillRect(X + 1, Y + 1, 1, 1); }
    }
  }
  for (let k = 0; k < 420; k++) {
    const x = 3 + Math.floor(hash2(k, 1, 341) * (PW - 6)), y = 3 + Math.floor(hash2(k, 2, 341) * (PH - 6)), i = y * PW + x; if (cls[i] !== 5 || face[i] || face[i - PW * 3]) continue;
    const sz = hash2(k, 3, 341), grp = sz < 0.3 ? 3 : 1;   // a few scree chips, each with its dark foot and a pale top
    for (let c = 0; c < grp; c++) { const cx = x + Math.round((hash2(k, c, 342) - 0.5) * 8), cy = y + Math.round((hash2(k, c, 343) - 0.5) * 5), w = 2 + (hash2(k, c, 344) < 0.4 ? 1 : 0);
      g.fillStyle = '#4a4147'; g.fillRect(cx, cy + 1, w + 1, 1); g.fillStyle = '#6b6469'; g.fillRect(cx, cy, w, 1); g.fillStyle = '#b4aeab'; g.fillRect(cx, cy - 1, w - 1, 1); }
  }
  for (let k = 0; k < 150; k++) {   // loose stones, 4-6 px, each with a pale lit top-left, a dark right side and a hard foot
    const x = 4 + Math.floor(hash2(k, 1, 361) * (PW - 8)), y = 6 + Math.floor(hash2(k, 2, 361) * (PH - 12)), i = y * PW + x; if (cls[i] !== 5 || face[i] || face[i - PW * 4] || cls[i + PW * 3] !== 5) continue;
    const w = 3 + Math.floor(hash2(k, 3, 361) * 3), h = w - 1;
    g.fillStyle = '#322125'; g.fillRect(x + 1, y + h, w, 1); g.fillStyle = '#6a6368'; g.fillRect(x, y, w, h); g.fillStyle = '#4f484e'; g.fillRect(x + w - 1, y, 1, h); g.fillStyle = '#aaa5a6'; g.fillRect(x, y, w - 1, 1);
  }
  for (let k = 0; k < 26; k++) {   // a dry tuft: three blades in the old shelf tone
    const x = 4 + Math.floor(hash2(k, 1, 351) * (PW - 8)), y = 6 + Math.floor(hash2(k, 2, 351) * (PH - 12)), i = y * PW + x; if (cls[i] !== 5 || face[i] || cls[i + PW * 3] !== 5) continue;
    for (let b = -1; b <= 1; b++) { const len = 3 + Math.floor(hash2(k, b, 352) * 3); for (let s = 0; s < len; s++) { g.fillStyle = s === len - 1 ? '#c98f3e' : '#8d6b3a'; g.fillRect(x + b + Math.round(b * s * 0.4), y - s, 1, 1); } }
    g.fillStyle = '#4a4147'; g.fillRect(x - 1, y + 1, 3, 1);
  }
  // pale grit and chips scattered over the floor, densest under the faces (ART_DIRECTION §4: detail near walls, calm centre)
  for (let k = 0; k < 2600; k++) {
    const x = Math.floor(hash2(k, 5, 281) * PW), y = Math.floor(hash2(k, 6, 281) * PH), i = y * PW + x; if (cls[i] !== 0 || face[i]) continue;
    let near = 0; for (let q = 1; q < 14; q++) if (face[(y - q) * PW + x] || lev[(y - q) * PW + x] > 0) { near = q; break; }
    if (!near && hash2(k, 7, 281) < 0.8) continue;
    const big = hash2(k, 8, 281) < 0.25; g.fillStyle = '#5d5b63'; g.fillRect(x, y + 1, big ? 3 : 2, 1); g.fillStyle = hash2(k, 9, 281) < 0.5 ? '#e8d8b0' : '#aea89c'; g.fillRect(x, y, big ? 2 : 1, 1);
  }
  return { lev, cls, face };
}
// ---------- what stands on a quarry board: the authored blocked cells get their structures, the props their sprites, and the
// edges their dressing (scaffolds against the faces, the barred galleries, rails, the crew's tools)
const PROP_SPRITE = { water_barrel: 'rain_barrel', oil_flask: 'oil_flask', hay_bale: 'hay_bale', brazier: 'brazier', cabbage_cart: 'cabbage_cart', rubble_pile: 'lime_boulder' };
function placeProps() {
  const out = [];
  for (const [id, x, y, flag] of LV.props || []) {
    if (flag && !FLAGS[flag]) continue;
    const blocks = PROPS[id].blocks, ob = put(PROP_SPRITE[id], cellX(x), cellY(y) + (id === 'oil_flask' ? 2 : 4), blocks ? { cell: [x, y] } : {});
    out.push({ id, x, y, ob });
  }
  return out;
}
function placeQuarry() {
  const PINES = ['pine_a', 'pine_b', 'pine_c', 'pine_a', 'pine_b'];
  const wallRun = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const c = ROWS[y][x], bx = cellX(x), by = GY + y * CS + CS - 3;
    if (c === 'T') { if (y === GH - 1 && hash2(x, y, 9) < 0.3) { put('bush_dark', bx + Math.round((hash2(x, y, 3) - 0.5) * 16), by + 2, { cell: [x, y] }); continue; }
      put(PINES[Math.floor(hash2(x, y, 8) * PINES.length)], bx + Math.round((hash2(x, y, 3) - 0.5) * 22), by - 4 + Math.round(hash2(x, y, 4) * 14), { kind: 'tree', cell: [x, y] }); }
    if (c === '#' && LEVEL_KEY === 'gate' && (y === 0)) wallRun.push(x);
    if (c === '#' && LEVEL_KEY === 'gate' && y > 0 && y < GH - 1) put(y < 6 ? (x === 9 || x === 12 ? 'oil_barrels' : 'scaffold') : ({ 4: 'stone_blocks', 9: 'lime_boulder', 12: 'minecart', 17: 'stone_blocks' })[x], bx, by, { cell: [x, y] });
    if (c === '#' && LEVEL_KEY === 'floor') put('lime_boulder', bx, by, { cell: [x, y] });
    if (c === 'c') put('crates', bx, by, { cell: [x, y] });
    if (c === 'r' || c === 'R') put('lime_rubble', bx + Math.round((hash2(x, y, 7) - 0.5) * 8), by - 4, { flat: false });
  }
  if (LEVEL_KEY === 'gate') {
    // the curtain wall along the north edge (rows 0: '######GG######'), the gatehouse in its middle, barrels against it
    for (const x of wallRun) put(x % 3 === 1 ? 'qwall_b' : 'qwall', cellX(x) + 6, GY + CS - 2, {});
    put('gatehouse', GX + 11 * CS, GY + CS + 2, {});
    put('lamp', cellX(5) + 2, GY + 10 * CS + 30, { cell: [5, 10] }); put('signpost', cellX(1), GY + 3 * CS - 6, {});
    put('lime_rubble', cellX(7), GY + 11 * CS + 26, {}); put('lime_boulder', cellX(14) + 6, GY + 11 * CS + 30, {});
  }
  if (LEVEL_KEY === 'cutting') {
    put('scaffold', cellX(10) + 2, GY + 3 * CS + 30, { cell: [10, 3] }); put('tool_rack', cellX(9), GY + 9 * CS - 4, {});
    put('stone_blocks', cellX(11) + 8, GY + 8 * CS + 36, { cell: [11, 8] }); put('minecart', cellX(8) - 6, GY + 2 * CS + 34, { cell: [7, 2] });
    put('lime_boulder', cellX(12), GY + 2 * CS + 34, { cell: [12, 2] });
  }
  if (LEVEL_KEY === 'floor') {
    // the drill shaft (P) under its headframe; the barred galleries in the north and south faces (quarry_descent: "the gallery
    // entrances have been barred with timber"); rails and a cart along the north terrace; the crew's tools; the driller's junk
    put('headframe', GX + 19 * CS - 4, GY + 8 * CS + 2, {});   // its legs on the floor at the shaft's south lip, not in the dark
    for (const x of [5, 13]) put('gallery_door', cellX(x), GY + CS + 4, {});
    put('rails', cellX(9), GY + 2 * CS + 12, { flat: true }); put('rails', cellX(9) + 62, GY + 2 * CS + 12, { flat: true });
    put('minecart', cellX(10) + 4, GY + 2 * CS + 6, {});
    put('drill_junk', cellX(14) + 6, GY + 8 * CS + 34, { flat: false }); put('tool_rack', cellX(2) + 4, GY + 2 * CS + 4, {});
    put('stone_blocks', cellX(17) + 6, GY + 9 * CS + 2, {}); put('scaffold', cellX(3), GY + 10 * CS + 4, {});
  }
  if (LEVEL_KEY === 'road') {
    put('milestone', cellX(2), GY + 8 * CS + 30, { cell: [2, 8] }); put('cart_wheel', cellX(12), GY + 10 * CS + 28, { cell: [12, 10] });
    put('signpost', cellX(8), GY + 7 * CS + 32, { cell: [8, 7] }); put('stone_blocks', cellX(16), GY + 1 * CS + 32, { cell: [16, 1] });
    put('lime_boulder', cellX(13), GY + 5 * CS + 32, { cell: [13, 5] }); put('log', cellX(5), GY + 10 * CS + 30, { cell: [5, 10] });
    for (const [x, y] of [[3, 3], [7, 4], [12, 7], [2, 6], [17, 7], [6, 8]]) put(hash2(x, y, 1) < 0.5 ? 'tuft' : 'flowers', cellX(x), cellY(y) + 6, { flat: true });
  }
  dressPlateaus();
  // the pines beyond a forest edge in the margins (road only: the quarry is bare rock)
  if (LEVEL_KEY === 'road') for (let i = 0; i < 2; i++) for (let x = -10; x < GX + 9 * CS; x += 34 + Math.round(hash2(i, x, 5) * 16)) put(PINES[(x + i * 3) % PINES.length], x, GY - 10 - i * 46 - Math.round(hash2(x, i, 6) * 20), { kind: 'tree' });
  if (LEVEL_KEY === 'road') for (let y = 0; y < GH; y++) { if (ROWS[y][0] !== 'T') continue; put(PINES[(y * 7) % PINES.length], 40 + Math.round(hash2(y, 1, 7) * 20), GY + y * CS + CS - 2, { kind: 'tree' }); }
}
// polish pass: the big rock plateaus get a little sparse dressing (PixelLab scree heaps, a few dead shrubs, a loose rubble heap), each on its own
// spot well inside the plateau and away from every other object, grounded like any prop
function dressPlateaus() {
  const rockCell = (cx, cy) => (cx < 0 || cy < 0 || cx >= GW || cy >= GH ? qcell(cx, cy) === 'X' : LEG(ROWS[cy][cx]).elev > 0 && !LEG(ROWS[cy][cx]).ramp);
  const inside = (px, py) => { const cx = Math.floor((px - GX) / CS), cy = Math.floor((py - GY) / CS); for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) if (!rockCell(cx + j, cy + k)) return false; return inQMass(px - 40, py - 22) && inQMass(px + 40, py + 40); };
  let shrubs = 0, n = 0;
  for (let k = 0; k < 400 && n < 15; k++) {
    const px = 30 + Math.floor(hash2(k, 1, 501) * (PW - 60)), py = 40 + Math.floor(hash2(k, 2, 501) * (PH - 120)); if (!inside(px, py)) continue;
    if (OBJ.some(o => Math.hypot(o.x + o.w / 2 - px, o.base - py) < 95)) continue;
    const r = hash2(k, 3, 501), key = r < 0.22 && shrubs < 5 ? 'dead_shrub' : r < 0.3 ? 'lime_rubble' : 'scree';
    if (key === 'dead_shrub') shrubs++;
    put(key, px, py, { flip: hash2(k, 4, 501) < 0.5 }); n++;
  }
}
// every object's own shadow on the floor (the ported grounding.js), grass kits on grass, the floor reaction on hard ground
function groundObjects(QB) {
  const g = ground.getContext('2d', { willReadFrequently: true });
  for (const o of OBJ) if (o.flat) { const im = IMG['ob:' + o.k], m = hardShadowMask(alphaOf(im), im.width, im.height, { flat: true, band: 3 }); paintMask(g, m, o.x - m.pad, o.y, 1.3); g.drawImage(im, o.x, o.y); }
  for (const o of OBJ) {
    if (o.flat) continue;
    const img = IMG['ob:' + o.k], ow8 = Math.max(8, Math.round(img.width * 0.15));
    const opts = o.kind === 'tree' ? { dir: { x: 0.42, y: 0.3 }, foot: 8, sweep: 1, reach: Math.min(52, Math.max(12, Math.round(img.height * 0.32))) } : { overhang: ow8, band: img.height > 50 ? 6 : undefined };
    const m = hardShadowMask(alphaOf(img), img.width, img.height, opts);
    const ix = Math.max(0, Math.min(PW - 1, o.x + (o.w >> 1))), iy = Math.min(PH - 1, o.base - 2), under = QB.cls[iy * PW + ix];
    SHADOW_LOG.push({ o, m, dx: o.x - m.pad, dy: o.y });
    if (under === 4) { const kit = groundKit(img, o.x * 7 + o.base, { tall: o.kind === 'tree' ? 7 : 5 }); if (kit) { g.drawImage(kit.contact, o.x - kit.m, o.y - kit.m); FRINGE.push([o, kit]); } paintMask(g, m, o.x - m.pad, o.y, 1.45); }   // the dark moss needs the deeper notch to read 25%
    else { paintMask(g, m, o.x - m.pad, o.y, 1.3); floorReaction(g, m, o.x - m.pad, o.y, o.x * 31 + o.base); }
  }
}
const SHADOW_LOG = [];

// ---------- the measurable checks (tutorial pass), run from tools/t13checks.js
// (A) shadow contrast: each object's visible shadow (mask pixels not under any sprite) against open ground 5-6 px beyond it
function shadowTableQ() {
  const d = ground.getContext('2d').getImageData(0, 0, PW, PH).data, cover = new Uint8Array(PW * PH), shad = new Uint8Array(PW * PH);
  for (const o of OBJ) { if (o.flat) continue; const A = alphaOf(IMG['ob:' + o.k]); for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (A[y * o.w + x]) { const X = o.x + x, Y = o.y + y; if (X >= 0 && Y >= 0 && X < PW && Y < PH) cover[Y * PW + X] = 1; } }
  for (const { m, dx, dy } of SHADOW_LOG) for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.alpha[y * m.width + x] >= 120) { const X = dx + x, Y = dy + y; if (X >= 0 && Y >= 0 && X < PW && Y < PH) shad[Y * PW + X] = 1; }
  const lum = i => 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return SHADOW_LOG.map(({ o, m, dx, dy }) => {
    let s = 0, n = 0, rs = 0, rn = 0; const mine = [];
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.alpha[y * m.width + x] >= 120) { const X = dx + x, Y = dy + y; if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue; const i = Y * PW + X; mine.push(i); if (!cover[i]) { s += lum(i); n++; } }
    for (const i of mine) { const X = i % PW, Y = (i / PW) | 0; for (const [ex, ey] of [[6, 0], [-6, 0], [0, 6], [0, -6], [5, 5], [-5, 5]]) { const X2 = X + ex, Y2 = Y + ey; if (X2 < 0 || Y2 < 0 || X2 >= PW || Y2 >= PH) continue; const j = Y2 * PW + X2; if (!cover[j] && !shad[j]) { rs += lum(j); rn++; } } }
    const sl = n ? s / n : 0, rl = rn ? rs / rn : 0;
    return { k: o.k, x: o.x + (o.w >> 1), y: o.base, visible: n, shadow: +sl.toFixed(1), ground: +rl.toFixed(1), darker: rl ? +(1 - sl / rl).toFixed(3) : 0 };
  });
}
// (D) straight edges: the longest run of terrain boundary that stays on one pixel row or column (ground classes and shelf levels)
function edgeRunsQ() {
  const C = QB.cls, Lv = QB.lev, key = i => C[i] * 4 + Lv[i] + 1; let best = { len: 0 };
  for (const horiz of [true, false]) {
    const A = horiz ? PH : PW, B = horiz ? PW : PH;
    for (let a = 1; a < A - 1; a++) { let run = 0;
      for (let b = 0; b < B; b++) {
        const i = horiz ? a * PW + b : b * PW + a, j = horiz ? (a + 1) * PW + b : b * PW + a + 1;
        if (C[i] !== 9 && C[j] !== 9 && key(i) !== key(j)) { run++; if (run > best.len) best = { len: run, at: horiz ? [b - run + 1, a] : [a, b - run + 1], horiz }; } else run = 0;
      } }
  }
  return { longestPx: best.len, tiles: +(best.len / T).toFixed(2), at: best.at, horizontal: best.horiz };
}
// (E) polish pass: how straight the boundary LOOKS. Boundaries are traced as chains of per-column (and per-row) crossings; the longest
// stretch of a chain whose position stays within 3 px counts as one straight edge. v1's exact-pixel-run count missed a stepped but ruler-straight edge.
function straightQ() {
  const C = QB.cls, Lv = QB.lev, key = i => (C[i] === 9 ? 99 : C[i] * 4 + Lv[i] + 1); let best = { len: 0 };
  for (const horiz of [true, false]) {
    const A = horiz ? PW : PH, B = horiz ? PH : PW, at = (a, b) => horiz ? b * PW + a : a * PW + b;   // a runs along the edge, b across it
    let chains = [];   // { b: last position, from, hist: [b per a] }
    for (let a = 0; a < A; a++) {
      const cross = []; for (let b = 1; b < B - 1; b++) if (key(at(a, b)) !== key(at(a, b + 1))) cross.push(b);
      const next = [];
      for (const b of cross) { let ch = chains.find(c => !c.used && Math.abs(c.b - b) <= 2); if (ch) { ch.used = true; ch.b = b; ch.hist.push(b); next.push(ch); } else next.push({ b, from: a, hist: [b], used: true }); }
      for (const c of chains) if (!c.used) { const h = c.hist; for (let i = 0; i < h.length; i++) { let lo = h[i], hi = h[i], j = i; while (j + 1 < h.length && Math.max(hi, h[j + 1]) - Math.min(lo, h[j + 1]) <= 3) { j++; lo = Math.min(lo, h[j]); hi = Math.max(hi, h[j]); } if (j - i + 1 > best.len) best = { len: j - i + 1, at: horiz ? [c.from + i, h[i]] : [h[i], c.from + i], horiz }; } }
      for (const c of next) c.used = false; chains = next;
    }
    for (const c of chains) { const h = c.hist; for (let i = 0; i < h.length; i++) { let lo = h[i], hi = h[i], j = i; while (j + 1 < h.length && Math.max(hi, h[j + 1]) - Math.min(lo, h[j + 1]) <= 3) { j++; lo = Math.min(lo, h[j]); hi = Math.max(hi, h[j]); } if (j - i + 1 > best.len) best = { len: j - i + 1, at: horiz ? [c.from + i, h[i]] : [h[i], c.from + i], horiz }; } }
  }
  return { straightPx: best.len, tiles: +(best.len / T).toFixed(2), at: best.at, horizontal: best.horiz };
}
let QB = null;
