// ---------- the fight, on the ported rules: initiative by Speed each round, a turn = 4 AP and a separate Move pool,
// statuses tick at the owner's turn start, surfaces tick (and fire spreads) at the end of the round.
let BOARD = null;
const timers = [], gtimers = [];
const wait = ms => new Promise(r => timers.push({ t: ms, r }));
function setTimeoutG(f, ms) { gtimers.push({ t: ms, f }); }
let RNG = 20261105; const rng = () => ((RNG = (RNG * 1103515245 + 12345) >>> 0) / 4294967296);
const S = { phase: 'intro', active: null, ab: null, aim: null, round: 0, over: false, order: [], preview: null, walk: null, plan: null };
const alive = side => UNITS.filter(u => u.hp > 0 && u.side === side);
function setupBoard() {
  BOARD = newBoard();
  const barrels = OBJ.filter(o => o.k === 'rain_barrel');
  BOARD.props = [
    { id: 'water_barrel', def: PROPS.water_barrel, x: 15, y: 3, hp: 6, ob: barrels[0] },
    { id: 'water_barrel', def: PROPS.water_barrel, x: 14, y: 4, hp: 6, ob: barrels[1] },
    { id: 'oil_flask', def: PROPS.oil_flask, x: 13, y: 6, hp: 4, ob: OIL.ob },
    { id: 'hay_bale', def: PROPS.hay_bale, x: 12, y: 5, hp: 5, ob: OBJ.find(o => o.k === 'hay_bale') },
  ];
  for (const u of UNITS) { const b = BASE[u.k]; Object.assign(u, { hp: b.hp, max: b.hp, st: [], ap: 0, mv: 0, cd: {} }); }
  BOARD.units = UNITS;
}
// ---------- movement: 4-way, extra cost on water, mud, oil and rubble (moveCost), never through foes or walls
function reach(u) {
  const seen = new Map([[u.cx + ',' + u.cy, { d: 0, from: null }]]), q = [[u.cx, u.cy]];
  if (has(u, 'rooted')) return seen;
  while (q.length) {
    q.sort((a, b) => seen.get(a + '').d - seen.get(b + '').d); const [x, y] = q.shift(), d = seen.get(x + ',' + y).d;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (blockedNow(BOARD, nx, ny)) continue;
      const o = unitOn(BOARD, nx, ny); if (o && o.side !== u.side) continue;
      const sc = contact(BOARD, nx, ny), nd = d + 1 + (sc ? sc.moveCost : 0); if (nd > u.mv) continue;
      if (seen.has(k) && seen.get(k).d <= nd) continue; seen.set(k, { d: nd, from: x + ',' + y }); q.push([nx, ny]);
    }
  }
  for (const [k, v] of seen) { const [x, y] = k.split(',').map(Number); if (unitOn(BOARD, x, y) && !(x === u.cx && y === u.cy)) v.ally = true; }
  return seen;
}
function pathTo(R, x, y) { const out = []; let k = x + ',' + y; while (k && R.get(k) && R.get(k).from) { out.unshift(k.split(',').map(Number)); k = R.get(k).from; } return out; }
async function moveUnit(u, x, y, previewMs = 0) {
  const R = reach(u), node = R.get(x + ',' + y); if (!node || node.ally) return false;
  const p = pathTo(R, x, y); if (!p.length) return true;
  S.walk = { u, path: p }; if (previewMs) await wait(previewMs);
  u.mv -= node.d;
  for (const step of p) {   // one tile at a time; whatever surface it lands on touches the walker (contactEffects)
    await new Promise(r => { u.arrive = r; u.path = [step]; });
    S.walk = { u, path: S.walk ? S.walk.path.slice(1) : [] };
    const sc = contact(BOARD, u.cx, u.cy);
    if (sc && sc.enterDamage) hurt(u, Math.max(0, Math.round(sc.enterDamage * mult(u, sc.type))), null, '#f2b45a');
    if (sc && sc.status && rng() < sc.chance) addStatus(u, sc.status);
    if (u.hp <= 0 || has(u, 'rooted')) break;
  }
  S.walk = null; return true;
}
const STATUS_COL = { burning: '#f2b45a', wet: '#86c2bd', chilled: '#c8e4ee', frozen: '#e8f4f8', shocked: '#f2d47a', rooted: '#a08a6c', slowed: '#a08a6c', guarded: '#d6d0c4' };
function addStatus(u, id, dur) { const fin = applyStatus(u, id, dur); popText(u, STAT[fin].name, STATUS_COL[fin]); return fin; }
function hurt(u, n, from, col) {
  if (!u || u.hp <= 0 || n <= 0) return; u.hp = Math.max(0, u.hp - n); u.flash = 0; popNum(u, n, col);
  if (from) { const dx = u.x - from.x, dy = u.y - from.y, d = Math.hypot(dx, dy) || 1; u.shove = [dx / d * 4, dy / d * 2]; }
  if (u.hp <= 0) { u.ko = 0; impact('earth', u.x, u.y); }
}
// ---------- the forecast runs resolve() itself on a deep copy of the board (the rules' own function, nothing hand-described)
function forecast(u, ab, t) {
  const B = cloneBoard(BOARD), cu = B.units.find(v => v.ref === u), save = BOARD; BOARD = B;
  let res; try { res = resolve(B, cu, ab, { x: t[0], y: t[1] }, null); } finally { BOARD = save; }
  return { ab, t, dmg: res.hits.map(h => ({ u: h.v.ref, n: h.n, chance: h.chance })), tips: res.tips, statuses: res.statuses.map(s => ({ u: s.v.ref, id: s.id, chance: s.chance })),
    heals: res.heals.map(h => ({ u: h.v.ref, n: h.n })), tiles: abilityTiles(u, ab, { x: t[0], y: t[1] }) };
}
async function useAbility(u, ab, t) {
  const A = ABIL[ab]; u.ap -= A.ap; if (A.cd) u.cd[ab] = A.cd + 1;
  const tgt = { x: t[0], y: t[1] }, dir = A.tgt === 'self' ? u.dir : dirTo(cellX(t[0]) - u.x, cellY(t[1]) - u.y, u.k !== 'kaya');
  let done = false; const apply = () => { if (done) return; done = true; const res = resolve(BOARD, u, ab, tgt, rng); NAMES.push(`${u.k}:${ab}@${t}=>${res.tips.join('/')} hits ${res.hits.map(h => h.v.k + h.n).join(',')} miss ${res.misses.length}`); playResult(u, res); };
  showName(A.name); S.preview = null; S.ab = null; S.aim = null;
  const tiles = abilityTiles(u, ab, tgt), cx = tiles.reduce((a, [x]) => a + cellX(x), 0) / tiles.length, cy = tiles.reduce((a, [, y]) => a + cellY(y), 0) / tiles.length;
  if (u.k === 'kaya') {
    await new Promise(fin => startBend(u, A.clip === 'stomp' ? 'jab' : A.clip, dir, () => {
      if (ab === 'fire_jab' || ab === 'fire_blast') fireJab(u, ab === 'fire_blast' ? cellX(t[0]) : cx, ab === 'fire_blast' ? cellY(t[1]) : cy, () => { if (ab === 'fire_blast') { rings.push({ x: cellX(t[0]), y: cellY(t[1]), t: 0 }); flashes.push({ x: cellX(t[0]), y: cellY(t[1]), t: 0, life: 360, r: 30 }); shake = 240; shakeAmp = 2; } apply(); });
      else { fireWhip(u); setTimeoutG(apply, 140); }
    }, fin));
  } else {
    u.dir = dir; await new Promise(fin => { u.anim = 'attack'; u.at = 0; u.struck = false; u.done = fin;
      u.onStrike = () => {
        if (ab === 'water_whip' || ab === 'sling_stone' || ab === 'rock_throw') throwBolt(ab === 'water_whip' ? 'water' : 'stone', u, { x: cx, y: cy }, apply);
        else if (ab === 'ice_path') { for (const [x, y] of tiles) for (let i = 0; i < 6; i++) dusts.push({ x: cellX(x) + (rnd() - 0.5) * 20, y: cellY(y) - 6, vx: (rnd() - 0.5) * 30, vy: -20 - rnd() * 30, t: 0, life: 500, col: i % 2 ? '#e8f4f8' : '#86c2bd' }); setTimeoutG(apply, 120); }
        else if (ab === 'healing_stream') { for (let i = 0; i < 16; i++) dusts.push({ x: cx + (rnd() - 0.5) * 16, y: cy - 10, vx: (rnd() - 0.5) * 20, vy: -40 - rnd() * 40, t: 0, life: 700, col: i % 2 ? '#86c2bd' : '#c9e7d0' }); apply(); }
        else if (ab === 'earth_wall') { for (const [x, y] of tiles) impact('earth', cellX(x), cellY(y)); apply(); }
        else if (ab === 'stone_stance') { impact('earth', u.x, u.y); apply(); }
        else { impact(u.k === 'bruiser' ? 'slam' : 'club', (u.x + cx) / 2, (u.y + cy) / 2); apply(); }
      }; });
  }
  while (!done && (shots.length || bolts.length)) await wait(30);
  apply(); await wait(300);
}
function playResult(u, res) {
  // resolve() already changed hp on the live units: show it
  for (const h of res.hits) { const v = h.v; v.flash = 0; popNum(v, h.n, h.type === 'fire' ? '#f2b45a' : '#f6eed6'); const dx = v.x - u.x, dy = v.y - u.y, d = Math.hypot(dx, dy) || 1; v.shove = [dx / d * 4, dy / d * 2]; if (v.hp <= 0 && v.ko < 0) { v.ko = 0; impact('earth', v.x, v.y); } }
  for (const m of res.misses) popText(m, 'Miss', '#e8d8b0');
  for (const h of res.heals) popNum(h.v, '+' + h.n, '#9cd38a');
  for (const s of res.statuses) popText(s.v, STAT[s.id].name, STATUS_COL[s.id]);
  for (const p of res.broke) { if (p.ob) p.ob.gone = true; impact(p.id === 'oil_flask' ? 'club' : 'earth', cellX(p.x), cellY(p.y)); popTextAt(cellX(p.x), cellY(p.y) - 34, p.def.name + ' breaks', '#e8d8b0'); }
  for (const [x, y] of res.walls) WALLS.push({ x, y, t: 0 });
  const shown = new Set(); for (const c of res.changes) if (c.combo && c.combo.id !== 'paint' && !shown.has(c.combo.id)) { shown.add(c.combo.id); popTextAt(cellX(c.x), cellY(c.y) - 20, c.combo.tip, '#f6eed6'); }
  if (res.changes.length || res.walls.length || res.broke.length) surfDirty = true;
  for (const c of res.changes) if (c.to === 'fire') flashes.push({ x: cellX(c.x), y: cellY(c.y), t: -rnd() * 200, life: 300, r: 14 });
  for (const c of res.changes) if (c.to === 'steam' || c.from === 'fire') for (let i = 0; i < 8; i++) dusts.push({ x: cellX(c.x) + (rnd() - 0.5) * 24, y: cellY(c.y) - 8, vx: (rnd() - 0.5) * 20, vy: -30 - rnd() * 30, t: 0, life: 700, col: '#e8ece8' });
}
const WALLS = [];
// ---------- turns
async function runBattle(auto) {
  await wait(700); banner('AMBUSH!', 'Figures step out from the pines at the bend'); await wait(2400); banner('');
  while (!S.over) {
    S.round++;
    S.order = UNITS.filter(u => u.hp > 0).sort((a, b) => eff(b).speed - eff(a).speed || (a.side === 'party' ? -1 : 1));
    for (const u of S.order) {
      if (S.over || u.hp <= 0) continue;
      // the owner's turn start: statuses tick (Burning hurts), durations fall, cooldowns fall, a Frozen unit loses the turn
      const skips = u.st.some(s => STAT[s.id] && STAT[s.id].skips);
      for (const k in u.cd) if (u.cd[k] > 1) u.cd[k]--; else delete u.cd[k];
      const ticks = tickStatuses(u); for (const t of ticks) hurt(u, Math.max(0, Math.round(t.amount * mult(u, t.type))), null, '#f2b45a');
      if (u.hp <= 0) { await wait(500); if (checkEnd()) break; continue; }
      const e = eff(u); u.ap = skips ? 0 : Math.max(0, e.ap); u.mv = skips ? 0 : Math.max(0, e.move);
      S.active = u; focus = u; setTop(`Round ${S.round} · ${u.name}`);
      if (ticks.length) await wait(500);
      if (skips) { popText(u, 'Frozen', '#e8f4f8'); await wait(900); continue; }
      if (u.side === 'foe') await foeTurn(u); else if (auto) await autoTurn(u); else await playerTurn(u);
      S.active = null; S.ab = null; S.aim = null; S.preview = null;
      if (checkEnd()) break;
    }
    if (S.over) break;
    const ch = tickSurfaces(BOARD);
    if (ch.length) { surfDirty = true; const c = ch.find(c => c.label === 'The fire spreads!'); if (c) { popTextAt(cellX(c.x), cellY(c.y) - 20, 'The fire spreads!', '#f2b45a'); focus = { x: cellX(c.x), y: cellY(c.y) }; await wait(900); } }
    await wait(300);
  }
}
function checkEnd() {
  if (S.over) return true;
  if (!alive('foe').length) { S.over = true; S.active = null; banner('VICTORY', 'The Forest Road is clear'); setTop(''); return true; }
  if (!alive('party').length) { S.over = true; banner('DEFEAT', ''); return true; }
  return false;
}
// ---------- the bandits (core/rules/ai.ts in spirit): every reachable tile is scored: can it strike from there, how close
// to its prey, never through or into fire (and not into oil or steam if it can help it), a shooter keeps cover and distance
async function foeTurn(u) {
  await wait(150);
  const ab = KITS[u.k][0], A = ABIL[ab], party = alive('party'); if (!party.length) return;
  const R = reach(u); let best = null, bs = -1e9;
  for (const [k, v] of R) {
    if (v.ally) continue; const [x, y] = k.split(',').map(Number), o = { x, y };
    const tg = party.filter(p => dist(o, { x: p.cx, y: p.cy }) <= A.range), dmin = Math.min(...party.map(p => dist(o, { x: p.cx, y: p.cy })));
    const s0 = contact(BOARD, x, y), haz = s0 ? (s0.enterDamage ? 60 : s0 === SURF.oil || s0 === SURF.steam ? 12 : 4) : 0;
    let s = (tg.length ? 50 : 0) - dmin * 3 - haz - v.d * 0.3;
    if (A.range > 1 && tg.length) { const ghost = { cx: x, cy: y }; s += party.some(p => coverFor(BOARD, p, ghost)) ? 8 : 0; s -= party.some(p => dist(o, { x: p.cx, y: p.cy }) <= 1) ? 10 : 0; }
    let k2 = k, burned = false; while (k2 && R.get(k2) && R.get(k2).from) { const [a, b] = k2.split(',').map(Number); const sc = contact(BOARD, a, b); if (sc && sc.enterDamage) burned = true; k2 = R.get(k2).from; }
    if (burned) s -= 40;
    if (s > bs) { bs = s; best = [x, y]; }
  }
  if (best && (best[0] !== u.cx || best[1] !== u.cy)) await moveUnit(u, best[0], best[1], 350);
  while (u.ap >= A.ap && u.hp > 0) {
    const tg = alive('party').filter(p => dist({ x: u.cx, y: u.cy }, { x: p.cx, y: p.cy }) <= A.range).sort((p, q) => p.hp - q.hp)[0];
    if (!tg) break; focus = tg; await useAbility(u, ab, [tg.cx, tg.cy]); if (checkEnd()) return;
  }
}
// ---------- the player: tap a tile to walk, pick an ability, tap a target to see the forecast, tap again to confirm
let playerDone = null;
function playerTurn(u) { return new Promise(r => { playerDone = r; buildBar(); setTop(`${u.name} · ${u.ap} AP · tap ground to move`); }); }
function buildBar() {
  const bar = document.getElementById('bar'); bar.innerHTML = ''; const u = S.active;
  if (!u || u.side !== 'party' || S.over || REC || OVERVIEW) return;
  const add = (label, on, fn, dis) => { const b = document.createElement('button'); b.textContent = label; if (on) b.className = 'on'; b.disabled = !!dis; b.onpointerdown = e => { e.preventDefault(); fn(); }; bar.appendChild(b); };
  for (const ab of KITS[u.k]) { const A = ABIL[ab]; add(`${A.name} · ${A.ap}`, S.ab === ab, () => { S.ab = S.ab === ab ? null : ab; S.aim = null; S.preview = null; buildBar(); if (S.ab && ABIL[S.ab].tgt === 'self') { S.aim = [u.cx, u.cy]; S.preview = forecast(u, S.ab, S.aim); } }, u.ap < A.ap || u.cd[ab] || !validTargets(BOARD, u, ab).length); }
  add('End Turn', false, () => { const r = playerDone; playerDone = null; bar.innerHTML = ''; r && r(); });
}
let busy = false;
async function tapCell(x, y) {
  const u = S.active; if (!u || u.side !== 'party' || busy || !playerDone) return;
  if (S.ab) {
    if (!validTargets(BOARD, u, S.ab).some(([a, b]) => a === x && b === y)) return;
    if (!S.aim || S.aim[0] !== x || S.aim[1] !== y) { S.aim = [x, y]; S.preview = forecast(u, S.ab, S.aim); return; }
    busy = true; const ab = S.ab; buildBar(); await useAbility(u, ab, [x, y]); busy = false; afterPlayerAction(u); return;
  }
  const R = reach(u), n = R.get(x + ',' + y); if (!n || n.ally || (x === u.cx && y === u.cy)) return;
  busy = true; await moveUnit(u, x, y, 250); busy = false; afterPlayerAction(u);
}
function afterPlayerAction(u) {
  if (checkEnd() || u.hp <= 0) { const r = playerDone; playerDone = null; r && r(); return; }
  setTop(`${u.name} · ${u.ap} AP`); buildBar();
  const anyAb = KITS[u.k].some(ab => u.ap >= ABIL[ab].ap && !u.cd[ab] && validTargets(BOARD, u, ab).length);
  if (!anyAb && u.mv <= 0) { const r = playerDone; playerDone = null; r && r(); }
}
function banner(s, sub) { const b = document.getElementById('banner'); b.innerHTML = s ? `${s}<small>${sub || ''}</small>` : ''; b.classList.toggle('show', !!s); }
function setTop(s) { const t = document.getElementById('top'); t.textContent = s; t.style.display = s ? '' : 'none'; }
