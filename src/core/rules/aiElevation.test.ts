import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { AiProfile, Grid, Unit, Vec2 } from '../types';
import { planAiTurn, weightsFor } from './ai';
import { DEFAULT_TILE, distance, tileAt, withTile } from './grid';

/**
 * The AI and high ground (ADR 0061, E6).
 *
 * Height used to be a flat 1.5 points per tier to everybody, so a boss climbed
 * for the same reason a cautious archer did. Each profile now carries its own
 * per-tier weight — cautious 4, support 3, aggressive 1, boss 0 — and these
 * tests read that number back and then show it deciding where a unit walks.
 */

const HERO: Vec2 = { x: 0, y: 0 };
const START: Vec2 = { x: 0, y: 4 };
/** One tier up and one tile closer to the hero: the corridor's only interest. */
const HIGH_GROUND: Vec2 = { x: 0, y: 3 };

/**
 * A one-wide corridor, so every cell the AI scores is one this test reasons
 * about. On an open board the profile weights only break ties by iteration
 * order, which is exactly the sort of thing a test should not rest on.
 */
function corridor(): Grid {
  const tiles = Array.from({ length: 15 }, (_, index) =>
    index % 3 === 0
      ? DEFAULT_TILE
      : { ...DEFAULT_TILE, terrain: 'wall' as const, blocked: true, blocksSight: true },
  );
  return { width: 3, height: 5, tiles };
}

/**
 * A lone enemy at the far end of the corridor with nothing but a heal, so its
 * turn falls through to repositioning — the path the elevation weight lives on.
 * The hero is an opponent, so the heal has nobody to land on.
 */
function standoff(ai: AiProfile, elevation: number): { draft: BattleDraft; enemyId: string } {
  const state = createGame(CONTENT, {
    seed: `ai-elevation-${ai}-${elevation}`,
    party: [{ characterId: 'kaya', level: 3 }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_forest_road', new RngCursor(state.rng), {
    variantId: 'thugs',
  });
  const enemyBase = battle.units.find((unit) => unit.faction === 'enemy');
  const heroBase = battle.units.find((unit) => unit.faction === 'party');
  if (!enemyBase || !heroBase) throw new Error('Missing elevation fixture units');

  const base = corridor();
  const high = tileAt(base, HIGH_GROUND);
  if (!high) throw new Error('Missing elevation fixture tile');
  const grid = withTile(base, HIGH_GROUND, { ...high, elevation });

  const enemy: Unit = {
    ...enemyBase,
    ai,
    pos: START,
    abilities: ['healing_stream'],
    cooldowns: {},
    ap: 3,
    move: 4,
  };
  const hero: Unit = { ...heroBase, pos: HERO };
  const units = [enemy, hero];
  return {
    draft: new BattleDraft(
      CONTENT,
      { ...battle, grid, units, order: units.map((unit) => unit.id), turnIndex: 0, props: [] },
      new RngCursor(0x1234),
    ),
    enemyId: enemy.id,
  };
}

function endedAt(draft: BattleDraft, unitId: string): Vec2 {
  const unit = draft.unit(unitId);
  if (!unit) throw new Error('Unit vanished from the draft');
  return unit.pos;
}

describe('the AI and high ground', () => {
  it('gives every profile its own per-tier elevation weight', () => {
    expect(weightsFor('cautious').elevation).toBe(4);
    expect(weightsFor('support').elevation).toBe(3);
    expect(weightsFor('aggressive').elevation).toBe(1);
    expect(weightsFor('boss').elevation).toBe(0);
    // `none` is not a personality: it keeps the old flat number.
    expect(weightsFor('none').elevation).toBe(1.5);
  });

  it('stops a cautious unit on high ground it would otherwise walk past', () => {
    const flat = standoff('cautious', 0);
    planAiTurn(flat.draft, flat.enemyId, new RngCursor(0x11));
    // Without the hill, closing the distance is all that is left to want.
    expect(endedAt(flat.draft, flat.enemyId)).toEqual({ x: 0, y: 1 });

    const high = standoff('cautious', 1);
    planAiTurn(high.draft, high.enemyId, new RngCursor(0x11));
    // Cautious pays 4 a tier, which outweighs a tile of closing at 0.5.
    expect(endedAt(high.draft, high.enemyId)).toEqual(HIGH_GROUND);
  });

  it('leaves a boss blind to the same tile, because its weight is zero', () => {
    const flat = standoff('boss', 0);
    planAiTurn(flat.draft, flat.enemyId, new RngCursor(0x11));

    const high = standoff('boss', 1);
    planAiTurn(high.draft, high.enemyId, new RngCursor(0x11));

    // A zero weight cannot move the decision...
    expect(endedAt(high.draft, high.enemyId)).toEqual(endedAt(flat.draft, flat.enemyId));
    // ...so the boss closes on the hero instead of taking the hill.
    expect(endedAt(high.draft, high.enemyId)).not.toEqual(HIGH_GROUND);
    expect(distance(endedAt(high.draft, high.enemyId), HERO)).toBe(1);
  });
});
