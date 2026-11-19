/**
 * Sparring bouts (ADR 0122): out of the bout, and the platform that tips.
 *
 * A test-only bout on the Forest Road board: its deep water (`W`, rows 10 and 11) stands in for the
 * water round a platform. The pivot is row 5 (`axis: 'y'`), so rows 0-4 are one half and rows 6-11
 * the other. Every unit is placed by hand, so each rule reads on its own. No story text.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { isValidTarget } from '../rules/abilities';
import { scoreAbility, weightsFor } from '../rules/ai';
import { forecastTip } from '../rules/bout';
import { objectiveHolder } from '../rules/objectives';
import { forecastReactions } from '../rules/reactions';
import { deserialize, serialize } from '../save/serialize';
import type { BattleState, ContentIndex, EncounterDef, GameState, Unit, Vec2 } from '../types';
import { BattleDraft } from './battleDraft';
import { createBattle, createGame } from './createGame';
import { advanceToNextTurn } from './turnFlow';

const BASE = CONTENT.encounters.get('enc_forest_road');
if (!BASE) throw new Error('The Forest Road encounter is missing');

function boutEncounter(overrides: Partial<EncounterDef> = {}): EncounterDef {
  return {
    ...BASE!,
    variants: [],
    reinforcements: [],
    bout: { outOn: ['water_deep'], tipping: { axis: 'y', pivot: 5 } },
    ...overrides,
  };
}

function contentWith(encounter: EncounterDef): ContentIndex {
  return { ...CONTENT, encounters: new Map(CONTENT.encounters).set(encounter.id, encounter) };
}

function gameState(content: ContentIndex): GameState {
  const seeded = createGame(content, {
    seed: 'sparring-bout',
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'riko', level: 2, autoChoose: true },
      { characterId: 'bo', level: 2, autoChoose: true },
    ],
    startNode: 'battle_forest_road',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(content, seeded, 'enc_forest_road', rng);
  return { ...seeded, screen: 'combat', rng: rng.state, battle };
}

/** The battle with each unit, in roster order, standing on the next of `cells`. */
function placed(content: ContentIndex, cells: readonly Vec2[]): BattleState {
  const battle = gameState(content).battle!;
  expect(battle.units).toHaveLength(cells.length);
  return { ...battle, units: battle.units.map((unit, i) => ({ ...unit, pos: cells[i]! })) };
}

/** `battle` with these units already teetering on the edge (ADR 0122 §2a). */
function teetering(battle: BattleState, ...indexes: number[]): BattleState {
  const ids = new Set(indexes.map((i) => battle.units[i]!.id));
  return {
    ...battle,
    units: battle.units.map((unit) =>
      ids.has(unit.id)
        ? {
            ...unit,
            statuses: [...unit.statuses, { id: 'teetering' as const, duration: 2, stacks: 1 }],
          }
        : unit,
    ),
  };
}

const isTeetering = (unit: Unit) => unit.statuses.some((s) => s.id === 'teetering');

const draftOf = (content: ContentIndex, battle: BattleState) =>
  new BattleDraft(content, battle, new RngCursor(0));

const byId = (battle: BattleState, id: string): Unit => {
  const unit = battle.units.find((u) => u.id === id);
  if (!unit) throw new Error(`missing ${id}`);
  return unit;
};

// Roster order: Kaya, Riko, Bo, then the Forest Road's worker and slinger. Bo and the worker
// stand on the pivot row, so they count for neither half.
const BO: Vec2 = { x: 10, y: 5 };
const WORKER: Vec2 = { x: 17, y: 5 };
const SLINGER: Vec2 = { x: 18, y: 3 };
const CALM: readonly Vec2[] = [{ x: 4, y: 9 }, { x: 8, y: 9 }, BO, WORKER, SLINGER];

describe('out of the bout (ADR 0122 §2)', () => {
  const content = contentWith(boutEncounter({ bout: { outOn: ['water_deep'] } }));

  it('a first shove toward the water leaves a fighter teetering on the edge, not in', () => {
    const battle = placed(content, CALM);
    const kaya = battle.units[0]!;
    const draft = draftOf(content, battle);
    draft.shove(kaya.id, { x: 4, y: 8 }, 2, 'push');
    const after = draft.toBattle();
    expect(byId(after, kaya.id)).toMatchObject({ pos: { x: 4, y: 9 }, hp: kaya.hp });
    expect(isTeetering(byId(after, kaya.id))).toBe(true);
    expect(after.boutOut).toBeUndefined();
  });

  it('a shove while teetering puts a fighter out at full HP', () => {
    const battle = teetering(placed(content, CALM), 0);
    const kaya = battle.units[0]!;
    expect(kaya.hp).toBe(kaya.base.maxHp);
    const draft = draftOf(content, battle);
    draft.shove(kaya.id, { x: 4, y: 8 }, 2, 'push');
    const after = draft.toBattle();
    expect(byId(after, kaya.id)).toMatchObject({ pos: { x: 4, y: 10 }, hp: 0 });
    expect(after.boutOut).toEqual([kaya.id]);
    expect(draft.events.map((e) => e.type)).toContain('unitDied');
  });

  it('outside a bout the same shove stops at the water’s edge', () => {
    const plain = contentWith(boutEncounter({ bout: undefined }));
    const battle = placed(plain, CALM);
    const kaya = battle.units[0]!;
    const draft = draftOf(plain, battle);
    draft.shove(kaya.id, { x: 4, y: 8 }, 2, 'push');
    expect(byId(draft.toBattle(), kaya.id)).toMatchObject({ pos: { x: 4, y: 9 } });
    expect(draft.toBattle().boutOut).toBeUndefined();
  });

  it('0 HP is out too, and nobody out can be helped up', () => {
    const battle = placed(content, [CALM[0]!, { x: 5, y: 9 }, BO, WORKER, SLINGER]);
    const [kaya, riko] = battle.units;
    const draft = draftOf(content, battle);
    draft.dealDamage(kaya!.id, 999, 'pure', null);
    const after = draft.toBattle();
    expect(after.boutOut).toEqual([kaya!.id]);
    const helpUp = CONTENT.abilities.get('help_up');
    if (!helpUp) throw new Error('help_up is missing');
    const check = isValidTarget(content, after, byId(after, riko!.id), helpUp, kaya!.pos);
    expect(check).toMatchObject({ ok: false, reason: expect.stringContaining('out of the bout') });
  });

  it('walking off the edge clears a teeter', () => {
    const battle = teetering(placed(content, CALM), 0);
    const kaya = battle.units[0]!;
    const draft = draftOf(content, battle);
    draft.cleanseFrom(kaya.id, ['teetering']);
    expect(isTeetering(byId(draft.toBattle(), kaya.id))).toBe(false);
  });

  it('the forecast says "teetering" first, then "out", and the AI prices them', () => {
    const fresh = placed(content, [{ x: 4, y: 8 }, { x: 4, y: 9 }, BO, WORKER, SLINGER]);
    const shoveAbility = CONTENT.abilities.get('shove');
    if (!shoveAbility) throw new Error('shove is missing');
    const [k0, r0] = fresh.units;
    const first = forecastReactions(content, fresh, k0!, shoveAbility, r0!.pos, [r0!.pos], k0!.pos);
    expect(first.shoves.find((s) => s.id === r0!.id)).toMatchObject({ teeters: true });
    expect(first.shoves.find((s) => s.id === r0!.id)?.out).toBeUndefined();
    const battle = teetering(fresh, 1);
    const [kaya, riko] = battle.units;
    const shove = CONTENT.abilities.get('shove');
    if (!shove) throw new Error('shove is missing');
    const forecast = forecastReactions(
      content,
      battle,
      kaya!,
      shove,
      riko!.pos,
      [riko!.pos],
      kaya!.pos,
    );
    expect(forecast.shoves.find((s) => s.id === riko!.id)?.out).toBe(true);
    // Riko is Kaya's friend: shoving her in costs far more than an ordinary shove scores.
    const draft = draftOf(content, battle);
    const score = scoreAbility(draft, kaya!, shove, riko!.pos, weightsFor('aggressive'), new Map());
    expect(score).toBeLessThan(-weightsFor('aggressive').kill);
  });
});

describe('the tipping platform (ADR 0122 §3)', () => {
  const content = contentWith(boutEncounter());

  it('slides the heavier half one cell toward its edge, into the water and out', () => {
    // Kaya and Riko below the pivot, already teetering; the slinger above it; Bo and the worker
    // on the pivot row.
    const battle = teetering(
      placed(content, [{ x: 4, y: 9 }, { x: 5, y: 9 }, BO, WORKER, SLINGER]),
      0,
      1,
    );
    const draft = draftOf(content, battle);
    draft.tipPlatform();
    const after = draft.toBattle();
    expect(byId(after, battle.units[0]!.id)).toMatchObject({ pos: { x: 4, y: 10 }, hp: 0 });
    expect(byId(after, battle.units[1]!.id)).toMatchObject({ pos: { x: 5, y: 10 }, hp: 0 });
    expect(after.boutOut).toHaveLength(2);
    // The lighter half and the pivot row stay where they were.
    expect(byId(after, battle.units[2]!.id).pos).toEqual(BO);
    expect(byId(after, battle.units[3]!.id).pos).toEqual(WORKER);
    expect(byId(after, battle.units[4]!.id).pos).toEqual(SLINGER);
  });

  it('moves a line together, the fighter nearest the edge first', () => {
    const battle = teetering(
      placed(content, [{ x: 4, y: 7 }, { x: 4, y: 8 }, { x: 4, y: 9 }, WORKER, SLINGER]),
      2,
    );
    const draft = draftOf(content, battle);
    draft.tipPlatform();
    const after = draft.toBattle();
    expect(after.units.map((u) => u.pos)).toEqual([
      { x: 4, y: 8 },
      { x: 4, y: 9 },
      { x: 4, y: 10 },
      WORKER,
      SLINGER,
    ]);
    expect(after.boutOut).toEqual([battle.units[2]!.id]);
  });

  it('a tip at the edge leaves a fighter teetering, not in the water', () => {
    const battle = placed(content, [{ x: 4, y: 9 }, { x: 5, y: 9 }, BO, WORKER, SLINGER]);
    const draft = draftOf(content, battle);
    draft.tipPlatform();
    const after = draft.toBattle();
    expect(after.boutOut).toBeUndefined();
    expect(after.units.slice(0, 2).every(isTeetering)).toBe(true);
  });

  it('does not tip when the halves are even, and ignores the pivot row', () => {
    // One fighter each side; three on the pivot row.
    const battle = placed(content, [{ x: 4, y: 9 }, { x: 4, y: 5 }, BO, WORKER, SLINGER]);
    expect(forecastTip(content, battle)).toEqual([]);
    const draft = draftOf(content, battle);
    draft.tipPlatform();
    expect(draft.toBattle().units.map((u) => u.pos)).toEqual(battle.units.map((u) => u.pos));
  });

  it('the board shows the round end’s own tip, and the round end makes it', () => {
    const battle = teetering(
      placed(content, [{ x: 4, y: 7 }, { x: 4, y: 8 }, { x: 4, y: 9 }, WORKER, SLINGER]),
      2,
    );
    const forecast = forecastTip(content, battle);
    expect(forecast.map((slide) => slide.to)).toEqual([
      { x: 4, y: 8 },
      { x: 4, y: 9 },
      { x: 4, y: 10 },
    ]);
    expect(forecast.map((slide) => slide.out)).toEqual([false, false, true]);
    // The last turn of the round ends: the platform tips before the next round starts.
    const draft = draftOf(content, { ...battle, turnIndex: battle.order.length - 1 });
    advanceToNextTurn(draft);
    const after = draft.toBattle();
    for (const slide of forecast) expect(byId(after, slide.unitId).pos).toEqual(slide.to);
  });

  it('a bout lost to the water ends the fight', () => {
    // Bo is already out; Kaya and Riko are teetering and go in; the enemies stay dry.
    const placedBattle = placed(content, [{ x: 4, y: 9 }, { x: 5, y: 9 }, BO, WORKER, SLINGER]);
    const bo = placedBattle.units[2]!;
    const battle: BattleState = {
      ...placedBattle,
      units: teetering(placedBattle, 0, 1).units.map((u) => (u.id === bo.id ? { ...u, hp: 0 } : u)),
      boutOut: [bo.id],
    };
    const draft = draftOf(content, { ...battle, turnIndex: battle.order.length - 1 });
    advanceToNextTurn(draft);
    expect(draft.phase).toBe('defeat');
  });
});

describe('a mid-bout save', () => {
  it('keeps who is out', () => {
    const content = contentWith(boutEncounter());
    const start = gameState(content);
    const battle = teetering(placed(content, CALM), 0);
    const draft = draftOf(content, battle);
    draft.shove(battle.units[0]!.id, { x: 4, y: 8 }, 1, 'push');
    const state: GameState = { ...start, battle: draft.toBattle() };
    const meta = {
      label: 'Slot 1',
      summary: 'Test save',
      savedAt: 1_700_000_000_000,
      session: { players: [{ name: 'P1', unitId: 'p0' }], soloPlay: false },
    };
    const loaded = deserialize(serialize(state, meta));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.blob.state.battle?.boutOut).toEqual([battle.units[0]!.id]);
  });
});

describe('holding a number of cells (ADR 0122 §5)', () => {
  it('needs minHeld distinct cells held at once', () => {
    const content = contentWith(boutEncounter({ bout: undefined }));
    const units = placed(content, CALM).units;
    const objective = {
      kind: 'holdAtRoundEnd' as const,
      cells: [CALM[0]!, CALM[1]!, { x: 2, y: 9 }],
      minHeld: 2,
      label: 'Placeholder objective',
    };
    expect(objectiveHolder(units, objective)).toBeDefined();
    const oneHeld = units.map((u, i) => (i === 1 ? { ...u, pos: { x: 12, y: 9 } } : u));
    expect(objectiveHolder(oneHeld, objective)).toBeUndefined();
    expect(objectiveHolder(oneHeld, { ...objective, minHeld: undefined })).toBeDefined();
  });
});
