// ---------- the Forest Road board (v2, verbatim): terrain drawn per pixel from pure PixelLab tiles (floor, road, creek), so every edge
// wanders; the puddle, rubble, props and a forest of pines from the authored map; every object grounded by Imagination's shadow
function charAt(wx, wy) {
  const cx = Math.floor((wx - GX) / CS), cy = Math.floor((wy - GY) / CS);
  if (cy < 0) return 'T'; if (cy >= GH) return 'W';
  return ROWS[cy][Math.max(0, Math.min(GW - 1, cx))];
}
const isRoad = c => c === '=' || c === '~', isWater = c => c === 'W';
const OBJ = [], BLOCK = new Set();
function put(k, cx, by, o = {}) {
  const a = ASSETS.objects[k]; if (!a) return null;
  const ob = { k, x: Math.round(cx - a.w / 2), y: Math.round(by - a.h), w: a.w, h: a.h, base: Math.round(by), kind: o.kind || 'prop', flat: !!o.flat, flip: !!o.flip };
  OBJ.push(ob); if (o.cell) BLOCK.add(o.cell[0] + ',' + o.cell[1]); return ob;
}
function placeForest() {
  const PINES = ['pine_a', 'pine_b', 'pine_c', 'pine_a', 'pine_b'];
  // the pine wall: every T cell, plus two ragged rows in the north margin and the dark ends of the side margins
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (ROWS[y][x] !== 'T') continue;
    const k = y === GH - 1 ? ['bush_dark', 'bush_dark', 'alder'][(x * 7 + y) % 3] : PINES[(x * 5 + y * 3) % PINES.length];
    put(k, cellX(x) + Math.round((hash2(x, y, 3) - 0.5) * 14), GY + y * CS + CS - 4 + Math.round(hash2(x, y, 4) * 6), { kind: 'tree', cell: [x, y] });
  }
  for (let i = 0; i < 2; i++) for (let x = -10; x < PW + 30; x += 34 + Math.round(hash2(i, x, 5) * 16)) {
    const by = GY - 10 - i * 46 - Math.round(hash2(x, i, 6) * 20);
    if (i === 0 && x > GX - 20 && x < GX + GW * CS + 20 && hash2(x, i, 9) < 0.35) continue;   // the deer paths between the trunks
    put(PINES[(x + i * 3) % PINES.length], x, by, { kind: 'tree' });
  }
  for (const [side, x0] of [[-1, 4], [1, PW - 76]]) for (let y = 0; y < GH; y++) {
    const c = ROWS[y][side < 0 ? 0 : GW - 1]; if (c !== 'T' && !(y <= 3 || y >= 9)) continue;
    put(PINES[(y * 7 + x0) % PINES.length], x0 + 36 + Math.round(hash2(y, side, 7) * 20), GY + y * CS + CS - 2, { kind: 'tree' });
  }
  // the creek's far bank: alders and bushes
  // the rocky bank under the slinger's perch (^ elevation 1, A elevation 2) and the rubble heaps (cover)
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const c = ROWS[y][x];
    if (c === 'A') { put('boulder', cellX(x), GY + y * CS + CS - 3, { cell: [x, y] }); put('rubble', cellX(x) + 14, GY + y * CS + CS + 4); }
    if (c === '^' && (ROWS[y + 1] || '')[x] !== '^' && !(x === 18 && y === 3) && hash2(x, y, 11) < 0.7)   // (18,3) is the slinger's perch: keep her in sight
      put(hash2(x, y, 12) < 0.5 ? 'boulder' : 'rubble', cellX(x) + Math.round((hash2(x, y, 13) - 0.5) * 10), GY + y * CS + CS - 2);
    if (c === 'r') put('rubble', cellX(x), GY + y * CS + CS - 6, { cell: [x, y] });
  }
  // the encounter's props (combat.ts FOREST_ROAD.props) and the roadside dressing (scenes/forestRoad.ts)
  put('signpost', cellX(4), cellY(2) + 4, { cell: [4, 2] });
  put('fence', cellX(1) + 20, cellY(2) + 2, { cell: [1, 2] }); BLOCK.add('2,2'); put('fence', cellX(4) + 4, cellY(3) - 8, { cell: [4, 3] });
  put('stump', cellX(2), cellY(1) + 4, { cell: [2, 1] });
  put('cart_wheel', cellX(12), cellY(2) + 4, { cell: [12, 2] });
  put('milestone', cellX(14), cellY(2) + 4, { cell: [14, 2] });
  put('lamp', cellX(14) + 8, cellY(3) + 4, { cell: [14, 3] });
  put('log', GX + 7 * CS, GY - 8); put('log', GX + 15 * CS + 10, GY + 4 * CS - 4 - 120);
  for (const [x, y] of [[6, 1], [10, 2], [13, 9], [2, 9], [16, 10], [9, 1]]) put(hash2(x, y, 1) < 0.5 ? 'tuft' : 'flowers', cellX(x), cellY(y) + 6, { flat: true });
}
// ---------- the ground layer, baked once
const ground = document.createElement('canvas'); ground.width = PW; ground.height = PH;
const FRINGE = [];
function bakeForest() {
  const g = ground.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
  const tc = document.createElement('canvas'); tc.width = IMG.tiles.width; tc.height = T; const tx = tc.getContext('2d'); tx.drawImage(IMG.tiles, 0, 0);
  const TD = tx.getImageData(0, 0, tc.width, T).data, TW = tc.width;
  const nvar = ASSETS.tiles.nvar;
  // puddle texture: the PixelLab puddle's own water, sampled from its middle
  const pu = IMG['ob:puddle'], pc = document.createElement('canvas'); pc.width = pu.width; pc.height = pu.height; const pcx = pc.getContext('2d'); pcx.drawImage(pu, 0, 0);
  const PD = pcx.getImageData(0, 0, pu.width, pu.height).data;
  const puddleAt = (wx, wy) => { // the '~' cells, smoothed between cell centres and wobbled
    const fx = (wx - GX) / CS - 0.5, fy = (wy - GY) / CS - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), sx = fx - ix, sy = fy - iy;
    const v = (x, y) => (at(x, y) === '~' ? 1 : 0);
    return v(ix, iy) * (1 - sx) * (1 - sy) + v(ix + 1, iy) * sx * (1 - sy) + v(ix, iy + 1) * (1 - sx) * sy + v(ix + 1, iy + 1) * sx * sy + vnoise(wx, wy, 61, 9) * 0.18;
  };
  const id = g.createImageData(PW, PH), d = id.data, cls = new Uint8Array(PW * PH);   // 0 floor, 1 road, 2 water, 3 puddle
  const VW = Math.ceil(PW / T) + 1, VH = Math.ceil(PH / T) + 1, VR = new Float32Array(VW * VH), VWt = new Float32Array(VW * VH);
  for (let vy = 0; vy < VH; vy++) for (let vx = 0; vx < VW; vx++) { const c = charAt(vx * T, vy * T); VR[vy * VW + vx] = isRoad(c) ? 1 : 0; VWt[vy * VW + vx] = isWater(c) ? 1 : 0; }
  for (let ty = 0; ty < VH - 1; ty++) for (let tx2 = 0; tx2 < VW - 1; tx2++) {
    const k = [VR[ty * VW + tx2], VR[ty * VW + tx2 + 1], VR[(ty + 1) * VW + tx2], VR[(ty + 1) * VW + tx2 + 1]], w = [VWt[ty * VW + tx2], VWt[ty * VW + tx2 + 1], VWt[(ty + 1) * VW + tx2], VWt[(ty + 1) * VW + tx2 + 1]];
    // the forest floor: the dark moss and fern tiles, now and then leaf litter or a root; sunlit grass only in dapples
    const MOSS = [0, 3, 12, 13, 14, 15], hv = hash2(tx2, ty, 17), fv = 3 + (hv < 0.05 ? 8 + Math.floor(hash2(tx2, ty, 18) * 4) : MOSS[Math.floor(hash2(tx2, ty, 18) * MOSS.length)]);
    for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
      const wx = tx2 * T + px, wy = ty * T + py; if (wx >= PW || wy >= PH) continue;
      const u = (px + 0.5) / T, v = (py + 0.5) / T, bl = (q) => q[0] * (1 - u) * (1 - v) + q[1] * u * (1 - v) + q[2] * (1 - u) * v + q[3] * u * v;
      const n = vnoise(wx, wy, 21, 11) * 0.22 + vnoise(wx, wy, 23, 4) * 0.1;
      let c = bl(w) + n > 0.5 ? 2 : bl(k) + n > 0.5 ? 1 : 0;
      if (c === 1 && puddleAt(wx, wy) > 0.5) c = 3;
      const i = wy * PW + wx; cls[i] = c; let r, gg, b;
      if (c === 3) { const j = (py * TW + 2 * T + px) * 4, k = 0.42; r = TD[j] * (1 - k) + 112 * k; gg = TD[j + 1] * (1 - k) + 104 * k; b = TD[j + 2] * (1 - k) + 86 * k; if (hash2(wx, wy, 77) < 0.0025) { r = 150; gg = 168; b = 164; } }   // muddy rainwater: the creek's water, silted
      else { const dap = c === 0 && vnoise(wx, wy, 41, 46) + vnoise(wx, wy, 43, 9) * 0.25 > 0.72, tile = c === 1 ? 1 : c === 2 ? 2 : dap ? 0 : fv, j = (py * TW + tile * T + px) * 4; r = TD[j]; gg = TD[j + 1]; b = TD[j + 2]; }
      d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
  }
  // edges: the floor darkens into the road's verge, a mud bank runs along the water, the puddle gets a wet dark rim
  const near = (x, y, want, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < PW && yy < PH && cls[yy * PW + xx] === want) return Math.abs(dx) + Math.abs(dy) || 1; } return 0; };
  const mix = (i, col, a) => { for (let k = 0; k < 3; k++) d[i * 4 + k] = d[i * 4 + k] * (1 - a) + col[k] * a; };
  for (let y = 1; y < PH - 1; y++) for (let x = 1; x < PW - 1; x++) {
    const i = y * PW + x, c = cls[i];
    if (c === 0) { const n = near(x, y, 1, 1); if (n) mix(i, [50, 33, 37], 0.32); const w = near(x, y, 2, 2); if (w) mix(i, w === 1 ? [58, 46, 44] : [90, 61, 43], 0.55); }
    if (c === 1) { const w = near(x, y, 2, 2); if (w) mix(i, [58, 46, 44], 0.5); const p = near(x, y, 3, 1); if (p) mix(i, [58, 46, 44], 0.55); }
    if (c === 3 && near(x, y, 1, 1)) mix(i, [50, 33, 37], 0.45);
  }
  g.putImageData(id, 0, 0);
  // tufts creeping over the road's edge
  for (let k = 0; k < 900; k++) {
    const x = 2 + Math.floor(hash2(k, 1, 71) * (PW - 4)), y = 2 + Math.floor(hash2(k, 2, 71) * (PH - 4));
    if (cls[y * PW + x] !== 1 || !near(x, y, 0, 2)) continue;
    for (let b = 0; b < 3; b++) { const len = 2 + Math.floor(hash2(k, b, 72) * 3), lean = b - 1; for (let s = 0; s < len; s++) { g.fillStyle = s >= len - 1 ? GR[4] : GR[2]; g.fillRect(x + Math.round(lean * s * 0.5), y + 1 - s, 1, 1); } }
  }
  // every object: flat dressing first, then each one's own shadow (Imagination's grounding.js, ported), grass kits on the floor
  for (const o of OBJ) if (o.flat) g.drawImage(IMG['ob:' + o.k], o.x, o.y);
  for (const o of OBJ) {
    if (o.flat) continue;
    const img = IMG['ob:' + o.k], ow8 = Math.max(8, Math.round(img.width * 0.15));
    const opts = o.kind === 'tree' && o.k !== 'bush' && o.k !== 'bush_dark' ? { dir: { x: 0.42, y: 0.3 }, foot: 8, sweep: 1, reach: Math.min(52, Math.max(12, Math.round(img.height * 0.32))) } : { overhang: ow8 };
    const m = hardShadowMask(alphaOf(img), img.width, img.height, opts);
    const under = cls[Math.min(PH - 1, o.base - 2) * PW + Math.max(0, Math.min(PW - 1, o.x + (o.w >> 1)))];
    if (under === 0) { const kit = groundKit(img, o.x * 7 + o.base, { tall: o.kind === 'tree' ? 7 : 5 }); if (kit) { g.drawImage(kit.contact, o.x - kit.m, o.y - kit.m); FRINGE.push([o, kit]); } paintMask(g, m, o.x - m.pad, o.y); }
    else { paintMask(g, m, o.x - m.pad, o.y, 1.3); floorReaction(g, m, o.x - m.pad, o.y, o.x * 31 + o.base); }
  }
  // the world's edge: the dark under the trees deepens toward the frame (hard steps)
  for (let y = 0; y < PH; y += 4) for (let x = 0; x < PW; x += 4) {
    const e = Math.min(x, y * 1.4, PW - x, (PH - y) * 3); const a = e < 24 ? 0.42 : e < 48 ? 0.26 : e < 72 ? 0.12 : 0;
    if (a) { g.fillStyle = `rgba(20,14,16,${a})`; g.fillRect(x, y, 4, 4); }
  }
  return cls;
}
let CLS = null;
