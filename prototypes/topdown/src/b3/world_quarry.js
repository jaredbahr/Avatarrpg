// ---------- the quarry boards (tutorial pass): every pixel is classed from the authored rows, with the cell values blended between
// cell centres and broken by two octaves of value noise, so no edge follows the cell grid. Raised rock (the legend's elevation
// 1 and 2: ledges, terraces, the cut walls) is drawn with PixelLab's terrace set: its top texture on the shelf, its cut face
// hanging below the shelf's front edge (13 px a tier), a lit lip, a dark foot and a short cast to the lower right. The board
// sits on a mass of rock that ends in the rim cliff over the void; the road mouths run off the rim.
const Q_FACE = 13;
const qcell = (x, y) => {   // the authored character, extended past the board: a walkable edge cell carries on (an exit), the rest is rock
  const cx = Math.max(0, Math.min(GW - 1, x)), cy = Math.max(0, Math.min(GH - 1, y)), c = ROWS[cy][cx];
  if (x === cx && y === cy) return LEVEL_KEY === 'gate' && y === GH - 1 && (c === '#' || c === 'G') ? 'X' : c;
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
  const n = vnoise(wx, wy, 201, 30) * 14 + vnoise(wx, wy, 203, 9) * 5;
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
    const fp = cellField(c => (c === 'P' ? 1 : 0), x, y), fw = cellField(c => (c === 'W' || c === '~' ? 1 : 0), x, y);
    if (fp > 0.08 && fp + m * 1.4 > 0.62) cls[i] = 3;          // only near a pit or a pool: the noise alone never opens a speck of either
    else if (fw > 0.08 && fw + m * 1.7 > 0.55) cls[i] = 2;
    else {   // v3: the strongest of road, grass and floor wins (no band of a third ground between two others)
      const fr = cellField(c => (c === '=' ? 1 : 0), x, y + Math.round(vnoise(x, 7, 227, 40) * 9)) + m * 1.25, fg = cellField(c => (c === ',' || c === 'T' ? 1 : 0), x, y) - m, ff = cellField(c => (c !== '=' && c !== ',' && c !== 'T' && c !== '~' && c !== 'W' && !LEG(c).elev ? 1 : 0), x, y) + vnoise(x, y, 229, 13) * 0.2;
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
    } else if (cls[i] === 5) c = sample('top', x, y);
    else if (cls[i] === 1) c = sample('road', x, y);
    else if (cls[i] === 2) c = sample('water', x, y);
    else if (cls[i] === 4) c = vnoise(x, y, 41, 46) + vnoise(x, y, 43, 9) * 0.25 > 0.98 ? sample('grass', x, y) : sample(hash2(Math.floor(x / T), Math.floor(y / T), 245) < 0.5 ? 'moss0' : 'moss1', x, y);
    else if (cls[i] === 3) { const r = vnoise(x, y, 251, 5); c = r > 0.3 ? [40, 30, 32] : [27, 20, 23]; }
    else { c = sample(fl(x, y), x, y); const b = 1 + vnoise(x, y, 247, 23) * 0.06; c = c.map(v => v * b); }
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
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
  // the pines beyond a forest edge in the margins (road only: the quarry is bare rock)
  if (LEVEL_KEY === 'road') for (let i = 0; i < 2; i++) for (let x = -10; x < GX + 9 * CS; x += 34 + Math.round(hash2(i, x, 5) * 16)) put(PINES[(x + i * 3) % PINES.length], x, GY - 10 - i * 46 - Math.round(hash2(x, i, 6) * 20), { kind: 'tree' });
  if (LEVEL_KEY === 'road') for (let y = 0; y < GH; y++) { if (ROWS[y][0] !== 'T') continue; put(PINES[(y * 7) % PINES.length], 40 + Math.round(hash2(y, 1, 7) * 20), GY + y * CS + CS - 2, { kind: 'tree' }); }
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
let QB = null;
