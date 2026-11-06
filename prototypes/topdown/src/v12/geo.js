// ---------- Ba Dan as a diorama: the village's ground mass sits in the void and ends in a cut cliff edge (the old isometric
// Ba Dan's edge, top-down). Content cell (cx, cy) of the game's 24x16 village sits at world px (128 + 40 cx, 192 + 40 cy).
const C2X = cx => 128 + 40 * cx, C2Y = cy => 192 + 40 * cy;
let gseed = 9137;
const grnd = () => ((gseed = (gseed * 1103515245 + 12345) >>> 0) / 4294967296);
// the rim: a rectangle of vertices with soft organic bites, kept straight where a road, the canal or the river path leaves
const bites = n => { const a = []; let v = 0, run = 0; for (let i = 0; i < n; i++) { run++; if (run >= 4 && grnd() < 0.22) { v = v ? 0 : 1; run = 0; } a.push(v); } return a; };   // runs of 4+, one tile deep: soft, never notched
const BN = bites(MW + 1), BS = bites(MW + 1), BW = bites(MH + 1), BE = bites(MH + 1);
const TOPV = x => 2 + BN[x], BOTV = x => 28, LEFTV = y => (y >= 11 && y <= 20 ? 2 : 2 + BW[y]), RIGHTV = y => (y >= 14 && y <= 20 ? 36 : 36 - BE[y]);
const inMass = (x, y) => x >= LEFTV(y) && x <= RIGHTV(y) && y >= TOPV(x) && y <= BOTV(x);
// terrain inside the mass (Wang corners): G grass, C cobble, W water, D dirt. v9: no boxes. Every paved area is a road
// (a polyline with a width) or a court (a blob), and its edge wanders with a smooth value noise so no grass/cobble boundary
// runs straight for more than a couple of tiles.
const hash2 = (x, y, k) => { let t = (x * 374761393 + y * 668265263 + k * 1442695041) >>> 0; t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0; return ((t ^ (t >>> 16)) & 0xffff) / 65535; };
function vnoise(x, y, k, p = 2.6) {   // smooth value noise in [-1, 1], period about p vertices
  const fx = x / p, fy = y / p, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(ix, iy, k), b = hash2(ix + 1, iy, k), c = hash2(ix, iy + 1, k), d = hash2(ix + 1, iy + 1, k);
  return ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy) * 2 - 1;
}
const segD = (x, y, [ax, ay], [bx, by]) => { const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(x - ax - vx * t, y - ay - vy * t); };
const lineD = (x, y, pts) => { let d = 1e9; for (let i = 1; i < pts.length; i++) d = Math.min(d, segD(x, y, pts[i - 1], pts[i])); return d; };
// [polyline in vertices, half width]: the east road (with a slight sag), the north lane along the house fronts and its spur to
// the bridge, the dry crossing to the watch-post plaza, the lane down to the well court, the south lane along the house fronts
const ROADS = [
  [[[2, 16.6], [8, 16.3], [13, 16.8], [19, 16.4], [25, 16.8], [31, 16.4], [35, 16.7], [38, 16.6]], 1.2],
  [[[10, 10.85], [13, 10.65], [16, 10.95], [20, 10.65], [24, 10.95], [27, 10.65], [30, 10.85]], 1.15],
  [[[15.9, 10.8], [15.9, 13.5]], 1.2],
  [[[20.5, 15], [23.5, 13.6], [26, 14.6]], 1.25],
  [[[18.5, 17], [18.3, 20], [18.6, 25.4]], 1.15],
  [[[11, 25.6], [17, 25.3], [24.5, 25.7]], 1.05],
];
const COURTS = [[16.2, 11.8, 2.6], [18.6, 20.4, 2.9], [23.6, 14.2, 2.4]];   // Mira's court, the well court, the watch-post plaza
function paved(x, y) {
  const n = vnoise(x, y, 7, 2.2) * 0.6 + vnoise(x, y, 11, 1.0) * 0.55;
  for (const [pts, w] of ROADS) if (lineD(x, y, pts) <= w + n) return true;
  for (const [cx, cy, r] of COURTS) if (Math.hypot(x - cx, (y - cy) * 1.15) <= r + n * 1.2) return true;
  return false;
}
function vtRaw(x, y) {
  if (!inMass(x, y)) return 'V';
  if ((y === 14 && x >= 2 && x <= 19) || (x >= 4 && x <= 5 && y >= 16 && y <= 17)) return 'W';             // the canal, a narrow channel from the west rim to the dry crossing; the flooded ford at the road's west end
  if (x >= 2 && x <= 20 && (y === 13 || y === 15)) return 'C';                                               // the canal's stone kerbs
  if (x >= 3 && x <= 6 && y === 18) return 'C';                                                               // the ford's south lip
  if (x >= 27 && x <= 28 && y >= 22 && y <= 28) return 'D';                                                   // the riverside path, down to the rim
  if (x >= 26 && x <= 29 && y >= 23 && y <= 28 && vnoise(x, y, 3) > 0.35) return 'D';
  if (paved(x, y)) return 'C';
  if (x >= 4 && x <= 19 && (y === 12 || y === 16) && vnoise(x, y, 5, 1.8) > 0.05) return 'C';                 // the quay widens and narrows along the canal
  return 'G';
}
// tidy the noise: a lone cobble vertex becomes grass, a grass notch with three paved sides fills in
const VT = new Map();
function vt(x, y) {
  const key = y * 1000 + x; if (VT.has(key)) return VT.get(key);
  let v = vtRaw(x, y);
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => vtRaw(x + dx, y + dy)), nc = nb.filter(q => q === 'C' || q === 'W').length;
  if (v === 'C' && nc < 2) v = 'G';
  VT.set(key, v); return v;
}
const SETS = { G: 'gc', C: 'gc', W: 'canal', D: 'dirt', F: 'flag', CG: 'gc', CW: 'canal', DG: 'dirt', CF: 'flag' };
const setFor = a => SETS[[...new Set(a)].sort().join('')];
// cliff codes per vertex: 1 ground (U), 0 void (L), 2 the cliff face's foot (T: void directly below ground)
const cliffCode = (x, y) => (inMass(x, y) ? 1 : inMass(x, y - 1) ? 2 : 0);
const CLIFF = ASSETS.cliff.tiles.map((t, i) => ({ i, pat: t.pat, spec: t.pat.filter(v => v !== 255).length })).sort((a, b) => b.spec - a.spec);
function cliffTile(x, y) {
  let best = -1, bestCost = 1e9;   // exact match first; a corner the set never drew falls back to the nearest pattern (a foot read as void costs least)
  for (const t of CLIFF) {
    let cost = 0;
    for (let r = 0; r < 4; r++) for (let c = 1; c <= 2; c++) { const v = t.pat[r * 4 + c], w = cliffCode(x + c - 1, y + r - 1); if (v === 255 || v === w) continue; cost += (v === 1 || w === 1) ? 4 : 1; }
    if (cost === 0) return t.i;
    if (cost < bestCost) { bestCost = cost; best = t.i; }
  }
  return best;
}
// where each vertex sits relative to the village, for context-placed variants (dirt by walls, wear down the road)
const wallCells = new Set();
