// ---------- the recorded demo plays the party itself, choosing by the forecast: every place it could stand x every
// ability x every target is forecast with the real rules on a copy; it shows the move preview and the forecast plaque
// before each choice, exactly as a player would see them
const TIP_BONUS = { 'Ignites Oil': 30, 'Douses Fire': 14, 'Smothers Fire': 8, 'Makes Steam': 6, 'Freezes Water': 10, 'Raises a Wall': 12, 'Breaks Oil Flask': 4, 'Makes Mud': 3 };
const used = new Set();
function scorePlan(u, f) {
  let s = 0;
  for (const d of f.dmg) s += (d.u.side !== u.side ? 1 : -2.5) * d.n * d.chance / 100 + (d.u.side !== u.side && d.n >= d.u.hp ? 12 : 0);
  for (const st of f.statuses) s += (st.u.side !== u.side ? 4 : st.id === 'guarded' ? 5 : -5) * st.chance;
  for (const h of f.heals) s += Math.min(h.n, h.u.max - h.u.hp) * (h.u.hp < h.u.max * 0.6 ? 1.2 : 0.2);
  const foes = alive('foe'), nearFoe = f.tiles.some(([x, y]) => foes.some(o => dist({ x, y }, { x: o.cx, y: o.cy }) <= 2));
  for (const t of f.tips) s += nearFoe ? (TIP_BONUS[t] || 0) * (used.has(t) ? 0.35 : 1) : -2;   // reactions are worth it where the bandits are
  if (f.ab === 'stone_stance' && u.hp > u.max * 0.7) s -= 4;
  if (f.ab === 'earth_wall') s += nearFoe && !used.has('Raises a Wall') ? 4 : -30;
  return s;
}
function standScore(u, x, y) {
  const sc = contact(BOARD, x, y); let s = sc && sc.enterDamage ? -40 : sc === SURF.oil ? -6 : 0;
  const foes = alive('foe'), dmin = Math.min(...foes.map(o => dist({ x, y }, { x: o.cx, y: o.cy })));
  if (u.k !== 'bo') s -= dmin <= 1 ? 8 : 0; else s -= dmin * 0.5;
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
      if (!moved) { let tgt = null, bs = -1e9; for (const [k, v] of R) { if (v.ally) continue; const [x, y] = k.split(',').map(Number); const s = standScore(u, x, y) - Math.min(...alive('foe').map(o => dist({ x, y }, { x: o.cx, y: o.cy }))) * (u.k === 'bo' ? 2 : 1); if (s > bs) { bs = s; tgt = [x, y]; } }
        if (tgt && (tgt[0] !== u.cx || tgt[1] !== u.cy)) await moveUnit(u, tgt[0], tgt[1], 500); }
      break;
    }
    if (best.x !== here.x || best.y !== here.y) { await moveUnit(u, best.x, best.y, 550); moved = true; await wait(120); }
    // the forecast as the player sees it: the area on the ground, the ring on the target, the plaque, then the blow
    S.ab = best.ab; S.aim = best.t; S.preview = forecast(u, best.ab, best.t); focus = { x: (u.x + cellX(best.t[0])) / 2, y: (u.y + cellY(best.t[1])) / 2 };
    await wait(1100);
    for (const t of best.f.tips) used.add(t);
    await useAbility(u, best.ab, best.t);
    if (checkEnd()) return;
  }
}
