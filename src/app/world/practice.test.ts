import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { BA_DAN_CANAL_BRIDGE, BA_DAN_WATER_CELLS } from '../../content/maps/baDanLayout';
import { buildGrid, tileAt } from '../../core/rules/grid';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import type { Ability, MapDef, Unit, Vec2 } from '../../core/types';
import { Animator } from '../animator';
import { choreograph } from '../anim/choreography';
import { seatHere } from './waiting';
import {
  BA_DAN_PRACTICE,
  isBendingAttack,
  practiceAbility,
  practiceAt,
  practiceCasts,
  glidePoint,
  practiceEvents,
  practiceFrame,
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
    expect(practiceAt('riverside', BA_DAN_PRACTICE.anchor)).toBeNull();
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

  it('throws once each, in party order, at the mark', () => {
    const casts = practiceCasts(CONTENT, state.party, STANDING, BA_DAN_PRACTICE);
    expect(casts.map((cast) => [cast.unitId, cast.abilityId, cast.from, cast.target])).toEqual(
      state.party.map((member, index) => [
        member.id,
        practiceAbility(CONTENT, member)?.id,
        STANDING[index],
        BA_DAN_PRACTICE.mark,
      ]),
    );
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

const ability = (id: string): Ability => CONTENT.abilities.get(id)!;
const member = (element: string, faction: Unit['faction'] = 'party'): Unit =>
  ({
    id: element,
    sprite: `unit.${element}`,
    element,
    faction,
    pos: { x: 0, y: 0 },
  }) as unknown as Unit;

describe('which abilities are practised', () => {
  it('admits single-target ranged damage of the caster element only', () => {
    for (const id of ['fire_jab', 'lightning'])
      expect(isBendingAttack(member('fire'), ability(id)), id).toBe(true);
    for (const id of ['water_whip', 'water_pull'])
      expect(isBendingAttack(member('water'), ability(id)), id).toBe(true);
    for (const id of ['rock_throw', 'metalbending', 'metal_cable'])
      expect(isBendingAttack(member('earth'), ability(id)), id).toBe(true);
  });

  it('turns down area, melee, support, other elements and anyone outside the party', () => {
    for (const id of [
      'flame_arc',
      'dragon_breath',
      'fire_blast',
      'lightning_storm',
      'lightning_arc',
      'fire_wall',
      'fire_step',
      'heat_shield',
      'strike',
      'water_whip',
    ])
      expect(isBendingAttack(member('fire'), ability(id)), id).toBe(false);
    for (const id of ['healing_stream', 'ice_shield', 'healing_hands', 'octopus_form'])
      expect(isBendingAttack(member('water'), ability(id)), id).toBe(false);
    expect(isBendingAttack(member('fire', 'enemy'), ability('fire_jab'))).toBe(false);
    expect(isBendingAttack(member('fire', 'ally'), ability('fire_jab'))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Playback: the combat casts, as combat plays them                     */
/* ------------------------------------------------------------------ */

describe('practice playback', () => {
  const state = baDan();
  const casts = practiceCasts(CONTENT, state.party, STANDING, BA_DAN_PRACTICE);
  const play = () =>
    choreograph({
      content: CONTENT,
      events: practiceEvents(casts),
      unitsBefore: practiceUnits(state.party, STANDING),
      cursor: 0,
      rate: 1,
      pushIndex: 0,
      projection: 'orthographic',
    });

  it('plays every cast in party order, with its combat sound, striking nobody', () => {
    const out = play();
    expect(out.sounds.map((s) => s.key)).toEqual(
      casts.map((cast) => CONTENT.abilities.get(cast.abilityId)!.fx),
    );
    // Nothing is struck, so no health moves.
    expect(out.health).toEqual([]);
  });

  it('runs through the animator: busy for the whole practice', () => {
    const animator = new Animator(CONTENT, { motionReduced: () => false });
    animator.push(0, practiceEvents(casts), practiceUnits(state.party, STANDING));
    const end = Math.max(...play().tracks.map((t) => t.start + t.duration));
    expect(animator.busy(end / 2)).toBe(true);
    expect(animator.busy(end + 1000)).toBe(false);
  });
});

describe('the practice camera', () => {
  it('frames the benders and leans toward the mark', () => {
    const benders = [
      { x: 10, y: 8 },
      { x: 9, y: 8 },
      { x: 8, y: 7 },
    ];
    expect(practiceFrame(benders, BA_DAN_PRACTICE.mark)).toEqual({ x: 7, y: 7.25 });
  });

  it('glides with an ease and lands exactly on its target', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 4, y: 2 };
    expect(glidePoint(from, to, 0, 400)).toEqual(from);
    expect(glidePoint(from, to, 200, 400)).toEqual({ x: 2, y: 1 });
    expect(glidePoint(from, to, 100, 400).x).toBeLessThan(1);
    expect(glidePoint(from, to, 900, 400)).toEqual(to);
    // Reduce motion: no glide at all.
    expect(glidePoint(from, to, 0, 0)).toEqual(to);
  });
});
