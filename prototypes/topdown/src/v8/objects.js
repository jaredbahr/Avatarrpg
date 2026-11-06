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
const neHouse = put('house_ne', 912, NB, { kind: 'house', foot: [140, 104] });
// Gao's yard on his west side: a fence, his bread oven, the sacks; his door barrel and herb rack at his shopfront
put('fence', 330, NB + 4, { foot: [70, 8] }); put('fence', 330, NB - 40, { foot: [70, 8] });
put('oven', 318, NB - 12); put('sacks', 352, NB - 18);
put('barrel', 505, NB + 8); put('herb_shelf', 388, NB + 10);
put('rain_barrel', 801, NB + 8);
put('bucket_broom', 744, NB + 8); put('flower_pots', 958, NB + 10); put('crates', 990, NB + 22);
// the north court: Gao's display, Mira's table with the pot on the fire, the north display; the handcart
put('market_jars', 412, 404);
const miraTable = put('mira_table', 560, 402);
put('cookpot', 646, 392);
put('market_veg', 776, 402);
put('handcart', 968, 392);
put('laundry_line', 250, 226, { foot: [70, 6] }); put('woodshed', 1080, NB + 4, { foot: [70, 14] });
// the canal: the bridge styled on its own bank stones (deck walkable, drawn as ground), the dry crossing is paving
const bridge = put('bridge', 508, 480, { flat: true, kind: 'bridge' });
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
  ['tree_blossom', 790, 236], ['bush', 520, 300],
  ['tree', 150, 160], ['tree_blossom', 270, 140], ['tree', 400, 150], ['tree', 1080, 150], ['tree_blossom', 1150, 190], ['tree', 700, 132], ['bush', 860, 130], ['bush', 560, 140],
  ['tree', 110, 300], ['bush', 96, 360], ['tree', 104, 620], ['tree_blossom', 120, 760], ['tree', 180, 860], ['bush', 480, 852], ['tree', 300, 850], ['tree_blossom', 556, 880],
  ['bush', 700, 880], ['bush', 968, 852], ['bush', 1150, 700], ['bush', 1186, 250],
  ['bush', 60, 860], ['bush', 1150, 870], ['tree_blossom', 884, 652], ['bush', 1170, 640]]) {
  const o = put(k, x, y, { foot: k === 'bush' ? [24, 10] : [22, 12], kind: 'tree' }); if (k === 'tree_blossom') BLOSSOMS.push(o);
}
for (const [x, y] of [[180, 720], [960, 700], [640, 290], [470, 250], [1100, 330], [230, 250]]) put('flowers', x, y, { flat: true });
for (const [x, y] of [[150, 560], [470, 860], [560, 830], [700, 120], [150, 250], [320, 130], [900, 170], [760, 850], [240, 800], [1090, 420], [880, 250]]) put('tuft', x, y, { flat: true });
// nothing roots on the cliff face: a rim tree, bush or tuft whose base would sit past the grass edge is drawn back onto the ground
// (its crown still overhangs the drop)
const MOVED = [];
for (const o of OBJ) {
  if (o.kind !== 'tree' && o.k !== 'tuft' && o.k !== 'flowers') continue;
  const cx = o.x + o.w / 2, c0 = Math.floor((cx - 8) / T), c1 = Math.floor((cx + 8) / T);
  let nb = o.base, ncx = cx;
  const bot = Math.min(BOTV(c0), BOTV(c1)) * T + 8, top = Math.max(TOPV(c0), TOPV(c1)) * T + 14;
  nb = Math.max(top, Math.min(bot, nb));
  const row = Math.floor(nb / T), lft = Math.max(LEFTV(row), LEFTV(row - 1)) * T + 14, rgt = Math.min(RIGHTV(row), RIGHTV(row - 1)) * T + 18;
  ncx = Math.max(lft, Math.min(rgt, ncx));
  const dx = Math.round(ncx - cx), dy = nb - o.base; if (!dx && !dy) continue;
  const s = SOLID.find(q => Math.abs(q.y + q.h - o.base) < 1 && Math.abs(q.x + q.w / 2 - cx) < 2); if (s) { s.x += dx; s.y += dy; }
  o.x += dx; o.base += dy; o.y += dy; MOVED.push([o.k, dx, dy]);
}
const lamps = OBJ.filter(o => o.k === 'lamp');
// the canal is water except under the bridge deck; the flooded ford closes the west road
const CANAL_TOP = 14 * T - 18, CANAL_BOT = 14 * T + 22, DECK_L = 494, DECK_R = 522;
SOLID.push({ x: 0, y: CANAL_TOP, w: DECK_L, h: CANAL_BOT - CANAL_TOP }, { x: DECK_R, y: CANAL_TOP, w: 20 * T - 4 - DECK_R, h: CANAL_BOT - CANAL_TOP });
SOLID.push({ x: 108, y: 498, w: 72, h: 58 });   // the flooded ford
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
