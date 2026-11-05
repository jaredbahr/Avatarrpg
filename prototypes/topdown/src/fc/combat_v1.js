// ---------- the fight: the party's turn (tap a unit, tap a lit tile to move, pick a blow, tap a target), then the
// bandits' turn (each walks toward the nearest of the party and strikes when it can). Demo rules, not the game's.
STATS.kaya.hp = 52; STATS.sura.hp = 38; STATS.bo.hp = 48; STATS.sura.atk.dmg = 9; STATS.bo.atk.dmg = 13;
const KAYA_MOVES = {
  jab:   { label: 'Fire Jab',   min: 1, max: 6, dmg: 11, line: true },
  whip:  { label: 'Flame Whip', min: 1, max: 1, dmg: 12, arc: true },
  stomp: { label: 'Fire Stomp', min: 0, max: 0, dmg: 13, ring: true },
};
const timers = [];
const wait = ms => new Promise(r => timers.push({ t: ms, r }));
const S = { phase: 'intro', sel: null, ability: null, R: null, round: 0, over: false, log: '' };
const cheb = (a, b) => Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy));
const alive = side => UNITS.filter(u => u.ko < 0 && u.side === side);
function inLine(u, x, y, max) { const dx = x - u.cx, dy = y - u.cy, n = Math.max(Math.abs(dx), Math.abs(dy)); return n >= 1 && n <= max && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)); }
function lineClear(u, x, y) { const dx = Math.sign(x - u.cx), dy = Math.sign(y - u.cy); let cx = u.cx + dx, cy = u.cy + dy; while (cx !== x || cy !== y) { const c = at(cx, cy); if (c === 'T' || c === 'A' || c === 'r' || UNITS.some(o => o.ko < 0 && o.cx === cx && o.cy === cy)) return false; cx += dx; cy += dy; } return true; }
function targetsFor(u, ab) {   // cells this blow may be aimed at
  const out = [];
  if (u.k === 'kaya') {
    const m = KAYA_MOVES[ab];
    if (m.ring) return alive('foe').some(f => cheb(u, f) === 1) || (OIL.ob && !OIL.lit && Math.max(Math.abs(13 - u.cx), Math.abs(6 - u.cy)) <= 1) ? [[u.cx, u.cy]] : [];
    for (const f of alive('foe')) if (m.line ? inLine(u, f.cx, f.cy, m.max) && lineClear(u, f.cx, f.cy) : cheb(u, f) === 1) out.push([f.cx, f.cy]);
    if (m.line && OIL.ob && !OIL.lit && inLine(u, 13, 6, m.max) && lineClear(u, 13, 6)) out.push([13, 6]);   // the flask itself
    return out;
  }
  const a = STATS[u.k].atk;
  for (const f of UNITS.filter(o => o.ko < 0 && o.side !== u.side)) { const d = cheb(u, f); if (d >= a.min && d <= a.max) out.push([f.cx, f.cy]); }
  return out;
}
function hurt(t, n, from, col) {
  if (!t || t.ko >= 0) return;
  t.hp = Math.max(0, t.hp - n); t.flash = 0; popNum(t, n, col);
  if (from) { const dx = t.x - from.x, dy = t.y - from.y, d = Math.hypot(dx, dy) || 1; t.shove = [dx / d * 4, dy / d * 2]; }
  if (t.hp <= 0) { t.ko = 0; impact('earth', t.x, t.y); }
}
const unitAt = (x, y) => UNITS.find(u => u.ko < 0 && u.cx === x && u.cy === y);
async function moveUnit(u, x, y) {
  const R = reach(u); if (!R.has(x + ',' + y) || R.get(x + ',' + y).ally) return false;
  const p = pathTo(u, R, x, y); if (!p.length) return true;
  await new Promise(r => { u.arrive = r; u.path = p; }); u.moved = true; return true;
}
async function act(u, ab, x, y) {
  const t = unitAt(x, y);
  if (u.k === 'kaya') {
    const m = KAYA_MOVES[ab], dir = ab === 'stomp' ? u.dir : dirTo(cellX(x) - u.x, cellY(y) - u.y, false);
    await new Promise(done => startBend(u, ab, dir, () => {
      if (ab === 'jab') fireJab(u, cellX(x), cellY(y), () => { if (x === 13 && y === 6 && !OIL.lit) { igniteOil(); for (const c of OIL.burning) hurt(unitAt(c.x, c.y), 4, null, '#f2b45a'); } else hurt(t, m.dmg, u); });
      if (ab === 'whip') { fireWhip(u); const [ux, uy] = VEC8[dir]; for (const f of alive('foe')) { const dx = f.cx - u.cx, dy = f.cy - u.cy; if (cheb(u, f) === 1 && dx * ux + dy * uy > 0.2) setTimeoutG(() => hurt(f, m.dmg, u), 120); } }
      if (ab === 'stomp') { fireStomp(u); for (const f of alive('foe')) if (cheb(u, f) === 1) setTimeoutG(() => hurt(f, m.dmg, u), 160); if (OIL.ob && !OIL.lit && Math.max(Math.abs(13 - u.cx), Math.abs(6 - u.cy)) <= 1) setTimeoutG(igniteOil, 200); }
    }, done));
  } else {
    const a = STATS[u.k].atk; u.dir = dirTo(cellX(x) - u.x, cellY(y) - u.y, true); showName(a.label);
    await new Promise(done => { u.anim = 'attack'; u.at = 0; u.struck = false; u.done = done;
      u.onStrike = () => {
        if (a.kind === 'stone' || a.kind === 'water') throwBolt(a.kind, u, t, () => hurt(t, a.dmg, u));
        else { impact(a.kind, (u.x + t.x) / 2, (u.y + t.y) / 2); hurt(t, a.dmg, u); }
      }; });
  }
  u.acted = true; await wait(240);
}
const gtimers = []; function setTimeoutG(f, ms) { gtimers.push({ t: ms, f }); }
// ---------- the bandits' turn
async function foeTurn() {
  S.phase = 'foes'; setTop('The bandits move');
  for (const u of alive('foe')) {
    if (S.over) return;
    focus = u; await wait(160);
    const party = alive('party'); if (!party.length) break;
    const a = STATS[u.k].atk, inRange = (cx, cy) => party.filter(p => { const d = Math.max(Math.abs(p.cx - cx), Math.abs(p.cy - cy)); return d >= a.min && d <= a.max; });
    if (!inRange(u.cx, u.cy).length) {   // walk to the reachable cell nearest a target (one it can strike from, if any)
      const R = reach(u); let best = null, bs = 1e9;
      for (const [k, v] of R) { if (v.ally) continue; const [x, y] = k.split(',').map(Number); const hits = inRange(x, y).length; const dmin = Math.min(...party.map(p => Math.abs(p.cx - x) + Math.abs(p.cy - y))); const s = (hits ? 0 : 100) + dmin + (OIL.burning.some(c => c.turns > 0 && c.x === x && c.y === y) ? 50 : 0); if (s < bs) { bs = s; best = [x, y]; } }
      if (best) await moveUnit(u, best[0], best[1]);
    }
    const tg = inRange(u.cx, u.cy).sort((p, q) => p.hp - q.hp)[0];
    if (tg) { focus = tg; await act(u, null, tg.cx, tg.cy); }
    await wait(120);
  }
  await endRound();
  if (!S.over && partyTurnHook) partyTurn();
}
async function endRound() {
  for (const c of OIL.burning) { if (c.turns <= 0) continue; const u = unitAt(c.x, c.y); if (u) hurt(u, 4, null, '#f2b45a'); c.turns--; }
  await wait(300); checkEnd();
}
function checkEnd() {
  if (S.over) return true;
  if (!alive('foe').length) { S.over = true; banner('VICTORY', 'The Forest Road is clear'); setTop(''); return true; }
  if (!alive('party').length) { S.over = true; banner('DEFEAT', ''); return true; }
  return false;
}
function partyTurn() {
  S.round++; S.phase = 'party'; for (const u of alive('party')) { u.moved = false; u.acted = false; }
  select(alive('party')[0]); setTop(`Round ${S.round} · your move`);
}
function select(u) { S.sel = u; S.ability = null; S.R = u && !u.moved ? reach(u) : null; focus = u || focus; buildBar(); }
function endPartyTurn() { S.sel = null; S.R = null; buildBar(); foeTurn(); }
// ---------- input: tap units, lit tiles and targets; the bar picks a blow
function buildBar() {
  const bar = document.getElementById('bar'); bar.innerHTML = '';
  if (S.phase !== 'party' || S.over || REC || OVERVIEW) return;
  const u = S.sel, add = (label, on, fn, dis) => { const b = document.createElement('button'); b.textContent = label; if (on) b.className = 'on'; b.disabled = !!dis; b.onpointerdown = e => { e.preventDefault(); fn(); }; bar.appendChild(b); };
  if (u && !u.acted) {
    const abs = u.k === 'kaya' ? Object.keys(KAYA_MOVES) : ['atk'];
    for (const ab of abs) add(u.k === 'kaya' ? KAYA_MOVES[ab].label : STATS[u.k].atk.label, S.ability === ab, () => { S.ability = S.ability === ab ? null : ab; buildBar(); }, !targetsFor(u, ab === 'atk' ? null : ab).length);
  }
  add('End Turn', false, endPartyTurn);
}
let busy = false;
async function tapCell(x, y) {
  if (S.phase !== 'party' || S.over || busy) return;
  const u = S.sel, t = unitAt(x, y);
  if (u && S.ability) {
    const ab = S.ability === 'atk' ? null : S.ability;
    if (targetsFor(u, ab).some(([a, b]) => a === x && b === y)) { busy = true; S.ability = null; buildBar(); await act(u, ab, x, y); busy = false; afterAction(); return; }
  }
  if (t && t.side === 'party') return select(t);
  if (u && !u.moved && S.R && S.R.has(x + ',' + y) && !S.R.get(x + ',' + y).ally) { busy = true; S.R = null; await moveUnit(u, x, y); busy = false; select(u); }
}
function afterAction() {
  if (checkEnd()) return;
  const next = alive('party').find(p => !p.acted || !p.moved);
  if (S.sel && (!S.sel.acted || !S.sel.moved)) return select(S.sel);
  if (next) select(next); else endPartyTurn();
}
// ---------- the demo's own player, for the recording: the same calls a tap makes
async function autoParty() {
  const order = ['kaya', 'sura', 'bo'];
  for (const k of order) {
    const u = alive('party').find(p => p.k === k); if (!u || S.over) continue;
    select(u); await wait(300);
    const foes = alive('foe'); if (!foes.length) break;
    if (k === 'kaya') {
      const plan = () => { const adj = foes.filter(f => cheb(u, f) === 1).length; if (adj >= 2 || (adj && S.usedWhip && !S.usedStomp)) return 'stomp'; if (adj) return 'whip'; return 'jab'; };
      let ab = plan(), ts = targetsFor(u, ab);
      if (!ts.length) {   // step to where the jab (the flask first) or the whip has a target
        const R = reach(u); let best = null, bs = 1e9;
        for (const [key, v] of R) { if (v.ally) continue; const [x, y] = key.split(',').map(Number); const o = { cx: x, cy: y };
          const flask = OIL.ob && !OIL.lit && inLine(o, 13, 6, 6) && foes.some(f => Math.max(Math.abs(f.cx - 13), Math.abs(f.cy - 6)) <= 1) ? -50 : 0;
          const adj = foes.filter(f => cheb(o, f) === 1).length, line = foes.some(f => inLine(o, f.cx, f.cy, 6));
          const s = flask + (adj ? -30 * adj : 0) + (line ? -10 : 0) + v.d; if (s < bs) { bs = s; best = [x, y]; } }
        if (best) { S.R = R; await wait(220); await moveUnit(u, best[0], best[1]); select(u); await wait(160); }
        ab = plan(); ts = targetsFor(u, ab); if (!ts.length && ab !== 'jab') { ab = 'jab'; ts = targetsFor(u, ab); }
      }
      const fl = ts.find(([x, y]) => x === 13 && y === 6) && foes.some(f => Math.max(Math.abs(f.cx - 13), Math.abs(f.cy - 6)) <= 1);
      const pick = fl ? [13, 6] : ts[0];
      if (pick) { S.ability = ab; buildBar(); await wait(260); if (ab === 'whip') S.usedWhip = true; if (ab === 'stomp') S.usedStomp = true; await act(u, ab, pick[0], pick[1]); }
    } else {
      const a = STATS[k].atk; let ts = targetsFor(u, null);
      if (!ts.length) {
        const R = reach(u); let best = null, bs = 1e9;
        for (const [key, v] of R) { if (v.ally) continue; const [x, y] = key.split(',').map(Number); const hit = foes.some(f => { const d = Math.max(Math.abs(f.cx - x), Math.abs(f.cy - y)); return d >= a.min && d <= a.max; }); const dmin = Math.min(...foes.map(f => Math.abs(f.cx - x) + Math.abs(f.cy - y))); const burn = OIL.burning.some(c => c.turns > 0 && c.x === x && c.y === y) ? 40 : 0; const s = (hit ? 0 : 100) + dmin + burn; if (s < bs) { bs = s; best = [x, y]; } }
        if (best) { S.R = R; await wait(220); await moveUnit(u, best[0], best[1]); select(u); await wait(160); }
        ts = targetsFor(u, null);
      }
      if (ts.length) { S.ability = 'atk'; await wait(240); const pick = ts.map(([x, y]) => unitAt(x, y)).sort((p, q) => p.hp - q.hp)[0]; await act(u, null, pick.cx, pick.cy); }
    }
    if (checkEnd()) return;
  }
  S.sel = null; S.R = null;
}
async function autoBattle() {
  await wait(700); banner('AMBUSH!', 'Figures step out from the pines at the bend'); await wait(2200); banner('');
  S.round = 0; await foeOpening();
  while (!S.over) { S.round++; S.phase = 'party'; setTop(`Round ${S.round}`); for (const u of alive('party')) { u.moved = false; u.acted = false; } await autoParty(); if (S.over) break; S.phase = 'foes'; await foeTurnOnly(); }
}
let partyTurnHook = true;   // the interactive game hands the turn back to the player; the recorded demo plays the party itself
async function foeTurnOnly() { partyTurnHook = false; await foeTurn(); }
async function foeOpening() { partyTurnHook = false; await foeTurn(); partyTurnHook = true; }
async function playInteractive() { await wait(900); banner('AMBUSH!', 'Figures step out from the pines at the bend'); await wait(2200); banner(''); await foeOpening(); partyTurn(); }
function banner(s, sub) { const b = document.getElementById('banner'); b.innerHTML = s ? `${s}<small>${sub || ''}</small>` : ''; b.classList.toggle('show', !!s); }
function setTop(s) { const t = document.getElementById('top'); t.textContent = s; t.style.display = s ? '' : 'none'; }
