import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, Unit, Vec2 } from '../types';
import { planAiTurn, previewAiPlan } from './ai';
import { DEFAULT_TILE, tileAt, withTile } from './grid';

/**
 * The AI and ledge drops (E5).
 *
 * A unit shoved or pulled off a tier takes `tuning.ledgeDropDamage` per tier,
 * never below 1 HP. That damage used to be invisible to the scorer, which paid
 * a flat 2 for every shove whether the target landed on bare ground or over a
 * cliff. These tests pin the value to the same `shoveUnitForecast` the confirm
 * preview reads, so the AI's price cannot drift from the promise on screen.
 */

const CASTER: Vec2 = { x: 1, y: 1 };
/** Raised one tier; the only place a shove can send anybody over an edge. */
const LEDGE: Vec2 = { x: 2, y: 1 };
/** Where the pushed unit lands: one tier down, no ramp. */
const LANDING: Vec2 = { x: 3, y: 1 };
/** A second target pushed across flat ground for comparison. */
const FLAT: Vec2 = { x: 1, y: 2 };

/** A flat board with the one-tile platform the ledge sits on. */
function platformGrid(): Grid {
  const tiles = Array.from({ length: 5 * 5 }, () => DEFAULT_TILE);
  const base: Grid = { width: 5, height: 5, tiles };
  const raised = tileAt(base, LEDGE);
  if (!raised) throw new Error('missing ledge fixture tile');
  return withTile(base, LEDGE, { ...raised, elevation: 1 });
}

interface Fixture {
  readonly draft: BattleDraft;
  readonly casterId: string;
  readonly ledgeId: string;
  readonly flatId: string | null;
}

/**
 * One enemy with Shove and one or two party targets. The ledge target can be
 * set to its last hit point to prove the fall is worth nothing there.
 */
function fixture(options: { readonly includeFlat: boolean; readonly ledgeHp?: number }): Fixture {
  const seeded = createGame(CONTENT, {
    seed: `ai-ledge-${options.includeFlat}-${options.ledgeHp ?? 'full'}`,
    party: [
      { characterId: 'kaya', level: 3, autoChoose: true },
      { characterId: 'bo', level: 3, autoChoose: true },
    ],
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_forest_road', rng);
  const enemyBase = battle.units.find((unit) => unit.faction === 'enemy');
  const targets = battle.units.filter((unit) => unit.faction === 'party');
  const first = targets[0];
  const second = targets[1];
  if (!enemyBase || !first || !second) throw new Error('missing ledge fixture units');

  const caster: Unit = {
    ...enemyBase,
    ai: 'aggressive',
    pos: CASTER,
    abilities: ['shove'],
    cooldowns: {},
    ap: 1,
    move: 0,
  };
  const ledge: Unit = { ...first, pos: LEDGE, hp: options.ledgeHp ?? first.hp };
  const flat: Unit = { ...second, pos: FLAT };
  const units = options.includeFlat ? [flat, ledge, caster] : [ledge, caster];

  return {
    draft: new BattleDraft(
      CONTENT,
      {
        ...battle,
        grid: platformGrid(),
        units,
        order: units.map((unit) => unit.id),
        turnIndex: 0,
        props: [],
      },
      new RngCursor(0x1ed),
    ),
    casterId: caster.id,
    ledgeId: ledge.id,
    flatId: options.includeFlat ? flat.id : null,
  };
}

describe('the AI and ledges', () => {
  it('shoves the target over the edge instead of taking the flat shove', () => {
    const { draft, casterId } = fixture({ includeFlat: true });
    const plan = previewAiPlan(draft, casterId);

    expect(plan).not.toBeNull();
    expect(plan?.ability.id).toBe('shove');
    expect(plan?.target).toEqual(LEDGE);
  });

  it('settles the shove off the ledge for the drop damage', () => {
    const { draft, casterId, ledgeId } = fixture({ includeFlat: false });
    const before = draft.unit(ledgeId);
    if (!before) throw new Error('missing ledge target');

    planAiTurn(draft, casterId, new RngCursor(0x11));

    const after = draft.unit(ledgeId);
    expect(after?.pos).toEqual(LANDING);
    expect(before.hp - (after?.hp ?? 0)).toBe(CONTENT.tuning.ledgeDropDamage);
  });

  it('prices the drop into the shove, and a 1-HP fall at nothing', () => {
    const full = fixture({ includeFlat: false });
    const fullPlan = previewAiPlan(full.draft, full.casterId);
    const drop = CONTENT.tuning.ledgeDropDamage;
    // 2 for the shove itself, plus the tier drop at the unit's damage weight.
    expect(fullPlan?.score).toBe(2 + drop);

    const floor = fixture({ includeFlat: false, ledgeHp: 1 });
    const floorPlan = previewAiPlan(floor.draft, floor.casterId);
    // No extra: the forecast reports zero HP lost at the floor, so the AI pays
    // only the flat shove value.
    expect(floorPlan?.score).toBe(2);
  });

  it('never drops a target below its last hit point when it is shoved off', () => {
    const { draft, casterId, ledgeId } = fixture({ includeFlat: false, ledgeHp: 1 });
    planAiTurn(draft, casterId, new RngCursor(0x11));

    const after = draft.unit(ledgeId);
    expect(after).toBeDefined();
    expect(after?.hp).toBe(1);
    expect(after?.pos).toEqual(LANDING);
  });
});
