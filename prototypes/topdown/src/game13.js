'use strict';
// Ba Dan, top-down (v8): the village as a diorama, grounded by Imagination's art-direction rules (one shadow, plinths, sunk bases).
// v7: the whole village in the v2 style. Kaya is v2 exactly (walk, idle, look-around) plus the v4 bends;
// the residents are new PixelLab characters made with v2 Kaya's settings. No motion layer.
// Ba Dan Lane v6: v2 Kaya (unchanged base and coat) with a relaxed walk take, the v4 bends, v2's pace; no motion layer.
// Ba Dan Lane v2. Every sprite and tile is PixelLab output (see README). The engine supplies the motion:
// continuous movement with eased starts and stops, walk frames advanced by distance travelled (not by time),
// facing that sweeps through the in-between headings, and a smoothed whole-pixel camera.
const T = 32, MW = 39, MH = 31, PW = MW * T, PH = MH * T;   // the village's ground mass plus three tiles of void around it
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']; // index * 45deg, y down
const Q = new URLSearchParams(location.search);
const AREA = window.AREA || null;
const REC = AREA ? !!AREA.rec : Q.get('record') === '1';
const OVERVIEW = Q.get('overview') === '1';
if (REC || OVERVIEW) document.body.classList.add('rec');
let seed = 1234567;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const CELL = ASSETS.cell, AX = ASSETS.ax, AY = ASSETS.ay;

// ---------- tuning
const WALK_SPEED = 66;            // px/s, v2's pace (v5 walks the v2 way)
const CYCLE_PX = 30;              // v2's cadence: ground per 12-frame cycle
const ACCEL = 9, DECEL = 11;      // exponential ease rates in and out (1/s)
const TURN = Math.PI * 3.2;       // rad/s: a 180-degree turn sweeps through the diagonals in ~0.3 s

// ---------- images
const IMG = {};
const load = (key, src) => new Promise(r => { const i = new Image(); i.onload = () => { IMG[key] = i; r(); }; i.src = src; });
const loads = [];
for (const [k, s] of Object.entries(ASSETS.tiles)) loads.push(load('tile:' + k, s));
for (const [k, v] of Object.entries(ASSETS.variants)) loads.push(load('var:' + k, v.src));
for (const [c, clips] of Object.entries(ASSETS.chars)) for (const [n, v] of Object.entries(clips)) loads.push(load(`ch:${c}:${n}`, v.src));
for (const [k, v] of Object.entries(ASSETS.objects)) loads.push(load('ob:' + k, v.src));
for (const [k, v] of Object.entries(ASSETS.moves.vfx)) { if (v.src) loads.push(load('fx:' + k, v.src)); else for (const [d, w] of Object.entries(v)) loads.push(load(`fx:${k}:${d}`, w.src)); }

loads.push(load('cliff', ASSETS.cliff.src));

// ---------- grounding (ported from Imagination's src/game/grounding.js and src/game/ground.js, ART_DIRECTION §2-3)
// One shadow colour, hard edge, light from the upper left: an occlusion seam where the base meets the floor, a contact band
// on the lower and right sides, and a short cast to the lower right that never runs further than one tile.
const SHADOW = '#322125', SHADOW_RGB = [0x32, 0x21, 0x25];
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
  const reach = clamp(Math.round(o.reach ?? height * 0.3), 12, 24);
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

// ---------- what stands in Ba Dan (centre x, base y in world px). Every placed object gets the grounding treatment.
const OBJ = [], SOLID = [];
function put(k, cx, by, o = {}) {
  const a = ASSETS.objects[k]; if (!a) { console.warn('missing', k); return null; }
  const ob = { k, x: Math.round(cx - a.w / 2), y: by - a.h, w: a.w, h: a.h, base: by, flat: !!o.flat, label: o.label, kind: o.kind || (o.flat ? 'flat' : 'prop'), noShadow: !!o.noShadow };
  OBJ.push(ob);
  const foot = o.foot === false ? null : o.foot || [Math.round(a.w * 0.78), Math.min(14, Math.max(6, Math.round(a.h * 0.18)))];
  if (foot && !o.flat) SOLID.push({ x: cx - foot[0] / 2, y: by - foot[1], w: foot[0], h: foot[1] });
  return ob;
}
const NB = 336, SB = 812;   // the north and south house rows stand on their lanes
// the north street: Gao's merchant house with his yard, a woodshed in the gap, Mira's house, the north-east neighbour
const gaoHouse = put('house_gao', 448, NB, { kind: 'house', foot: [140, 104] });
put('banner_pole', 564, NB + 4, { foot: [10, 6] });
const miraHouse = put('house_mira', 688, NB, { kind: 'house', foot: [140, 104] });
const neHouse = put('house_ne', 932, NB, { kind: 'house', foot: [140, 104] });
// Gao's yard on his west side: a fence, his bread oven, the sacks; his door barrel and herb rack at his shopfront
put('fence', 330, NB + 4, { foot: [70, 8] }); put('fence', 330, NB - 40, { foot: [70, 8] });
put('oven', 318, NB - 12); put('sacks', 352, NB - 18);
put('barrel', 505, NB + 8); put('herb_shelf', 388, NB + 10);
put('rain_barrel', 801, NB + 8);
put('bucket_broom', 744, NB + 8); put('flower_pots', 978, NB + 10); put('crates', 1010, NB + 22);
// the north court: Gao's display, Mira's table with the pot on the fire, the north display; the handcart
put('market_jars', 412, 404);
const miraTable = put('mira_table', 560, 402);
put('cookpot', 646, 392);
put('market_veg', 776, 402);
put('handcart', 968, 392);
put('laundry_line', 1090, 252, { foot: [70, 6] }); put('woodshed', 1102, NB + 4, { foot: [70, 14] });
// the canal: the bridge styled on its own bank stones (deck walkable, drawn as ground), the dry crossing is paving
const bridge = put('bridge', 508, 476, { flat: true, kind: 'bridge' });
// the watch post on the east square: Dorin's post, the notice board, the shrine, lamps; the road's drains
put('notice_board', 872, 474);
put('shrine', 716, 456);
put('lamp', 948, 486, { foot: [10, 6] }); put('lamp', 1028, 486, { foot: [10, 6] }); put('lamp', 330, 412, { foot: [10, 6] });
put('lamp', 788, 604, { foot: [10, 6] }); put('lamp', 948, 604, { foot: [10, 6] });
// the north-west bank: Dorin's practice ground (dummy, target), the bench and fence
const dummy = put('dummy', 214, 384); dummy.hit = -1;
put('target', 150, 372); put('bench', 118, 428); put('fence', 196, 300, { foot: [70, 8] });
// south of the road: the south market stall, the garden plot, the stone lantern
put('stall', 262, 650); put('produce', 322, 652); put('pots', 212, 650);
put('garden', 248, 730, { foot: [60, 24] });
put('stone_lantern', 330, 736);
// the south street: Pella's house, the merchant house, Hanru's house; the well in the court between them
const pellaHouse = put('house_pella', 448, SB, { kind: 'house', foot: [146, 104] });
put('house_merchant', 735, SB, { kind: 'house', foot: [172, 96] });
const seHouse = put('house_se', 1002, SB, { kind: 'house', foot: [146, 104] });
put('well', 600, 640, { foot: [56, 22] });
put('planter', 380, SB + 18); put('flower_pots', 520, SB + 16); put('firewood', 1092, SB + 26);
put('crates_barrel', 628, SB + 14); put('beehive', 150, 700); put('sack', 860, NB + 40);
put('trough', 1090, 650); put('haystack', 1112, 414);
// the way-marks: the forest road at the east edge, the riverside path
const exitSign = put('signpost', 1056, 500, { label: 'TO THE FOREST ROAD' });
const walkway = put('walkway', 1150 + 44, 556, { flat: true });   // the canal bridge's twin carries the road on east over the edge, into the dark
const riverSign = put('signpost', 818, 866, { label: 'RIVERSIDE' });
// trees and bushes: the court trees, a few behind the north houses, and the rim (overhanging the edge)
const BLOSSOMS = [];
for (const [k, x, y] of [
  ['bush', 520, 300],   // v14: the blossom tree that stood at (790, 236) is gone: the redrawn Mira house's side wall and roof now cover its crown, so it showed as a red blob on the eave
 
  ['tree', 150, 160], ['tree_blossom', 270, 140], ['tree', 400, 150], ['tree', 1080, 150], ['tree_blossom', 1150, 190], ['tree', 700, 132], ['bush', 860, 130], ['bush', 560, 140],
  ['tree', 110, 300], ['bush', 96, 360], ['tree', 104, 620], ['tree_blossom', 120, 760], ['tree', 180, 860], ['bush', 480, 852], ['tree', 300, 850], ['tree_blossom', 556, 880],
  ['bush', 700, 880], ['bush', 968, 852], ['bush', 1150, 700], ['bush', 1186, 250],
  ['bush', 60, 860], ['bush', 1150, 870], ['tree_blossom', 884, 652], ['bush', 1170, 640]]) {
  const o = put(k, x, y, { foot: k === 'bush' ? [24, 10] : [22, 12], kind: 'tree' }); if (k === 'tree_blossom') BLOSSOMS.push(o);
}
for (const [x, y] of [[180, 720], [960, 700], [640, 290], [470, 250]]) put('flowers', x, y, { flat: true });
for (const [x, y] of [[150, 560], [470, 860], [560, 830], [700, 120], [320, 130], [900, 170], [760, 850], [240, 800], [1090, 420], [880, 250]]) put('tuft', x, y, { flat: true });
// v12 (item 7): nothing roots on or near the cliff. A tree's trunk stands at least 22 px inside the grass lip (a bit more than half a tile), and a
// crown may overhang the drop by 14 px at most, so none floats over the void. The grass lip sits a little off the vertex line (measured on the baked
// ground): left -14, right +18, top -8, bottom +18. The fix is a fixed point, because the lip moves with the rim's bites.
const MOVED = [];
const lipL = y => Math.max(LEFTV(Math.floor(y / T)), LEFTV(Math.floor(y / T) - 1)) * T - 14, lipR = y => Math.min(RIGHTV(Math.floor(y / T)), RIGHTV(Math.floor(y / T) - 1)) * T + 18;
const lipT = (x0, x1) => { let m = 0; for (let c = Math.floor(x0 / T); c <= Math.floor(x1 / T); c++) m = Math.max(m, TOPV(Math.max(0, Math.min(MW, c))) * T - 8); return m; };
const LIPB = BOTV(0) * T + 18, TRUNK = 22, HANG = 14;
for (const o of OBJ) {
  if (o.kind !== 'tree' && o.k !== 'tuft' && o.k !== 'flowers') continue;
  const cx0 = o.x + o.w / 2, base0 = o.base, tree = o.kind === 'tree';
  let cx = cx0, base = base0;
  for (let it = 0; it < 6; it++) {
    const m = tree ? Math.max(TRUNK, o.w / 2 - HANG) : 10;
    cx = Math.max(lipL(base) + m, Math.min(lipR(base) - m, cx));
    base = Math.min(LIPB - (tree ? TRUNK : 10), base);
    if (tree) base = Math.max(base, lipT(cx - o.w / 2, cx + o.w / 2) + o.h - HANG); else base = Math.max(base, lipT(cx, cx) + 12);
  }
  const dx = Math.round(cx - cx0), dy = Math.round(base - base0); if (!dx && !dy) continue;
  const sol = SOLID.find(q => Math.abs(q.y + q.h - o.base) < 1 && Math.abs(q.x + q.w / 2 - cx0) < 2); if (sol) { sol.x += dx; sol.y += dy; }
  o.x += dx; o.base += dy; o.y += dy; MOVED.push([o.k, dx, dy]);
}
const lamps = OBJ.filter(o => o.k === 'lamp');
// the canal is water except under the bridge deck; the flooded ford closes the west road
const CANAL_TOP = 14 * T - 18, CANAL_BOT = 14 * T + 22, DECK_L = 498, DECK_R = 518;
SOLID.push({ x: 0, y: CANAL_TOP, w: DECK_L, h: CANAL_BOT - CANAL_TOP }, { x: DECK_R, y: CANAL_TOP, w: 20 * T - 4 - DECK_R, h: CANAL_BOT - CANAL_TOP });
SOLID.push({ x: 108, y: 498, w: 72, h: 58 });
SOLID.push({ x: 487, y: 428, w: 11, h: 48 }, { x: 518, y: 428, w: 12, h: 48 });   // the abutments' wings   // the flooded ford
// smoke leaves the chimneys the art draws (top of each chimney, measured from the sprites)
const CHIMNEYS = [];
const FOOT_W = 12, FOOT_H = 6;
function walkableCell(x, y) { const cx = Math.floor(x / T), cy = Math.floor(y / T); return inMass(cx, cy) && inMass(cx + 1, cy) && inMass(cx, cy + 1) && inMass(cx + 1, cy + 1); }
function solidAt(x, y, w = FOOT_W, h = FOOT_H) {
  const l = x - w / 2, t = y - h, r = x + w / 2, b = y;
  if (l < 2 || r > PW - 2 || t < 2 || b > PH - 2) return true;
  const onWalk = y > 528 && y < 560 && x > 33 * T;                  // the east road's walkway, out over the edge
  if (!onWalk && !(walkableCell(l, t) && walkableCell(r, t) && walkableCell(l, b) && walkableCell(r, b))) return true;
  if (onWalk && x > PW - 40) return true;
  for (const s of SOLID) if (l < s.x + s.w && r > s.x && t < s.y + s.h && b > s.y) return true;
  return false;
}

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
      const bm = hardShadowMask(alphaOf(img), img.width, img.height, { flat: true, band: 4, base: 34 }); paintMask(g, bm, o.x - bm.pad, o.y);
      bridgeShadow(g, o, img);   // v13: the deck's own silhouette on the water, not a flat rectangle
      g.drawImage(img, o.x, o.y); continue;
    }
    // Imagination's per-item options (island2 dress2.shadowOpts2): trees take the sun-swept joined shadow (TREE_SUN2,
    // reach a third of the height, at most 52); everything else the short floor shadow with an overhang allowance that grows
    // with the width (a round well's seam follows its curve); houses the heavy contact band
    const ow8 = Math.max(8, Math.round(img.width * 0.15)), bushy = o.k === 'bush';
    const opts = o.kind === 'house' ? { overhang: ow8, band: 6 } : o.kind === 'tree' && !bushy ? { dir: { x: 0.42, y: 0.3 }, foot: 8, sweep: 1, reach: Math.min(52, Math.max(12, Math.round(img.height * 0.32))) } : { overhang: ow8 };
    if (o.kind === 'house') houseApron(g, o, img);   // v15: a packed-earth apron along the front, so no grass touches the footing
    if (o.kind === 'house') { houseDoorstep(g, o); houseSideShadow(g, o, img, under === 'G' || under === 'D' ? 0.6 : 0.78); }
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
function houseApron(g, o, img) {
  // the sprite's foundation spans [x0, x1] on its bottom rows; the apron runs 5 px past it each side and 8-10 px down from the base line:
  // a dark seam on the base (occlusion), trodden earth in three tones with a ragged lower edge, small stones, a lit pebble or two.
  const A = alphaOf(img), W = img.width, Hh = img.height; let x0 = W, x1 = 0;
  for (let y = Hh - 6; y < Hh; y++) for (let x = 0; x < W; x++) if (A[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  for (let x = x0 - 6; x <= x1 + 6; x++) {
    const wx = o.x + x, edge = x < x0 || x > x1, d = (edge ? 6 : 12) + Math.round(vnoise(wx, o.base, 41, 3) * 2.2);
    for (let k = -1; k < d; k++) {
      if (k < 0 && edge) continue;
      const t = vnoise(wx, o.base + k, 43, 2.5);
      g.fillStyle = k < 1 ? 'rgba(50,33,37,0.8)' : k < 2 ? DIRT[0] : k < d - 2 ? (t > 0.15 ? DIRT[2] : DIRT[1]) : DIRT[1];
      if (k >= d - 2 && ((wx + k) & 1)) continue;   // the lower edge breaks into the ground
      g.fillRect(wx, o.base + k, 1, 1);
    }
  }
  for (let i = 0, n = Math.round((x1 - x0) / 9); i < n; i++) { const sx = o.x + x0 - 3 + Math.floor(hash2(i, o.base, 47) * (x1 - x0 + 6)), sy = o.base + 3 + (i % 4); g.fillStyle = STONE[1]; g.fillRect(sx, sy, 2, 1); g.fillStyle = STONE[2]; g.fillRect(sx, sy, 1, 1); }
}
function houseDoorstep(g, o) {
  // v15: the doorstep sits on the path: two flagstones lead out from the art's own step slab over the apron (the lane's edge).
  const cx = o.x + (o.w >> 1), w = o.k === 'house_merchant' ? 44 : 22, x0 = cx - (w >> 1), b = o.base;
  for (let r = 0; r < 2; r++) {
    const y = b + 2 + r * 6, xo = r ? 3 : 0, ww = w - 4 - r * 4;
    g.fillStyle = '#3e3d47'; g.fillRect(x0 + xo + 2, y - 1, ww, 7); g.fillStyle = '#85807f'; g.fillRect(x0 + xo + 3, y, ww - 2, 4); g.fillStyle = '#aea89c'; g.fillRect(x0 + xo + 3, y, ww - 2, 1); g.fillStyle = '#5d5b63'; g.fillRect(x0 + xo + 3, y + 4, ww - 2, 1);
  }
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

// v13 (Jared: the bridge's shadow reads as a flat grey rectangle). Light from the upper left: the deck, its rails and posts throw
// their own shape onto the water a few px to the lower right. The bridge sprite's silhouette, row by row within the canal, is
// shifted (+6, +3), each row nudged a pixel by the ripples, and laid only on water pixels; a deeper core hugs the deck, the far
// edge breaks into a dither where the ripples catch the light. The bridge itself is drawn over it, so only the cast shows.
function bridgeShadow(g, o, img) {
  const A = alphaOf(img), W = img.width, Hh = img.height, x0 = o.x - 2, y0 = CANAL_TOP - 4, w = W + 26, h = CANAL_BOT - CANAL_TOP + 12;
  const id = g.getImageData(x0, y0, w, h), d = id.data, m = new Uint8Array(w * h);
  for (let y = 0; y < Hh; y++) {
    const wy = o.y + y; if (wy < CANAL_TOP - 3 || wy > CANAL_BOT + 2) continue;
    const off = 8 + Math.round(vnoise(3, wy, 77, 2.5) * 1.4);
    for (let x = 0; x < W; x++) { if (!A[y * W + x]) continue; const sx = o.x + x + off - x0, sy = wy + 4 - y0; if (sx >= 0 && sy >= 0 && sx < w && sy < h) m[sy * w + sx] = 1; }
  }
  const water = j => d[j + 2] > d[j] + 18 && d[j + 1] > d[j] + 10;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, j = i * 4; if (!m[i] || !water(j)) continue;
    const rim = !m[i + 1] || !m[i + w] || !m[i - w], core = m[i - 3] && m[i - 6];
    if (rim && (x + y) % 2) continue;                       // the ripples break the far edge
    const a = rim ? 0.32 : core ? 0.5 : 0.42;
    d[j] = d[j] * (1 - a) + 0x32 * a; d[j + 1] = d[j + 1] * (1 - a) + 0x21 * a; d[j + 2] = d[j + 2] * (1 - a) + 0x25 * a;
  }
  g.putImageData(id, x0, y0);
}
// v14: the redrawn houses show their side wall in the art (receding up and to the right in shade), so the ground beside it follows the
// wall's own foot line: per column from the front corner out to the far end, a hard 6 px band under the foot (contact, then a lighter
// cast), and past the far end a short tail to the lower right. Light from the upper left, so it falls on the right and never past ~9 px.
// v15: the houses are straight-on, so the sun (upper left) throws the wall's shadow to the right of it and onto the lane in front: a hard
// parallelogram 18 px wide beside the foundation (rising 24 px up the picture, skewed down to the right) and a 7 px strip under the apron that
// runs from just inside the left foot to 18 px past the right one. #322125, alpha .55; drawn under the sprite, so only the cast shows.
function houseSideShadow(g, o, img, alpha) {
  const A = alphaOf(img), W = img.width, Hh = img.height; let x0 = W, x1 = 0;
  for (let y = Hh - 6; y < Hh; y++) for (let x = 0; x < W; x++) if (A[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  g.fillStyle = `rgba(50,33,37,${alpha})`;
  for (let k = 1; k <= 22; k++) {
    const wx = o.x + x1 + k, top = o.base - 30 + Math.floor(k * 0.6), bot = o.base + 9 + Math.floor(k * 0.4) + Math.round(vnoise(wx, o.base, 93, 3) * 0.8);
    g.fillRect(wx, top, 1, bot - top);
  }
  for (let x = x0 + 8; x <= x1 + 22; x++) { const wx = o.x + x, d = x > x1 ? Math.floor((x - x1) * 0.4) : 0; g.fillRect(wx, o.base + 9 + (x > x1 ? Math.floor((x - x1) * 0.3) : 0), 1, 5 + Math.round(vnoise(wx, o.base, 95, 3) * 0.7)); }
}

// ---------- actors
const angOf = d => DIRS.indexOf(d) * Math.PI / 4;
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
class Actor {
  constructor(name, x, y, face = 'south', speed = WALK_SPEED) {
    Object.assign(this, { name, x, y, vx: 0, vy: 0, face: angOf(face), want: angOf(face), speed, dist: 0, idleT: 0, look: -1, path: [], cycle: CYCLE_PX });
  }
  get heading() { const i = ((Math.round(this.face / (Math.PI / 4)) % 8) + 8) % 8; return DIRS[i]; }
  get moving() { return Math.hypot(this.vx, this.vy) > 6; }
  // ix, iy: desired direction (unit or zero). Eased velocity, axis-separated collision so walls slide.
  drive(ix, iy, dt, maxSpeed = this.speed) {
    const s = dt / 1000, tx = ix * maxSpeed, ty = iy * maxSpeed;
    const k = 1 - Math.exp(-(ix || iy ? ACCEL : DECEL) * s);
    this.vx += (tx - this.vx) * k; this.vy += (ty - this.vy) * k;
    if (Math.abs(this.vx) < 0.5 && !ix) this.vx = 0; if (Math.abs(this.vy) < 0.5 && !iy) this.vy = 0;
    const ox = this.x, oy = this.y;
    const nx = this.x + this.vx * s; if (!solidAt(nx, this.y, this.fw, this.fh) && !this.bump(nx, this.y)) this.x = nx; else this.vx = 0;
    const ny = this.y + this.vy * s; if (!solidAt(this.x, ny, this.fw, this.fh) && !this.bump(this.x, ny)) this.y = ny; else this.vy = 0;
    const moved = Math.hypot(this.x - ox, this.y - oy); this.dist += moved;
    if (ix || iy) this.want = Math.atan2(iy, ix);
    // sweep the facing toward the wanted heading at a fixed turn rate, so a reversal passes through the diagonals
    const d = wrap(this.want - this.face), st = TURN * s;
    this.face = Math.abs(d) <= st ? this.want : wrap(this.face + Math.sign(d) * st);
    if (moved > 0.05 || ix || iy) { this.idleT = 0; this.look = -1; } else this.idleT += dt;
    return moved;
  }
  bump(x, y) { for (const o of ACTORS) if (o !== this && o.solid && Math.abs(o.x - x) < 14 && Math.abs(o.y - y) < 8 && Math.hypot(o.x - x, o.y - y) < Math.hypot(o.x - this.x, o.y - this.y)) return true; return false; }
  // steer along this.path; ease into the last point
  follow(dt) {
    if (!this.path.length) return this.drive(0, 0, dt);
    const [px, py] = this.path[0], dx = px - this.x, dy = py - this.y, d = Math.hypot(dx, dy);
    const last = this.path.length === 1;
    if (d < (last ? 1.5 : 7)) { this.path.shift(); if (!this.path.length) { this.arrive && this.arrive(); } return this.drive(0, 0, dt); }
    if (this === kaya) {
      if (Math.abs(this.x - (this.px0 ?? 0)) + Math.abs(this.y - (this.py0 ?? 0)) > 0.4) { this.px0 = this.x; this.py0 = this.y; this.stall = 0; }
      else if ((this.stall = (this.stall || 0) + dt) > 250) {
        this.stall = 0; const goal = this.path[this.path.length - 1], cx = Math.floor(this.x / NG), cy = Math.floor(this.y / NG);
        let best = null, bd = 1e9; for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) if (navFree(x, y)) { const q = Math.hypot(x * NG + 8 - this.x, y * NG + 11 - this.y); if (q < bd) { bd = q; best = [x * NG + 8, y * NG + 11]; } }
        const rest = astar(best ? best[0] : this.x, best ? best[1] : this.y, goal[0], goal[1]) || [];
        this.path = best ? [best, ...rest] : rest; return this.drive(0, 0, dt);
      }
    }
    const sp = last ? Math.min(this.speed, 18 + d * 3.2) : this.speed;
    return this.drive(dx / d, dy / d, dt, sp);
  }
}
// ---------- the people of Ba Dan (src/content/residents/baDan.ts and routines.ts, simplified to one daytime loop)
const kaya = new Actor('kaya', 300, 532, 'east');          // the party spawn on the west road, (3,7)
kaya.solid = true;
// lines: the opening of each resident's real talk node (story/act1.ts, story/baDanDay.ts)
const RES = [
  { id: 'mira', name: 'Elder Mira', at: [612, 402], face: 'south', speed: 0,
    lines: ['Come in. There is rice if you have not eaten. We need to talk about the quarry.',
            'No carts for a month. I sent four people to find out why. None came home.'] },
  { id: 'gao', name: 'Gao the Shopkeeper', at: [460, 404], face: 'west', speed: 40,   // BD02 shopfront: display, lane, door step, lane
    route: [[460, 404, 4000, 'west'], [508, 362, 5000, 'south'], [448, 354, 2500, 'north'], [508, 362, 6000, 'south']],
    lines: ['For the quarry? Water skins are by the door. Take one. You can pay me when everyone is home.',
            'The cutting is flooded in places. Mind your footing, especially if there is a fight.'] },
  { id: 'pella', name: 'Pella', at: [560, 690], face: 'south', speed: 44,           // BD04: plays around the well in the court between the south houses
    route: [[560, 690, 3000, 'south'], [592, 700, 2500, 'east'], [578, 770, 2500, 'south'], [552, 662, 2000, 'west']],
    lines: ['My brother took vegetables up before Mira sent the others. Bo-shan. That makes five missing. He was supposed to be back on Tuesday.',
            'Mira says \u201cthe missing people\u201d every time. She could say his name. She knows his name.'] },
  { id: 'dorin', name: 'Gate Guard Dorin', at: [828, 478], face: 'south', speed: 54, // BD03 post, then footing drill at the dummy on the canal bank
    route: [[828, 478, 7000, 'south'], [192, 424, 9000, 'north']],
    lines: ['East road, then the switchbacks. About two hours. Longer if the mud is bad.',
            'Mira wants me here in case anyone makes it back. If you find someone who can walk, send them down. I will watch for them.'] },
  { id: 'hanru', name: 'Hanru', at: [786, 480], face: 'south', speed: 0,            // the handover spot (16,6)
    lines: ['I have the watch until dawn. Walk where you like. I only ask where people are going when they look lost.',
            'That lamp by the east road stays lit. If anyone comes down from the quarry in the dark, they will see it.'] },
  { id: 'household', name: null, at: [448, 834], face: 'south', speed: 40,           // bg.pella_household: a basket up to the square and back
    route: [[448, 834, 1500, 'south'], [222, 834, 1500, 'west'], [196, 640, 1500, 'north'], [300, 548, 1500, 'east'],
            [524, 372, 3500, 'north'], [508, 548, 1500, 'south'], [196, 640, 1500, 'west'], [222, 810, 1500, 'south']] },
];
const people = RES.map(r => {
  const a = new Actor(r.id, r.at[0], r.at[1], r.face, r.speed || WALK_SPEED); a.solid = true; a.def = r; a.leg = 0; a.hold = 1000 + rnd() * 2000; a.phase = rnd() * 1500;
  return a;
});
const cat = new Actor('cat', 335, 884, 'east', 26); cat.cycle = 22; cat.fw = 10; cat.fh = 4;
const ACTORS = [kaya, ...people, cat];
const talkable = people.filter(p => p.def.lines);
function updatePerson(p, dt) {
  const r = p.def;
  if (p.talking) { p.drive(0, 0, dt); p.want = Math.atan2(kaya.y - p.y, kaya.x - p.x); return; }
  if (!r.route) { p.drive(0, 0, dt); p.want = angOf(r.face); return; }
  if (p.hold > 0) { p.hold -= dt; p.drive(0, 0, dt); if (p.faceTo) p.want = angOf(p.faceTo); return; }
  if (!p.path.length && !p.going) {
    p.leg = (p.leg + 1) % r.route.length; const [x, y] = r.route[p.leg];
    p.path = astar(p.x, p.y, x, y, p) || [[x, y]]; p.going = true;
    p.arrive = () => { const w = r.route[p.leg]; p.hold = w[2]; p.faceTo = w[3]; p.going = false; };
  }
  p.follow(dt);
  if (p.going && !p.path.length && !p.moving) { p.going = false; p.hold = 800; }   // blocked: wait, then try the next leg
}
// the cat pads along the south lawn and settles down between walks
const catRoute = [[335, 884], [455, 884]]; let catLeg = 1, catSit = 0, catSitT = 0;
function updateCat(dt) {
  if (catSit > 0) { catSit -= dt; catSitT += dt; cat.drive(0, 0, dt); return; }
  if (!cat.path.length) { cat.path = [catRoute[catLeg]]; cat.arrive = () => { catLeg = 1 - catLeg; catSit = 5200; catSitT = 0; }; }
  cat.follow(dt);
  const h = cat.heading; if (h !== 'east' && h !== 'west') cat.face = cat.vx >= 0 ? 0 : Math.PI;
}

// ---------- pathing: A* on a 16 px nav grid, then string-pulled into straight runs
const NG = 16, NW = PW / NG, NH = PH / NG;
// residents who stand still (Mira at her table, Hanru on watch) are kept out of paths
const navFree = (cx, cy) => !solidAt(cx * NG + 8, cy * NG + 13, FOOT_W + 6, FOOT_H + 8) && !people.some(p => !p.def.route && Math.abs(cx * NG + 8 - p.x) < 14 && Math.abs(cy * NG + 11 - p.y) < 10);
function lineFree(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
  for (let i = 1; i <= n; i++) { const t = i / n; if (solidAt(ax + (bx - ax) * t, ay + (by - ay) * t, FOOT_W + 2, FOOT_H + 2)) return false; }
  return true;
}
function astar(sx, sy, gx, gy) {
  const s = [Math.floor(sx / NG), Math.floor(sy / NG)];
  let g = [Math.floor(gx / NG), Math.floor(gy / NG)];
  if (!navFree(...g)) { // nearest free cell to the tap
    let best = null, bd = 1e9;
    for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) if (navFree(x, y)) { const d = Math.hypot(x - g[0], y - g[1]); if (d < bd) { bd = d; best = [x, y]; } }
    if (!best) return null; g = best; gx = g[0] * NG + 8; gy = g[1] * NG + 11;
  }
  const key = (x, y) => y * NW + x, open = [[0, s[0], s[1]]], from = new Map(), cost = new Map([[key(...s), 0]]);
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]); const [, x, y] = open.shift();
    if (x === g[0] && y === g[1]) {
      const pts = []; let k = key(x, y);
      while (from.has(k)) { pts.unshift([(k % NW) * NG + 8, Math.floor(k / NW) * NG + 11]); k = from.get(k); }
      if (pts.length) pts[pts.length - 1] = [gx, gy];
      // string-pull: keep only the corners a straight walk cannot skip
      const out = []; let ax = sx, ay = sy, i = 0;
      while (i < pts.length) { let j = pts.length - 1; while (j > i && !lineFree(ax, ay, pts[j][0], pts[j][1])) j--; out.push(pts[j]); [ax, ay] = pts[j]; i = j + 1; }
      return out;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= NW || ny >= NH || !navFree(nx, ny)) continue;
      if (dx && dy && (!navFree(x + dx, y) || !navFree(x, y + dy))) continue;
      const c = cost.get(key(x, y)) + (dx && dy ? 1.414 : 1);
      if (c < (cost.get(key(nx, ny)) ?? 1e9)) { cost.set(key(nx, ny), c); from.set(key(nx, ny), key(x, y)); open.push([c + Math.hypot(g[0] - nx, g[1] - ny), nx, ny]); }
    }
  }
  return null;
}
function walkTo(x, y) { const p = astar(kaya.x, kaya.y, x, y); kaya.path = p || []; return !!p; }
// ---------- input
const held = new Set(), padDirs = new Set(); let pendingTalk = false, tapMark = null;
const KEYS = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
addEventListener('keydown', e => {
  if (KEYS[e.code]) { held.add(KEYS[e.code]); kaya.path = []; pendingTalk = false; hideHint(); e.preventDefault(); }
  if (['KeyE', 'Enter'].includes(e.code)) { interact(); e.preventDefault(); }
  const mk = { KeyJ: 'jab', KeyK: 'whip', KeyL: 'stomp' }[e.code];
  if (mk && !e.repeat) { if (dlg.open) advanceDialog(); else startMove(mk); e.preventDefault(); }
  if (e.code === 'Space' && !e.repeat) { if (dlg.open) advanceDialog(); else startMove(lastMove); e.preventDefault(); }
});
addEventListener('keyup', e => { if (KEYS[e.code]) held.delete(KEYS[e.code]); });
addEventListener('blur', () => held.clear());
for (const b of document.querySelectorAll('#pad button')) {
  const [dx, dy] = b.dataset.d.split(',').map(Number); const k = dx < 0 ? 'l' : dx > 0 ? 'r' : dy < 0 ? 'u' : 'd';
  const on = e => { e.preventDefault(); padDirs.add(k); b.classList.add('on'); kaya.path = []; pendingTalk = false; hideHint(); };
  const off = e => { e.preventDefault(); padDirs.delete(k); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
}
document.getElementById('act').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
for (const b of document.querySelectorAll('[data-move]')) b.addEventListener('pointerdown', e => { e.preventDefault(); hideHint(); startMove(b.dataset.move); });
function inputDir() {
  const s = new Set([...held, ...padDirs]);
  const x = (s.has('r') ? 1 : 0) - (s.has('l') ? 1 : 0), y = (s.has('d') ? 1 : 0) - (s.has('u') ? 1 : 0), n = Math.hypot(x, y) || 1;
  return [x / n, y / n];
}
// a free spot beside a resident to talk from: east, west or north of them, nearest to Kaya first
function besideSpot(p) {
  const c = [[p.x + 30, p.y + 2], [p.x - 30, p.y + 2], [p.x, p.y - 26], [p.x + 26, p.y - 18], [p.x - 26, p.y - 18]].filter(([x, y]) => !solidAt(x, y, FOOT_W + 2, FOOT_H + 2) && navFree(Math.floor(x / NG), Math.floor(y / NG)));   // a spot the path grid can reach, not one wedged against a table
  c.sort((a, b) => Math.hypot(a[0] - kaya.x, a[1] - kaya.y) - Math.hypot(b[0] - kaya.x, b[1] - kaya.y));
  return c[0] || [p.x + 30, p.y + 4];
}
// ---------- talk: the nearest resident Kaya is standing beside
let nearP = null;
function findNear() {
  if (kaya.moving || move) return null;
  let best = null, bd = 48;
  for (const p of talkable) { const d = Math.hypot(kaya.x - p.x, (kaya.y - p.y) * 1.3); if (d < bd) { bd = d; best = p; } }
  return best;
}
function interact() { if (dlg.open) return advanceDialog(); const p = findNear(); if (p) openDialog(p); }
const cv = document.getElementById('c');
cv.addEventListener('pointerdown', e => {
  if (dlg.open) { advanceDialog(); return; }
  hideHint();
  const r = cv.getBoundingClientRect();
  const wx = (e.clientX - r.left) / r.width * view.w + cam.rx, wy = (e.clientY - r.top) / r.height * view.h + cam.ry;
  const hit = talkable.find(p => Math.abs(wx - p.x) < 14 && wy > p.y - 50 && wy < p.y + 6);
  if (hit) {
    if (findNear() === hit) { openDialog(hit); return; }
    const [bx, by] = besideSpot(hit); walkTo(bx, by); pendingTalk = hit; return;
  }
  pendingTalk = null; walkTo(wx, wy); tapMark = { x: wx, y: wy, t: 500 };
});
function updateKaya(dt) {
  if (dlg.open || move) { kaya.drive(0, 0, dt); return; }
  const [ix, iy] = inputDir();
  if (ix || iy) kaya.drive(ix, iy, dt); else kaya.follow(dt);
  if (pendingTalk && !kaya.path.length && findNear() === pendingTalk) { const p = pendingTalk; pendingTalk = null; openDialog(p); }
}

// ---------- dialogue
const dlg = { open: false, i: 0, shown: 0, who: null };
const dlgEl = document.getElementById('dlg'), dlgName = document.getElementById('dlgName'), dlgText = document.getElementById('dlgText');
function openDialog(p) {
  dlg.who = p; p.talking = true; kaya.want = Math.atan2(p.y - kaya.y, p.x - kaya.x);
  dlg.open = true; dlg.i = 0; dlg.shown = 0; dlgEl.style.display = 'block'; held.clear(); renderDialog();
}
function advanceDialog() {
  const L = dlg.who.def.lines, full = L[dlg.i].length;
  if (dlg.shown < full) { dlg.shown = full; renderDialog(); return; }
  dlg.i++; dlg.shown = 0;
  if (dlg.i >= L.length) { dlg.open = false; dlg.who.talking = false; dlg.who = null; dlgEl.style.display = 'none'; return; }
  renderDialog();
}
function renderDialog() { dlgName.textContent = dlg.who.def.name; dlgText.textContent = dlg.who.def.lines[dlg.i].slice(0, Math.floor(dlg.shown)); }
let hintGone = false;
function hideHint() { if (!hintGone) { hintGone = true; document.getElementById('hint').style.opacity = 0; } }

// ---------- ambient life: chimney smoke, canal glints, birds, falling blossom, two butterflies over the garden
const smoke = []; let smokeT = 0;
const glints = Array.from({ length: 60 }, () => ({ x: 160 + rnd() * 480, y: CANAL_TOP + 12 + Math.floor(rnd() * 36), ph: rnd() * 2000, sp: 3 + rnd() * 5 }));
const birds = []; let birdT = 2500;
const petals = []; let petalT = 0;
const flies = [0, 1].map(i => ({ x: 248 + i * 30, y: 680, t: i * 900, col: i ? '#f2d47a' : '#f6eed6' }));
function updateAmbient(dt) {
  smokeT -= dt;
  if (smokeT <= 0) { smokeT = 240; for (const [x, y] of CHIMNEYS) smoke.push({ x: x + rnd() * 3 - 2, y: y - 1, age: 0, life: 3600 + rnd() * 1400, vx: 2 + rnd() * 3, vy: -6 - rnd() * 3 }); }
  for (const p of smoke) { p.age += dt; p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vx += 1.4 * dt / 1000; }
  while (smoke.length && smoke[0].age > smoke[0].life) smoke.shift();
  for (const g of glints) { g.ph += dt; g.x += g.sp * dt / 1000; if (g.x > 636) g.x -= 476; }
  birdT -= dt;
  if (birdT <= 0) { birdT = 9000 + rnd() * 5000; const y0 = 30 + rnd() * 400; birds.push({ x: -10, y: y0, vx: 46, vy: 10, t: 0 }, { x: -26, y: y0 + 12, vx: 46, vy: 10, t: 180 }); }
  for (const b of birds) { b.t += dt; b.x += b.vx * dt / 1000; b.y += b.vy * dt / 1000; }
  while (birds.length && birds[0].x > PW + 40) birds.shift();
  petalT -= dt;
  if (petalT <= 0) { petalT = 420; const t = BLOSSOMS[Math.floor(rnd() * BLOSSOMS.length)]; petals.push({ x: t.x + 8 + rnd() * (t.w - 16), y: t.y + 10 + rnd() * 30, age: 0, life: 2600 + rnd() * 1200, ph: rnd() * 6 }); }
  for (const p of petals) { p.age += dt; p.y += 9 * dt / 1000; p.x += Math.sin(p.age / 300 + p.ph) * 6 * dt / 1000; }
  while (petals.length && petals[0].age > petals[0].life) petals.shift();
  for (const f of flies) { f.t += dt; f.x = 248 + 40 * Math.sin(f.t / 1700 + f.col.length) + 10 * Math.sin(f.t / 310); f.y = 672 + 14 * Math.sin(f.t / 1300) + 4 * Math.sin(f.t / 170); }
}

// ---------- bending moves (v4). The body is PixelLab's posed frames drawn as-is; the code only adds the fire,
// a whole-pixel screen shake, a ground flash and the dummy's reaction.
const MV = ASSETS.moves;
const VEC8 = { east: [1, 0], 'south-east': [0.7071, 0.7071], south: [0, 1], 'south-west': [-0.7071, 0.7071], west: [-1, 0], 'north-west': [-0.7071, -0.7071], north: [0, -1], 'north-east': [0.7071, -0.7071] };
const MOVES = {
  jab:   { label: 'Fire Jab',    clip: 'jab',   ms: [70, 70, 70, 80, 50, 140, 90, 70, 70, 70, 80] },
  whip:  { label: 'Flame Whip',  clip: 'whip',  ms: null },
  stomp: { label: 'Fire Stomp',  clip: 'stomp', ms: null },
};
for (const k of ['whip', 'stomp']) {   // 70 ms a frame, the strike frame held twice as long
  const n = ASSETS.chars.kaya[k].frames; MOVES[k].ms = Array.from({ length: n }, (_, i) => (i === MV[k].strike ? 150 : 70));
}
for (const k in MOVES) MOVES[k].strike = MV[k].strike;
let move = null;            // { k, t, dir, fired }
const shots = [], bursts = [], embers = [], flashes = [], arcs = [], rings = []; let shake = 0, shakeAmp = 2;
let lastMove = 'jab';
function startMove(k) {
  if (move || dlg.open) return;
  lastMove = k; move = { k, t: 0, dir: kaya.heading, fired: false }; kaya.path = []; kaya.look = -1;
  const lab = document.getElementById('moveName'); if (lab) { lab.textContent = MOVES[k].label; lab.classList.remove('show'); void lab.offsetWidth; lab.classList.add('show'); }
}
function moveFrame() { let t = move.t; const ms = MOVES[move.k].ms; for (let i = 0; i < ms.length; i++) { if (t < ms[i]) return i; t -= ms[i]; } return -1; }
function hitDummy(ux, uy) { dummy.hit = 0; dummy.hx = ux; dummy.hy = uy; }
function dummyVec() { const dx = dummy.x + dummy.w / 2 - kaya.x, dy = dummy.base - kaya.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d, d]; }
function strike() {
  const d = move.dir, [ux, uy] = VEC8[d];
  if (move.k === 'jab') {
    const [fx, fy] = MV.jab.fist[d] || [ux * 14, -22];
    const sx = kaya.x + fx, sy = kaya.y + fy, gy = kaya.y + uy * 6;
    bursts.push({ d, x: sx, y: sy, t: 0 });
    shots.push({ d, ux, uy, x: sx + ux * 4, g: gy + uy * 4, h: gy - sy, dist: 0, t: 0 });
    flashes.push({ x: sx, y: gy, t: 0, life: 220, r: 12 }); shake = 150; shakeAmp = 1;
  }
  if (move.k === 'whip') {   // a crescent swept across the tiles in front of her
    const cx = kaya.x + ux * 12, cy = kaya.y - 22 + uy * 12;
    arcs.push({ d, x: cx, y: cy, t: 0, sort: kaya.y + (uy < 0 ? -6 : 6) });
    for (let i = -1; i <= 1; i++) flashes.push({ x: kaya.x + ux * 36 - uy * 22 * i, y: kaya.y + uy * 30 + ux * 10 * i, t: -60 * (i + 1), life: 260, r: 12 });
    shake = 140; shakeAmp = 1;
    const [vx, vy, dist] = dummyVec();
    if (dist < 110 && vx * ux + vy * uy > 0.45) { dummy.delay = 120; dummy.pendingHit = [ux, uy]; }
  }
  if (move.k === 'stomp') {   // a ring of flame racing out along the ground around her
    rings.push({ x: kaya.x, y: kaya.y, t: 0 });
    flashes.push({ x: kaya.x, y: kaya.y, t: 0, life: 360, r: 26 });
    shake = 260; shakeAmp = 2;
    const [vx, vy, dist] = dummyVec();
    if (dist < 96) { dummy.delay = Math.round(dist * 2.4); dummy.pendingHit = [vx, vy]; }
  }
}
function updateMove(dt) {
  if (!move) return;
  move.t += dt; const f = moveFrame();
  if (f >= MOVES[move.k].strike && !move.fired) { move.fired = true; strike(); }
  if (f < 0) move = null;
}
function updateFx(dt) {
  for (const s of shots) {
    const st = 300 * dt / 1000; s.x += s.ux * st; s.g += s.uy * st; s.dist += st; s.t += dt; s.h = Math.max(8, s.h - 6 * dt / 1000);
    flashes.push({ x: s.x, y: s.g, t: 0, life: 90, r: 7 });
    const hitD = !s.done && Math.abs(s.x - (dummy.x + dummy.w / 2)) < 12 && Math.abs(s.g - dummy.base) < 12;
    if (hitD) hitDummy(s.ux, s.uy);
    if (hitD || s.dist > 112) { s.done = true; embers.push({ x: s.x, y: s.g - s.h, t: 0 }); flashes.push({ x: s.x, y: s.g, t: 0, life: 260, r: 14 }); if (hitD) { shake = 120; shakeAmp = 1; } }
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
  for (const a of [bursts, embers, flashes, arcs, rings]) for (const b of a) b.t += dt;
  const len = v => v.ms.reduce((a, b) => a + b, 0);
  const drop = (a, l) => { while (a.length && a[0].t > l) a.shift(); };
  drop(bursts, len(MV.vfx.burst.east)); drop(embers, len(MV.vfx.embers)); drop(arcs, len(MV.vfx.whip.east)); drop(rings, len(MV.vfx.ring));
  for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].t > flashes[i].life) flashes.splice(i, 1);
  if (dummy.pendingHit) { dummy.delay -= dt; if (dummy.delay <= 0) { hitDummy(...dummy.pendingHit); dummy.pendingHit = null; } }
  if (dummy.hit >= 0) { dummy.hit += dt; if (dummy.hit > 900) dummy.hit = -1; }
  if (shake > 0) shake -= dt;
}
function fxFrame(v, t) { let i = 0; while (i < v.n - 1 && t >= v.ms[i]) { t -= v.ms[i]; i++; } return i; }
function drawFx(key, v, x, y, t) { if (t < 0) return; const f = fxFrame(v, t); ctx.drawImage(IMG[key], f * v.w, 0, v.w, v.h, Math.round(x) - v.px - cam.rx, Math.round(y) - v.py - cam.ry, v.w, v.h); }
// ---------- view and camera
const ctx = cv.getContext('2d');
const view = { w: 400, h: 240, zd: 3, zc: 3 }, cam = { x: 0, y: 0, rx: 0, ry: 0, init: false };
let zoomOverride = Q.get('zoom') ? +Q.get('zoom') : 0;
function resize() {
  const dpr = window.devicePixelRatio || 1, cw = innerWidth, ch = innerHeight;
  const zc = zoomOverride || Math.max(2, Math.min(3, Math.floor(Math.min(cw, ch) / 180)));
  const zd = Math.max(1, Math.round(zc * dpr));
  Object.assign(view, { zc, zd, w: Math.min(PW, Math.ceil(cw * dpr / zd)), h: Math.min(PH, Math.ceil(ch * dpr / zd)) });
  cv.width = view.w; cv.height = view.h; cv.style.width = (view.w * zd / dpr) + 'px'; cv.style.height = (view.h * zd / dpr) + 'px';
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);
function updateCamera(dt) {
  // aim a little ahead of her and slightly north of her feet; ease toward it; draw at whole pixels
  const tx = kaya.x + kaya.vx * 0.35 - view.w / 2, ty = kaya.y - 26 + kaya.vy * 0.35 - view.h * 0.64;
  const cx = Math.max(0, Math.min(PW - view.w, tx)), cy = Math.max(0, Math.min(PH - view.h, ty));
  if (!cam.init) { cam.x = cx; cam.y = cy; cam.init = true; }
  const k = 1 - Math.exp(-4.5 * dt / 1000); cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k;
  cam.rx = Math.round(cam.x); cam.ry = Math.round(cam.y);
  if (shake > 0) { cam.rx += Math.round((rnd() * 2 - 1) * shakeAmp); cam.ry += Math.round((rnd() * 2 - 1) * shakeAmp); }
}

// ---------- drawing
let clock = 0;
function drawClip(a, clipName, frame, dir) {
  const clip = ASSETS.chars[a.name][clipName]; let row = clip.dirs.indexOf(dir);
  if (row < 0) { // nearest available heading
    const i = DIRS.indexOf(dir); let best = 0, bd = 9;
    clip.dirs.forEach((d, r) => { const k = Math.abs(((DIRS.indexOf(d) - i + 12) % 8) - 4); if (4 - k < bd) { bd = 4 - k; best = r; } }); row = best;
  }
  ctx.drawImage(IMG[`ch:${a.name}:${clipName}`], (frame % clip.frames) * CELL, row * CELL, CELL, CELL, Math.round(a.x) - AX - cam.rx, Math.round(a.y) - AY - cam.ry, CELL, CELL);
}
function shadow(x, y, wd) {
  const sx = Math.round(x) - cam.rx, sy = Math.round(y) - cam.ry;
  ctx.fillStyle = 'rgba(28,23,25,0.26)';
  ctx.fillRect(sx - wd, sy - 2, wd * 2, 3); ctx.fillRect(sx - wd + 3, sy - 3, wd * 2 - 6, 1); ctx.fillRect(sx - wd + 3, sy + 1, wd * 2 - 6, 1);
}
function personDraw(a) {
  const ch = ASSETS.chars[a.name], sp = Math.hypot(a.vx, a.vy);
  if (a === kaya && move) return drawClip(a, MOVES[move.k].clip, Math.max(0, moveFrame()), move.dir);
  if (ch.walk && sp > 6) return drawClip(a, 'walk', Math.floor(a.dist / (a.cycle / ch.walk.frames)), a.heading);
  // occasional look-around after standing a while, facing the camera
  if (ch.look && a.look < 0 && a.idleT > 5200 && ch.look.dirs.includes(a.heading) && rnd() < 0.004) a.look = 0;
  if (a.look >= 0) {
    const f = Math.floor(a.look / 120);
    if (f < ch.look.frames) return drawClip(a, 'look', f, a.heading);
    a.look = -1; a.idleT = 0;
  }
  // the idle breathes slowly and barely: only the frames within 1 px of the rest pose, ping-ponged at ~4 s a breath
  if (ch.idle) { const calm = (ch.idle.calm || {})[a.heading] || [0]; const n = calm.length, k = Math.floor((clock + (a.phase || 0)) / 420) % (2 * n - 2 || 1); return drawClip(a, 'idle', calm[k < n ? k : 2 * n - 2 - k], a.heading); }
  drawClip(a, 'rot', 0, a.heading);
}
function catDraw() {
  const ch = ASSETS.chars.cat;
  if (Math.hypot(cat.vx, cat.vy) > 3) return drawClip(cat, 'walk', Math.floor(cat.dist / (cat.cycle / ch.walk.frames)), cat.heading);
  if (catSit > 0) { const n = ch.sit.frames, f = Math.floor(catSitT / 120); return drawClip(cat, 'sit', f < n ? f : n - 1 - (Math.floor(catSitT / 700) % 2), 'south-west'); }
  drawClip(cat, 'rot', 0, cat.heading);
}
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

// ---------- v13: Ba Dan inside the tutorial (tutorial-demo.html sets window.AREA = { mode: 'badan' | 'home', rec }).
// The real hub (story/act1.ts village_explore): the objective, Mira's, Gao's, Pella's and Dorin's talk nodes (kept short), the
// pella_asked flag (it parks Bo-shan's cabbage cart on the quarry floor three fights later), and the east road out. Sura and Bo
// walk Kaya's trail. 'home' is the walk home at the end: the party comes back in along the east road at dusk.
const TUTM = AREA && AREA.mode;
const tutFlags = {};
function tellShell(msg) { try { if (AREA && parent !== window) parent.postMessage(Object.assign({ from: 'badan' }, msg), '*'); } catch (e) { /* stand-alone */ } }
if (TUTM) {
  const L = id => RES.find(r => r.id === id);
  L('mira').lines = ['Come in. There is rice if you have not eaten. We need to talk about the quarry.',
    'No carts for a month. I sent four people to find out why. None came home.',
    'Dorin went as far as the gate yesterday. They have guards now. Would not let him through.',
    'I can offer you food and a bed here. I wish it were more. Will you look for our people?'];
  L('gao').lines = ['For the quarry? Water skins are by the door. Take one. You can pay me when everyone is home.',
    'The cutting is flooded in places. Mind your footing, especially if there is a fight.'];
  L('pella').lines = ["You're going to the quarry? I can show you the way. I know it. Mira keeps saying I'm too little.",
    'My brother took vegetables up before Mira sent the others. Bo-shan. That makes five missing.',
    "Look for the cart with cabbages piled above the seat. Tell him I'm not doing his chores again this week."];
  L('dorin').lines = ['East road, then the switchbacks. About two hours. Longer if the mud is bad.',
    'I got as far as the gate yesterday. There were workers up on the wall with slings. Would not answer me.'];
  if (TUTM === 'home') {
    L('mira').lines = ['Bo-shan came through the gate ahead of you. Pella has not let go of his sleeve.',
      'Bo-shan and all four messengers are home. I have counted everyone twice. They keep telling me to stop.',
      'You can stay as long as you need. Leave your washing by the door.'];
    kaya.x = 1120; kaya.y = 530; kaya.face = kaya.want = Math.PI;
  }
}
// the party: Sura and Bo follow Kaya's trail, 30 and 58 px behind her (never solid, so they never block her)
const party = [];
if (TUTM) {
  for (const [k, back] of [['sura', 30], ['bo', 58]]) {
    const a = new Actor(k, kaya.x - back, kaya.y - 2, TUTM === 'home' ? 'west' : 'east', WALK_SPEED * 1.08);
    a.def = { id: k, name: null, route: [], follow: back }; a.phase = rnd() * 1500; a.solid = false; party.push(a); people.push(a);
  }
}
const trailPts = [];
const updatePerson0 = updatePerson;
updatePerson = function (p, dt) {
  if (!p.def.follow) return updatePerson0(p, dt);
  let need = p.def.follow, at = null, px = kaya.x, py = kaya.y;   // walk back along the trail until 'need' px are used up
  for (const [x, y] of trailPts) { const d = Math.hypot(x - px, y - py); if (need <= d) { const t = need / d; at = [px + (x - px) * t, py + (y - py) * t]; break; } need -= d; px = x; py = y; }
  if (!at) at = trailPts.length ? trailPts[trailPts.length - 1] : [p.x, p.y];
  if (Math.hypot(at[0] - p.x, at[1] - p.y) > 3) { p.path = [at]; p.follow(dt); } else { p.path = []; p.drive(0, 0, dt); if (!kaya.moving) p.want = Math.atan2(kaya.y - p.y, kaya.x - p.x); }
};
// the objective line (story/act1.ts village_explore and its variant once Mira has been visited)
let objEl = null;
function setObjective(s) {
  if (!TUTM) return;
  if (!objEl) { objEl = document.createElement('div'); objEl.id = 'objective'; Object.assign(objEl.style, { position: 'fixed', left: '0.75rem', top: 'max(0.6rem, env(safe-area-inset-top))', maxWidth: 'min(26rem, 70vw)', font: 'bold 0.8rem/1.35 monospace', color: '#f6eed6', background: 'color-mix(in srgb, #1c1719 78%, transparent)', padding: '0.4rem 0.7rem', borderLeft: '0.2rem solid #d9a441', borderRadius: '0.2rem', pointerEvents: 'none' }); document.body.appendChild(objEl); }
  objEl.textContent = s; objEl.style.display = s ? '' : 'none';
}
// a talk node ends: Mira opens the road; Pella sets pella_asked
const advanceDialog0 = advanceDialog;
advanceDialog = function () {
  const who = dlg.who; advanceDialog0();
  if (TUTM && who && !dlg.open) {
    tutFlags['talked_' + who.def.id] = true;
    if (who.def.id === 'mira' && TUTM === 'badan') { tutFlags.metMira = true; setObjective('Take the east road to the quarry. You can speak with the neighbors before you leave.'); }
    if (who.def.id === 'mira' && TUTM === 'home') tellShell({ type: 'done' });
    if (who.def.id === 'pella') tutFlags.pella_asked = true;
  }
};
// the east road out: off the rim at the east edge. Before Mira, Kaya turns back with a nudge (the objective, not a wall)
let leaving = false, nudgeT = 0;
const update0 = update;
update = function (dt) {
  update0(dt);
  if (!TUTM) return;
  const last = trailPts[0];
  if (!last || Math.hypot(last[0] - kaya.x, last[1] - kaya.y) > 4) { trailPts.unshift([kaya.x, kaya.y]); if (trailPts.length > 60) trailPts.pop(); }
  if (nudgeT > 0) { nudgeT -= dt; if (nudgeT <= 0) setObjective(tutFlags.metMira ? 'Take the east road to the quarry.' : 'Talk to Elder Mira, then take the east road to the quarry.'); }
  if (TUTM === 'badan' && !leaving && kaya.x > 1150 && kaya.y > 470 && kaya.y < 600) {
    if (tutFlags.metMira) { leaving = true; tellShell({ type: 'exit', flags: Object.assign({}, tutFlags) }); }
    else { setObjective('Elder Mira is waiting for you in the square. Talk to her first.'); nudgeT = 2600; walkTo(1080, 530); }
  }
};
if (TUTM) {
  setObjective(TUTM === 'home' ? 'Home. Find Mira in the square.' : 'Talk to Elder Mira, then take the east road to the quarry.');
  window.__tut = { flags: () => Object.assign({}, tutFlags), leaving: () => leaving };
  const h = document.getElementById('hint'); if (h) h.style.display = 'none';
}

// dialogue portraits: the tutorial shell holds the images (PORTRAITS); a resident with one gets it on the right of the box (Kaya's on
// the left, in the shell). Hanru has none, so his box stays plain. Same box styling as the shell's.
if (TUTM) {
  const PORT_OF = { mira: 'mira', gao: 'gao', pella: 'pella', dorin: 'dorin' };
  const st = document.createElement('style');
  st.textContent = '#dlg.hasp { min-height: 7.25rem; padding-right: 7.1rem; } #dlg img { display: none; position: absolute; top: 0.75rem; right: 0.75rem; width: 5.25rem; height: 5.25rem; box-sizing: border-box; object-fit: cover; background: #e8d8b0; border: 0.1875rem solid #e8d8b0; outline: 0.125rem solid #1c1719; border-radius: 0.2rem; image-rendering: auto; } #dlg.hasp img { display: block; }';
  document.head.appendChild(st);
  const im = document.createElement('img'); im.alt = ''; dlgEl.insertBefore(im, dlgEl.firstChild);
  const renderDialog0 = renderDialog;
  renderDialog = function () {
    renderDialog0();
    let P = null; try { P = parent.PORTRAITS; } catch (e) { /* stand-alone */ }
    const k = dlg.who && PORT_OF[dlg.who.def.id];
    if (k && P && P[k]) { if (im.getAttribute('src') !== P[k]) im.src = P[k]; im.alt = dlg.who.def.name; dlgEl.classList.add('hasp'); }
    else { im.removeAttribute('src'); dlgEl.classList.remove('hasp'); }
  };
}
