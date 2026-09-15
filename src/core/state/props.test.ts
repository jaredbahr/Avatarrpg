/**
 * Interactable props.
 *
 * The point of these tests is that almost none of the behaviour being asserted is
 * implemented by props. A water barrel does not know what Wet is; it paints
 * `water`, and the surface table does the rest. An oil flask does not know about
 * fire; `combos.ts` has had the `fire-into-oil` rule since Phase 1 and was only
 * ever waiting for something to spill oil.
 *
 * So these are integration tests on purpose. If a barrel stops soaking people,
 * the interesting question is whether props broke or whether the reaction table
 * did, and a test that mocks the surface engine would answer neither.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { enterCost, posKey, tileAt } from '../rules/grid';
import type { GameState, Vec2 } from '../types';
import { BattleDraft } from './battleDraft';
import { createBattle, createGame } from './createGame';

function freshDraft(): BattleDraft {
  const seeded = createGame(CONTENT, {
    seed: 'props',
    party: [
      { characterId: 'kaya', level: 3, autoChoose: true },
      { characterId: 'nilak', level: 3, autoChoose: true },
    ],
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_forest_road', rng);
  return new BattleDraft(CONTENT, battle, rng);
}

/** An empty, walkable tile with `radius` clear tiles around it. */
function openTile(draft: BattleDraft, radius = 1): Vec2 {
  const occupied = new Set(draft.units.flatMap((u) => [posKey(u.pos)]));
  for (let y = radius; y < draft.grid.height - radius; y++) {
    for (let x = radius; x < draft.grid.width - radius; x++) {
      let clear = true;
      for (let dy = -radius; dy <= radius && clear; dy++) {
        for (let dx = -radius; dx <= radius && clear; dx++) {
          const pos = { x: x + dx, y: y + dy };
          const tile = tileAt(draft.grid, pos);
          if (!tile || tile.blocked || tile.surface || occupied.has(posKey(pos))) clear = false;
        }
      }
      if (clear) return { x, y };
    }
  }
  throw new Error('no open tile on this map');
}

describe('props on the battlefield', () => {
  let draft: BattleDraft;
  beforeEach(() => {
    draft = freshDraft();
  });

  it('bakes a solid prop into the tile it stands on', () => {
    const pos = openTile(draft);
    expect(tileAt(draft.grid, pos)?.blocked).toBe(false);

    draft.placeProp('water_barrel', pos);

    // The whole integration trick: every existing consumer of blocking reads
    // Tile, so nothing had to learn what a prop is.
    const tile = tileAt(draft.grid, pos);
    expect(tile?.blocked).toBe(true);
    expect(tile?.cover).toBe(true);
    expect(
      enterCost({ grid: draft.grid, blocked: new Set(), surfaces: CONTENT.surfaces, size: 1 }, pos),
    ).toBeNull();
  });

  it('leaves the tile alone for a prop that is not solid', () => {
    const pos = openTile(draft);
    draft.placeProp('oil_flask', pos);
    expect(tileAt(draft.grid, pos)?.blocked).toBe(false);
  });

  it('restores the original tile when it breaks', () => {
    const pos = openTile(draft);
    const before = tileAt(draft.grid, pos);
    const prop = draft.placeProp('water_barrel', pos);
    if (!prop) throw new Error('prop not placed');

    draft.breakProp(prop.id);

    expect(draft.propAt(pos)).toBeUndefined();
    expect(tileAt(draft.grid, pos)?.blocked).toBe(before?.blocked);
    expect(tileAt(draft.grid, pos)?.terrain).toBe(before?.terrain);
  });

  it('soaks whoever is standing beside a broken water barrel', () => {
    const pos = openTile(draft);
    const victim = draft.units[0];
    if (!victim) throw new Error('no units');

    // Stand them next to the barrel.
    const beside = { x: pos.x + 1, y: pos.y };
    draft.placeUnit(victim.id, beside, { contact: false });

    const prop = draft.placeProp('water_barrel', pos);
    if (!prop) throw new Error('prop not placed');
    draft.breakProp(prop.id);

    expect(tileAt(draft.grid, beside)?.surface?.id).toBe('water');
    // Nothing in props.ts mentions Wet. The surface table applied it.
    expect(draft.unit(victim.id)?.statuses.some((s) => s.id === 'wet')).toBe(true);
  });

  it('turns an oil flask into a spreading blaze when fire reaches it', () => {
    const pos = openTile(draft, 2);
    const prop = draft.placeProp('oil_flask', pos);
    if (!prop) throw new Error('prop not placed');

    // Fire is in vulnerableTo, so this breaks it outright.
    draft.damageProps([pos], 3, 'fire');
    expect(draft.propAt(pos)).toBeUndefined();

    // Oil on the ground, and then the fire arriving after it — the ordering in
    // applyEffect is what makes this the interesting case rather than a puddle.
    draft.impact([pos], 'fire', null);

    const tile = tileAt(draft.grid, pos);
    expect(tile?.surface?.id).toBe('fire');
    expect(tile?.surface?.spread, 'fire on oil should spread').toBeGreaterThan(0);
  });

  it('doubles damage from what a prop is vulnerable to', () => {
    const pos = openTile(draft);
    const prop = draft.placeProp('brazier', pos);
    if (!prop) throw new Error('prop not placed');

    // Brazier has 8 hp and is vulnerable to earth: 4 doubled is exactly lethal.
    draft.damageProps([pos], 4, 'earth');
    expect(draft.propAt(pos)).toBeUndefined();
  });

  it('ignores damage a prop is immune to', () => {
    const pos = openTile(draft);
    const prop = draft.placeProp('brazier', pos);
    if (!prop) throw new Error('prop not placed');

    draft.damageProps([pos], 50, 'fire');
    expect(draft.propAt(pos)?.hp).toBe(prop.hp);
  });

  it('burns a prop that is standing in fire', () => {
    const pos = openTile(draft, 2);
    const prop = draft.placeProp('oil_flask', pos);
    if (!prop) throw new Error('prop not placed');

    // A flask is not solid, so fire can be painted right under it.
    draft.paint([pos], 'fire', 3, null);
    draft.tickTerrain();

    expect(draft.propAt(pos), 'the flask should have gone up').toBeUndefined();
  });

  it('catches a solid prop alight from the fire beside it', () => {
    /*
     * A hay bale is solid, so `paintSurface` will not paint its own tile — there
     * is a bale there, not ground. Fire reaching the hay and doing nothing would
     * still be the wrong answer, so exposure is read from the neighbours.
     */
    const pos = openTile(draft, 2);
    const prop = draft.placeProp('hay_bale', pos);
    if (!prop) throw new Error('prop not placed');

    const beside = { x: pos.x + 1, y: pos.y };
    draft.paint([beside], 'fire', 3, null);
    expect(tileAt(draft.grid, pos)?.surface, 'its own tile stays bare').toBeNull();

    // 5 hp, vulnerable to fire, 4 damage a round doubled.
    draft.tickTerrain();
    expect(draft.propAt(pos), 'the hay should have caught').toBeUndefined();
  });

  it('leaves a solid prop alone when the fire beside it cannot hurt it', () => {
    const pos = openTile(draft, 2);
    const prop = draft.placeProp('rubble_pile', pos);
    if (!prop) throw new Error('prop not placed');

    draft.paint([{ x: pos.x + 1, y: pos.y }], 'fire', 3, null);
    draft.tickTerrain();

    expect(draft.propAt(pos)?.hp, 'stone does not burn').toBe(prop.hp);
  });

  it('shoves a pushable prop away from the shover', () => {
    const pos = openTile(draft, 2);
    const prop = draft.placeProp('water_barrel', pos);
    if (!prop) throw new Error('prop not placed');

    const origin = { x: pos.x - 1, y: pos.y };
    draft.shoveProp(prop.id, origin, 1, 'push');

    const moved = draft.props.find((p) => p.id === prop.id);
    expect(moved?.pos).toEqual({ x: pos.x + 1, y: pos.y });
    // The tile it left is walkable again, the tile it arrived on is not.
    expect(tileAt(draft.grid, pos)?.blocked).toBe(false);
    expect(tileAt(draft.grid, { x: pos.x + 1, y: pos.y })?.blocked).toBe(true);
  });

  it('refuses to shove a prop that is not pushable', () => {
    const pos = openTile(draft, 2);
    const prop = draft.placeProp('rubble_pile', pos);
    if (!prop) throw new Error('prop not placed');

    draft.shoveProp(prop.id, { x: pos.x - 1, y: pos.y }, 1, 'push');
    expect(draft.props.find((p) => p.id === prop.id)?.pos).toEqual(pos);
    expect(tileAt(draft.grid, pos)?.blocked, 'it should still be solid').toBe(true);
  });

  it('stops a shoved prop at the first tile it cannot enter', () => {
    const pos = openTile(draft, 2);
    const prop = draft.placeProp('water_barrel', pos);
    const blocker = draft.placeProp('rubble_pile', { x: pos.x + 1, y: pos.y });
    if (!prop || !blocker) throw new Error('props not placed');

    draft.shoveProp(prop.id, { x: pos.x - 1, y: pos.y }, 3, 'push');

    // Nowhere to go, so it stays — and stays solid.
    expect(draft.props.find((p) => p.id === prop.id)?.pos).toEqual(pos);
    expect(tileAt(draft.grid, pos)?.blocked).toBe(true);
  });

  it('blinds and scatters people when the cabbage cart goes over', () => {
    const pos = openTile(draft);
    const victim = draft.units[0];
    if (!victim) throw new Error('no units');

    const beside = { x: pos.x + 1, y: pos.y };
    draft.placeUnit(victim.id, beside, { contact: false });
    const hpBefore = draft.unit(victim.id)?.hp;

    const prop = draft.placeProp('cabbage_cart', pos);
    if (!prop) throw new Error('prop not placed');
    draft.breakProp(prop.id);

    const after = draft.unit(victim.id);
    expect(after?.statuses.some((s) => s.id === 'blinded')).toBe(true);
    // Nobody has ever been hurt by a cabbage.
    expect(after?.hp).toBe(hpBefore);
  });

  it('prints the prop’s own words to the log, never its id', () => {
    const pos = openTile(draft);
    const prop = draft.placeProp('cabbage_cart', pos);
    if (!prop) throw new Error('prop not placed');
    draft.breakProp(prop.id);

    const destroyed = draft.events.find((e) => e.type === 'propDestroyed');
    expect(destroyed).toBeDefined();
    if (destroyed?.type !== 'propDestroyed') throw new Error('wrong event');
    expect(destroyed.label).toContain('CABBAGES');
    expect(destroyed.label).not.toContain(prop.id);
  });
});

describe('props and the map', () => {
  it('instantiates props authored on the map, honouring their conditions', () => {
    const base: GameState = createGame(CONTENT, {
      seed: 'map-props',
      party: [{ characterId: 'kaya' }],
      startNode: '',
    });

    // Fake a map with one unconditional prop and one gated one.
    const map = CONTENT.maps.get('forest_road');
    if (!map) throw new Error('no forest_road map');
    const probe = new BattleDraft(
      CONTENT,
      createBattle(CONTENT, base, 'enc_forest_road', new RngCursor(base.rng)),
      new RngCursor(base.rng),
    );
    const spot = openTile(probe);

    const withProps = new Map(CONTENT.maps);
    withProps.set('forest_road', {
      ...map,
      props: [
        { propId: 'water_barrel', pos: spot },
        {
          propId: 'oil_flask',
          pos: { x: spot.x, y: spot.y + 1 },
          when: { kind: 'flag', key: 'saboteur', op: 'set' },
        },
      ],
    });
    const content = { ...CONTENT, maps: withProps };

    const without = createBattle(content, base, 'enc_forest_road', new RngCursor(base.rng));
    expect(without.props.map((p) => p.propId)).toEqual(['water_barrel']);

    const gated: GameState = { ...base, flags: { saboteur: true } };
    const with_ = createBattle(content, gated, 'enc_forest_road', new RngCursor(gated.rng));
    expect(with_.props.map((p) => p.propId)).toEqual(['water_barrel', 'oil_flask']);
  });
});
