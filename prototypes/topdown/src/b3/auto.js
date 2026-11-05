// ---------- the recorded demo plays the party itself, choosing by the forecast: every place it could stand x every ability x
// every target is forecast with the real rules on a copy; it shows the move preview and the forecast plaque before each choice,
// exactly as a player would see them. v3 fixes the odd picks v2 made: a wall only goes up between the party and a foe that can
// still reach it, Ice Path only where it freezes someone or lays ice under a foe, and nobody chooses to stand on ice or in oil.
const TIP_BONUS = { 'Ignites Oil': 30, 'Douses Fire': 14, 'Smothers Fire': 8, 'Makes Steam': 6, 'Freezes Water': 10, 'Breaks Oil Flask': 4, 'Makes Mud': 3, 'Knocks Back': 3 };
const used = new Set();
function wallUseful(u, f) {   // the wall must stand between a party member and a foe that is two to four tiles off
  const foes = alive('foe'), party = UNITS.filter(v => v.hp > 0 && v.side === 'party');
  return f.tiles.some(([x, y]) => foes.some(o => { const d = udist(o, { x, y }); return d >= 1 && d <= 2; }) && party.some(p => dist({ x: p.cx, y: p.cy }, { x, y }) <= 2));
}
function scorePlan(u, f) {
  let s = 0;
  for (const d of f.dmg) s += (d.u.side !== u.side ? 1 : -2.5) * d.n * d.chance / 100 + (d.u.side !== u.side && d.n >= d.u.hp ? 12 : 0);
  for (const st of f.statuses) s += (st.u.side !== u.side ? 4 : st.id === 'guarded' || st.id === 'inspired' ? 5 : -5) * st.chance;
  for (const h of f.heals) s += Math.min(h.n, h.u.max - h.u.hp) * (h.u.hp < h.u.max * 0.6 ? 1.2 : 0.2);
  const foes = alive('foe'), nearFoe = f.tiles.some(([x, y]) => foes.some(o => udist(o, { x, y }) <= 2));
  for (const t of f.tips) s += nearFoe ? (TIP_BONUS[t] || 0) * (used.has(t) ? 0.35 : 1) : -2;   // reactions are worth it where the enemy is
  if (f.ab === 'stone_stance') s += u.hp > u.max * 0.7 || !foes.some(o => udist(o, { x: u.cx, y: u.cy }) <= 2) ? -6 : 2;
  if (f.ab === 'earth_wall') s += wallUseful(u, f) && !used.has('Raises a Wall') ? 6 : -40;
  if (f.ab === 'ice_path') { const onFoe = f.tiles.filter(([x, y]) => foes.some(o => covers(o, x, y))).length; s += onFoe ? 3 * onFoe : f.tips.includes('Freezes Water') ? 0 : -20; }
  if (f.ab === 'healing_stream' && !f.heals.some(h => h.u.hp < h.u.max * 0.75)) s -= 12;
  return s;
}
function standScore(u, x, y) {
  const sc = contact(BOARD, x, y); let s = sc && sc.enterDamage ? -40 : sc === SURF.oil ? -8 : sc === SURF.ice ? -6 : sc === SURF.mud ? -4 : 0;
  const foes = alive('foe'); if (!foes.length) return s;
  const dmin = Math.min(...foes.map(o => udist(o, { x, y })));
  if (u.k !== 'bo') s -= dmin <= 1 ? 8 : 0; else s -= dmin * 0.5;
  const big = foes.find(o => o.k === 'grumbler'); if (big && udist(big, { x, y }) <= 2) s -= 10;   // the encounter's tip: keep more than two tiles from the driller
  const c = cellOf(BOARD, x, y); if (c && c.elev > 0) s += 2;
  return s;
}
async function autoTurn(u) {
  await wait(750);   // the move preview: where they can walk, as a warm tint
  let moved = false;
  for (let guard = 0; guard < 2 && u.hp > 0 && !S.over; guard++) {
    const here = { x: u.cx, y: u.cy }, R = moved ? new Map([[u.cx + ',' + u.cy, { d: 0 }]]) : reach(u);
    let best = null;
    for (const [k, v] of R) {
      if (v.ally) continue; const [x, y] = k.split(',').map(Number), ox = u.cx, oy = u.cy;
      u.cx = x; u.cy = y;   // stand there for the forecast (restored below)
      for (const ab of KITS[u.k]) {
        const A = ABIL[ab]; if (u.ap < A.ap || u.cd[ab]) continue;
        for (const t of validTargets(BOARD, u, ab)) { const f = forecast(u, ab, t), s = scorePlan(u, f) + standScore(u, x, y) - v.d * 0.4; if (s > 1 && (!best || s > best.s)) best = { s, x, y, ab, t, f }; }
      }
      u.cx = ox; u.cy = oy;
    }
    if (!best) {   // nothing worth doing from anywhere: close in (or hold) and end the turn
      if (!moved) { let tgt = null, bs = -1e9; for (const [k, v] of R) { if (v.ally) continue; const [x, y] = k.split(',').map(Number); const s = standScore(u, x, y) - Math.min(...alive('foe').map(o => udist(o, { x, y }))) * (u.k === 'bo' ? 2 : 1); if (s > bs) { bs = s; tgt = [x, y]; } }
        if (tgt && (tgt[0] !== u.cx || tgt[1] !== u.cy)) await moveUnit(u, tgt[0], tgt[1], 500); }
      break;
    }
    if (best.x !== here.x || best.y !== here.y) { await moveUnit(u, best.x, best.y, 550); moved = true; await wait(120); if (u.cx !== best.x || u.cy !== best.y) continue; }
    // the forecast as the player sees it: the area on the ground, the ring on the target, the plaque, then the blow
    S.ab = best.ab; S.aim = best.t; S.preview = forecast(u, best.ab, best.t); focus = { x: (u.x + cellX(best.t[0])) / 2, y: (u.y + cellY(best.t[1])) / 2 };
    await wait(1100);
    for (const t of best.f.tips) used.add(t);
    if (best.ab === 'earth_wall') used.add('Raises a Wall');
    await useAbility(u, best.ab, best.t);
    if (checkEnd()) return;
  }
}
