// ---------- the ground layer, baked once: terrain, the cliff edge and void, the floor's wear, and every static object's shadow
const ground = document.createElement('canvas'); ground.width = PW; ground.height = PH;
const FRINGE = new Map();   // object -> grass fringe canvas drawn in front of it
function cellCorners(x, y) { return [vt(x, y), vt(x + 1, y), vt(x, y + 1), vt(x + 1, y + 1)]; }
function nearHouse(x, y) { return OBJ.some(o => o.kind === 'house' && x * T + 16 > o.x + 4 && x * T + 16 < o.x + o.w - 4 && y * T >= o.base - 14 && y * T <= o.base - 2); }   // the cell whose top the plinth sits on: its dark band reads as the wall's foot
const MIXED = [], SHADOW_LOG = [];
function bakeGround() {
  const g = ground.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
  const VOID = ASSETS.cliff.void;
  g.fillStyle = VOID; g.fillRect(0, 0, PW, PH);
  // 1. terrain: the Wang pairs inside the mass, the cliff set at its rim
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const c = cellCorners(x, y), ext = c.some(v => v === 'V');
    if (ext) {   // the rim and the cliff face (deep void stays the plain void colour)
      if (cliffCode(x, y) === 0 && cliffCode(x + 1, y) === 0 && cliffCode(x, y + 1) === 0 && cliffCode(x + 1, y + 1) === 0) continue;
      const i = cliffTile(x, y); if (i >= 0) g.drawImage(IMG['cliff'], i * T, 0, T, T, x * T, y * T, T, T);
      continue;
    }
    if ((c.every(v => v === 'G' || v === 'C') || c.every(v => v === 'G' || v === 'D')) && !c.every(v => v === c[0])) { MIXED.push([x, y, c]); continue; }   // drawn per pixel below
    const s = setFor(c) || 'gc', key = ASSETS.tileKey[s];
    const idx = parseInt(c.map(v => (key['1'] === v ? '1' : '0')).join(''), 2), pure = c.every(v => v === c[0]);
    let drawn = false;
    if (pure && c[0] === 'C') {   // context-placed cobble: dirt in the cracks by walls, worn smooth down the road, the odd puddle, moss at verges
      const verge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => cellCorners(x + dx, y + dy).includes('G'));
      const road = y >= 16 && y <= 17 && x >= 4 && x <= 33, r = grnd();
      let v = -1;
      if (nearHouse(x, y)) v = 0; else if (road && r < 0.5) v = 1;    // no puddles: the glitter read as broken glass
      if (v >= 0) { const n = v * 4 + Math.floor(grnd() * 4); g.drawImage(IMG['var:C2'], n * T, 0, T, T, x * T, y * T, T, T); drawn = true; }
      else if (grnd() < 0.3) { const pool = grnd() < 0.12 ? [4, 5, 6, 7] : [0, 1, 2, 3, 12, 13, 14, 15]; g.drawImage(IMG['var:C'], pool[Math.floor(grnd() * pool.length)] * T, 0, T, T, x * T, y * T, T, T); drawn = true; }
    } else if (pure && c[0] === 'F' && ASSETS.variants.F && grnd() < 0.35) { g.drawImage(IMG['var:F'], (8 + Math.floor(grnd() * 8)) * T, 0, T, T, x * T, y * T, T, T); drawn = true; }
    else if (pure && c[0] === 'G' && grnd() < 0.45) { g.drawImage(IMG['var:G'], Math.floor(grnd() * ASSETS.variants.G.n) * T, 0, T, T, x * T, y * T, T, T); drawn = true; }
    if (!drawn) g.drawImage(IMG['tile:' + s], (idx % 4) * T, (idx >> 2) * T, T, T, x * T, y * T, T, T);
  }
  // 1b. v9: the grass/cobble edge, per pixel. The corners' paving is interpolated across the cell and wobbled by two octaves
  // of value noise, so the edge wanders instead of stepping along the tile grid; each side samples its own pure tile.
  {
    const key = ASSETS.tileKey.gc, pureIdx = v => (key['1'] === v ? 15 : 0);
    const tileData = (img, sx, sy) => { const c = document.createElement('canvas'); c.width = c.height = T; const x = c.getContext('2d'); x.drawImage(img, sx, sy, T, T, 0, 0, T, T); return x.getImageData(0, 0, T, T).data; };
    const GT = [tileData(IMG['tile:gc'], (pureIdx('G') % 4) * T, (pureIdx('G') >> 2) * T)], CT = [tileData(IMG['tile:gc'], (pureIdx('C') % 4) * T, (pureIdx('C') >> 2) * T)];
    for (let i = 0; i < ASSETS.variants.G.n; i++) GT.push(tileData(IMG['var:G'], i * T, 0));
    for (const i of [0, 1, 2, 3, 12, 13, 14, 15]) CT.push(tileData(IMG['var:C'], i * T, 0));
    const dk = ASSETS.tileKey.dirt, DTL = [tileData(IMG['tile:dirt'], ((dk['1'] === 'D' ? 15 : 0) % 4) * T, ((dk['1'] === 'D' ? 15 : 0) >> 2) * T)];
    for (const [x, y, c] of MIXED) {
      const dirt = c.includes('D'), id = g.getImageData(x * T, y * T, T, T), d = id.data, k = c.map(v => (v === 'C' || v === 'D' ? 1 : 0));
      const gt = GT[Math.floor(grnd() * GT.length)], ct = dirt ? DTL[0] : CT[Math.floor(grnd() * CT.length)];
      for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
        const u = (px + 0.5) / T, v = (py + 0.5) / T, wx = x * T + px, wy = y * T + py;
        const f = k[0] * (1 - u) * (1 - v) + k[1] * u * (1 - v) + k[2] * (1 - u) * v + k[3] * u * v + vnoise(wx, wy, 21, 11) * 0.24 + vnoise(wx, wy, 23, 4) * 0.1;
        const src = f > 0.5 ? ct : gt, j = (py * T + px) * 4; d[j] = src[j]; d[j + 1] = src[j + 1]; d[j + 2] = src[j + 2]; d[j + 3] = 255;
      }
      g.putImageData(id, x * T, y * T);
    }
  }
  // 2. the verge: darker joints where cobble meets grass, and tufts creeping in over the stones
  const id = g.getImageData(0, 0, PW, PH), d = id.data;
  const isGrass = i => d[i + 1] > d[i] + 14 && d[i + 1] > d[i + 2] + 8, isStone = i => { const r = d[i], gg = d[i + 1], b = d[i + 2]; return Math.abs(r - gg) < 22 && Math.abs(gg - b) < 22 && r > 70 && r < 200; };
  const darken = [];
  for (let y = 2; y < PH - 2; y++) for (let x = 2; x < PW - 2; x++) {
    const i = (y * PW + x) * 4; if (!isStone(i)) continue;
    let near = 0; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]) if (isGrass(((y + dy) * PW + x + dx) * 4)) { near = Math.abs(dx) + Math.abs(dy); break; }
    if (near) darken.push([i, near === 1 ? 0.38 : 0.2]);
  }
  for (const [i, a] of darken) { d[i] = d[i] * (1 - a) + 0x32 * a; d[i + 1] = d[i + 1] * (1 - a) + 0x21 * a; d[i + 2] = d[i + 2] * (1 - a) + 0x25 * a; }
  g.putImageData(id, 0, 0);
  let creep = 0;
  for (let k = 0; k < 2600 && creep < 260; k++) {   // short tufts rooted in the grass edge, leaning onto the stones
    const [i] = darken[Math.floor(grnd() * darken.length)] || [0]; const p = i / 4, x = p % PW, y = (p / PW) | 0;
    if (grnd() < 0.6) continue; creep++;
    for (let b = 0; b < 3; b++) { const len = 2 + Math.floor(grnd() * 3), lean = b - 1; for (let s = 0; s < len; s++) { g.fillStyle = s >= len - 1 ? GR[4] : GR[2]; g.fillRect(x + Math.round(lean * s * 0.5), y + 1 - s, 1, 1); } }
  }
  // 2b. v12: the canal runs on to the west lip. The two tiles under the rim's grass lip take the canal's own columns (a tile on), so the water,
  // its kerbs and the bank stones meet the cliff edge at exactly the canal's rows; drawSpill() pours it over the lip
  { const sx = 82, sy = 416, sw = 14, sh = 64, id2 = g.getImageData(sx, sy, sw, sh); g.putImageData(id2, sx - 32, sy); }
  // 3. the exits over the rim: the riverside path carried down the cliff face, the canal spilling off the west edge (drawn live)
  // the riverside path goes over the edge as a flight of dirt steps cut into the face, sinking into the dark
  { // the path's dirt runs on over the rim's grass lip to the top of the steps (ragged edges, like the path itself)
    const dk = ASSETS.tileKey.dirt, di = dk['1'] === 'D' ? 15 : 0, tc = document.createElement('canvas'); tc.width = tc.height = T;
    tc.getContext('2d').drawImage(IMG['tile:dirt'], (di % 4) * T, (di >> 2) * T, T, T, 0, 0, T, T); const td = tc.getContext('2d').getImageData(0, 0, T, T).data;
    const x0 = 27 * T - 14, w = 2 * T + 28, y0 = 27 * T, h = T + 24, id = g.getImageData(x0, y0, w, h), d = id.data;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const wx = x0 + xx, wy = y0 + yy, half = 30 - yy * 0.3 + vnoise(wx, wy, 51, 4) * 4, cx = 28 * T;
      if (Math.abs(wx - cx) > half || wy > 28 * T + 17 + vnoise(wx, 0, 53, 3) * 2) continue;
      const j = (yy * w + xx) * 4, k = ((wy % T) * T + (wx % T)) * 4; d[j] = td[k]; d[j + 1] = td[k + 1]; d[j + 2] = td[k + 2];
    }
    g.putImageData(id, x0, y0);
  }
  const st = IMG['ob:steps'], sx = 28 * T - Math.round(st.width / 2), sy = 28 * T - 6;
  const sm = hardShadowMask(alphaOf(st), st.width, st.height, { flat: true, band: 3 }); paintMask(g, sm, sx - sm.pad, sy);
  g.drawImage(st, sx, sy);
  for (let k = 0; k < 4; k++) { g.fillStyle = `rgba(20,15,17,${0.16 + k * 0.2})`; g.fillRect(sx - 2, sy + 22 + k * 10, st.width + 4, k === 3 ? st.height : 10); }
  // 4. the void: deeper toward the world's edge, in hard steps (no smoothing)
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (cellCorners(x, y).some(v => v !== 'V')) continue;
    let dist = 9; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (inMass(x + dx, y + dy)) dist = Math.min(dist, Math.max(Math.abs(dx), Math.abs(dy)));
    const a = dist <= 1 ? 0 : dist === 2 ? 0.18 : dist === 3 ? 0.32 : 0.45;
    if (a) { g.fillStyle = `rgba(10,7,9,${a})`; g.fillRect(x * T, y * T, T, T); }
  }
  // 5. the shadow layer and the contact kits of every static object (ART_DIRECTION §2-3)
  for (const o of OBJ) if (o.flat && o.kind !== 'bridge' && o.k !== 'walkway') g.drawImage(IMG['ob:' + o.k], o.x, o.y);   // flat dressing first: every shadow lands on top of it
  for (const o of OBJ) {
    if (o.k === 'walkway') {
      // the road's cobbles run on over the rim's lip to meet the deck (ragged top and bottom, like the rest of the road)
      { const key = ASSETS.tileKey.gc, ci = key['1'] === 'C' ? 15 : 0, tc = document.createElement('canvas'); tc.width = tc.height = T;
        tc.getContext('2d').drawImage(IMG['tile:gc'], (ci % 4) * T, (ci >> 2) * T, T, T, 0, 0, T, T); const td = tc.getContext('2d').getImageData(0, 0, T, T).data;
        const x0 = 36 * T - 10, x1 = o.x + 6, id = g.getImageData(x0, o.y - 10, x1 - x0, o.h + 20), d = id.data, w = x1 - x0;
        for (let yy = 0; yy < o.h + 20; yy++) for (let xx = 0; xx < w; xx++) {
          const wy = o.y - 10 + yy, top = o.y - 2 + Math.round(vnoise(x0 + xx, 0, 31, 5) * 4), bot = o.base + 2 + Math.round(vnoise(x0 + xx, 1, 33, 5) * 4);
          if (wy < top || wy > bot || (xx < 10 && vnoise(xx, wy, 35, 4) < -0.2)) continue;
          const j = (yy * w + xx) * 4, k = (((wy % T) + T) % T * T + ((x0 + xx) % T)) * 4; d[j] = td[k]; d[j + 1] = td[k + 1]; d[j + 2] = td[k + 2]; d[j + 3] = 255;
        }
        g.putImageData(id, x0, o.y - 10); }
      g.fillStyle = 'rgba(8,5,6,0.7)'; g.fillRect(o.x + 6, o.base - 2, o.w - 6, 12);
      g.drawImage(IMG['ob:' + o.k], o.x, o.y);
      for (let k = 0; k < 4; k++) { g.fillStyle = `rgba(24,18,20,${0.2 + k * 0.2})`; g.fillRect(PW - 44 + k * 11, o.y - 2, 11, o.h + 14); }
      continue;
    }
    if (o.flat && o.kind !== 'bridge') continue;
    const img = IMG['ob:' + o.k], under = vt(Math.floor((o.x + o.w / 2) / T), Math.floor((o.base - 2) / T));
    if (o.kind === 'bridge') {   // the deck's shadow on the water to its lower right, then the bridge itself on the ground layer
      // v12: light from the upper left, so the deck, its rails and the north abutment throw their shadow on the water to the lower right
      // v12b: the ported mask with its base at the deck's front edge (sprite row 34, where the near stones begin); a water-wide strip beside it
      g.fillStyle = 'rgba(50,33,37,0.5)'; g.fillRect(DECK_R + 9, 440, 9, 22); g.fillStyle = 'rgba(50,33,37,0.32)'; g.fillRect(DECK_R + 18, 446, 4, 14);
      const bm = hardShadowMask(alphaOf(img), img.width, img.height, { flat: true, band: 4, base: 34 }); paintMask(g, bm, o.x - bm.pad, o.y);
      g.fillStyle = 'rgba(50,33,37,0.4)'; g.fillRect(DECK_L + 2, 452, DECK_R - DECK_L - 4, 3);
      g.drawImage(img, o.x, o.y); continue;
    }
    // Imagination's per-item options (island2 dress2.shadowOpts2): trees take the sun-swept joined shadow (TREE_SUN2,
    // reach a third of the height, at most 52); everything else the short floor shadow with an overhang allowance that grows
    // with the width (a round well's seam follows its curve); houses the heavy contact band
    const ow8 = Math.max(8, Math.round(img.width * 0.15)), bushy = o.k === 'bush';
    const opts = o.kind === 'house' ? { overhang: ow8, band: 6 } : o.kind === 'tree' && !bushy ? { dir: { x: 0.42, y: 0.3 }, foot: 8, sweep: 1, reach: Math.min(52, Math.max(12, Math.round(img.height * 0.32))) } : { overhang: ow8 };
    if (o.kind === 'house') {   // (C) the wall foot: a worn, ragged band of trodden earth along the plinth, a little wider than the house
      for (let x = o.x - 7; x < o.x + o.w + 7; x++) { const h = 3 + Math.round(vnoise(x, o.base, 41, 3) * 1.5), edge = x < o.x || x >= o.x + o.w;
        for (let k = -1; k < h - (edge ? 2 : 0); k++) { g.fillStyle = k < 1 ? 'rgba(50,33,37,0.55)' : 'rgba(58,46,44,0.38)'; g.fillRect(x, o.base + k, 1, 1); } }
    }
    if (o.kind === 'house') houseDoorstep(g, o);
    const m = hardShadowMask(alphaOf(img), img.width, img.height, opts); SHADOW_LOG.push({ o, m, dx: o.x - m.pad, dy: o.y });
    if (under === 'G' || under === 'D') {
      const kit = groundKit(img, o.x * 7 + o.base, { tall: o.kind === 'tree' ? 7 : 5, density: o.kind === 'house' ? 0.6 : 1 });
      if (kit) { g.drawImage(kit.contact, o.x - kit.m, o.y - kit.m); FRINGE.set(o, kit); }
      paintMask(g, m, o.x - m.pad, o.y);
      if (o.kind === 'house') houseSkirt(o, FRINGE.get(o) || (() => { const kk = { fringe: mkCanvas(o.w + 20, o.h + 20), m: 10 }; FRINGE.set(o, kk); return kk; })());
    } else { if (o.kind === 'house') { const kk = { fringe: mkCanvas(o.w + 20, o.h + 20), m: 10 }; FRINGE.set(o, kk); houseSkirt(o, kk); } paintMask(g, m, o.x - m.pad, o.y, 1.3); floorReaction(g, m, o.x - m.pad, o.y, o.x * 31 + o.base); }   // v11: on paving the same mask a notch darker (seam 228, band 182, cast 162 of 255), so it reads at 1x as it does on grass
  }
}
// v12 (item 3): a house is grounded like Imagination's buildings. The doorstep is a flat slab that runs on over the lane; the skirt is the
// ground's own texture (trodden earth, pebbles, grass, moss) lying over the plinth's bottom rows, so the base is never a clean traceable line
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function houseDoorstep(g, o) {
  if (o.k === 'house_merchant') return;     // its own broad steps are in the art
  const cx = o.x + (o.w >> 1), w = 36, x0 = cx - (w >> 1), b = o.base;
  g.fillStyle = 'rgba(50,33,37,0.6)'; g.fillRect(x0 + 3, b + 6, w, 2);                      // the slab's cast, to the lower right
  g.fillStyle = '#3e3d47'; g.fillRect(x0 - 1, b - 3, w + 2, 10);                              // outline in the stone's dark tone
  g.fillStyle = '#85807f'; g.fillRect(x0, b - 2, w, 5); g.fillStyle = '#aea89c'; g.fillRect(x0, b - 2, w, 1); g.fillRect(x0, b - 2, 1, 5);   // lit top
  g.fillStyle = '#5d5b63'; g.fillRect(x0, b + 3, w, 3); g.fillStyle = '#3e3d47'; g.fillRect(x0, b + 5, w, 1);                                 // front face
  for (let x = x0 + 5; x < x0 + w - 3; x += 11) { g.fillStyle = '#3e3d47'; g.fillRect(x, b - 1, 1, 4); }
  g.fillStyle = 'rgba(50,33,37,0.5)'; g.fillRect(x0, b - 2, w, 1);                            // the wall's contact on the slab
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? DIRT[1] : GR[2]; g.fillRect(x0 - 3 + Math.floor(hash2(i, b, 61) * (w + 6)), b + 4 + (i % 3), 2, 1); }   // earth tracked on
}
function houseSkirt(o, kit) {
  const f = kit.fringe.getContext('2d'), M = kit.m, b = o.base - o.y;
  let s = o.x * 31 + o.base * 7; const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const dot = (x, y, w, h, c) => { f.fillStyle = c; f.fillRect(x + M, y + M, w, h); };
  const x0 = -6, x1 = o.w + 6;
  for (let n = 0, x = x0 + 2; x < x1 - 4; n++) {   // spills of worn earth lying across the plinth's foot, ragged on both edges, so the base is no line
    const w = 4 + Math.floor(r() * 6), rows = [0.4, 0.75, 1, 0.8, 0.35];
    for (let i = 0; i < w; i++) rows.forEach((pr, k) => { if (r() < pr * (i === 0 || i === w - 1 ? 0.55 : 1)) dot(x + i, b - 2 + k, 1, 1, k === 4 ? DIRT[0] : (i + k) % 3 ? DIRT[1] : DIRT[2]); });
    x += w + 3 + Math.floor(r() * 12);
  }
  for (let x = x0; x < x1;) {
    const edge = x < 2 || x > o.w - 3, roll = r() - (edge ? 0.25 : 0);
    if (roll < 0.22) { for (let k = 0; k < 3 + Math.floor(r() * 2); k++) { const lean = (r() - 0.5) * 1.6; dot(x + Math.round(lean * k * 0.5), b + 1 - k, 1, 1, k >= 2 ? GR[4] : k ? GR[3] : GR[1]); } dot(x + 1, b + 1, 1, 1, GR[2]); x += 2; }
    else if (roll < 0.42) { const w = 2 + Math.floor(r() * 3); dot(x, b - 1, w, 2, DIRT[2]); dot(x, b - 1, w, 1, DIRT[1]); dot(x + 1, b + 1, w, 1, DIRT[0]); x += w; }
    else if (roll < 0.56) { dot(x, b - 1, 2, 2, STONE[1]); dot(x, b - 1, 1, 1, STONE[2]); dot(x + 1, b, 1, 1, STONE[0]); x += 3; }
    else if (roll < 0.62) { dot(x, b, 3, 1, GR[1]); dot(x + 1, b - 1, 1, 1, GR[2]); x += 3; }
    else x += 1 + Math.floor(r() * 3);
  }
}
// the chimneys the art draws: a narrow run of columns standing well above the roof line next to it
function findChimneys() {
  for (const o of OBJ) {
    if (o.kind !== 'house') continue;
    const A = alphaOf(IMG['ob:' + o.k]), W = o.w, H = o.h, top = new Array(W).fill(H);
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (A[y * W + x]) { top[x] = y; break; }
    let best = null;
    for (let x = 8; x < W - 8; x++) { if (x > W * 0.35 && x < W * 0.65) continue; const lift = Math.min(top[x - 8], top[x + 8]) - top[x]; if (lift > 9 && (!best || top[x] < best[1])) best = [x, top[x]]; }   // the ridge is not a chimney
    if (best) CHIMNEYS.push([o.x + best[0], o.y + best[1]]);
  }
}

// (A) the shadow check: for each object, the mean luminance of its visible shadow (mask pixels not under any sprite) against the
// ring of open ground 3-8 px outside the mask, both read from the finished ground layer
function shadowTable() {
  const d = ground.getContext('2d').getImageData(0, 0, PW, PH).data, cover = new Uint8Array(PW * PH), shad = new Uint8Array(PW * PH);
  for (const o of OBJ) { if (o.flat) continue; const A = alphaOf(IMG['ob:' + o.k]); for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (A[y * o.w + x]) { const X = o.x + x, Y = o.y + y; if (X >= 0 && Y >= 0 && X < PW && Y < PH) cover[Y * PW + X] = 1; } }
  for (const { m, dx, dy } of SHADOW_LOG) for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.alpha[y * m.width + x] >= 120) { const X = dx + x, Y = dy + y; if (X >= 0 && Y >= 0 && X < PW && Y < PH) shad[Y * PW + X] = 1; }
  const lum = i => 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return SHADOW_LOG.map(({ o, m, dx, dy }) => {
    let s = 0, n = 0, rs = 0, rn = 0; const mine = new Set();
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.alpha[y * m.width + x] >= 120) { const X = dx + x, Y = dy + y; if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue; const i = Y * PW + X; mine.add(i); if (!cover[i]) { s += lum(i); n++; } }
    for (const i of mine) { const X = i % PW, Y = (i / PW) | 0; for (const [ex, ey] of [[6, 0], [-6, 0], [0, 6], [0, -6], [5, 5], [-5, 5], [5, -5], [-5, -5]]) { const X2 = X + ex, Y2 = Y + ey; if (X2 < 0 || Y2 < 0 || X2 >= PW || Y2 >= PH) continue; const j = Y2 * PW + X2; if (!cover[j] && !shad[j] && cover[j] === 0) { rs += lum(j); rn++; } } }
    const sl = n ? s / n : 0, rl = rn ? rs / rn : 0;
    return { k: o.k, x: o.x + (o.w >> 1), y: o.base, visible: n, shadow: +sl.toFixed(1), ground: +rl.toFixed(1), darker: rl ? +(1 - sl / rl).toFixed(3) : 0 };
  });
}
window.__shadowTable = () => shadowTable();
