import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { GameEvent, Unit } from '../types';
import { planAiTurn } from './ai';
import { pathCost, posKey, reachable, tileAt } from './grid';

function rootedGrumbler(): { draft: BattleDraft; boss: Unit } {
  const state = createGame(CONTENT, {
    seed: 'rooted-grumbler-movement',
    party: [
      { characterId: 'sura', level: 3 },
      { characterId: 'riko', level: 3 },
    ],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_grumbler', new RngCursor(state.rng));
  const boss = battle.units.find((unit) => unit.enemyId === 'grumbler');
  const sura = battle.units.find((unit) => unit.characterId === 'sura');
  const riko = battle.units.find((unit) => unit.characterId === 'riko');
  if (!boss || !sura || !riko) throw new Error('Missing Driller movement fixture');

  const units: Unit[] = battle.units.map((unit) => {
    if (unit.id === boss.id) {
      return {
        ...unit,
        ap: 5,
        move: 3,
        statuses: [{ id: 'rooted', duration: 1, stacks: 1 }],
        // Debris was the previous action. It is still cooling down on this
        // activation, which leaves Churn legal but Slam out of reach.
        cooldowns: { driller_debris: 1 },
      };
    }
    if (unit.id === sura.id) return { ...unit, pos: { x: 11, y: 5 } };
    if (unit.id === riko.id) return { ...unit, pos: { x: 1, y: 3 } };
    return unit;
  });

  const configuredBoss = units.find((unit) => unit.id === boss.id);
  if (!configuredBoss) throw new Error('Configured Driller was lost');
  const configured = { ...battle, units };
  return {
    draft: new BattleDraft(CONTENT, configured, new RngCursor(0x1234)),
    boss: configuredBoss,
  };
}

function eventsFor(events: readonly GameEvent[], type: GameEvent['type']): GameEvent[] {
  return events.filter((event) => event.type === type);
}

describe('AI movement status gates', () => {
  it('keeps a rooted boss in place while allowing a legal stationary ability', () => {
    const { draft, boss } = rootedGrumbler();

    planAiTurn(draft, boss.id, new RngCursor(0x5678));

    const after = draft.unit(boss.id);
    expect(after?.pos).toEqual({ x: 15, y: 5 });
    expect(after?.move).toBe(3);
    expect(eventsFor(draft.events, 'unitMoved')).toEqual([]);
    expect(
      eventsFor(draft.events, 'abilityUsed').map((event) =>
        event.type === 'abilityUsed' ? event.abilityId : null,
      ),
    ).toContain('driller_churn');
  });

  it('does not reposition a rooted unit when no ability is available', () => {
    const { draft, boss } = rootedGrumbler();
    draft.replace({ ...boss, abilities: [], ap: 0 });

    planAiTurn(draft, boss.id, new RngCursor(0x9abc));

    expect(draft.unit(boss.id)?.pos).toEqual({ x: 15, y: 5 });
    expect(eventsFor(draft.events, 'unitMoved')).toEqual([]);
  });
});

/**
 * `planAiTurn` enumerates moves with `reachable(draft.moveContext(unit), …)`
 * (`ai.ts`), so the climb rule reaches the AI through that one context. These
 * pin it on a shipped battlefield: in the Cutting's northwest bay the flat
 * ground at (4,2) meets the party's tier-1 ledge at (3,2).
 */
describe('AI movement over tiered ground', () => {
  function cuttingMover(): { draft: BattleDraft; mover: Unit } {
    const state = createGame(CONTENT, {
      seed: 'cutting-climb',
      party: [{ characterId: 'sura', level: 3 }],
      startNode: '',
    });
    const battle = createBattle(CONTENT, state, 'enc_ambush', new RngCursor(state.rng));
    const draft = new BattleDraft(CONTENT, battle, new RngCursor(0x5eed));
    const mover = draft.living().find((unit) => unit.characterId === 'sura');
    if (!mover) throw new Error('Missing the Cutting movement fixture');
    draft.replace({ ...mover, pos: FLAT, move: 1 });
    const moved = draft.living().find((unit) => unit.id === mover.id);
    if (!moved) throw new Error('Missing the Cutting mover');
    return { draft, mover: moved };
  }
  /** Flat tier-0 ground, with more flat ground east of it and the ledge west. */
  const FLAT = { x: 4, y: 2 };
  const BENCH = { x: 3, y: 2 };

  it('stands the fixture on the tiers it names', () => {
    const { draft, mover } = cuttingMover();
    const { grid } = draft.moveContext(mover);
    const tier = (pos: { x: number; y: number }) => tileAt(grid, pos)?.elevation;
    expect([tier(FLAT), tier({ x: 5, y: 2 }), tier(BENCH)]).toEqual([0, 0, 1]);
    expect(tileAt(grid, BENCH)?.blocked).toBe(false);
  });

  it('counts a climb against the move budget the AI searches with', () => {
    const { draft, mover } = cuttingMover();
    const ctx = draft.moveContext(mover);

    const onePoint = reachable(ctx, FLAT, 1);
    expect(onePoint.has(posKey({ x: 5, y: 2 }))).toBe(true);
    expect(onePoint.has(posKey(BENCH))).toBe(false);

    const twoPoints = reachable(ctx, FLAT, 2);
    expect(twoPoints.get(posKey(BENCH))?.cost).toBe(2);
    expect(pathCost(ctx, FLAT, [BENCH])).toBe(2);
  });

  /*
   * Since M5 no shipped map has a walkable 0-to-2 step — the Cutting's tier-2
   * slabs became blocked rock, which is what E4 climbing assumes — so the
   * corner is raised on this context's own copy of the grid: the ledge cell
   * north of the flat ground, lifted to a walkable tier 2. That keeps the test
   * on the climb rule rather than on the rock simply being blocked.
   */
  it('refuses the two-tier corner step the AI would otherwise consider', () => {
    const { draft, mover } = cuttingMover();
    const shipped = draft.moveContext(mover);
    const corner = { x: 4, y: 1 };
    const index = corner.y * shipped.grid.width + corner.x;
    const ledge = shipped.grid.tiles[index];
    if (!ledge || ledge.blocked || ledge.elevation !== 1) throw new Error('Expected a ledge');
    const tiles = [...shipped.grid.tiles];
    tiles[index] = { ...ledge, elevation: 2 };
    const ctx = { ...shipped, grid: { ...shipped.grid, tiles } };

    expect(pathCost(ctx, FLAT, [corner])).toBeNull();
    expect(reachable(ctx, FLAT, 2).has(posKey(corner))).toBe(false);
    // The same cell at its shipped tier is one ordinary climb away.
    expect(pathCost(shipped, FLAT, [corner])).toBe(2);
  });
});
