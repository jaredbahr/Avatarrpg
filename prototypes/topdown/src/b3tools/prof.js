// ---------- measuring hooks (B3PROF=1 builds only, never shipped): where the time of a fight goes, and the event log that must not change.
// Nothing here changes a rule or a timing; it wraps functions to look.
const EV = [], PROF = { tot: 0, cat: {}, side: {}, cs: {}, idle: {}, cam: 0, moves: 0, uses: 0, turns: 0, last: 'start', t0: null };
window.__EV = EV; window.__PROFDATA = PROF;
const _ev = s => EV.push(s + ' |R' + RNG);
{
  const _mv = moveUnit; moveUnit = async function (u, x, y, ...a) { PROF.moves++; _ev(`move ${u.k} ${u.cx},${u.cy}->${x},${y}`); return _mv(u, x, y, ...a); };
  const _ua = useAbility; useAbility = async function (u, ab, t) { PROF.uses++; _ev(`use ${u.k} ${ab} ${t}`); return _ua(u, ab, t); };
  const _hu = hurt; hurt = function (u, n, from, col) { const h = u.hp; const r = _hu(u, n, from, col); if (u.hp !== h) _ev(`hurt ${u.k} ${h}->${u.hp}`); return r; };
  const _as = addStatus; addStatus = function (u, id, dur) { const r = _as(u, id, dur); _ev(`status ${u.k} ${r}`); return r; };
  const _ai = aiTurn; aiTurn = function (u) { PROF.turns++; _ev(`turn R${S.round} ${u.k} hp${u.hp} ap${u.ap} mv${u.mv}`); return _ai(u); };
  const _at = autoTurn; autoTurn = function (u) { PROF.turns++; _ev(`turn R${S.round} ${u.k} hp${u.hp} ap${u.ap} mv${u.mv}`); return _at(u); };
  const _pt = playerTurn; playerTurn = function (u) { PROF.turns++; _ev(`turn R${S.round} ${u.k} hp${u.hp} ap${u.ap} mv${u.mv}`); return _pt(u); };
  const _ce = checkEnd; checkEnd = function () { const was = S.over, r = _ce(); if (r && !was) _ev('end ' + S.result + ' R' + S.round); return r; };
  const _w = wait; wait = function (ms) {
    const p = _w(ms), tg = timers[timers.length - 1]; const st = (new Error().stack || '').split('\n')[2] || ''; const m = st.match(/at (?:async )?([\w.$]+)/);
    if (tg) tg.tag = (m ? m[1] : '?') + ':' + ms; return p;
  };
  const _bn = banner; let BAN = false; banner = function (s, sub) { BAN = !!s; return _bn(s, sub); };
  const _up = update;
  update = function (dt) {
    const bx = cam.x, by = cam.y, act = S.active, side = act ? (act.side === 'party' && !STATS[act.k].ally ? 'player' : act.side === 'party' ? 'ally' : 'enemy') : 'between';
    const anim = UNITS.some(u => u.anim === 'attack' || u.anim === 'bend') || shots.length || bolts.length;
    const mv = UNITS.some(u => u.path.length);
    const fx = vfxs.length || arcs.length || bursts.length || flashes.some(f => f.t >= 0 && f.life > 120) || WALLS.some(w => w.t < 260);
    let cat;
    if (hitStop > 0) cat = 'hitstop'; else if (anim) cat = 'attack anim'; else if (mv) cat = 'movement'; else if (BAN) cat = 'banner';
    else if (fx) cat = 'effects tail'; else cat = 'idle wait';
    if (PROF.t0 === null && (S.phase === 'fight')) PROF.t0 = PROF.tot;
    if (PROF.t0 !== null && PROF.end == null && S.over && gtimers.length === 0) PROF.end = PROF.tot;
    if (PROF.t0 !== null && PROF.end == null) {
      PROF.cat[cat] = (PROF.cat[cat] || 0) + dt; PROF.side[side] = (PROF.side[side] || 0) + dt; const k = side + ' / ' + cat; PROF.cs[k] = (PROF.cs[k] || 0) + dt;
      if (cat === 'idle wait') { const tg = timers.reduce((a, b) => (!a || b.t < a.t ? b : a), null); const key = tg && tg.tag ? tg.tag : gtimers.length ? 'gtimer' : 'none'; PROF.idle[key] = (PROF.idle[key] || 0) + dt; }
    }
    PROF.tot += dt; _up(dt);
    if (Math.hypot(cam.x - bx, cam.y - by) > 0.4 && PROF.t0 !== null && PROF.end == null) PROF.cam += dt;
  };
  window.__profDone = () => PROF.end != null;
  window.__profRes = () => { const T = (PROF.end != null ? PROF.end : PROF.tot) - (PROF.t0 || 0); return { total: T, cat: PROF.cat, side: PROF.side, cs: PROF.cs, idle: PROF.idle, cam: PROF.cam, rounds: S.round, moves: PROF.moves, uses: PROF.uses, turns: PROF.turns }; };
  window.__evState = () => ({ ev: EV.slice(), names: NAMES.slice(), rng: RNG, round: S.round, result: S.result, units: UNITS.map(u => [u.k, u.hp, u.cx, u.cy, u.st.map(s => s.id + s.dur).join('+')].join(' ')), surf: BOARD.cells.filter(c => c.surface).map(c => c.x + ',' + c.y + c.surface.id).join(';') });
}
