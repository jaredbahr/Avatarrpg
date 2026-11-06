// ---------- the fight, on the ported rules: initiative by Speed each round, a turn = AP and a separate Move pool,
// statuses tick at the owner's turn start, surfaces tick (and fire spreads) at the end of the round.
let BOARD = null;
const timers = [], gtimers = [];
const wait = ms => new Promise(r => timers.push({ t: ms, r }));
function setTimeoutG(f, ms) { gtimers.push({ t: ms, f }); }
let RNG = 20261105; const rng = () => ((RNG = (RNG * 1103515245 + 12345) >>> 0) / 4294967296);
const S = { phase: 'intro', active: null, ab: null, aim: null, round: 0, over: false, order: [], preview: null, walk: null, plan: null, result: null };
const alive = side => UNITS.filter(u => u.hp > 0 && u.side === side);
let PROPLIST = [];
function setupBoard() {
  BOARD = newBoard();
  BOARD.props = PROPLIST.map(p => ({ id: p.id, def: PROPS[p.id], x: p.x, y: p.y, hp: PROPS[p.id].hp, ob: p.ob }));
  for (const u of UNITS) { levelUp(u.k, LV.level || 1); }
  for (const u of UNITS) { const b = BASE[u.k]; Object.assign(u, { hp: b.hp, max: b.hp, st: [], ap: 0, mv: 0, cd: {} }); }
  BOARD.units = UNITS;
}
// ---------- movement: 4-way, extra cost on water, mud, oil and rubble (moveCost), a climb of one tier costs one more and two
// tiers is a wall (E4 climbing); never through foes or walls. A 2x2 unit needs all four cells.
function standable(u, x, y) {
  const e0 = cellOf(BOARD, x, y); if (!e0) return false;
  for (let dy = 0; dy < (u.size || 1); dy++) for (let dx = 0; dx < (u.size || 1); dx++) {
    const c = cellOf(BOARD, x + dx, y + dy); if (!c || blockedNow(BOARD, x + dx, y + dy) || c.elev !== e0.elev && (u.size || 1) > 1) return false;
    const o = unitOn(BOARD, x + dx, y + dy); if (o && o !== u && o.side !== u.side) return false;
  }
  return true;
}
function reach(u, limit = u.mv) {
  const seen = new Map([[u.cx + ',' + u.cy, { d: 0, from: null }]]), q = [[u.cx, u.cy]];
  if (has(u, 'rooted')) return seen;
  while (q.length) {
    q.sort((a, b) => seen.get(a + '').d - seen.get(b + '').d); const [x, y] = q.shift(), d = seen.get(x + ',' + y).d;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (!standable(u, nx, ny)) continue;
      const climb = Math.abs(cellOf(BOARD, nx, ny).elev - cellOf(BOARD, x, y).elev); if (climb > 1) continue;
      const sc = contact(BOARD, nx, ny), nd = d + 1 + (sc ? sc.moveCost : 0) + climb; if (nd > limit) continue;
      if (seen.has(k) && seen.get(k).d <= nd) continue; seen.set(k, { d: nd, from: x + ',' + y }); q.push([nx, ny]);
    }
  }
  for (const [k, v] of seen) { const [x, y] = k.split(',').map(Number); if (cellsOf({ cx: x, cy: y, size: u.size }).some(([a, b]) => { const o = unitOn(BOARD, a, b); return o && o !== u; })) v.ally = true; }
  return seen;
}
function pathTo(R, x, y) { const out = []; let k = x + ',' + y; while (k && R.get(k) && R.get(k).from) { out.unshift(k.split(',').map(Number)); k = R.get(k).from; } return out; }
// pacing pass: a unit's blow is resolved at its strike frame; what is left is recovery. The next turn may start while it plays out,
// but the same unit never walks out of its own animation, so everything that moves a unit first lets it finish.
async function settle(u) { while (u.anim !== 'idle' && u.hp > 0) await wait(16); }
async function moveUnit(u, x, y, previewMs = 0, R0 = null) {
  await settle(u);
  const R = R0 || reach(u), node = R.get(x + ',' + y); if (!node || node.ally) return false;
  const p = pathTo(R, x, y); if (!p.length) return true;
  S.walk = { u, path: p }; if (previewMs) await wait(previewMs);
  u.mv -= node.d;
  for (const step of p) {   // one tile at a time; whatever surface it lands on touches the walker (contactEffects)
    await new Promise(r => { u.arrive = r; u.path = [step]; });
    S.walk = { u, path: S.walk ? S.walk.path.slice(1) : [] };
    if (MODE === 'explore') continue;
    const sc = contact(BOARD, u.cx, u.cy);
    if (sc && sc.enterDamage) hurt(u, Math.max(0, Math.round(sc.enterDamage * mult(u, sc.type))), null, '#f2b45a');
    if (sc && sc.status && rng() < sc.chance) addStatus(u, sc.status);
    if (u.hp <= 0 || has(u, 'rooted')) break;
  }
  S.walk = null; skipEnd(); return true;
}
const STATUS_COL = { burning: '#f2b45a', wet: '#86c2bd', chilled: '#c8e4ee', frozen: '#e8f4f8', shocked: '#f2d47a', rooted: '#a08a6c', slowed: '#a08a6c', guarded: '#d6d0c4', inspired: '#f2d47a', blinded: '#c9c0a8' };
function addStatus(u, id, dur) { const fin = applyStatus(u, id, dur); popText(u, STAT[fin].name, STATUS_COL[fin]); return fin; }
function knockOut(u) { if (u.ko >= 0) return; u.ko = 0; if (u.k === 'grumbler') { impact('slam', u.x, u.y); popText(u, 'The drill jams', '#e8d8b0'); hitStop = 220; } else impact('earth', u.x, u.y); }
function hurt(u, n, from, col) {
  if (!u || u.hp <= 0 || n <= 0) return; u.hp = Math.max(0, u.hp - n); u.flash = 0; popNum(u, n, col);
  if (from) { const dx = u.x - from.x, dy = u.y - from.y, d = Math.hypot(dx, dy) || 1; u.shove = [dx / d * 4, dy / d * 2]; }
  if (u.hp <= 0) knockOut(u);
}
// ---------- the forecast runs resolve() itself on a deep copy of the board (the rules' own function, nothing hand-described)
function forecast(u, ab, t) {
  const B = cloneBoard(BOARD), cu = B.units.find(v => v.ref === u), save = BOARD; BOARD = B;
  let res; try { res = resolve(B, cu, ab, { x: t[0], y: t[1] }, null); } finally { BOARD = save; }
  return { ab, t, dmg: res.hits.map(h => ({ u: h.v.ref, n: h.n, chance: h.chance })), tips: res.tips, statuses: res.statuses.map(s => ({ u: s.v.ref, id: s.id, chance: s.chance })),
    heals: res.heals.map(h => ({ u: h.v.ref, n: h.n })), tiles: abilityTiles(u, ab, { x: t[0], y: t[1] }), pushes: res.pushes.length };
}
// ---------- one blow, start to finish: the pose, its painted effect, the rules, the result on screen
const HEAVY = { club_swing: 90, merc_blade: 70, ruon_sabre: 80, driller_slam: 170, driller_debris: 120, rock_throw: 50 };
async function useAbility(u, ab, t) {
  await settle(u);
  const A = ABIL[ab]; u.ap -= A.ap; if (A.cd) u.cd[ab] = A.cd + 1;
  const tgt = { x: t[0], y: t[1] }, o = originFor(u, tgt), dir = A.tgt === 'self' ? u.dir : dirTo(cellX(t[0]) - cellX(o.x), cellY(t[1]) - cellY(o.y));
  let done = false, applied = null; const appliedP = new Promise(r => { applied = r; }); const apply = () => { if (done) return; done = true; const res = resolve(BOARD, u, ab, tgt, rng); NAMES.push(`${u.k}:${ab}@${t}=>${res.tips.join('/')} hits ${res.hits.map(h => h.v.k + h.n).join(',')} miss ${res.misses.length}`); playResult(u, res, ab); applied(); };
  showName(A.name); S.preview = null; S.ab = null; S.aim = null;
  const tiles = abilityTiles(u, ab, tgt), cx = tiles.reduce((a, [x]) => a + cellX(x), 0) / tiles.length, cy = tiles.reduce((a, [, y]) => a + cellY(y), 0) / tiles.length;
  const TX = cellX(t[0]), TY = cellY(t[1]);
  let animP;
  if (u.k === 'kaya') {
    const k = ab === 'fire_jab' ? 'jab' : ab === 'flame_arc' ? 'whip' : 'blast';
    animP = new Promise(fin => startBend(u, k, dir, () => {
      if (ab === 'fire_jab' || ab === 'fire_blast') fireJab(u, ab === 'fire_blast' ? TX : cx, ab === 'fire_blast' ? TY : cy, () => { if (ab === 'fire_blast') { rings.push({ x: TX, y: TY, t: 0 }); flashes.push({ x: TX, y: TY, t: 0, life: 360, r: 30 }); shake = 240; shakeAmp = 2; } apply(); });
      else { fireWhip(u); setTimeoutG(apply, 140); }
    }, fin));
  } else {
    u.dir = dir; const clip = CLIP[ab] && ASSETS.chars[u.k] && ASSETS.chars[u.k][CLIP[ab]] ? CLIP[ab] : null;
    animP = new Promise(fin => { u.anim = 'attack'; u.clip = clip; u.at = 0; u.struck = false; u.done = fin;
      u.onStrike = () => {
        const hand = { x: u.x + Math.cos(Math.atan2(TY - u.y, TX - u.x)) * 10, y: u.y - 24 };
        if (ab === 'water_whip') { vfxAt('water_lash', (u.x + TX) / 2, u.y - 20, { flip: TX < u.x }); throwBolt('water', u, { x: TX, y: TY }, () => { vfxAt('water_splash', TX, TY - 16); apply(); }); }
        else if (ab === 'sling_stone' || ab === 'rock_throw') throwBolt('stone', u, { x: TX, y: TY }, () => { vfxAt('rock_hit', TX, TY - 14); apply(); }, ab === 'rock_throw' ? 'rock' : null);
        else if (ab === 'merc_crossbow') throwBolt('bolt', u, { x: TX, y: TY }, () => { vfxAt('bolt_hit', TX, TY - 18); apply(); });
        else if (ab === 'oil_flask') throwBolt('jar', u, { x: TX, y: TY }, () => { vfxAt('oil_splash', TX, TY - 6); apply(); });
        else if (ab === 'torch_toss') throwBolt('torch', u, { x: TX, y: TY }, () => { flashes.push({ x: TX, y: TY, t: 0, life: 300, r: 16 }); apply(); });
        else if (ab === 'fire_blast') { vfxAt('fire_punch', hand.x, hand.y, { flip: TX < u.x }); shots.push({ d: dir, x: hand.x, g: u.y, h: 20, tx: TX, ty: TY, t: 0, onHit: () => { rings.push({ x: TX, y: TY, t: 0 }); flashes.push({ x: TX, y: TY, t: 0, life: 360, r: 30 }); shake = 200; shakeAmp = 2; apply(); } }); }
        else if (ab === 'ice_path') { tiles.forEach(([x, y], i) => setTimeoutG(() => vfxAt('ice_burst', cellX(x), cellY(y) - 6), i * 70)); setTimeoutG(apply, 120); }
        else if (ab === 'healing_stream') { vfxAt('heal', TX, TY - 20); apply(); }
        else if (ab === 'earth_wall') { for (const [x, y] of tiles) vfxAt('dust_ring', cellX(x), cellY(y) - 2); shake = 160; shakeAmp = 1; apply(); }
        else if (ab === 'stone_stance') { vfxAt('dust_ring', u.x, u.y - 2); apply(); }
        else if (ab === 'raise_rubble') { vfxAt('dust_ring', TX, TY - 2); vfxAt('rock_hit', TX, TY - 10); apply(); }
        else if (ab === 'bandit_rush') { vfxAt('dust_ring', u.x, u.y - 2); apply(); }
        else if (ab === 'ruon_order') { popText(u, 'Left flank! Now!', '#f2d47a'); vfxAt('heal', TX, TY - 20); apply(); }
        else if (ab === 'merc_blade' || ab === 'ruon_sabre') { vfxAt('slash', TX, TY - 22, { flip: TX < u.x }); apply(); }
        else if (ab === 'club_swing') { vfxAt('club_hit', TX, TY - 22); impact(u.k === 'bruiser' ? 'slam' : 'club', TX, TY); apply(); }
        else if (ab === 'driller_slam') { vfxAt('slam_shock', cx, cy); impact('slam', cx, cy); shake = 320; shakeAmp = 3; apply(); }
        else if (ab === 'driller_debris') { vfxAt('debris', TX, TY - 18); shake = 260; shakeAmp = 2; setTimeoutG(apply, 160); }
        else if (ab === 'driller_spray') { tiles.forEach(([x, y], i) => setTimeoutG(() => vfxAt('oil_splash', cellX(x), cellY(y) - 4), i * 60)); setTimeoutG(apply, 200); }
        else if (ab === 'driller_churn') { tiles.filter((_, i) => i % 2 === 0).forEach(([x, y], i) => setTimeoutG(() => vfxAt('mud_churn', cellX(x), cellY(y) - 4), i * 40)); shake = 400; shakeAmp = 2; setTimeoutG(apply, 220); }
        else { impact('club', TX, TY); apply(); }
        if (HEAVY[ab] && ab !== 'driller_debris') hitStop = Math.max(hitStop, HEAVY[ab]);
      }; });
  }
  // resolved at the strike; the rest of the pose is recovery and plays on while the turn passes. If a pose ends without having struck, resolve then.
  await Promise.race([appliedP, animP.then(async () => { while (!done && (shots.length || bolts.length)) await wait(30); apply(); })]);
  apply(); skipEnd(); await wait(TAIL_MS);
}
const TAIL_MS = 110;   // damage numbers and the first knock-out frame read before the next turn starts (was 300 after the whole pose)
function playResult(u, res, ab) {
  // resolve() already changed hp (and positions, for a push or a rush) on the live units: show it
  for (const h of res.hits) { const v = h.v; v.flash = 0; popNum(v, h.n, h.type === 'fire' ? '#f2b45a' : '#f6eed6'); const dx = v.x - u.x, dy = v.y - u.y, d = Math.hypot(dx, dy) || 1; v.shove = [dx / d * 4, dy / d * 2]; if (v.hp <= 0) knockOut(v); }
  for (const m of res.misses) popText(m, 'Miss', '#e8d8b0');
  for (const h of res.heals) popNum(h.v, '+' + h.n, '#9cd38a');
  for (const s of res.statuses) popText(s.v, STAT[s.id].name, STATUS_COL[s.id]);
  for (const p of res.pushes || []) { p.v.path = [p.to]; p.v.fast = 160; }
  if (res.dash) { u.path = [res.dash.to]; u.fast = 260; vfxAt('dust_ring', feetX(u, res.dash.to[0]), feetY(u, res.dash.to[1]) - 2); }
  for (const p of res.broke) { if (p.ob) p.ob.gone = true; impact(p.id === 'oil_flask' ? 'club' : 'earth', cellX(p.x), cellY(p.y)); if (p.id === 'oil_flask') vfxAt('oil_splash', cellX(p.x), cellY(p.y) - 4); popTextAt(cellX(p.x), cellY(p.y) - 44 - res.broke.indexOf(p) * 8, p.def.label || p.def.name + ' breaks', '#e8d8b0'); }
  for (const [x, y] of res.walls) WALLS.push({ x, y, t: 0 });
  const shown = new Set(); for (const c of res.changes) if (c.combo && c.combo.id !== 'paint' && !shown.has(c.combo.id)) { shown.add(c.combo.id); popTextAt(cellX(c.x), cellY(c.y) - 20 - (shown.size - 1) * 8, c.combo.tip, '#f6eed6'); }   // stacked, never on top of each other
  if (res.changes.length || res.walls.length || res.broke.length) surfDirty = true;
  for (const c of res.changes) if (c.to === 'fire') flashes.push({ x: cellX(c.x), y: cellY(c.y), t: -rnd() * 200, life: 300, r: 14 });
  for (const c of res.changes) if (c.to === 'steam' || c.from === 'fire') for (let i = 0; i < 8; i++) dusts.push({ x: cellX(c.x) + (rnd() - 0.5) * 24, y: cellY(c.y) - 8, vx: (rnd() - 0.5) * 20, vy: -30 - rnd() * 30, t: 0, life: 700, col: '#e8ece8' });
}
const WALLS = [];
// ---------- turns
let MODE = LV.mode;
async function runBattle(auto) {
  S.phase = 'fight'; await wait(250);
  if (LV.intro) { banner(LV.intro[0], LV.intro[1]); await wait(2000); banner(''); }
  while (!S.over) {
    S.round++;
    S.order = UNITS.filter(u => u.hp > 0).sort((a, b) => eff(b).speed - eff(a).speed || (a.side === 'party' ? -1 : 1));
    for (const u of S.order) {
      if (S.over || u.hp <= 0) continue;
      // the owner's turn start: statuses tick (Burning hurts), durations fall, cooldowns fall, a Frozen unit loses the turn
      const skips = u.st.some(s => STAT[s.id] && STAT[s.id].skips);
      for (const k in u.cd) if (u.cd[k] > 1) u.cd[k]--; else delete u.cd[k];
      const ticks = tickStatuses(u); for (const t of ticks) hurt(u, Math.max(0, Math.round(t.amount * mult(u, t.type))), null, '#f2b45a');
      if (u.hp <= 0) { await wait(300); if (checkEnd()) break; continue; }
      const e = eff(u); u.ap = skips ? 0 : Math.max(0, e.ap); u.mv = skips ? 0 : Math.max(0, e.move);
      S.active = u; focus = u; setTop(`Round ${S.round} · ${u.name}`);
      if (ticks.length) await wait(300);
      if (skips) { popText(u, 'Frozen', '#e8f4f8'); await wait(550); continue; }
      if (u.side === 'foe' || STATS[u.k].ally) await aiTurn(u); else if (auto) await autoTurn(u); else await playerTurn(u);
      S.active = null; S.ab = null; S.aim = null; S.preview = null;
      if (checkEnd()) break;
    }
    if (S.over) break;
    const ch = tickSurfaces(BOARD);
    if (ch.length) { surfDirty = true; const c = ch.find(c => c.label === 'The fire spreads!'); if (c) { popTextAt(cellX(c.x), cellY(c.y) - 20, 'The fire spreads!', '#f2b45a'); focus = { x: cellX(c.x), y: cellY(c.y) }; await wait(600); } }
    await wait(100);
  }
}
function checkEnd() {
  if (S.over) return true;
  if (!alive('foe').length) { S.over = true; S.active = null; S.result = 'victory'; banner('VICTORY', LV.win || ''); setTop(''); setTimeoutG(() => tellShell({ type: 'done', result: 'victory' }), 1700); return true; }
  if (!UNITS.some(u => u.hp > 0 && u.side === 'party' && !STATS[u.k].ally)) { S.over = true; S.result = 'defeat'; banner('DEFEAT', ''); setTimeoutG(() => tellShell({ type: 'done', result: 'defeat' }), 1700); return true; }
  return false;
}
// ---------- the other side (and Ruon), in the spirit of core/rules/ai.ts: every place it could stand x every ability x every
// target is forecast with the real rules on a copy and scored by its role; then it walks there and strikes. aggressive closes
// in, cautious keeps cover and distance, the boss leads with the slam and lays oil, mud and rubble where the party stands
const ROLE = { thug: 'aggressive', bruiser: 'aggressive', merc: 'aggressive', ruon: 'aggressive', slinger: 'cautious', xbow: 'cautious', qbender: 'cautious', deserter: 'cautious', grumbler: 'boss' };
function aiStandScore(u, x, y, R) {
  const foes = UNITS.filter(v => v.hp > 0 && v.side !== u.side), role = ROLE[u.k] || 'aggressive';
  const sc = contact(BOARD, x, y); let s = sc && sc.enterDamage ? -60 : sc === SURF.oil ? -10 : sc === SURF.steam ? -8 : 0;
  const near = foes.length ? Math.min(...foes.map(o => udist({ cx: x, cy: y, size: u.size }, { x: o.cx, y: o.cy }))) : 9;
  if (role === 'aggressive' || role === 'boss') s -= near * 2.2; else { s -= Math.abs(near - 4) * 1.6; if (near <= 1) s -= 10; if (foes.some(p => coverFor(BOARD, p, { cx: x, cy: y }))) s += 6; }
  let k = x + ',' + y; while (k && R.get(k) && R.get(k).from) { const [a, b] = k.split(',').map(Number), c = contact(BOARD, a, b); if (c && c.enterDamage) s -= 30; k = R.get(k).from; }
  return s;
}
function aiTargets(u, ab) {
  const A = ABIL[ab], all = validTargets(BOARD, u, ab);
  if (A.tgt === 'tile' || A.tgt === 'blast') {   // only tiles beside an enemy are worth a forecast
    const foes = UNITS.filter(v => v.hp > 0 && v.side !== u.side);
    if (A.eff[0].k === 'dash') return all.filter(([x, y]) => foes.some(o => udist(o, { x, y }) === 1));
    return all.filter(([x, y]) => foes.some(o => udist(o, { x, y }) <= (A.radius || 0)));
  }
  return all;
}
function aiScore(u, f) {
  let s = 0;
  for (const d of f.dmg) s += (d.u.side !== u.side ? 1 : -1.5) * d.n * d.chance / 100 + (d.u.side !== u.side && d.n >= d.u.hp ? 10 : 0);
  for (const st of f.statuses) s += (st.u.side !== u.side ? (st.id === 'inspired' ? -4 : 4) : st.id === 'inspired' || st.id === 'guarded' ? 5 : -4) * st.chance;
  for (const h of f.heals) s += Math.min(h.n, h.u.max - h.u.hp) * 0.8;
  const foes = UNITS.filter(v => v.hp > 0 && v.side !== u.side), on = f.tiles.filter(([x, y]) => foes.some(o => covers(o, x, y))).length;
  if (f.ab === 'oil_flask' || f.ab === 'driller_spray') s += on * 3;
  if (f.ab === 'torch_toss') s += f.tips.includes('Ignites Oil') ? 14 : 0;
  if (f.ab === 'driller_churn') s += on * 2.5;
  if (f.ab === 'raise_rubble') s += 2;
  if (f.ab === 'ruon_order') s += 6;
  if (f.ab === 'bandit_rush') s += 1;
  s += f.pushes * 2;
  return s;
}
async function aiTurn(u) {
  await wait(60);
  for (let guard = 0; guard < 3 && u.hp > 0 && !S.over && u.ap > 0; guard++) {
    const R = guard === 0 || u.mv > 0 ? reach(u) : new Map([[u.cx + ',' + u.cy, { d: 0 }]]); let best = null;
    for (const [k, v] of R) {
      if (v.ally) continue; const [x, y] = k.split(',').map(Number), ox = u.cx, oy = u.cy, stand = aiStandScore(u, x, y, R) - v.d * 0.3;
      u.cx = x; u.cy = y;
      for (const ab of KITS[u.k]) {
        const A = ABIL[ab]; if (u.ap < A.ap || u.cd[ab]) continue;
        for (const t of aiTargets(u, ab)) { const f = forecast(u, ab, t), s = aiScore(u, f) + stand * 0.5; if (s > 2 && (!best || s > best.s)) best = { s, x, y, ab, t, f }; }
      }
      u.cx = ox; u.cy = oy;
    }
    if (!best) {   // nothing worth doing from anywhere: close in (or hold cover) and end the turn
      if (u.mv > 0) { let tgt = null, bs = -1e9; for (const [k, v] of R) { if (v.ally) continue; const [x, y] = k.split(',').map(Number), s = aiStandScore(u, x, y, R) - v.d * 0.2; if (s > bs) { bs = s; tgt = [x, y]; } }
        if (tgt && (tgt[0] !== u.cx || tgt[1] !== u.cy)) await moveUnit(u, tgt[0], tgt[1], 140, R); }
      break;
    }
    if (best.x !== u.cx || best.y !== u.cy) { await moveUnit(u, best.x, best.y, 140, R); if (u.hp <= 0 || has(u, 'rooted') && (best.x !== u.cx || best.y !== u.cy)) break; }
    if (!validTargets(BOARD, u, best.ab).some(([a, b]) => a === best.t[0] && b === best.t[1])) continue;
    focus = { x: (u.x + cellX(best.t[0])) / 2, y: (u.y + cellY(best.t[1])) / 2, pts: [u, { x: cellX(best.t[0]), y: cellY(best.t[1]) }] };
    if (u.side === 'party') { S.ab = best.ab; S.aim = best.t; S.preview = forecast(u, best.ab, best.t); await wait(380); }
    await useAbility(u, best.ab, best.t); if (checkEnd()) return;
  }
}
// ---------- the player: tap a tile to walk, pick an ability, tap a target to see the forecast, tap again to confirm
let playerDone = null;
function playerTurn(u) { return new Promise(r => { playerDone = r; buildBar(); setTop(`${u.name} · ${u.ap} AP · tap ground to move`); }); }
function buildBar() {
  const bar = document.getElementById('bar'); bar.innerHTML = ''; const u = S.active;
  if (!u || u.side !== 'party' || S.over || REC || OVERVIEW || STATS[u.k].ally) return;
  const add = (label, on, fn, dis) => { const b = document.createElement('button'); b.textContent = label; if (on) b.className = 'on'; b.disabled = !!dis; b.onpointerdown = e => { e.preventDefault(); fn(); }; bar.appendChild(b); };
  for (const ab of KITS[u.k]) { const A = ABIL[ab]; add(`${A.name} · ${A.ap}`, S.ab === ab, () => { S.ab = S.ab === ab ? null : ab; S.aim = null; S.preview = null; buildBar(); if (S.ab && ABIL[S.ab].tgt === 'self') { S.aim = [u.cx, u.cy]; S.preview = forecast(u, S.ab, S.aim); } }, u.ap < A.ap || u.cd[ab] || !validTargets(BOARD, u, ab).length); }
  add('End Turn', false, () => { const r = playerDone; playerDone = null; bar.innerHTML = ''; r && r(); });
}
let busy = false;
async function tapCell(x, y) {
  if (MODE === 'explore') return exploreTap(x, y);
  const u = S.active; if (!u || u.side !== 'party' || busy || !playerDone) { if (S.phase === 'fight' && !S.over && (busy || S.active || vfxs.length || bolts.length)) skipAnim(); return; }
  if (S.ab) {
    if (!validTargets(BOARD, u, S.ab).some(([a, b]) => a === x && b === y)) return;
    if (!S.aim || S.aim[0] !== x || S.aim[1] !== y) { S.aim = [x, y]; S.preview = forecast(u, S.ab, S.aim); return; }
    busy = true; const ab = S.ab; buildBar(); await useAbility(u, ab, [x, y]); busy = false; afterPlayerAction(u); return;
  }
  const R = reach(u), n = R.get(x + ',' + y); if (!n || n.ally || (x === u.cx && y === u.cy)) return;
  busy = true; await moveUnit(u, x, y, 120); busy = false; afterPlayerAction(u);
}
function afterPlayerAction(u) {
  if (checkEnd() || u.hp <= 0) { const r = playerDone; playerDone = null; r && r(); return; }
  setTop(`${u.name} · ${u.ap} AP`); buildBar();
  const anyAb = KITS[u.k].some(ab => u.ap >= ABIL[ab].ap && !u.cd[ab] && validTargets(BOARD, u, ab).length);
  if (!anyAb && u.mv <= 0) { const r = playerDone; playerDone = null; r && r(); }
}
function banner(s, sub) { const b = document.getElementById('banner'); b.innerHTML = s ? `${s}<small>${sub || ''}</small>` : ''; b.classList.toggle('show', !!s); }
function setTop(s) { const t = document.getElementById('top'); t.textContent = s; t.style.display = s ? '' : 'none'; }
// ---------- explore (the road up to the quarry): Kaya walks where you tap; Sura and Bo follow two and four steps behind her
const trail = [];
function exploreStep(u) { trail.unshift([u.cx, u.cy]); if (trail.length > 12) trail.pop(); }
async function exploreWalk(x, y) {
  const k = UNITS[0], R = reach(k, 99); if (!R.get(x + ',' + y) || busy) return false;
  busy = true; const p = pathTo(R, x, y);
  S.walk = { u: k, path: p };
  for (const step of p) {
    exploreStep(k);
    const fol = UNITS.slice(1, 3);
    fol.forEach((f, i) => { const tr = trail[i * 2 + 1] || trail[trail.length - 1]; if (tr && (tr[0] !== f.cx || tr[1] !== f.cy)) { f.path = [tr]; } });
    await new Promise(r => { k.arrive = r; k.path = [step]; });
    S.walk = { u: k, path: S.walk.path.slice(1) };
    if ((LV.exit || []).some(([a, b]) => a === k.cx && b === k.cy)) { S.walk = null; busy = false; exitReached(); return true; }
  }
  S.walk = null; busy = false; return true;
}
let exited = false;
function exitReached() { if (exited) return; exited = true; setTop(''); tellShell({ type: 'exit' }); }
function exploreTap(x, y) { exploreWalk(x, y); }
async function runExplore(auto) {
  S.phase = 'explore'; setTop(TUT ? '' : 'Tap the road to walk');
  if (!auto) return;
  await wait(600);
  for (const [x, y] of LV.route.slice(1)) { await exploreWalk(x, y); await wait(60); if (exited) return; }
}
const TUT = !!AREA;
