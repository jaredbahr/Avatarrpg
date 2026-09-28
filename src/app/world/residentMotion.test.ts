import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { BA_DAN_ROUTINES, PARKED_ROUTINES } from '../../content/residents/routines';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { buildGrid, posKey, samePos, tileAt } from '../../core/rules/grid';
import type { DayPhase, GameState, MapDef, Vec2 } from '../../core/types';
import { ResidentWalks, planResidentMotion, standingOn } from './residentMotion';
import type { ResidentMotion } from './residentMotion';
import { previewWalk } from './walking';

/**
 * The resident walk planner (ADR 0047 §7, W8): who walks where when the
 * placements change, the fallback when there is no route, the freeze during
 * a conversation, and determinism. The planner is pure; `ResidentWalks`
 * plays its plan on a clock of its own, driven here by hand.
 */

const VILLAGE = CONTENT.maps.get('ba_dan_village') as MapDef;
const SEAT: Vec2 = { x: 10, y: 5 };

function at(phase: DayPhase, pos: Vec2 = SEAT, visited: readonly string[] = ['mira_intro']) {
  const base = createGame(CONTENT, {
    seed: 'resident-motion',
    party: ['kaya', 'sura'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    story: { ...base.story, nodeId: 'village_explore', visited: [...visited] },
    location: { mapId: VILLAGE.id, pos },
    world: { ...base.world, clock: { day: 1, phase } },
  } satisfies GameState;
}

const waited = (state: GameState, until: DayPhase) =>
  apply(CONTENT, state, { type: 'wait', until }).state;

const byId = (motions: readonly ResidentMotion[]) =>
  new Map(motions.map((motion) => [motion.who.id, motion]));

/** Every step one of the eight neighbours, on open ground, never squeezing past a corner. */
function expectWalkable(map: MapDef, from: Vec2, path: readonly Vec2[]) {
  const grid = buildGrid(map);
  const open = (p: Vec2) => {
    const tile = tileAt(grid, p);
    return Boolean(tile && !tile.blocked);
  };
  let prev = from;
  for (const step of path) {
    expect(Math.max(Math.abs(step.x - prev.x), Math.abs(step.y - prev.y))).toBe(1);
    expect(open(step)).toBe(true);
    if (step.x !== prev.x && step.y !== prev.y) {
      expect(open({ x: step.x, y: prev.y })).toBe(true);
      expect(open({ x: prev.x, y: step.y })).toBe(true);
    }
    prev = step;
  }
}

describe('planResidentMotion', () => {
  const before = at('midday');
  const after = waited(before, 'afternoon');
  const party = [SEAT, { x: 9, y: 5 }];
  const plan = planResidentMotion({ content: CONTENT, map: VILLAGE, before, after, party });
  const moves = byId(plan);

  it('walks everyone whose place changed, by a walkable route, through doors and exits', () => {
    expect(after.world.clock.phase).toBe('afternoon');
    // Gao stays at his shopfront: nothing to plan for him.
    expect(moves.has('lw.npc.gao')).toBe(false);
    const summary = plan.map((motion) =>
      motion.kind === 'walk'
        ? {
            id: motion.who.id,
            from: motion.from,
            to: motion.path.at(-1),
            enter: motion.enter,
            leave: motion.leave,
          }
        : { id: motion.who.id, fade: true },
    );
    expect(summary).toEqual([
      // The household adult goes in at Pella's door when she leaves the court.
      {
        id: 'bg.pella_household',
        from: { x: 11, y: 13 },
        to: { x: 10, y: 13 },
        enter: false,
        leave: true,
      },
      // The relief watch goes back down the east road; nobody placed it anywhere.
      {
        id: 'bg.relief_watch',
        from: { x: 17, y: 6 },
        to: { x: 23, y: 7 },
        enter: false,
        leave: true,
      },
      // Dorin comes up the river path to the post.
      {
        id: 'lw.npc.dorin',
        from: { x: 19, y: 14 },
        to: { x: 17, y: 6 },
        enter: true,
        leave: false,
      },
      // Mira and Pella go down the river path to the riverside.
      { id: 'lw.npc.mira', from: { x: 11, y: 5 }, to: { x: 19, y: 14 }, enter: false, leave: true },
      {
        id: 'lw.npc.pella',
        from: { x: 11, y: 12 },
        to: { x: 19, y: 14 },
        enter: false,
        leave: true,
      },
    ]);
    for (const motion of plan) {
      if (motion.kind !== 'walk') continue;
      expectWalkable(VILLAGE, motion.from, motion.path);
      // Round the party, as the trail is.
      for (const step of motion.path) expect(party.map(posKey)).not.toContain(posKey(step));
    }
  });

  it('walks round the people standing still', () => {
    const standing = new Set(['9,4', '17,6']); // Gao, and Dorin's post
    for (const motion of plan)
      if (motion.kind === 'walk' && motion.who.id !== 'lw.npc.dorin')
        for (const step of motion.path) expect(standing.has(posKey(step))).toBe(false);
  });

  it('fades out at the exit `pos` while the rest of a widened mouth stays open (M2)', () => {
    const east = VILLAGE.exits?.find((exit) => exit.toMapId === 'forest_road');
    if (!east || !east.area) throw new Error('Missing the widened east mouth');
    // A leader triggers from any area cell, but the residents still leave from
    // the canonical tile, and the other mouth cells are ordinary ground.
    for (const cell of east.area) expect(tileAt(buildGrid(VILLAGE), cell)?.blocked).toBe(false);
    const watch = byId(plan).get('bg.relief_watch');
    expect(watch?.kind === 'walk' ? watch.path.at(-1) : null).toEqual(east.pos);
  });

  it('goes home by the door: Gao at night', () => {
    const evening = at('evening');
    const night = waited(evening, 'night');
    const gao = byId(
      planResidentMotion({ content: CONTENT, map: VILLAGE, before: evening, after: night, party }),
    ).get('lw.npc.gao');
    expect(gao).toMatchObject({ kind: 'walk', from: { x: 9, y: 4 }, enter: false, leave: true });
    expect(gao?.kind === 'walk' && gao.path.at(-1)).toEqual({ x: 10, y: 3 });
  });

  it('retries through the party, whom the rules walk through anyway', () => {
    const evening = at('evening');
    const night = waited(evening, 'night');
    // Surround Gao: every open tile beside him holds a member of the party.
    const grid = buildGrid(VILLAGE);
    const ring: Vec2[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const p = { x: 9 + dx, y: 4 + dy };
        const tile = tileAt(grid, p);
        if ((dx || dy) && tile && !tile.blocked) ring.push(p);
      }
    expect(ring.length).toBeGreaterThan(1);
    const gao = byId(
      planResidentMotion({
        content: CONTENT,
        map: VILLAGE,
        before: evening,
        after: night,
        party: ring.filter((p) => !(p.x === 10 && p.y === 3)),
      }),
    ).get('lw.npc.gao');
    expect(gao?.kind).toBe('walk');
    expect(gao?.kind === 'walk' && gao.path.at(-1)).toEqual({ x: 10, y: 3 });
  });

  it('fades out and in when there is no route at all, and never teleports mid-stride', () => {
    // Wall Gao in: his shop door is sealed and the lane round him is fenced.
    const fenced: MapDef = {
      ...VILLAGE,
      legend: { ...VILLAGE.legend, X: { terrain: 'wall', blocked: true } },
      rows: VILLAGE.rows.map((row, y) =>
        [...row]
          .map((c, x) =>
            Math.abs(x - 9) <= 1 && Math.abs(y - 4) <= 1 && !(x === 9 && y === 4) ? 'X' : c,
          )
          .join(''),
      ),
    };
    const evening = at('evening');
    const night = waited(evening, 'night');
    const gao = byId(
      planResidentMotion({ content: CONTENT, map: fenced, before: evening, after: night, party }),
    ).get('lw.npc.gao');
    expect(gao).toEqual({
      kind: 'fade',
      who: expect.objectContaining({ id: 'lw.npc.gao' }),
      from: { x: 9, y: 4 },
      to: null,
    });
  });

  it('is deterministic: the same states plan the same walks', () => {
    const again = planResidentMotion({ content: CONTENT, map: VILLAGE, before, after, party });
    expect(again).toEqual(plan);
    expect(plan.map((motion) => motion.who.id)).toEqual(
      [...plan.map((motion) => motion.who.id)].sort(),
    );
    // Planning reads the states; it never writes them.
    expect(after.rng).toEqual(waited(before, 'afternoon').rng);
  });
});

describe('ResidentWalks', () => {
  const party = [SEAT, { x: 9, y: 5 }];
  const walks = (reduced = false) => new ResidentWalks(CONTENT, () => reduced);
  const figure = (w: ResidentWalks, id: string) => w.figures().find((f) => f.id === id);

  it('places everyone on a new map, then walks them across it at the party pace', () => {
    const w = walks();
    const before = at('midday');
    w.tick(0, false);
    expect(w.update(VILLAGE, before, party, true)).toBe(false);
    expect(figure(w, 'lw.npc.mira')?.drawPos).toEqual({ x: 11, y: 5 });
    const after = waited(before, 'afternoon');
    expect(w.update(VILLAGE, after, party, true)).toBe(true);
    expect(w.moving()).toBe(true);
    // Dorin's rules tile is the post at once; the drawing starts at the river path.
    expect(figure(w, 'lw.npc.dorin')).toMatchObject({
      pos: { x: 17, y: 6 },
      drawPos: { x: 19, y: 14 },
      alpha: 0,
    });
    expect(w.walkingTo({ x: 17, y: 6 })).toBe(true);
    const trace: Vec2[] = [];
    for (let t = 50; t <= 4000; t += 50) {
      w.tick(t, false);
      const mira = figure(w, 'lw.npc.mira');
      if (mira) trace.push(mira.drawPos);
    }
    // No step longer than a stride at 280 ms a tile allows in 50 ms.
    for (let i = 1; i < trace.length; i++) {
      const a = trace[i - 1] as Vec2;
      const b = trace[i] as Vec2;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.2);
    }
    // Mira walks off down the river path and is gone once she has faded there.
    for (let t = 4050; t <= 6000; t += 50) w.tick(t, false);
    expect(figure(w, 'lw.npc.mira')).toBeUndefined();
    expect(figure(w, 'lw.npc.dorin')).toMatchObject({
      drawPos: { x: 17, y: 6 },
      alpha: 1,
      walking: false,
    });
    expect(w.moving()).toBe(false);
    expect(w.walkingTo({ x: 17, y: 6 })).toBe(false);
  });

  it('keeps a walk running when a command mid-walk leaves the walker’s tile alone', () => {
    const run = (interrupt: boolean) => {
      const w = walks();
      const before = at('midday');
      w.tick(0, false);
      w.update(VILLAGE, before, party, true);
      const after = waited(before, 'afternoon');
      w.update(VILLAGE, after, party, true);
      const trace: Vec2[] = [];
      let ended = -1;
      for (let t = 50; t <= 6000; t += 50) {
        if (interrupt && t === 1000) {
          // The party walks off; nobody's place changes.
          const walked = apply(CONTENT, after, { type: 'walkTo', pos: { x: 12, y: 7 } }).state;
          expect(walked.location.pos).toEqual({ x: 12, y: 7 });
          expect(w.update(VILLAGE, walked, [{ x: 12, y: 7 }], true)).toBe(false);
        }
        w.tick(t, false);
        const mira = figure(w, 'lw.npc.mira');
        if (mira) trace.push(mira.drawPos);
        if (ended < 0 && !w.moving()) ended = t;
      }
      return { trace, ended };
    };
    const calm = run(false);
    const busy = run(true);
    for (let i = 1; i < busy.trace.length; i++) {
      const a = busy.trace[i - 1] as Vec2;
      const b = busy.trace[i] as Vec2;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.2);
    }
    expect(busy.trace).toEqual(calm.trace);
    expect(busy.ended).toBe(calm.ended);
    expect(busy.ended).toBeGreaterThan(0);
  });

  it('freezes through a conversation: nothing planned, nothing moves, the speaker stays', () => {
    const w = walks();
    const before = at('midday');
    w.tick(0, false);
    w.update(VILLAGE, before, party, true);
    w.update(VILLAGE, waited(before, 'afternoon'), party, true);
    w.tick(600, false);
    const midway = w.figures();
    // A conversation opens: the clock stands still however long it lasts.
    for (let t = 650; t <= 5000; t += 50) w.tick(t, true);
    expect(w.figures()).toEqual(midway);
    // A state that changes during it is not planned until the conversation ends.
    const talking: GameState = {
      ...before,
      screen: 'dialogue',
      world: {
        ...before.world,
        talk: { npcId: 'elder_mira', mapId: VILLAGE.id, anchor: 'bd01.table' },
      },
    };
    expect(w.update(VILLAGE, talking, party, false)).toBe(false);
    expect(w.figures()).toEqual(midway);
  });

  it('keeps a pinned speaker on the pinned tile for the whole conversation', () => {
    const w = walks();
    // Mira's pre-intro hold keeps her at her table; opening mira_intro lifts
    // it on entry, and only the pin keeps her there (W5 amendment).
    const before = at('afternoon', { x: 12, y: 6 }, []);
    w.tick(0, false);
    w.update(VILLAGE, before, party, true);
    const talk = apply(CONTENT, before, { type: 'walkTo', pos: { x: 11, y: 5 } }).state;
    expect(talk.world.talk?.npcId).toBe('elder_mira');
    for (let t = 50; t <= 1000; t += 50) {
      w.tick(t, true);
      w.update(VILLAGE, talk, party, false);
      expect(figure(w, 'lw.npc.mira')).toMatchObject({ drawPos: { x: 11, y: 5 }, alpha: 1 });
    }
  });

  it('fades out where they stand and in where they belong when no route exists', () => {
    // The handover verge walled off: Dorin cannot walk from the post to it.
    const walled: MapDef = {
      ...VILLAGE,
      legend: { ...VILLAGE.legend, X: { terrain: 'wall', blocked: true } },
      rows: VILLAGE.rows.map((row, y) => (y === 6 ? `${row.slice(0, 16)}X${row.slice(17)}` : row)),
    };
    const w = walks();
    const before = at('afternoon', SEAT, ['mira_intro', 'mira_epilogue']);
    w.tick(0, false);
    w.update(walled, before, party, true);
    w.update(walled, waited(before, 'evening'), party, true);
    const seen: { x: number; y: number; alpha: number }[] = [];
    for (let t = 20; t <= 800; t += 20) {
      w.tick(t, false);
      const dorin = figure(w, 'lw.npc.dorin');
      if (dorin) seen.push({ ...dorin.drawPos, alpha: dorin.alpha });
    }
    // Only ever drawn on one of the two tiles: out at the post, then in at the verge.
    expect(seen.every((f) => (f.x === 17 || f.x === 16) && f.y === 6)).toBe(true);
    const out = seen.filter((f) => f.x === 17).map((f) => f.alpha);
    const back = seen.filter((f) => f.x === 16).map((f) => f.alpha);
    expect(out.length).toBeGreaterThan(3);
    expect(out).toEqual([...out].sort((a, b) => b - a));
    expect(back).toEqual([...back].sort((a, b) => a - b));
    expect(back.at(-1)).toBe(1);
  });

  it('collapses under reduced motion, as the party walk does', () => {
    const w = walks(true);
    const before = at('midday');
    w.tick(0, false);
    w.update(VILLAGE, before, party, true);
    w.update(VILLAGE, waited(before, 'afternoon'), party, true);
    w.tick(100, false);
    w.tick(200, false);
    expect(w.moving()).toBe(false);
    expect(figure(w, 'lw.npc.dorin')?.drawPos).toEqual({ x: 17, y: 6 });
  });

  it('forgets everything on reset: the next state is placed, not walked', () => {
    const w = walks();
    const before = at('midday');
    w.tick(0, false);
    w.update(VILLAGE, before, party, true);
    w.reset();
    expect(w.update(VILLAGE, waited(before, 'afternoon'), party, true)).toBe(false);
    expect(w.moving()).toBe(false);
    expect(figure(w, 'lw.npc.dorin')?.drawPos).toEqual({ x: 17, y: 6 });
  });
});

describe('routines (Working Ba Dan)', () => {
  const GAO = 'lw.npc.gao';
  const CARRIER = 'bg.pella_household';
  const SHOP: Vec2 = { x: 9, y: 4 };
  const YARD: Vec2 = { x: 11, y: 13 };
  /** Out on the east lawn, well clear of the square, the bridge and the lanes. */
  const AWAY: Vec2[] = [{ x: 20, y: 11 }];
  const key = (p: Vec2) => posKey({ x: Math.round(p.x), y: Math.round(p.y) });
  /** The parked basket runs here as it will once the household adult has art. */
  const walks = (reduced = false) =>
    new ResidentWalks(CONTENT, () => reduced, [...BA_DAN_ROUTINES, ...PARKED_ROUTINES]);

  /**
   * Plays `ms` of the scene loop at 50 ms a frame, as ExploreScene does: the
   * clock, then `update` with where the party is. Returns each frame's figures.
   */
  function play(
    w: ResidentWalks,
    state: GameState,
    from: number,
    ms: number,
    clear: (t: number) => readonly Vec2[] = () => AWAY,
    frozen = false,
  ) {
    const frames: { t: number; figures: ReturnType<ResidentWalks['figures']> }[] = [];
    for (let t = from; t <= from + ms; t += 50) {
      w.tick(t, frozen);
      w.update(VILLAGE, state, AWAY, !frozen, clear(t));
      frames.push({ t, figures: w.figures() });
    }
    return frames;
  }

  const of = (frames: ReturnType<typeof play>, id: string) =>
    frames.flatMap(({ t, figures }) => {
      const f = figures.find((each) => each.id === id);
      return f ? [{ t, ...f }] : [];
    });

  it('runs no basket errand in the game until the household adult is painted', () => {
    const frames = play(
      new ResidentWalks(CONTENT, () => false),
      at('afternoon', AWAY[0], []),
      0,
      40_000,
    );
    const carrier = of(frames, CARRIER);
    expect(carrier).toHaveLength(frames.length);
    for (const f of carrier) expect(f).toMatchObject({ drawPos: YARD, walking: false });
    expect(new Set(of(frames, GAO).map((f) => key(f.drawPos))).size).toBeGreaterThan(1);
  });

  it('runs Gao between his shopfront, the display and his steps, smoothly, his rules tile fixed', () => {
    const w = walks();
    const frames = play(w, at('morning', AWAY[0]), 0, 60_000);
    const gao = of(frames, GAO);
    expect(gao).toHaveLength(frames.length);
    const stops = new Set(gao.filter((f) => !f.walking).map((f) => key(f.drawPos)));
    expect(stops).toEqual(new Set(['9,4', '8,5', '10,3']));
    // Walking the lane to the display, never cutting the display's corner.
    expect(gao.some((f) => key(f.drawPos) === '9,5')).toBe(true);
    for (let i = 1; i < gao.length; i++) {
      const a = gao[i - 1]!.drawPos;
      const b = gao[i]!.drawPos;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.25);
    }
    // A tap still finds him at his shop: the rules never see the errand.
    expect(gao.every((f) => f.pos && samePos(f.pos, SHOP))).toBe(true);
    expect(gao.some((f) => f.walking)).toBe(true);
    // A work beat at the display: he reaches in and back.
    expect(gao.some((f) => key(f.drawPos) === '8,5' && (f.squash ?? 0) > 0.3)).toBe(true);
    // An errand is not a walk to a new place: nothing waits on it.
    expect(w.moving()).toBe(false);
    expect(w.walkingTo(SHOP)).toBe(false);
  });

  it('carries the basket over the bridge and back, pausing on each side', () => {
    const w = walks();
    const frames = play(w, at('midday', AWAY[0]), 0, 60_000);
    const carrier = of(frames, CARRIER);
    const tiles = carrier.map((f) => key(f.drawPos));
    expect(tiles).toContain('9,6'); // on the bridge deck
    const held = (tile: string) =>
      carrier.filter((f) => !f.walking && key(f.drawPos) === tile).length * 50;
    expect(held('9,9')).toBeGreaterThanOrEqual(1500); // the kerb, south of the road
    expect(held('9,5')).toBeGreaterThanOrEqual(3500); // the square, north of the canal
    expect(held('11,13')).toBeGreaterThanOrEqual(9000); // home in the yard
    expect(carrier.every((f) => f.pos && samePos(f.pos, YARD))).toBe(true);
  });

  it('is deterministic: the same clock and the same party give the same frames', () => {
    const run = () => {
      const w = walks();
      const state = at('afternoon', AWAY[0], []);
      return play(w, state, 0, 45_000, (t) => (t > 20_000 && t < 26_000 ? [{ x: 9, y: 7 }] : AWAY));
    };
    const a = run();
    expect(JSON.stringify(run())).toBe(JSON.stringify(a));
    // Both routines ran in that afternoon (Pella kept from the river keeps her household home).
    expect(new Set(of(a, GAO).map((f) => key(f.drawPos))).size).toBeGreaterThan(1);
    expect(new Set(of(a, CARRIER).map((f) => key(f.drawPos))).size).toBeGreaterThan(1);
  });

  it('never steps onto anyone’s tile, and the two errands never share one', () => {
    const w = walks();
    const state = at('afternoon', AWAY[0], []);
    const frames = play(w, state, 0, 90_000);
    const people = standingOn(CONTENT, VILLAGE, state);
    for (const { figures } of frames) {
      const gao = figures.find((f) => f.id === GAO);
      const carrier = figures.find((f) => f.id === CARRIER);
      if (!gao || !carrier) throw new Error('both routines are placed this afternoon');
      expect(key(gao.drawPos)).not.toBe(key(carrier.drawPos));
      for (const f of [gao, carrier])
        for (const other of people)
          if (other.id !== f.id) expect(key(f.drawPos)).not.toBe(posKey(other.pos));
    }
  });

  it('holds rather than cross the party’s way, and sets off once it has passed', () => {
    const w = walks();
    // The party stands on the road beside the bridge.
    const road: Vec2[] = [{ x: 9, y: 7 }];
    const waiting = play(w, at('midday', AWAY[0]), 0, 40_000, () => road);
    const carrier = of(waiting, CARRIER);
    for (const f of carrier)
      expect(Math.max(Math.abs(f.drawPos.x - 9), Math.abs(f.drawPos.y - 7))).toBeGreaterThan(2);
    // It can reach the front of the house, but never the kerb next to the party.
    expect(carrier.some((f) => key(f.drawPos) === '9,9')).toBe(false);
    // The party moves on: the basket goes over the bridge.
    const going = of(play(w, at('midday', AWAY[0]), 40_050, 30_000), CARRIER);
    expect(going.some((f) => key(f.drawPos) === '9,6')).toBe(true);
  });

  it('comes home early when the party comes close', () => {
    const w = walks();
    const state = at('morning', AWAY[0]);
    const frames = play(w, state, 0, 30_000);
    const reached = of(frames, GAO).find((f) => !f.walking && key(f.drawPos) === '8,5');
    if (!reached) throw new Error('Gao reached the display');
    // Replay to that moment, then bring the party to the square beside him.
    const v = walks();
    play(v, state, 0, reached.t);
    // The scene seats no follower where he stands.
    expect(v.errandTiles()).toContainEqual({ x: 8, y: 5 });
    // Mira's bench, two tiles from the display.
    const near: Vec2[] = [{ x: 10, y: 5 }];
    const after = of(
      play(v, state, reached.t + 50, 1500, () => near),
      GAO,
    );
    // His hold at the display was four seconds; he is back at the shop in well under two.
    expect(after.at(-1)?.drawPos).toEqual(SHOP);
    // And stays there while the party is close.
    const stay = of(
      play(v, state, reached.t + 1600, 20_000, () => near),
      GAO,
    );
    expect(stay.every((f) => samePos(f.drawPos, SHOP))).toBe(true);
  });

  it('calls him home from the crates when tapped, so the talk opens with him on his tile', () => {
    const w = walks();
    const state = at('morning', AWAY[0]);
    const reached = of(play(w, state, 0, 30_000), GAO).find(
      (f) => !f.walking && key(f.drawPos) === '8,5',
    );
    if (!reached) throw new Error('Gao reached the display');
    const gao = (v: ResidentWalks) => v.figures().find((f) => f.id === GAO);

    // Without the call home, a talk opened at once freezes him at the crates:
    // the scene holds the resident clock for as long as the conversation lasts.
    const naive = walks();
    play(naive, state, 0, reached.t);
    const opened = apply(CONTENT, state, { type: 'walkTo', pos: SHOP }).state;
    expect(opened.world.talk?.npcId).toBe('shopkeeper_gao');
    for (let t = reached.t + 50; t <= reached.t + 5_000; t += 50) {
      naive.tick(t, true);
      naive.update(VILLAGE, opened, [opened.location.pos], false);
    }
    expect(gao(naive)?.drawPos).toEqual({ x: 8, y: 5 });

    // The scene's way (ExploreScene.requestWalk): he is away, so the tap walks
    // the party beside his shop and the talk waits until he is home.
    const v = walks();
    play(v, state, 0, reached.t);
    expect(v.walkingTo(SHOP)).toBe(true);
    const beside = previewWalk(CONTENT, state, SHOP).path.at(-1);
    if (!beside) throw new Error('a tile beside the shop');
    const walking = apply(CONTENT, state, { type: 'walkTo', pos: beside }).state;
    expect(walking.screen).toBe('explore');
    let t = reached.t + 50;
    for (; t <= reached.t + 10_000 && v.walkingTo(SHOP); t += 50) {
      v.tick(t, false);
      v.update(VILLAGE, walking, [beside], true);
    }
    // Home on the next leg, not after the four-second hold at the crates.
    expect(t - reached.t).toBeLessThan(2_500);
    expect(gao(v)).toMatchObject({ drawPos: SHOP, walking: false });
    const talk = apply(CONTENT, walking, { type: 'walkTo', pos: SHOP }).state;
    expect(talk.world.talk?.npcId).toBe('shopkeeper_gao');
    // The conversation holds the clock, exactly as the scene does: he stays home.
    for (const end = t + 20_000; t <= end; t += 50) {
      v.tick(t, true);
      v.update(VILLAGE, talk, [talk.location.pos], false);
      expect(gao(v)).toMatchObject({ drawPos: SHOP, walking: false, alpha: 1 });
    }
  });

  /** Gao at the crates, then `ms` more of the loop with the party on `party`. */
  function homeFromCrates(party: readonly Vec2[], ms: number) {
    const state = at('morning', AWAY[0]);
    const reached = of(play(walks(), state, 0, 30_000), GAO).find(
      (f) => !f.walking && key(f.drawPos) === '8,5',
    );
    if (!reached) throw new Error('Gao reached the display');
    const v = walks();
    play(v, state, 0, reached.t);
    return of(
      play(v, state, reached.t + 50, ms, () => party),
      GAO,
    );
  }

  it('goes home round the party, never through it', () => {
    // The party on the lane tile his home leg crosses.
    const home = homeFromCrates([{ x: 9, y: 5 }], 3_000);
    expect(home.at(-1)?.drawPos).toEqual(SHOP);
    expect(home.every((f) => f.alpha === 1)).toBe(true);
    expect(home.some((f) => f.walking)).toBe(true);
    for (const f of home)
      expect(Math.hypot(f.drawPos.x - 9, f.drawPos.y - 5)).toBeGreaterThanOrEqual(0.7);
  });

  it('fades home when the party leaves no way round', () => {
    // Every open neighbour of his shop tile but the crates he stands at.
    const ring: Vec2[] = [
      { x: 8, y: 3 },
      { x: 9, y: 3 },
      { x: 10, y: 3 },
      { x: 8, y: 4 },
      { x: 10, y: 4 },
      { x: 9, y: 5 },
      { x: 10, y: 5 },
    ];
    const home = homeFromCrates(ring, 1_000);
    expect(home.at(-1)).toMatchObject({ drawPos: SHOP, alpha: 1 });
    expect(home.some((f) => f.alpha < 1)).toBe(true);
    // Out at the crates, in at home: never drawn on a tile between.
    for (const f of home) expect(['8,5', '9,4']).toContain(key(f.drawPos));
    expect(home.some((f) => f.walking)).toBe(false);
  });

  it('holds the anchor under reduce motion', () => {
    const w = walks(true);
    const frames = play(w, at('afternoon', AWAY[0], []), 0, 40_000);
    for (const f of of(frames, GAO)) expect(f).toMatchObject({ drawPos: SHOP, walking: false });
    for (const f of of(frames, CARRIER)) expect(f).toMatchObject({ drawPos: YARD, walking: false });
    expect(of(frames, GAO).every((f) => !f.lean && !f.squash)).toBe(true);
  });

  it('stands still through a conversation: the errand clock is the walk clock', () => {
    const w = walks();
    const state = at('morning', AWAY[0]);
    play(w, state, 0, 5_000);
    const before = w.figures();
    play(w, state, 5_050, 10_000, () => AWAY, true);
    expect(w.figures()).toEqual(before);
  });

  it('ends an errand with the placement: a phase change walks them on from where they are', () => {
    const w = walks();
    const morning = at('morning', AWAY[0]);
    const frames = play(w, morning, 0, 30_000);
    const reached = of(frames, GAO).find((f) => !f.walking && key(f.drawPos) === '8,5');
    if (!reached) throw new Error('Gao reached the display');
    const v = walks();
    play(v, morning, 0, reached.t);
    // Midday is his break: no restocking, back to the shopfront by a real walk.
    const midday: GameState = {
      ...morning,
      world: { ...morning.world, clock: { day: 1, phase: 'midday' } },
    };
    v.tick(reached.t + 50, false);
    expect(v.update(VILLAGE, midday, AWAY, true, AWAY)).toBe(true);
    expect(v.moving()).toBe(true);
    const back = of(play(v, midday, reached.t + 100, 3000), GAO);
    expect(back[0]?.drawPos.x).toBeLessThan(9);
    expect(back.at(-1)).toMatchObject({ drawPos: SHOP, walking: false });
    expect(v.moving()).toBe(false);
    // And no errand starts again during the break.
    const rest = of(play(v, midday, reached.t + 3200, 20_000), GAO);
    expect(rest.every((f) => samePos(f.drawPos, SHOP))).toBe(true);
  });
});
