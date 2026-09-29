/**
 * SIZE-2 occupancy and height reach, seen from the AI.
 *
 * `validatingOrigin` lets a range-3-plus line-of-sight attack reach a tile
 * further when it fires down from higher ground. The AI's reach and threat
 * estimates have to read that same rule, or a unit on a hill is treated as
 * out of the fight — and its threats ignored — until it is already in trouble.
 * `candidateTargets` has to enumerate every cell a size-2 opponent stands on,
 * or half of a boss is invisible to the scorer.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { BattleState, Grid, Unit, Vec2 } from '../types';
import { bestReach, candidateTargets, threatAt } from './ai';
import { hitChance } from './damage';
import { DEFAULT_TILE, posKey, tileAt, withTile } from './grid';
import { weatherAt } from './obscurement';
import { effectiveStats } from './stats';

/** An open, empty field: no terrain, no props, nothing for a range check to snag on. */
function baseBattle(width = 24, height = 8): BattleState {
  const game = createGame(CONTENT, {
    seed: 'ai-height-reach',
    party: [{ characterId: 'kaya', level: 5, autoChoose: true }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, game, 'enc_quarry_gate', new RngCursor(game.rng));
  return {
    ...battle,
    grid: { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) },
    props: [],
  };
}

function reachFixture(): { party: Unit; enemy: Unit; battle: BattleState } {
  const battle = baseBattle();
  const party = battle.units.find((unit) => unit.faction === 'party');
  const enemy = battle.units.find((unit) => unit.faction === 'enemy');
  if (!party || !enemy) throw new Error('missing AI height-reach fixture');
  return { party, enemy, battle };
}

function withUnits(battle: BattleState, units: readonly Unit[]): BattleState {
  return { ...battle, units, order: units.map((unit) => unit.id), turnIndex: 0 };
}

/** Sets one elevation across every listed tile. */
function raised(grid: Grid, positions: readonly Vec2[], elevation: number): Grid {
  let next = grid;
  for (const pos of positions) {
    const tile = tileAt(next, pos);
    if (tile) next = withTile(next, pos, { ...tile, elevation });
  }
  return next;
}

function unitById(draft: BattleDraft, id: string): Unit {
  const unit = draft.unit(id);
  if (!unit) throw new Error(`missing unit ${id}`);
  return unit;
}

describe('AI height reach', () => {
  it('counts the bonus in bestReach when the unit stands higher than its target', () => {
    const { party, enemy, battle } = reachFixture();
    const partyPos = { x: 2, y: 3 };
    const enemyPos = { x: 9, y: 3 }; // air_blast range 6, +1 for the height bonus
    const units = [
      { ...party, pos: partyPos, abilities: ['air_blast'] },
      { ...enemy, pos: enemyPos, abilities: ['air_blast'] },
    ];
    const flat = withUnits(battle, units);
    const high = withUnits({ ...battle, grid: raised(battle.grid, [partyPos], 1) }, units);

    const flatDraft = new BattleDraft(CONTENT, flat, new RngCursor(1));
    const highDraft = new BattleDraft(CONTENT, high, new RngCursor(2));

    expect(bestReach(flatDraft, unitById(flatDraft, party.id))).toBe(6);
    expect(bestReach(highDraft, unitById(highDraft, party.id))).toBe(7);
  });

  it('counts the bonus in threatAt when the threatening enemy stands higher', () => {
    const { party, enemy, battle } = reachFixture();
    const enemyPos = { x: 2, y: 3 };
    // One tile past the reach the enemy would have from flat ground.
    const pos = { x: 2 + 6 + 1 + effectiveStats(CONTENT, enemy).maxMove, y: 3 };
    const units = [
      { ...party, pos: { x: 1, y: 1 }, abilities: ['air_blast'] },
      { ...enemy, pos: enemyPos, abilities: ['air_blast'] },
    ];
    const flat = withUnits(battle, units);
    const high = withUnits({ ...battle, grid: raised(battle.grid, [enemyPos], 1) }, units);

    const flatDraft = new BattleDraft(CONTENT, flat, new RngCursor(3));
    const highDraft = new BattleDraft(CONTENT, high, new RngCursor(4));

    expect(threatAt(flatDraft, unitById(flatDraft, party.id), pos)).toBe(0);
    expect(threatAt(highDraft, unitById(highDraft, party.id), pos)).toBeGreaterThan(0);
  });

  it("reports a size-2 opponent's raised second cell for the movement estimate", () => {
    const { party, enemy, battle } = reachFixture();
    const anchor = { x: 2, y: 3 };
    const secondCell = { x: anchor.x + 1, y: anchor.y };
    const airBlast = CONTENT.abilities.get('air_blast');
    if (!airBlast) throw new Error('missing air_blast fixture');
    // The raised second cell reaches one further than the flat anchor with the
    // height bonus, and can step `maxMove` first. The tile sits that one tile
    // past the anchor's reach plus its move, so only the second cell reaches it.
    const maxMove = effectiveStats(CONTENT, enemy).maxMove;
    const pos = {
      x: secondCell.x + airBlast.range + CONTENT.tuning.heightReachBonus + maxMove,
      y: anchor.y,
    };
    const heroUnit: Unit = { ...party, pos: { x: 1, y: 1 }, abilities: ['air_blast'] };
    const bossUnit: Unit = {
      ...enemy,
      size: 2 as const,
      pos: anchor,
      abilities: ['air_blast'],
    };
    const state = withUnits({ ...battle, grid: raised(battle.grid, [secondCell], 1) }, [
      heroUnit,
      bossUnit,
    ]);
    const draft = new BattleDraft(CONTENT, state, new RngCursor(6));
    const hero = unitById(draft, heroUnit.id);
    const boss = unitById(draft, bossUnit.id);

    const weather = weatherAt(CONTENT, draft.encounterId, draft.round);
    const damage = airBlast.effects
      .filter((e): e is Extract<typeof e, { kind: 'damage' }> => e.kind === 'damage')
      .reduce((sum, e) => sum + e.base + e.scale * effectiveStats(CONTENT, boss).power, 0);
    const threatFrom = (origin: Vec2) =>
      damage * (hitChance(CONTENT, draft.grid, boss, { ...hero, pos }, weather, origin) / 100);

    // The high second cell is the better firing position, so its hit chance is
    // the one that belongs in the estimate, not the low anchor's.
    expect(threatFrom(secondCell)).toBeGreaterThan(threatFrom(anchor));
    expect(threatAt(draft, hero, pos)).toBeCloseTo(threatFrom(secondCell), 6);
  });
});

describe('AI candidate targets', () => {
  it('enumerates every cell a size-2 opponent occupies', () => {
    const { party, enemy, battle } = reachFixture();
    const boss = { ...enemy, size: 2 as const, pos: { x: 10, y: 3 } };
    const state = withUnits(battle, [
      { ...party, pos: { x: 2, y: 3 }, abilities: ['air_blast'] },
      boss,
    ]);
    const draft = new BattleDraft(CONTENT, state, new RngCursor(5));
    const caster = unitById(draft, party.id);
    const shove = CONTENT.abilities.get('shove');
    const blast = CONTENT.abilities.get('fire_blast');
    if (!shove || !blast) throw new Error('missing candidate-target abilities');

    const single = new Set(candidateTargets(draft, caster, [shove]).map(posKey));
    expect(single.has(posKey({ x: 10, y: 3 }))).toBe(true);
    expect(single.has(posKey({ x: 11, y: 3 }))).toBe(true);

    // Area shapes also ring both cells, so a blast can land between them.
    const area = new Set(candidateTargets(draft, caster, [blast]).map(posKey));
    expect(area.has(posKey({ x: 11, y: 3 }))).toBe(true);
    expect(area.has(posKey({ x: 12, y: 4 }))).toBe(true);
  });
});
