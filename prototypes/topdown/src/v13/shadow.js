// ---------- grounding (ported from Imagination's src/game/grounding.js and src/game/ground.js, ART_DIRECTION §2-3)
// One shadow colour, hard edge, light from the upper left: an occlusion seam where the base meets the floor, a contact band
// on the lower and right sides, and a short cast to the lower right that never runs further than one tile.
const SHADOW = '#322125', SHADOW_RGB = [0x32, 0x21, 0x25];
// leftovers pass: the walk home is at dusk (AREA.mode 'home'): the low sun throws every cast about 1.7x as far, still the one hard shadow colour
const DUSK = !!(window.AREA && window.AREA.mode === 'home'), DUSK_K = DUSK ? 1.7 : 1;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
// v10: Jared's own grounding, ported verbatim (its `put` is `gput` here: objects.js owns `put`) from Imagination src/game/grounding.js (hardShadowMask, closeHoles,
// crownShadowMask; only `export` dropped). Defaults give the original short lower-right run: every column stands on its
// own foot, the seam (175/150), the contact band (140), the cast (125) squashed to 0.35 and capped by `reach` (12-24 px).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function gput(mask, x, y, a) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return;
  const i = y * mask.width + x;
  if (a > mask.alpha[i]) mask.alpha[i] = a;
}

// Pure alpha-mask version used by tests and the browser renderer alike.
function hardShadowMask(alpha, width, height, o = {}) {
  // `o.hitch` (px): a towed thing seen from the front (a tank trailer) stands on its wheels, and its drawbar runs
  // forward low over the floor to a jack foot that is the lowest pixel. Everything above the row `hitch` px over the
  // image base casts as usual from that row (the axle line, under the wheels); the drawbar and jack below it lay their
  // own silhouette 2 px down-right on the floor, so the shadow sits under the wheels instead of a band below the jack.
  if (Number.isFinite(o.hitch) && o.hitch > 0) {
    let low = -1; for (let i = 0; i < alpha.length; i++) if (alpha[i]) low = Math.floor(i / width);
    const cut = low - Math.round(o.hitch);
    if (cut > 0) {
      const up = alpha.map((v, i) => (Math.floor(i / width) <= cut ? v : 0));
      const m = hardShadowMask(up, width, height, { ...o, hitch: undefined, base: cut });
      const W = m.width, H = Math.max(m.height, height + 3), A = new Uint8ClampedArray(W * H);
      A.set(m.alpha);
      for (let y = cut + 1; y < height; y++) for (let x = 0; x < width; x++) if (alpha[y * width + x]) { const i = (y + 2) * W + m.pad + x + 2; if (!A[i]) A[i] = 125; }
      return { ...m, height: H, alpha: A, base: low };
    }
  }
  const foot = Math.max(6, Math.round(o.foot ?? height * 0.1));
  const band = clamp(Math.round(o.band ?? 3 + Math.min(3, height / 80)), 3, 6);
  const reach = clamp(Math.round(o.reach ?? height * 0.3 * DUSK_K), 12, Math.round(24 * DUSK_K));
  let base = Number.isFinite(o.base) ? clamp(Math.round(o.base), 0, height - 1) : -1;
  if (base < 0) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (alpha[y * width + x]) base = y;
  // Optional sun direction `o.dir = {x, y}`: floor pixels moved per pixel of height (x > 0 falls right, y > 0 toward the
  // viewer). Without it the cast tier below is the original short lower-right run, byte for byte. `o.reach` then caps
  // the length of the longest shadow in pixels (default: none beyond the object's own height).
  const dir = o.dir ? { x: +o.dir.x || 0, y: Math.max(0, +o.dir.y || 0) } : null;
  const sweep = dir && Number.isFinite(o.sweep) ? Math.max(0, Math.min(1, o.sweep)) : 0;
  const dirLen = dir ? Math.hypot(dir.x, dir.y) : 0;
  let hTop = base; if (dir) for (let y = 0; y <= base && hTop === base; y++) for (let x = 0; x < width; x++) if (alpha[y * width + x]) { hTop = y; break; }
  // a `reach` shorter than the tallest cast scales the whole shadow down (heights stay in proportion), it never flattens the top
  const hScale = dir && o.reach != null && dirLen > 0 && (base - hTop) > 0 ? Math.min(1, o.reach / dirLen / (base - hTop)) : 1;
  const hMax = dir ? Math.max(0, base - hTop) * hScale : 0;
  const padL = dir && dir.x < 0 ? Math.ceil(-dir.x * hMax) + 1 : 0, ext = dir ? Math.ceil(Math.abs(dir.x) * hMax) + 2 : 0, extY = dir ? Math.ceil(dir.y * hMax) + 4 : 0;
  const pad = band + padL, ow = width + pad + 24 + ext, oh = Math.max(height, base + 25 + extY);
  const out = { width: ow, height: oh, alpha: new Uint8ClampedArray(ow * oh), pad, base, reach, color: SHADOW };
  if (base < 0) return out;
  // Each column stands on its OWN lowest pixel when that lies in the foot region (a group of things on one image:
  // a stump further back stands higher on the screen than the broom in front of it); columns with nothing in the
  // foot region (a table top between its legs) fall back to the image's base.
  const footReach = Math.max(foot, Math.round(height * 0.16));
  // `o.overhang` (default 8): how far above the run's lowest foot a column may stand on its own foot. A wide round base
  // seen from above (a fountain basin, a well) curves up more than 8 px at its sides and passes a larger value, so its
  // seam follows the curve instead of a flat band under it.
  const overhang = Number.isFinite(o.overhang) ? Math.max(0, o.overhang) : 8;
  // ...and then the short cast leaves from each column's own foot too (default: from the run's lowest foot, a flat line
  // that showed under a big basin's raised sides as a band floating below it)
  const ownCast = Number.isFinite(o.overhang);
  // A column's own foot: its lowest pixel inside the foot region. Touching columns form a run (one object, or
  // things leaning on each other); within a run a column keeps its own foot only when that is close to the run's
  // lowest (a round base, a pail beside a broom), otherwise it is an overhang (a hem, a rim) and uses the run's foot,
  // so nothing gets a shadow in mid-air. Separate runs (a stump further back) each stand on their own foot.
  const own = new Int32Array(width).fill(-1), colBase = new Int32Array(width).fill(-1), castFrom = new Int32Array(width).fill(-1), grounded = new Uint8Array(width);
  for (let x = 0; x < width; x++) for (let y = base; y >= Math.max(0, base - footReach); y--) if (alpha[y * width + x]) { own[x] = y; break; }
  for (let x = 0; x < width;) {
    if (own[x] < 0) { x++; continue; }
    let e = x, low = own[x]; while (e + 1 < width && own[e + 1] >= 0) { e++; low = Math.max(low, own[e]); }
    for (let i = x; i <= e; i++) { grounded[i] = 1; colBase[i] = low - own[i] <= overhang ? own[i] : low; castFrom[i] = ownCast ? colBase[i] : low; }
    x = e + 1;
  }
  // columns with nothing near the floor (a table top between its legs) cast from the image base, without a seam
  if (!o.groundedOnly) for (let x = 0; x < width; x++) if (colBase[x] < 0) for (let y = base; y >= 0; y--) if (alpha[y * width + x]) { colBase[x] = castFrom[x] = base; break; }
  // Occlusion seam and a short contact band, only under columns that actually reach the floor.
  for (let x = 0; x < width; x++) {
    if (!grounded[x]) continue; const lb = colBase[x];
    gput(out, pad + x, lb + 1, 175); gput(out, pad + x, lb + 2, 150);
    for (let yy = 1; yy <= band; yy++) gput(out, pad + x + 1, lb + yy, 140);
  }
  if (dir) {
    // Directional cast: every silhouette pixel at height H over its foot lands H * dir further along the floor (an affine
    // shear of the picture, so a tube held high above its tripod casts a slanted band). Each pixel is sampled densely
    // along its height and across its width so the cast is continuous, then single-pixel holes are closed.
    // A column's foot is its own (a leg further back stands higher); parts well above a foot that sits near the image
    // base (a tube over a tripod leg) blend to the base, so one object has one floor line. A column that never
    // reaches the floor (a tube, a table top) hangs over the image's base.
    for (let x = 0; x < width; x++) {
      if (colBase[x] < 0) continue;
      const lb = grounded[x] ? colBase[x] : base, snap = grounded[x] && lb >= base - 8 && lb < base;
      for (let y = 0; y < lb; y++) {
        if (!alpha[y * width + x]) continue;
        const f = snap ? lb + (base - lb) * Math.min(1, (lb - y) / footReach) : lb, H = (f - y) * hScale;
        // `o.sweep` (0..1): each pixel also shades the floor between its own cast point and a point that much nearer the
        // foot, as if the part were solid down to the ground: a tree crown's shadow then joins the trunk and pools under
        // the crown instead of floating a crown-height away beyond a lit gap
        for (let t = sweep > 0 ? -H * sweep : -0.5; t <= 0.5; t += 0.25 + (sweep > 0 ? 0.25 : 0)) {
          const Ht = Math.max(0, H + t);
          for (let xo = 0; xo <= 0.5; xo += 0.5) gput(out, pad + x + xo + dir.x * Ht, f + 1 + dir.y * Ht, 125);
        }
      }
    }
    // swept (tree) shadows also shade the floor seen between splayed roots: in the foot band, any gap with the tree on
    // both sides of it in its row
    if (sweep > 0) for (let y = Math.max(0, base - footReach); y <= base; y++) {
      let l = -1, r = -1; for (let x = 0; x < width; x++) if (alpha[y * width + x]) { if (l < 0) l = x; r = x; }
      for (let x = l + 1; x < r; x++) if (!alpha[y * width + x]) gput(out, pad + x, y, 125);
    }
    // `o.under`: also shade the floor under an overhang (a bench ring between its legs): from a column's own lowest
    // pixel down to the foot it stands on
    if (o.under && dir) for (let x = 0; x < width; x++) {
      if (!grounded[x] || own[x] < 0) continue;
      for (let y = own[x] + 1; y <= colBase[x]; y++) if (!alpha[y * width + x]) gput(out, pad + x, y, 125);
    }
    const A = out.alpha, W2 = out.width, H2 = out.height, set = (i) => A[i] > 0, fill = [];
    for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) {
      const i = y * W2 + x; if (A[i]) continue;
      const l = set(i - 1), r = set(i + 1), u = set(i - W2), d = set(i + W2);
      if ((l && r) || (u && d) || [l, r, u, d, set(i - W2 - 1), set(i - W2 + 1), set(i + W2 - 1), set(i + W2 + 1)].filter(Boolean).length >= 5) fill.push(i);
    }
    for (const i of fill) A[i] = 125;
  } else if (!o.flat) {   // `o.flat`: something lying on the floor (a pond's rim) keeps the seam and contact band, no cast
  // Cast tier: each column lays a short solid run on the floor toward the lower right from its own foot, as long as
  // the column is tall (scaled so the tallest reaches `reach`), squashed hard (light from high up the upper left) so
  // it hugs the base instead of reading as a slab. Lengths are smoothed over neighbours (median of three), so thin
  // outlines and handles don't streak and the cast reads as one shape.
  let top = base; for (let y = 0; y <= base && top === base; y++) for (let x = 0; x < width; x++) if (alpha[y * width + x]) { top = y; break; }
  const k = reach / Math.max(1, base - top), len = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const lb = colBase[x]; if (lb < 0) continue;
    let n = 0; for (let y = 0; y <= lb; y++) if (alpha[y * width + x]) n++;
    len[x] = Math.min(reach, n * k);
  }
  for (let x = 0; x < width; x++) {
    const lb = colBase[x]; if (lb < 0) continue;
    const a3 = len[Math.max(0, x - 1)], b3 = len[x], c3 = len[Math.min(width - 1, x + 1)];
    const L = Math.max(Math.max(Math.min(a3, b3), Math.min(Math.max(a3, b3), c3)), b3 * 0.6);   // a lone pole still casts
    // the cast leaves from the run's lowest foot, so a round base's raised edges don't poke thin lines out below it
    for (let h = 0; h <= L; h += 0.5) gput(out, pad + x + Math.round(h), castFrom[x] + 1 + Math.round(h * 0.35), 125);
  }
  // own-foot casts (o.overhang) start on different rows, so neighbouring diagonal runs leave a hatch of 1 px holes: close
  // them (a hole between two shadow pixels, or with five shadow neighbours), twice
  if (ownCast) for (let pass = 0; pass < 2; pass++) closeHoles(out.alpha, out.width, out.height, 125);
  }
  // Thin parts (a bucket bail, a broom handle) cast lone specks: drop pixels with fewer than two lit neighbours.
  const W2 = out.width, H2 = out.height, A = out.alpha, keep = A.slice();
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    if (!A[y * W2 + x]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W2 && yy < H2 && A[yy * W2 + xx]) n++;
    }
    if (n < 2) keep[y * W2 + x] = 0;
  }
  out.alpha = keep;
  return out;
}

function closeHoles(A, W2, H2, v) {
  const set = (i) => A[i] > 0, fill = [];
  for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) {
    const i = y * W2 + x; if (A[i]) continue;
    const l = set(i - 1), r = set(i + 1), u = set(i - W2), d = set(i + W2);
    if ((l && r) || (u && d) || [l, r, u, d, set(i - W2 - 1), set(i - W2 + 1), set(i + W2 - 1), set(i + W2 + 1)].filter(Boolean).length >= 5) fill.push(i);
  }
  for (const i of fill) A[i] = v;
}

// A big tree's shadow as one piece (the Great Oak): the hard contact shadow of hardShadowMask under everything that
// stands on the floor (roots, bench legs), plus the crown's own silhouette laid on the floor towards the light's far
// side. Crown pixels (rows above `o.crownBottom`) are projected by their height ABOVE THE CROWN'S BOTTOM, from the
// trunk's ground row `o.ground`: the crown's lowest edge lands at the trunk foot (joined, no lit gap) and its top lands
// `o.reach` px further along `o.dir`, so the pool keeps the crown's rounded outline, squashed and falling lower right.
function crownShadowMask(alpha, width, height, o) {
  const dir = { x: +o.dir.x || 0, y: Math.max(0, +o.dir.y || 0) }, dirLen = Math.hypot(dir.x, dir.y) || 1;
  const cb = Math.round(o.crownBottom), ground = Math.round(o.ground);
  let top = cb; for (let y = 0; y < cb && top === cb; y++) for (let x = 0; x < width; x++) if (alpha[y * width + x]) { top = y; break; }
  const k = Math.min(1, (o.reach ?? 48) / dirLen / Math.max(1, cb - top)), lead = Math.max(0, o.lead || 0);   // `lead`: the crown's lowest edge lands this far along dir (under the roots, not as a sliver beside them)
  const contact = hardShadowMask(alpha, width, height, { overhang: o.overhang, groundedOnly: true });   // the crown's own columns cast below, not from the image base
  const ext = Math.ceil(dir.x * (k * (cb - top) + lead)) + 2, pad = contact.pad;
  const ow = contact.width + ext, oh = Math.max(contact.height, ground + Math.ceil(dir.y * (k * (cb - top) + lead)) + 4);
  const out = { width: ow, height: oh, alpha: new Uint8ClampedArray(ow * oh), pad, base: contact.base, reach: o.reach, color: SHADOW };
  for (let y = top; y < cb; y++) for (let x = 0; x < width; x++) {
    if (!alpha[y * width + x]) continue;
    const H = (cb - y) * k + lead;
    for (let t = -0.5; t <= 0.5; t += 0.25) for (let xo = 0; xo <= 0.5; xo += 0.5) gput(out, pad + x + xo + dir.x * (H + t), ground + 1 + dir.y * (H + t), 125);
  }
  // the band between the trunk foot and the pool's top edge, under the trunk: the trunk's own short cast
  for (let y = cb; y <= ground; y++) for (let x = 0; x < width; x++) {
    if (!alpha[y * width + x]) continue;
    const H = (ground - y) * k;
    for (let t = 0; t <= H + lead; t += 0.5) gput(out, pad + x + dir.x * t, ground + 1 + dir.y * t, 125);
  }
  closeHoles(out.alpha, ow, oh, 125); closeHoles(out.alpha, ow, oh, 125);
  // open (erode, then dilate) the pool so the crown's ragged edge leaves no 1-2 px slivers on the floor
  const A = out.alpha, er = new Uint8ClampedArray(A.length);
  for (let y = 1; y < oh - 1; y++) for (let x = 1; x < ow - 1; x++) {
    let all = true; for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (!A[(y + dy) * ow + x + dx]) { all = false; break; }
    if (all) er[y * ow + x] = 125;
  }
  A.fill(0);
  // light from the upper left: nothing of the pool reaches left of where the tree meets the floor
  let left = contact.width; for (let y = 0; y < contact.height; y++) for (let x = 0; x < left; x++) if (contact.alpha[y * contact.width + x]) { left = x; break; }
  for (let y = 1; y < oh - 1; y++) for (let x = Math.max(1, left + 1); x < ow - 1; x++) if (er[y * ow + x]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) A[(y + dy) * ow + x + dx] = 125;
  // and under everything that stands on the floor, hardShadowMask's occlusion seam and contact band
  for (let y = 0; y < contact.height; y++) for (let x = 0; x < contact.width; x++) { const v = contact.alpha[y * contact.width + x]; if (v > A[y * ow + x]) A[y * ow + x] = v; }
  return out;
}

function alphaOf(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  return x.getImageData(0, 0, img.width, img.height).data.filter((_, i) => (i & 3) === 3).map(a => (a >= 128 ? a : 0));
}
// draw an alpha mask in the shadow colour onto a canvas context (whole pixels, hard edge)
function paintMask(g, m, dx, dy, scale = 1) {
  const id = g.getImageData(dx, dy, m.width, m.height), d = id.data;
  for (let i = 0; i < m.alpha.length; i++) {
    const a = m.alpha[i] * scale / 255; if (!a) continue; const j = i * 4;
    d[j] = d[j] * (1 - a) + SHADOW_RGB[0] * a; d[j + 1] = d[j + 1] * (1 - a) + SHADOW_RGB[1] * a; d[j + 2] = d[j + 2] * (1 - a) + SHADOW_RGB[2] * a;
  }
  g.putImageData(id, dx, dy);
}
// the floor reacting under a heavy base on paving: darkened joints and a little grit 2-4 px around the seam
function floorReaction(g, m, dx, dy, seed) {   // the paving reacts 3-6 px under the seam (the mask's 175 row): grout darkened, a little grit
  const id = g.getImageData(dx, dy, m.width, m.height), d = id.data; let s = seed;
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let x = 0; x < m.width; x++) {
    let lb = -1; for (let y = 0; y < m.height; y++) if (m.alpha[y * m.width + x] === 175) { lb = y; break; }
    if (lb < 0) continue;
    for (let k = 2; k <= 5; k++) for (const xx of [x - 2, x, x + 3]) {
      const py = lb + k; if (xx < 0 || py >= m.height || xx >= m.width) continue;
      const j = (py * m.width + xx) * 4, lum = (d[j] + d[j + 1] + d[j + 2]) / 3;
      if (lum < 92 && r() < 0.8) { const a = 0.32; d[j] = d[j] * (1 - a) + SHADOW_RGB[0] * a; d[j + 1] = d[j + 1] * (1 - a) + SHADOW_RGB[1] * a; d[j + 2] = d[j + 2] * (1 - a) + SHADOW_RGB[2] * a; }
      else if (r() < 0.05) { d[j] = 90; d[j + 1] = 61; d[j + 2] = 43; }
    }
  }
  g.putImageData(id, dx, dy);
}
// on grass: an occlusion band hugging the base plus a soil stain (floor layer), and tufts, pebbles and clods that grow up OVER the
// bottom edge (front layer), so the base reads sunk into the ground (Imagination ground.js groundKit)
const GR = ['#243d33', '#35593f', '#4f7d4a', '#7aa05a', '#a9c46f', '#c9d98a'], DIRT = ['#3a2e2c', '#5a3d2b', '#7d5434'], STONE = ['#5d5b63', '#85807f', '#aea89c'];
function groundKit(img, seed, o = {}) {
  const W = img.width, H = img.height, A = alphaOf(img), op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && A[y * W + x] > 0, M = 10;
  let s = seed * 977 + W * 13 + H; const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const h2 = (x, y, k) => { let t = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0; t = (t ^ (t >>> 13)) * 1274126177 >>> 0; return (t & 0xffff) / 65536; };
  const zone = o.zone ?? Math.max(10, Math.min(40, H * 0.3)), base = new Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let y = H - 1; y >= 0; y--) if (op(x, y)) { if (y >= H - 1 - zone) base[x] = y; break; }
  const cols = base.map((y, x) => (y >= 0 ? x : -1)).filter(x => x >= 0); if (!cols.length) return null;
  const x0 = cols[0], x1 = cols[cols.length - 1];
  const mk = () => { const c = document.createElement('canvas'); c.width = W + 2 * M; c.height = H + 2 * M; return c; };
  const cc = mk(), cg = cc.getContext('2d'), fc = mk(), fg = fc.getContext('2d');
  const dot = (g, x, y, col) => { g.fillStyle = col; g.fillRect(x + M, y + M, 1, 1); };
  for (let x = x0 - 3; x <= x1 + 3; x++) {
    const bx = Math.min(Math.max(x, x0), x1), by = base[bx] >= 0 ? base[bx] : H - 1, edge = x < x0 || x > x1;
    for (let k = -1; k <= 3; k++) {
      const a = edge ? (k <= 0 ? 0.32 : 0) : k <= 1 ? 0.6 : 0.32;
      if (a && (k < 2 || h2(x, k, seed) < 0.6)) dot(cg, x, by + k, `rgba(12,36,24,${a})`);
    }
    if (!edge && h2(x >> 1, 3, seed) < 0.35) dot(cg, x, by + 3, 'rgba(90,61,43,0.65)');   // soil stain
  }
  const tuft = (cx, by, h) => {
    const n = 3 + Math.floor(r() * 3);
    for (let b = 0; b < n; b++) {
      const lean = (b - (n - 1) / 2) * 0.55 + (r() - 0.5) * 0.5, len = Math.max(3, Math.round(h * (0.6 + r() * 0.5)));
      for (let k = 0; k < len; k++) { const x = Math.round(cx + lean * k * 0.6), y = by + 2 - k; dot(fg, x, y, k >= len - 2 ? GR[4] : k < 2 ? GR[1] : GR[3]); if (k < len - 2) dot(fg, x + 1, y, GR[0]); }
    }
  };
  const density = o.density ?? 1;
  for (let x = x0 - 2; x <= x1 + 2;) {
    const bx = Math.min(Math.max(x, x0), x1), by = base[bx] >= 0 ? base[bx] : H - 1, roll = r();
    if (roll < 0.55 * density) tuft(x, by, o.tall ?? 6);
    else if (roll < 0.7) { const sz = r() < 0.5 ? 2 : 1; fg.fillStyle = STONE[1]; fg.fillRect(x + M, by + 1 + M, sz + 1, sz); dot(fg, x, by + 1, STONE[2]); }
    else if (roll < 0.8) { fg.fillStyle = DIRT[1]; fg.fillRect(x + M, by + 2 + M, 2, 1); dot(fg, x + 2, by + 2, DIRT[2]); }
    else if (roll < 0.86) { tuft(x, by, 5); dot(fg, x, by - 4, r() < 0.5 ? '#c9473a' : '#f2d47a'); }
    x += 3 + Math.floor(r() * (6 / density));
  }
  return { contact: cc, fringe: fc, m: M };
}
// figures: Imagination feetBlobMask, verbatim (65% of the width it is given, a third as tall, alpha 153, hard edge);
// callers pass bodyBlob's width (the figure's opaque width x 0.6 / 0.65), so the ellipse is 60% of the body
const blobCache = new Map();
function feetBlob(w, alpha = 153) {   // v11: alpha 153 on soft ground, deeper on paving (the hard floor reacts, ART_DIRECTION §3)
  const key = Math.round(w) + '/' + alpha; if (blobCache.has(key)) return blobCache.get(key);
  const width = Math.max(4, Math.round(Math.round(w) * 0.65)), height = Math.max(2, Math.round(width / 3));
  const c = document.createElement('canvas'); c.width = width; c.height = height; const g = c.getContext('2d'), id = g.createImageData(width, height);
  const rx = width / 2, ry = height / 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (((x + .5 - rx) / rx) ** 2 + ((y + .5 - ry) / ry) ** 2 <= 1) { const j = (y * width + x) * 4; id.data[j] = 0x32; id.data[j + 1] = 0x21; id.data[j + 2] = 0x25; id.data[j + 3] = alpha; }
  g.putImageData(id, 0, 0); blobCache.set(key, c); return c;
}
