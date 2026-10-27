import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { Heading } from '../../content/assets/clips';
import type { BendEffectDef, BendSetDef } from '../../content/bends';
import { BEND_FX } from '../../content/fxCels';
import { BA_DAN_CANAL_BRIDGE, BA_DAN_WATER_CELLS } from '../../content/scenes/baDan';
import { buildGrid, tileAt } from '../../core/rules/grid';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import type { MapDef, Vec2 } from '../../core/types';
import { bendFxIndex, parseBendFxPage } from '../../render/fx/bendFx';
import type { ResolvedBendFrame } from '../../render/sheets/store';
import { Animator } from '../animator';
import type { BendSources } from '../anim/bendHandoff';
import { choreograph } from '../anim/choreography';
import type { BendTrack, EmitterTrack } from '../anim/timeline';
import { seatHere } from './waiting';
import {
  BA_DAN_PRACTICE,
  hasPractice,
  practiceAbility,
  practiceAt,
  practiceCasts,
  practiceEvents,
  practiceSources,
  practiceUnits,
} from './practice';

function baDan() {
  const fresh = createGame(CONTENT, {
    seed: 'practice',
    party: ['kaya', 'sura', 'bo'].map((characterId) => ({
      characterId,
      level: 1,
      autoChoose: true,
    })),
    startNode: 'village_explore',
  });
  return apply(CONTENT, fresh, { type: 'enterNode', nodeId: 'village_explore' }).state;
}

const MAP = CONTENT.maps.get('ba_dan_village') as MapDef;
/** The road at the bridge's foot and the bank beside it, as the party stands for the review capture. */
const STANDING: readonly Vec2[] = [
  { x: 10, y: 8 },
  { x: 11, y: 7 },
  { x: 11, y: 8 },
];

describe('where the party can practise', () => {
  it('offers Ba Dan’s south canal bank by the bridge, and nowhere else', () => {
    expect(hasPractice('ba_dan_village')).toBe(true);
    expect(hasPractice('riverside')).toBe(false);
    for (const pos of STANDING)
      expect(practiceAt('ba_dan_village', pos), String(pos.y)).toBe(BA_DAN_PRACTICE);
    expect(practiceAt('ba_dan_village', { x: 9, y: 3 })).toBeNull();
    expect(practiceAt('ba_dan_village', { x: 6, y: 8 })).toBeNull();
    expect(practiceAt('ba_dan_village', BA_DAN_CANAL_BRIDGE)).toBeNull();
    expect(practiceAt('riverside', { x: 10, y: 8 })).toBeNull();
    expect(practiceAt(undefined, { x: 10, y: 8 })).toBeNull();
  });

  it('stands in the demo slice, on ground the party can walk to, aimed at the canal’s edge', () => {
    const grid = buildGrid(MAP);
    const { anchor, reach, mark } = BA_DAN_PRACTICE;
    const inSlice = (p: Vec2) => p.x >= 0 && p.x <= 13 && p.y >= 0 && p.y <= 9;
    expect(inSlice(anchor) && inSlice(mark)).toBe(true);
    // The near edge of the open canal: the impact, drawn at body height, lands over the water.
    expect(BA_DAN_WATER_CELLS).toContainEqual({ x: mark.x, y: mark.y - 1 });
    let walkable = 0;
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const tile = tileAt(grid, { x: anchor.x + dx, y: anchor.y + dy });
        if (tile && !tile.blocked) walkable++;
      }
    expect(walkable).toBeGreaterThanOrEqual(3);
  });

  it('is not a seat, so Practice and not Wait takes Look around’s slot there', () => {
    const state = baDan();
    const { anchor, reach } = BA_DAN_PRACTICE;
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const pos = { x: anchor.x + dx, y: anchor.y + dy };
        const at = { ...state, location: { ...state.location, pos } };
        expect(seatHere(CONTENT, at), `${pos.x},${pos.y}`).toBeFalsy();
      }
  });
});

describe('who throws what', () => {
  const state = baDan();

  it('picks each bender’s own combat bend', () => {
    expect(state.party.map((member) => practiceAbility(CONTENT, member)?.id)).toEqual([
      'fire_jab',
      'water_whip',
      'rock_throw',
    ]);
  });

  it('throws once each, in party order, at the mark; Sura draws from the nearest canal cell', () => {
    const casts = practiceCasts(CONTENT, state.party, STANDING, BA_DAN_PRACTICE);
    expect(casts.map((cast) => [cast.unitId, cast.abilityId, cast.from, cast.target])).toEqual(
      state.party.map((member, index) => [
        member.id,
        practiceAbility(CONTENT, member)?.id,
        STANDING[index],
        BA_DAN_PRACTICE.mark,
      ]),
    );
    const sura = casts[1];
    // From the bank at (11,7), the canal right in front of her.
    expect(sura?.source).toEqual({ x: 11, y: 6 });
    expect(BA_DAN_WATER_CELLS).toContainEqual(sura?.source);
    expect(casts[0]?.source).toBeUndefined();
    expect(casts[2]?.source).toBeUndefined();
    expect(practiceSources(casts)).toEqual({ [state.party[1]!.id]: { x: 11, y: 6 } });
  });

  it('skips a member standing on the mark and one without a bend', () => {
    const onMark = [STANDING[0]!, BA_DAN_PRACTICE.mark, STANDING[2]!];
    expect(practiceCasts(CONTENT, state.party, onMark, BA_DAN_PRACTICE)).toHaveLength(2);
    const plain = state.party.map((member) => ({ ...member, abilities: ['strike'] }));
    expect(practiceCasts(CONTENT, plain, STANDING, BA_DAN_PRACTICE)).toEqual([]);
  });

  it('makes casts for the animator only: nothing struck, the game untouched', () => {
    const before = structuredClone(state);
    const casts = practiceCasts(CONTENT, state.party, STANDING, BA_DAN_PRACTICE);
    const events = practiceEvents(casts);
    expect(events.map((event) => event.type)).toEqual([
      'abilityUsed',
      'abilityUsed',
      'abilityUsed',
    ]);
    const units = practiceUnits(state.party, STANDING);
    expect(units.map((unit) => unit.pos)).toEqual(STANDING);
    expect(state).toEqual(before);
  });
});

/* ------------------------------------------------------------------ */
/* Playback: the combat bends, as combat plays them                     */
/* ------------------------------------------------------------------ */

const read = (path: string): unknown => JSON.parse(readFileSync(join('public', path), 'utf8'));
const fx = bendFxIndex(
  read(BEND_FX.data) as BendEffectDef[],
  BEND_FX.pages.map((path) => parseBendFxPage(read(path), path)),
);
const SETS: Record<string, BendSetDef> = {
  'unit.fire.kaya': read('art/units/kaya-bend.json') as BendSetDef,
  'unit.water.sura': read('art/units/sura-bend.json') as BendSetDef,
  'unit.earth.bo': read('art/units/bo-bend.json') as BendSetDef,
};
function frameOf(sprite: string, heading: Heading, index: number): ResolvedBendFrame | null {
  const facing = SETS[sprite]?.facings[heading];
  if (!facing || index >= facing.frames.length) return null;
  return {
    frame: { x: 0, y: 0, w: facing.frameSize.width, h: facing.frameSize.height },
    anchor: facing.anchor,
    pixelsPerTile: 128,
    sockets: facing.socketsPerFrame.find((row) => row.frame === index)?.sockets ?? {},
    heading,
    index,
    ms: facing.frameMs[index] ?? 0,
  } as unknown as ResolvedBendFrame;
}
const loaded: BendSources = { fx, setOf: (sprite) => SETS[sprite], frameOf };

describe('practice playback', () => {
  const state = baDan();
  const casts = practiceCasts(CONTENT, state.party, STANDING, BA_DAN_PRACTICE);
  const play = (waterSources?: Record<string, Vec2>, rate = 1) =>
    choreograph({
      content: CONTENT,
      events: practiceEvents(casts),
      unitsBefore: practiceUnits(state.party, STANDING),
      cursor: 0,
      rate,
      pushIndex: 0,
      projection: 'oblique',
      bends: loaded,
      ...(waterSources ? { waterSources } : {}),
    });

  it('plays all three bends one after another, with their combat sounds', () => {
    const out = play(practiceSources(casts));
    const bends = out.tracks.filter((t): t is BendTrack => t.kind === 'bend');
    expect(bends.map((b) => b.unitId)).toEqual(state.party.map((m) => m.id));
    for (let i = 1; i < bends.length; i++)
      expect(bends[i]!.start).toBeGreaterThanOrEqual(bends[i - 1]!.start + bends[i - 1]!.duration);
    expect(out.sounds.map((s) => s.key)).toEqual(
      casts.map((cast) => CONTENT.abilities.get(cast.abilityId)!.fx),
    );
    // Nothing is struck, so no health moves.
    expect(out.health).toEqual([]);
  });

  it('lifts Sura’s water out of the canal through her gather, and adds nothing else', () => {
    const drawn = play(practiceSources(casts));
    const plain = play();
    const extra = drawn.tracks.filter((t) => !plain.tracks.includes(t));
    const emitters = drawn.tracks.filter(
      (t): t is EmitterTrack => t.kind === 'emitter' && t.from.x === 11.5 && t.from.y === 6.5,
    );
    expect(emitters.length).toBeGreaterThan(0);
    const sura = drawn.tracks.find(
      (t): t is BendTrack => t.kind === 'bend' && t.unitId === state.party[1]!.id,
    )!;
    for (const e of emitters) {
      expect(e.start).toBe(sura.start);
      expect(e.attachments?.to?.socket).toBe('cast-gather');
    }
    expect(extra.length).toBeGreaterThanOrEqual(emitters.length);
    // Without a source the push is exactly combat's.
    expect(plain.tracks.filter((t) => t.kind === 'emitter')).toHaveLength(0);
    expect(drawn.tracks.filter((t) => t.kind !== 'emitter')).toEqual(plain.tracks);
  });

  it('keeps reduce motion on the collapsed legacy cast, with no particles', () => {
    const out = play(practiceSources(casts), 0.02);
    expect(out.tracks.some((t) => t.kind === 'bend' || t.kind === 'emitter')).toBe(false);
  });

  it('runs through the animator: busy for the whole practice, drawing each bender’s cels', () => {
    const animator = new Animator(CONTENT, {
      motionReduced: () => false,
      bends: () => loaded,
    });
    animator.setProjection('oblique');
    animator.push(0, practiceEvents(casts), practiceUnits(state.party, STANDING), {
      waterSources: practiceSources(casts),
    });
    const out = play(practiceSources(casts));
    const bends = out.tracks.filter((t): t is BendTrack => t.kind === 'bend');
    for (const bend of bends) {
      const mid = bend.start + bend.duration / 2;
      expect(animator.busy(mid)).toBe(true);
      expect(animator.bendPose(mid, bend.unitId)).toBeDefined();
    }
    const end = Math.max(...bends.map((b) => b.start + b.duration));
    expect(animator.busy(end + 1000)).toBe(false);
  });
});
