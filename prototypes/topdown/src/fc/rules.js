// ---------- the real rules, ported (read-only sources in Avatarrpg/src): content/surfaces.ts, content/combos.ts,
// content/statuses.ts, content/props.ts, content/abilities/{fire,water,earth,enemy}.ts, core/rules/surfaces.ts
// (applyImpact, paintSurface, tickSurfaces, contactEffects), core/rules/status.ts (applyStatus, tickStatuses),
// core/rules/damage.ts (compute, hitBreakdown), core/rules/grid.ts (lineTiles, coneTiles, blastTiles) and the ability
// resolution order of core/rules/abilities.ts (units hit, then props, THEN the impact on the ground).
const SURF = {
  water: { name: 'Water', moveCost: 1, enterDamage: 0, type: 'water', status: 'wet', chance: 1, dur: 4 },
  ice:   { name: 'Ice', moveCost: 0, enterDamage: 0, type: 'cold', status: 'chilled', chance: 0.4, dur: 3 },
  fire:  { name: 'Fire', moveCost: 0, enterDamage: 4, type: 'fire', status: 'burning', chance: 1, dur: 2 },
  mud:   { name: 'Mud', moveCost: 1, enterDamage: 0, type: 'earth', status: 'rooted', chance: 0.25, dur: 3 },
  steam: { name: 'Steam', moveCost: 0, enterDamage: 0, type: 'fire', status: null, chance: 0, dur: 1, obscures: { inside: -25, through: -15 } },
  oil:   { name: 'Oil', moveCost: 1, enterDamage: 0, type: 'physical', status: null, chance: 0, dur: -1 },
  rubble:{ name: 'Rubble', moveCost: 1, enterDamage: 0, type: 'earth', status: null, chance: 0, dur: -1, cover: true },
};
const rule = p => ({ result: null, duration: 2, spread: 0, status: null, statusChance: 0, chain: false, chainDamage: 0, ...p });
const COMBOS = [
  rule({ id: 'lightning-into-water', existing: 'water', applied: 'lightning', result: 'water', duration: 4, status: 'shocked', statusChance: 1, chain: true, chainDamage: 6, label: 'The lightning races through the water!', tip: 'Shocks Water' }),
  rule({ id: 'fire-into-oil', existing: 'oil', applied: 'fire', result: 'fire', duration: 3, spread: 1, status: 'burning', statusChance: 1, label: 'The oil catches — the fire is spreading!', tip: 'Ignites Oil' }),
  rule({ id: 'fire-into-water', existing: 'water', applied: 'fire', result: 'steam', duration: 2, label: 'The water flashes into steam.', tip: 'Makes Steam' }),
  rule({ id: 'fire-into-ice', existing: 'ice', applied: 'fire', result: 'water', duration: 3, label: 'The ice melts away.', tip: 'Melts Ice' }),
  rule({ id: 'fire-into-mud', existing: 'mud', applied: 'fire', result: 'mud', duration: 2, label: 'The mud hisses but holds.', tip: 'Mud Holds' }),
  rule({ id: 'fire-into-steam', existing: 'steam', applied: 'fire', result: 'steam', duration: 2, label: 'The steam boils hotter.', tip: 'Boils Steam' }),
  rule({ id: 'water-onto-fire', existing: 'fire', applied: 'water', result: null, label: 'The flames are doused.', tip: 'Douses Fire' }),
  rule({ id: 'water-onto-rubble', existing: 'rubble', applied: 'water', result: 'mud', duration: 3, label: 'The broken stone turns to mud.', tip: 'Makes Mud' }),
  rule({ id: 'cold-into-water', existing: 'water', applied: 'cold', result: 'ice', duration: 3, status: 'frozen', statusChance: 0.75, label: 'The water locks solid.', tip: 'Freezes Water' }),
  rule({ id: 'ice-onto-water', existing: 'water', applied: 'ice', result: 'ice', duration: 3, status: 'frozen', statusChance: 0.6, label: 'The water locks solid.', tip: 'Freezes Water' }),
  rule({ id: 'cold-into-mud', existing: 'mud', applied: 'cold', result: 'ice', duration: 3, label: 'The mud freezes over.', tip: 'Freezes Mud' }),
  rule({ id: 'cold-into-fire', existing: 'fire', applied: 'cold', result: null, label: 'The cold snuffs the flames.', tip: 'Snuffs Fire' }),
  rule({ id: 'earth-into-water', existing: 'water', applied: 'earth', result: 'mud', duration: 3, label: 'Earth churns the water into mud.', tip: 'Makes Mud' }),
  rule({ id: 'earth-into-ice', existing: 'ice', applied: 'earth', result: 'rubble', duration: -1, label: 'The ice shatters into rubble.', tip: 'Shatters Ice' }),
  rule({ id: 'earth-into-fire', existing: 'fire', applied: 'earth', result: null, label: 'Earth smothers the fire.', tip: 'Smothers Fire' }),
  rule({ id: 'air-into-fire', existing: 'fire', applied: 'air', result: 'fire', duration: 3, spread: 1, label: 'The wind fans the flames outward!', tip: 'Fans Fire' }),
  rule({ id: 'air-into-steam', existing: 'steam', applied: 'air', result: null, label: 'The wind scatters the steam.', tip: 'Scatters Steam' }),
  rule({ id: 'water-into-mud', existing: 'mud', applied: 'water', result: 'mud', duration: 4, label: 'The mud deepens.', tip: 'Deepens Mud' }),
  rule({ id: 'water-into-oil', existing: 'oil', applied: 'water', result: 'oil', duration: -1, label: 'The oil floats on the water, untouched.', tip: 'Oil Floats' }),
];
const STAT = {
  burning: { name: 'Burning', dur: 3, tick: 3, tickType: 'fire', mods: { defense: -1 } },
  wet:     { name: 'Wet', dur: 3, clears: ['burning'], mult: { fire: 0.5, lightning: 2, cold: 1.5 } },
  chilled: { name: 'Chilled', dur: 2, mods: { move: -1, speed: -2, accuracy: -5 } },
  frozen:  { name: 'Frozen', dur: 1, skips: true, upgradeFrom: ['chilled'], mods: { defense: -2 }, mult: { earth: 1.5, physical: 1.5, fire: 1.25 } },
  shocked: { name: 'Shocked', dur: 2, mods: { speed: -3, accuracy: -10, ap: -1 } },
  rooted:  { name: 'Rooted', dur: 1, noMove: true },
  slowed:  { name: 'Slowed', dur: 2, mods: { move: -2 } },
  guarded: { name: 'Guarded', dur: 2, mods: { defense: 3 }, mult: { fire: 0.75, physical: 0.75 } },
};
// the kits: Kaya fire_jab / flame_arc / fire_blast, Sura water_whip / ice_path / healing_stream, Bo rock_throw / stone_stance /
// earth_wall (levels 1, 2 and the level-3 choice), and the bandits' club_swing / sling_stone
const ABIL = {
  fire_jab:       { name: 'Fire Jab', ap: 1, range: 5, tgt: 'enemy', eff: [{ k: 'damage', base: 4, scale: 0.7, type: 'fire' }], clip: 'jab' },
  flame_arc:      { name: 'Flame Arc', ap: 2, range: 4, tgt: 'cone', len: 3, eff: [{ k: 'damage', base: 5, scale: 0.6, type: 'fire' }, { k: 'status', status: 'burning', dur: 2, chance: 0.5 }], clip: 'whip' },
  fire_blast:     { name: 'Fire Blast', ap: 2, range: 6, tgt: 'blast', radius: 1, eff: [{ k: 'damage', base: 6, scale: 0.7, type: 'fire' }, { k: 'status', status: 'burning', dur: 2, chance: 0.4 }], clip: 'stomp' },
  water_whip:     { name: 'Water Whip', ap: 1, range: 5, tgt: 'enemy', eff: [{ k: 'damage', base: 4, scale: 0.6, type: 'water' }, { k: 'status', status: 'wet', dur: 2, chance: 0.75 }] },
  ice_path:       { name: 'Ice Path', ap: 2, range: 5, tgt: 'line', len: 4, cd: 2, eff: [{ k: 'surface', surface: 'ice', dur: 3 }] },
  healing_stream: { name: 'Healing Stream', ap: 2, range: 4, tgt: 'ally', cd: 1, eff: [{ k: 'heal', base: 8, scale: 0.8 }, { k: 'cleanse', statuses: ['burning'] }] },
  rock_throw:     { name: 'Rock Throw', ap: 1, range: 5, tgt: 'enemy', eff: [{ k: 'damage', base: 5, scale: 0.6, type: 'earth' }] },
  stone_stance:   { name: 'Stone Stance', ap: 1, range: 0, tgt: 'self', cd: 2, eff: [{ k: 'status', status: 'guarded', dur: 2, chance: 1, self: true }] },
  earth_wall:     { name: 'Earth Wall', ap: 2, range: 5, tgt: 'line', len: 3, cd: 3, eff: [{ k: 'wall', dur: 3 }] },
  club_swing:     { name: 'Club Swing', ap: 2, range: 1, tgt: 'enemy', eff: [{ k: 'damage', base: 5, scale: 0.6, type: 'physical' }] },
  sling_stone:    { name: 'Sling Stone', ap: 2, range: 6, tgt: 'enemy', eff: [{ k: 'damage', base: 4, scale: 0.5, type: 'physical' }] },
};
const KITS = { kaya: ['fire_jab', 'flame_arc', 'fire_blast'], sura: ['water_whip', 'ice_path', 'healing_stream'], bo: ['rock_throw', 'earth_wall', 'stone_stance'],
  thug: ['club_swing'], bruiser: ['club_swing'], slinger: ['sling_stone'] };
// element base stats (content/elements.ts) plus each character's statMods; enemies from content/enemies.ts
const BASE = {
  kaya:    { hp: 26, ap: 4, move: 4, power: 8, defense: 2, speed: 7 },
  sura:    { hp: 26, ap: 4, move: 4, power: 7, defense: 1, speed: 6 },
  bo:      { hp: 38, ap: 4, move: 4, power: 6, defense: 5, speed: 2 },
  thug:    { hp: 28, ap: 4, move: 4, power: 5, defense: 1, speed: 5 },
  slinger: { hp: 22, ap: 4, move: 4, power: 4, defense: 0, speed: 7 },
  bruiser: { hp: 42, ap: 4, move: 3, power: 6, defense: 3, speed: 4 },
};
const PROPS = {
  water_barrel: { name: 'Water Barrel', hp: 6, blocks: true, cover: true, onBreak: { surface: 'water', dur: 4, radius: 1 } },
  oil_flask:    { name: 'Oil Flask', hp: 4, blocks: false, onBreak: { surface: 'oil', dur: -1, radius: 1 } },
  hay_bale:     { name: 'Hay Bale', hp: 5, blocks: true, cover: true, onBreak: { surface: 'fire', dur: 2, radius: 1 }, firePops: true },
};
// ---------- the board state (a plain object, so a forecast can run the very same functions on a deep copy)
function newBoard() {
  const cells = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const c = ROWS[y][x];
    cells.push({ x, y, c, blocked: c === 'T' || c === 'W' || c === 'A' || BLOCK.has(x + ',' + y), cover: c === 'r' || c === 'A',
      surface: c === '~' ? { id: 'water', dur: -1, spread: 0 } : c === 'r' ? { id: 'rubble', dur: -1, spread: 0 } : null, wall: 0 });
  }
  return { cells, props: [], units: [], log: [] };
}
const cellOf = (B, x, y) => (x < 0 || y < 0 || x >= GW || y >= GH ? null : B.cells[y * GW + x]);
const blockedNow = (B, x, y) => { const c = cellOf(B, x, y); return !c || c.blocked || c.wall > 0 || B.props.some(p => p.hp > 0 && p.def.blocks && p.x === x && p.y === y); };
const unitOn = (B, x, y) => B.units.find(u => u.hp > 0 && u.cx === x && u.cy === y);
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
function cloneBoard(B) { return { cells: B.cells.map(c => ({ ...c, surface: c.surface && { ...c.surface } })), props: B.props.map(p => ({ ...p })), units: B.units.map(u => ({ ...u, st: u.st.map(s => ({ ...s })), ref: u })), log: [], forecast: true }; }
// --- core/rules/surfaces.ts
const findCombo = (existing, applied) => COMBOS.find(r => r.existing === existing && r.applied === applied) || null;
const resolveDur = (id, d) => (d !== 0 ? d : (SURF[id] ? SURF[id].dur : 2));
function connected(B, x, y, id) { const out = [], seen = new Set(), q = [[x, y]]; while (q.length) { const [a, b] = q.pop(), k = a + ',' + b; if (seen.has(k)) continue; seen.add(k); const c = cellOf(B, a, b); if (!c || !c.surface || c.surface.id !== id) continue; out.push([a, b]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) q.push([a + dx, b + dy]); } return out; }
function applyImpact(B, positions, applied) {
  const changes = [], statusHits = [], chainHits = [];
  for (const [x, y] of positions) {
    const c = cellOf(B, x, y); if (!c || c.blocked || c.wall > 0) continue;
    const existing = c.surface ? c.surface.id : null, r = findCombo(existing, applied); if (!r) continue;
    if (r.chain && existing) for (const [a, b] of connected(B, x, y, existing)) { if (r.chainDamage) chainHits.push({ x: a, y: b, amount: r.chainDamage, type: applied, combo: r }); if (r.status) statusHits.push({ x: a, y: b, status: r.status, chance: r.statusChance, combo: r }); }
    c.surface = r.result ? { id: r.result, dur: resolveDur(r.result, r.duration), spread: r.spread } : null;
    changes.push({ x, y, from: existing, to: r.result, label: r.label, combo: r });
    if (r.status && !r.chain) statusHits.push({ x, y, status: r.status, chance: r.statusChance, combo: r });
  }
  return { changes, statusHits, chainHits };
}
function paintSurface(B, positions, surface, duration, spread = 0) {
  const changes = [], statusHits = [], chainHits = [];
  for (const [x, y] of positions) {
    const c = cellOf(B, x, y); if (!c || c.blocked || c.wall > 0) continue;
    const existing = c.surface ? c.surface.id : null;
    if (existing) {
      const re = applyImpact(B, [[x, y]], surface);
      if (re.changes.length) { changes.push(...re.changes); statusHits.push(...re.statusHits); chainHits.push(...re.chainHits); continue; }
      if (existing === surface) { c.surface = { id: surface, dur: Math.max(c.surface.dur, duration), spread: Math.max(c.surface.spread, spread) }; continue; }
    }
    c.surface = { id: surface, dur: duration, spread }; changes.push({ x, y, from: existing, to: surface, label: `${SURF[surface].name} spreads across the ground.`, combo: { id: 'paint', tip: 'Leaves ' + SURF[surface].name } });
  }
  return { changes, statusHits, chainHits };
}
function tickSurfaces(B) {   // durations down, expired surfaces vanish, fire with spread left crawls one ring (against a snapshot)
  const changes = [], from = [];
  for (const c of B.cells) {
    if (!c.surface) continue; const s = c.surface;
    if (s.spread > 0 && s.id === 'fire') from.push({ x: c.x, y: c.y, dur: s.dur, spread: s.spread });
    if (s.dur < 0) continue;
    const d = s.dur - 1; if (d <= 0) { c.surface = null; changes.push({ x: c.x, y: c.y, from: s.id, to: null, label: `${SURF[s.id].name} fades.` }); continue; }
    c.surface = { ...s, dur: d };
  }
  for (const s of from) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t = cellOf(B, s.x + dx, s.y + dy); if (!t || t.blocked || t.wall > 0) continue;
      const ex = t.surface ? t.surface.id : null; if (ex !== null && ex !== 'oil') continue;
      t.surface = { id: 'fire', dur: Math.max(1, s.dur - 1), spread: s.spread - 1 }; changes.push({ x: t.x, y: t.y, from: ex, to: 'fire', label: 'The fire spreads!' });
    }
    const c = cellOf(B, s.x, s.y); if (c.surface && c.surface.id === 'fire') c.surface.spread = Math.max(0, c.surface.spread - 1);
  }
  for (const c of B.cells) if (c.wall > 0) c.wall--;
  return changes;
}
const contact = (B, x, y) => { const c = cellOf(B, x, y); return c && c.surface ? SURF[c.surface.id] : null; };
// --- core/rules/status.ts and stats
const has = (u, id) => u.st.some(s => s.id === id);
function applyStatus(u, id, dur) {
  const up = STAT.frozen.upgradeFrom.includes(id) && has(u, id) ? 'frozen' : null;   // Chilled again becomes Frozen
  const fin = up || id, def = STAT[fin], d = dur ?? def.dur, cleared = [...(up ? [id] : []), ...(def.clears || [])];
  u.st = u.st.filter(s => !cleared.includes(s.id));
  const ex = u.st.find(s => s.id === fin); if (ex) ex.dur = Math.max(ex.dur, d); else u.st.push({ id: fin, dur: d });
  return fin;
}
function tickStatuses(u) { const dmg = []; const kept = []; for (const s of u.st) { const d = STAT[s.id]; if (d && d.tick) dmg.push({ amount: d.tick, type: d.tickType, src: s.id }); if (s.dur - 1 > 0) kept.push({ ...s, dur: s.dur - 1 }); } u.st = kept; return dmg; }
function eff(u) { const b = { ...BASE[u.k] }; for (const s of u.st) for (const [k, v] of Object.entries((STAT[s.id] || {}).mods || {})) b[k] = (b[k] || 0) + v; return b; }
function mult(u, type) { let m = 1; for (const s of u.st) m *= ((STAT[s.id] || {}).mult || {})[type] ?? 1; return m; }
// --- core/rules/damage.ts: (base + scale * power) * variance * incoming multiplier - defence, at least 1
function compute(att, def, e, variance = 1) { const a = (e.base + e.scale * eff(att).power) * variance * mult(def, e.type) - eff(def).defense; return Math.max(1, Math.round(a)); }
function steamBetween(B, a, b) { const n = dist({ x: a.cx, y: a.cy }, { x: b.cx, y: b.cy }); for (let i = 1; i < n; i++) { const x = Math.round(a.cx + (b.cx - a.cx) * i / n), y = Math.round(a.cy + (b.cy - a.cy) * i / n), c = cellOf(B, x, y); if (c && c.surface && c.surface.id === 'steam') return true; } return false; }
function coverFor(B, att, def) {   // a cover piece (rubble, a barrel, the hay) on the defender's side toward the attacker
  if (dist({ x: att.cx, y: att.cy }, { x: def.cx, y: def.cy }) <= 1) return false;
  const sx = Math.sign(att.cx - def.cx), sy = Math.sign(att.cy - def.cy);
  for (const [dx, dy] of [[sx, sy], [sx, 0], [0, sy]]) { if (!dx && !dy) continue; const c = cellOf(B, def.cx + dx, def.cy + dy); if (!c) continue; if (c.cover || c.wall > 0 || (c.surface && SURF[c.surface.id].cover) || B.props.some(p => p.hp > 0 && p.def.cover && p.x === c.x && p.y === c.y)) return true; }
  return false;
}
function hitChance(B, att, def) {
  const inside = contact(B, def.cx, def.cy), cov = coverFor(B, att, def) ? -20 : 0, acc = eff(att).accuracy || 0;
  const obs = inside && inside.obscures ? inside.obscures.inside : steamBetween(B, att, def) ? -15 : 0;
  return { chance: Math.max(5, Math.min(99, 90 + cov + acc + obs)), cover: cov, obs };
}
// --- grid.ts shapes
function lineTiles(o, t, len) { const dx = Math.sign(t.x - o.x), dy = Math.sign(t.y - o.y); if (!dx && !dy) return []; const out = []; let x = o.x, y = o.y; for (let i = 0; i < len; i++) { x += dx; y += dy; if (!cellOf(BOARD, x, y)) break; out.push([x, y]); if (cellOf(BOARD, x, y).blocked) break; } return out; }
function coneTiles(o, t, len) { const dx = Math.sign(t.x - o.x), dy = Math.sign(t.y - o.y); if (!dx && !dy) return []; const out = [], seen = new Set();
  for (let s = 1; s <= len; s++) { const cx = o.x + dx * s, cy = o.y + dy * s; for (let f = -(s - 1); f <= s - 1; f++) { const p = dx === 0 ? [cx + f, cy] : dy === 0 ? [cx, cy + f] : [cx - dx * Math.max(0, f), cy + dy * Math.max(0, -f)]; const k = p + ''; if (!cellOf(BOARD, p[0], p[1]) || seen.has(k)) continue; seen.add(k); out.push(p); } } return out; }
function blastTiles(t, r) { const out = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (cellOf(BOARD, t.x + dx, t.y + dy)) out.push([t.x + dx, t.y + dy]); return out; }
function abilityTiles(u, ab, t) { const a = ABIL[ab], o = { x: u.cx, y: u.cy }; return a.tgt === 'cone' ? coneTiles(o, t, a.len) : a.tgt === 'line' ? lineTiles(o, t, a.len) : a.tgt === 'blast' ? blastTiles(t, a.radius) : a.tgt === 'self' ? [[u.cx, u.cy]] : [[t.x, t.y]]; }
function validTargets(B, u, ab) {   // tiles this ability may be aimed at from where u stands
  const a = ABIL[ab], out = [];
  if (a.tgt === 'self') return [[u.cx, u.cy]];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const d = dist({ x, y }, { x: u.cx, y: u.cy }); if (d < 1 || d > a.range) continue;
    const t = unitOn(B, x, y);
    if (a.tgt === 'enemy') { if (t && t.side !== u.side) out.push([x, y]); continue; }
    if (a.tgt === 'ally') { if (t && t.side === u.side) out.push([x, y]); continue; }
    if (a.tgt === 'line' || a.tgt === 'cone') { if (d === 1) out.push([x, y]); continue; }   // aimed by direction: 'running out from you'
    if (a.tgt === 'blast' && !cellOf(B, x, y).blocked) out.push([x, y]);
  }
  if (a.tgt === 'ally' && (u.side === 'party')) out.push([u.cx, u.cy]);
  return out;
}
// --- the resolution (abilities.ts order): damage to units on the tiles, then the props on them break, then the impact
// of the damage type on the ground; statuses; surfaces painted; walls raised. `B.forecast` makes it deterministic (every
// hit lands, expected damage, statuses reported with their chance) so the preview runs the real code path on a copy.
function resolve(B, u, ab, t, rng) {
  const a = ABIL[ab], tiles = abilityTiles(u, ab, t), out = { hits: [], tips: [], changes: [], statuses: [], broke: [], heals: [], walls: [], misses: [] };
  const hitUnits = a.tgt === 'self' ? [u] : tiles.map(([x, y]) => unitOn(B, x, y)).filter(v => v && (a.tgt === 'ally' ? v.side === u.side : a.tgt === 'enemy' ? v.side !== u.side : true));
  const landed = [];
  for (const e of a.eff) {
    if (e.k === 'damage') {
      for (const v of hitUnits) {
        const h = hitChance(B, u, v);
        if (!B.forecast && rng() * 100 >= h.chance) { out.misses.push(v); continue; }
        const n = compute(u, v, e, B.forecast ? 1 : 0.9 + rng() * 0.2); v.hp = Math.max(0, v.hp - n); out.hits.push({ v, n, chance: h.chance, type: e.type }); landed.push(v);
      }
      // prop damage resolves BEFORE the impact (CLAUDE.md): a cracked flask spills oil the flame then finds
      for (const p of B.props) if (p.hp > 0 && tiles.some(([x, y]) => x === p.x && y === p.y)) breakProp(B, p, e.base, e.type, out);
      const re = applyImpact(B, tiles, e.type); out.changes.push(...re.changes);
      for (const s of re.statusHits) { const v = unitOn(B, s.x, s.y); if (v && (B.forecast || rng() < s.chance)) out.statuses.push({ v, id: applyStatus(v, s.status), chance: s.chance }); }
    }
    if (e.k === 'status') for (const v of (e.self ? [u] : landed)) { if (B.forecast ? e.chance > 0 : rng() < e.chance) out.statuses.push({ v, id: applyStatus(v, e.status, e.dur), chance: e.chance }); }
    if (e.k === 'surface') { const re = paintSurface(B, tiles, e.surface, e.dur); out.changes.push(...re.changes); for (const s of re.statusHits) { const v = unitOn(B, s.x, s.y); if (v && (B.forecast || rng() < s.chance)) out.statuses.push({ v, id: applyStatus(v, s.status), chance: s.chance }); } }
    if (e.k === 'heal') for (const v of hitUnits) { const n = Math.max(1, Math.round(e.base + e.scale * eff(u).power)); v.hp = Math.min(v.max, v.hp + n); out.heals.push({ v, n }); }
    if (e.k === 'cleanse') for (const v of hitUnits) v.st = v.st.filter(s => !e.statuses.includes(s.id));
    if (e.k === 'wall') for (const [x, y] of tiles) { const c = cellOf(B, x, y); if (c.blocked || unitOn(B, x, y)) continue; c.wall = e.dur; if (c.surface && c.surface.id === 'fire') c.surface = null; out.walls.push([x, y]); }
  }
  for (const ch of out.changes) if (ch.combo && ch.combo.tip && !out.tips.includes(ch.combo.tip)) out.tips.push(ch.combo.tip);
  for (const b of out.broke) if (!out.tips.includes('Breaks ' + b.def.name)) out.tips.unshift('Breaks ' + b.def.name);
  if (out.walls.length) out.tips.push('Raises a Wall');
  return out;
}
function breakProp(B, p, amount, type, out) {
  if (p.def.firePops && type === 'fire') amount = p.hp;   // the hay goes up at a touch of flame
  p.hp -= amount; if (p.hp > 0) return; out.broke.push(p);
  const o = p.def.onBreak, tiles = []; for (let dy = -o.radius; dy <= o.radius; dy++) for (let dx = -o.radius; dx <= o.radius; dx++) tiles.push([p.x + dx, p.y + dy]);
  if (p.def.blocks) { const c = cellOf(B, p.x, p.y); c.blocked = false; }
  const re = paintSurface(B, tiles, o.surface, o.dur); out.changes.push(...re.changes);
}
