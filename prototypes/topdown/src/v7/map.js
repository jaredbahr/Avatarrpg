// ---------- Ba Dan, top-down. Laid out from the game's own village (src/content/maps/village.ts, scenes/baDan.ts):
// a content cell (cx, cy) of the 24x16 village sits at world px (32 + 40 cx, 32 + 40 cy), so every landmark lands
// where a player of the current game expects it. Terrain is the v2 32 px Wang family on a vertex grid.
const C2X = cx => 32 + 40 * cx, C2Y = cy => 32 + 40 * cy;
// terrain (Wang corners on a vertex grid): G grass, C cobble, W water, D dirt
function vt(x, y) {
  if ((y === 9 && x <= 16) || (x <= 1 && y >= 10 && y <= 12)) return 'W';           // the canal (content row 6) and the flooded west ford
  if (y === 8 && x <= 19) return 'C';                                                // the canal's stone north bank
  if (y >= 6 && y <= 8 && x >= 8 && x <= 23) return 'C';                             // the paved lane and court before the north houses
  if (y === 9 && x >= 17 && x <= 19) return 'C';                                     // the dry crossing where the canal ends, content (13,6)
  if (y >= 10 && y <= 12 && x >= 2) return 'C';                                      // the east-west road, rows 7-8, out to the forest
  if (y === 13 && x <= 2) return 'C';                                                // the ford's paved south lip
  if (x >= 13 && x <= 18 && y >= 13 && y <= 14) return 'C';                          // the south court (Pella's)
  if (x >= 14 && x <= 16 && y >= 13 && y <= 20) return 'C';                          // the lane between the south houses
  if (y >= 19 && y <= 20 && x >= 8 && x <= 21) return 'C';                           // the lane along the south house fronts
  if (x >= 24 && x <= 26 && y >= 18) return 'D';                                     // the riverside path from its sign, off the south edge
  return 'G';
}
const setFor = a => { const u = [...new Set(a)].sort().join(''); return { G: 'gc', C: 'gc', W: 'canal', D: 'dirt', CG: 'gc', CW: 'canal', DG: 'dirt' }[u]; };

// ---------- objects (centre x, base y in px) and their foot blockers
const OBJ = [], SOLID = [];
function put(k, cx, by, o = {}) {
  const a = ASSETS.objects[k]; const ob = { k, x: Math.round(cx - a.w / 2), y: by - a.h, w: a.w, h: a.h, base: by, flat: !!o.flat, label: o.label };
  OBJ.push(ob);
  if (o.foot) { const [fw, fh] = o.foot; SOLID.push({ x: cx - fw / 2, y: by - fh, w: fw, h: fh }); }
  return ob;
}
// the four houses: Gao's (merchant, north-west), Mira's north house, Pella's south-west house, the south-east merchant house
const gaoHouse = put('house_ochre', C2X(8), C2Y(4), { foot: [136, 110] });
const miraHouse = put('house_cream', C2X(14), C2Y(4), { foot: [140, 110] });
put('house_green', C2X(8), C2Y(14), { foot: [140, 110] });
put('teahouse', C2X(15), C2Y(14), { foot: [172, 100] });
// Gao's yard on his west tiles, the barrel at his door (10,3) and the shop stack (10,2)
put('fence', 238, C2Y(4) - 2, { foot: [60, 8] }); put('fence', 238, C2Y(3) - 6, { foot: [60, 8] });
put('barrels', C2X(10) + 20, C2Y(4) + 4, { foot: [30, 10] });
put('crates', C2X(10) + 22, C2Y(3) - 4, { foot: [30, 10] });
// the market court: Gao's display (6,5), Mira's table (BD01, (10..11,5)), the north display (14,5); the south stall (3,9)
put('market_a', C2X(7), C2Y(6) - 4, { foot: [70, 12] });
const miraTable = put('mira_table', C2X(11), C2Y(6) - 6, { foot: [74, 12] });
put('market_b', C2X(15), C2Y(6) - 4, { foot: [70, 12] });
put('stall', C2X(4), C2Y(10), { foot: [118, 34] });
// planters (11,10) and the north garden (17,4); the garden plot (2,10); the well (12,13); the stone lantern (5,11)
put('planter', C2X(12), C2Y(11) - 2, { foot: [60, 10] });
put('planter', C2X(18), C2Y(5) - 2, { foot: [60, 10] });
put('garden', C2X(3) + 20, C2Y(12), { foot: [106, 40] });
put('well', C2X(12) - 18, C2Y(14) + 6, { foot: [60, 24] });
put('stone_lantern', C2X(5) + 20, C2Y(12), { foot: [16, 8] });
// notice boards: the school notice (12,11) and the one at the watch post (18,6); banners (11,2), (18,10)
put('notice_board', C2X(13) + 6, C2Y(12) - 4, { foot: [30, 8] });
put('notice_board', C2X(18) + 20, C2Y(7) - 2, { foot: [30, 8] });
put('banner_pole', C2X(11) + 20, C2Y(3), { foot: [8, 6] });
put('banner_pole', C2X(18) + 20, C2Y(11), { foot: [8, 6] });
// lamps (16,9), (20,6), (20,9) and the watch lamp on the east road that "stays lit"
const lamps = [put('lamp', C2X(16) + 20, C2Y(10), { foot: [10, 6] }), put('lamp', C2X(20) + 20, C2Y(7) - 4, { foot: [10, 6] }),
  put('lamp', C2X(20) + 20, C2Y(10), { foot: [10, 6] }), put('lamp', C2X(22) + 20, C2Y(7) - 4, { foot: [10, 6] })];
// the laundry line (17,2), the handcart (19,4), the hay trough (19,10), baskets (2,9), (14,6)
put('laundry_line', C2X(18), C2Y(3), { foot: [70, 6] });
put('handcart', C2X(20) + 20, C2Y(5), { foot: [86, 14] });
put('trough', C2X(20), C2Y(11), { foot: [56, 12] });
put('pots', C2X(2) - 8, C2Y(10) + 2, { foot: [22, 8] });
put('pots', C2X(14) + 20, C2Y(7) - 6, { foot: [22, 8] });
// the bench (3,5), fence (1,5) and Dorin's practice dummy on the canal's north bank
put('bench', C2X(4), C2Y(6) - 4, { foot: [34, 8] });
put('fence', C2X(1) + 10, C2Y(5) - 6, { foot: [60, 8] });
const dummy = put('dummy', C2X(2) + 6, C2Y(5) + 10, { foot: [16, 10] }); dummy.hit = -1;
// the bridge at (9,6); the dry crossing at (13,6) is paved ground
const bridge = put('bridge', C2X(9) + 20, C2Y(7) + 18, { flat: true });
// trees: the court trees (5,5) and (21,2), and the rim
const BLOSSOMS = [];
for (const [k, x, y] of [['tree', C2X(5) + 22, C2Y(6) - 2], ['tree', C2X(21) + 20, C2Y(3)],
  ['tree', 60, 74], ['tree_blossom', 150, 58], ['tree', 790, 64], ['tree', 910, 70], ['tree_blossom', 990, 96],
  ['tree', 34, 214], ['bush', 24, 256], ['tree', 26, 476], ['tree', 54, 610], ['tree_blossom', 150, 694],
  ['tree', 994, 226], ['tree', 1000, 486], ['bush', 996, 560], ['tree', 950, 700], ['tree_blossom', 470, 176],
  ['tree', 290, 700], ['bush', 640, 700], ['tree_blossom', 700, 690]]) {
  const o = put(k, x, y, { foot: k === 'bush' ? [24, 10] : [22, 12] }); if (k === 'tree_blossom') BLOSSOMS.push(o);
}
// flowers and tufts on the lawns (flat)
for (const [x, y] of [[120, 640], [880, 600], [560, 120], [300, 650]]) put('flowers', x, y, { flat: true });
for (const [x, y] of [[40, 560], [470, 650], [560, 680], [620, 120], [790, 650], [150, 150], [320, 120], [700, 60], [880, 160]]) put('tuft', x, y, { flat: true });
// the way out east, and the riverside path south (18,12)
const exitSign = put('sign', 992, C2Y(7) - 4, { foot: [12, 8], label: 'TO THE FOREST ROAD' });
const riverSign = put('sign', C2X(18) + 20, C2Y(13) - 2, { foot: [12, 8], label: 'RIVERSIDE' });
// the canal is solid except over the bridge deck; the flooded ford closes the west road
const CANAL_TOP = 9 * T - 20, CANAL_H = 38;
SOLID.push({ x: 0, y: CANAL_TOP, w: bridge.x + 6, h: CANAL_H }, { x: bridge.x + bridge.w - 6, y: CANAL_TOP, w: 16 * T + 18 - (bridge.x + bridge.w - 6), h: CANAL_H });
SOLID.push({ x: 0, y: CANAL_TOP, w: 52, h: 4 * T });
// smoke leaves the two painted chimneys (Gao's and Mira's houses)
const CHIMNEYS = [[gaoHouse.x + 114, gaoHouse.y + 11], [miraHouse.x + 120, miraHouse.y + 5]];
const FOOT_W = 12, FOOT_H = 6;
function solidAt(x, y, w = FOOT_W, h = FOOT_H) {
  const l = x - w / 2, t = y - h, r = x + w / 2, b = y;
  if (l < 2 || r > PW - 2 || t < 2 || b > PH - 2) return true;
  for (const s of SOLID) if (l < s.x + s.w && r > s.x && t < s.y + s.h && b > s.y) return true;
  return false;
}
