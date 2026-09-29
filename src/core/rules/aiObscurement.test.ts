import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { ContentIndex, GameEvent, Grid, Unit, Vec2 } from '../types';
import { planAiTurn } from './ai';
import { averageDamage, hitChance } from './damage';
import { DEFAULT_TILE, distance, withSurface } from './grid';

/**
 * The AI and obscurement.
 *
 * Attacks already know about clouds through `averageDamage → hitChance →
 * hitBreakdown`. Two things do not come for free: positioning has to treat a
 * cloud as cover-like (steam used to get that accidentally through
 * `grantsCover`), and a ranged unit has to close in once a sandstorm makes long
 * shots unreliable.
 */

const STEAM = { id: 'steam', duration: 2, spread: 0 } as const;

function openGrid(width: number, height: number): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

function fixture(): { attacker: Unit; defender: Unit } {
  const state = createGame(CONTENT, {
    seed: 'ai-obscurement',
    party: [{ characterId: 'kaya', level: 3 }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const attacker = battle.units.find((unit) => unit.faction === 'party');
  const defender = battle.units.find((unit) => unit.faction === 'enemy');
  if (!attacker || !defender) throw new Error('Missing fixture units');
  return { attacker, defender };
}

function at(unit: Unit, pos: Vec2): Unit {
  return { ...unit, pos };
}

/** The forest road plus a sandstorm, kept out of `content/` on purpose. */
function stormContent(): ContentIndex {
  const encounter = CONTENT.encounters.get('enc_forest_road');
  if (!encounter) throw new Error('Missing forest road encounter');
  return {
    ...CONTENT,
    encounters: new Map(CONTENT.encounters).set('enc_forest_road', {
      ...encounter,
      weather: { id: 'sandstorm', schedule: [{ fromRound: 1, intensity: 2 }] },
    }),
  };
}

/** A cautious slinger six tiles from a lone hero, on a clean board. */
function standoff(content: ContentIndex): { draft: BattleDraft; enemyId: string; heroPos: Vec2 } {
  const state = createGame(content, {
    seed: 'ai-sandstorm-standoff',
    party: [{ characterId: 'kaya', level: 3 }],
    startNode: '',
  });
  const battle = createBattle(content, state, 'enc_forest_road', new RngCursor(state.rng), {
    variantId: 'slingers',
  });
  const enemyBase = battle.units.find((unit) => unit.faction === 'enemy');
  const heroBase = battle.units.find((unit) => unit.faction === 'party');
  if (!enemyBase || !heroBase) throw new Error('Missing standoff fixture units');

  const heroPos: Vec2 = { x: 1, y: 3 };
  const enemy: Unit = { ...enemyBase, pos: { x: 7, y: 3 } };
  const hero: Unit = { ...heroBase, pos: heroPos };
  const units = [enemy, hero];
  const draft = new BattleDraft(
    content,
    {
      ...battle,
      grid: openGrid(14, 8),
      units,
      order: units.map((unit) => unit.id),
      turnIndex: 0,
      props: [],
    },
    new RngCursor(0x5eed),
  );
  return { draft, enemyId: enemy.id, heroPos };
}

/** Whether the AI repositioned before it took its first shot. */
function movedBeforeFirstShot(events: readonly GameEvent[]): boolean {
  for (const event of events) {
    if (event.type === 'unitMoved') return true;
    if (event.type === 'abilityUsed') return false;
  }
  return false;
}

describe('the AI and obscurement', () => {
  it('repositions onto a cloud to blunt the shots that threaten it', () => {
    const state = createGame(CONTENT, {
      seed: 'ai-obscurement-move',
      party: [{ characterId: 'kaya', level: 3 }],
      startNode: '',
    });
    const rng = new RngCursor(state.rng);
    const battle = createBattle(CONTENT, state, 'enc_forest_road', rng, { variantId: 'thugs' });
    const enemyBase = battle.units.find((unit) => unit.faction === 'enemy');
    const heroBase = battle.units.find((unit) => unit.faction === 'party');
    if (!enemyBase || !heroBase) throw new Error('Missing reposition fixture units');

    const grid = withSurface(openGrid(12, 8), { x: 4, y: 3 }, STEAM);
    // A full-HP unit with only a heal has nothing worth doing, so the loop
    // falls through to repositioning — which is where the cloud term lives.
    const enemy: Unit = {
      ...enemyBase,
      pos: { x: 6, y: 3 },
      ai: 'cautious',
      abilities: ['healing_stream'],
      cooldowns: {},
      ap: 3,
      move: 3,
    };
    const hero: Unit = { ...heroBase, pos: { x: 2, y: 3 } };
    const units = [enemy, hero];
    const draft = new BattleDraft(
      CONTENT,
      {
        ...battle,
        grid,
        units,
        order: units.map((unit) => unit.id),
        turnIndex: 0,
        // The real map's props carry coordinates for a grid we replaced.
        props: [],
      },
      new RngCursor(0xabc),
    );

    planAiTurn(draft, enemy.id, new RngCursor(0xdef));

    expect(draft.unit(enemy.id)?.pos).toEqual({ x: 4, y: 3 });
  });

  it('values a longer shot less under sandstorm, which pulls a ranged unit closer', () => {
    const rock = CONTENT.abilities.get('rock_throw');
    const effect = rock?.effects.find((candidate) => candidate.kind === 'damage');
    if (!effect || effect.kind !== 'damage') throw new Error('Missing rock throw fixture');
    const { attacker, defender } = fixture();
    const grid = openGrid(8, 5);
    const target = at(defender, { x: 6, y: 0 });
    const near = at(attacker, { x: 4, y: 0 });
    const far = at(attacker, { x: 0, y: 0 });

    // With no weather, distance does not move the shot at all.
    expect(hitChance(CONTENT, grid, near, target)).toBe(
      hitChance(CONTENT, grid, far, target),
    );
    expect(averageDamage(CONTENT, grid, near, target, effect)).toBe(
      averageDamage(CONTENT, grid, far, target, effect),
    );

    // A sandstorm makes the long shot strictly worse, which is the pressure the
    // AI's positioning already feels through `averageDamage`.
    expect(hitChance(CONTENT, grid, near, target, 2)).toBeGreaterThan(
      hitChance(CONTENT, grid, far, target, 2),
    );
    expect(averageDamage(CONTENT, grid, near, target, effect, 2)).toBeGreaterThan(
      averageDamage(CONTENT, grid, far, target, effect, 2),
    );
    // "Blowing sand" bites later than a full sandstorm.
    expect(hitChance(CONTENT, grid, near, target, 1)).toBe(
      hitChance(CONTENT, grid, near, target, 0),
    );
    expect(hitChance(CONTENT, grid, far, target, 1)).toBeLessThan(
      hitChance(CONTENT, grid, far, target, 0),
    );
  });

  it('advances before shooting when a sandstorm makes the long shot worse', () => {
    const clear = standoff(CONTENT);
    planAiTurn(clear.draft, clear.enemyId, new RngCursor(0x5eed));

    const storm = standoff(stormContent());
    planAiTurn(storm.draft, storm.enemyId, new RngCursor(0x5eed));
    const weathered = storm.draft.unit(storm.enemyId);
    if (!weathered) throw new Error('Weathered slinger vanished');

    // Both take the shot; only the sandstorm makes walking in worth it first.
    expect(clear.draft.events.some((event) => event.type === 'abilityUsed')).toBe(true);
    expect(storm.draft.events.some((event) => event.type === 'abilityUsed')).toBe(true);
    expect(movedBeforeFirstShot(clear.draft.events)).toBe(false);
    expect(movedBeforeFirstShot(storm.draft.events)).toBe(true);
    // And the advance really is a closing move, not a shuffle sideways.
    expect(distance(weathered.pos, storm.heroPos)).toBeLessThan(6);
  });
});
