import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { buildGrid, posKey, tileAt } from '../../core/rules/grid';
import type { DayPhase, GameState, MapDef, Vec2 } from '../../core/types';
import { ResidentWalks, planResidentMotion } from './residentMotion';
import type { ResidentMotion } from './residentMotion';

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
