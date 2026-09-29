import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, Unit, Vec2 } from '../types';
import { planAiTurn, previewAiPlan, scoreAbility, weightsFor } from './ai';
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

/** The cart, its neighbour and the caster, all on the same eastern run. */
const CART: Vec2 = { x: 3, y: 1 };
const CART_VICTIM: Vec2 = { x: 4, y: 1 };
const CART_CASTER: Vec2 = { x: 1, y: 1 };

/**
 * A cabbage cart on a two-tier plateau with a victim beside it (E-c). A damage
 * push like Shatterpoint breaks the cart and shoves the victim clear, then
 * shoves the same victim again — the case where a prop's fall and the ability's
 * fall both land on one unit.
 *
 * One seed for every board. `createBattle` draws the encounter variant from it
 * (`enc_forest_road` fields thugs, slingers or bruisers), and a different
 * variant means a different caster with different Power and Focus — which moves
 * the damage half of the score by more than the fall these tests measure. A
 * seed keyed on `ledge` put a slinger behind one board and a bruiser behind the
 * other, so `ledge - flat` was 2.295 of caster plus the drop instead of the
 * drop alone and read 1.235 where the fall is worth 2. The ledge has to be the
 * only difference between the two boards being subtracted.
 */
function cartFixture(options: { readonly ledge: boolean; readonly cart: boolean }): {
  readonly draft: BattleDraft;
  readonly caster: Unit;
} {
  const seeded = createGame(CONTENT, {
    seed: 'ai-cart-ledge',
    party: [
      { characterId: 'kaya', level: 3, autoChoose: true },
      { characterId: 'bo', level: 3, autoChoose: true },
    ],
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_forest_road', rng);
  const casterBase = battle.units.find((unit) => unit.faction === 'enemy');
  const victimBase = battle.units.find((unit) => unit.faction === 'party');
  if (!casterBase || !victimBase) throw new Error('missing cart fixture units');

  // Every tile sits a tier above the fall; only the eastern run drops away.
  const tiles = Array.from({ length: 8 * 3 }, () => ({ ...DEFAULT_TILE, elevation: 2 }));
  let grid: Grid = { width: 8, height: 3, tiles };
  if (options.ledge) {
    for (const [x, elevation] of [
      [5, 1],
      [6, 1],
      [7, 0],
    ] as const) {
      const tile = tileAt(grid, { x, y: CART_VICTIM.y });
      if (!tile) throw new Error('cart ledge fixture is off the grid');
      grid = withTile(grid, { x, y: CART_VICTIM.y }, { ...tile, elevation });
    }
  }

  const caster: Unit = {
    ...casterBase,
    ai: 'aggressive',
    pos: CART_CASTER,
    abilities: ['shatterpoint'],
    cooldowns: {},
    ap: 6,
    move: 0,
  };
  const victim: Unit = { ...victimBase, pos: CART_VICTIM };
  const units = [victim, caster];

  const draft = new BattleDraft(
    CONTENT,
    {
      ...battle,
      grid,
      units,
      order: units.map((unit) => unit.id),
      turnIndex: 0,
      props: [],
    },
    new RngCursor(0xca27),
  );
  if (options.cart) draft.placeProp('cabbage_cart', CART);
  return { draft, caster };
}

/** Shatterpoint aimed at the cart tile, priced by the AI's own scorer. */
function priceCartAim(options: { readonly ledge: boolean; readonly cart: boolean }): number {
  const { draft, caster } = cartFixture(options);
  const shatterpoint = CONTENT.abilities.get('shatterpoint');
  if (!shatterpoint) throw new Error('shatterpoint is missing from content');
  return scoreAbility(
    draft,
    caster,
    shatterpoint,
    CART,
    weightsFor('aggressive'),
    new Map<string, readonly Unit[]>(),
  );
}

describe('the AI, the cabbage cart and the ledge', () => {
  it('prices a cart-thrown victim’s fall once, not twice', () => {
    const shatterpoint = CONTENT.abilities.get('shatterpoint');
    if (!shatterpoint) throw new Error('shatterpoint is missing from content');
    const drop = CONTENT.tuning.ledgeDropDamage;

    const ledge = priceCartAim({ ledge: true, cart: true });
    const flat = priceCartAim({ ledge: false, cart: true });

    // The victim falls twice — once clear of the cart, once off the push — and
    // each fall is paid for once, at full weight. Neither is scaled by the
    // attack's hit chance: `resolveAbility` applies a push to every struck unit
    // whatever the to-hit roll does (only the damage and status effects read
    // it), and the cart's break push happens whenever the cart breaks. So two
    // drops, not one and a fraction of the second. Charging the cart's fall to
    // the push as well added a third.
    expect(ledge - flat).toBeCloseTo((2 * drop) / shatterpoint.apCost, 5);
  });

  it('prices a plain push at a single fall, unchanged', () => {
    const shatterpoint = CONTENT.abilities.get('shatterpoint');
    if (!shatterpoint) throw new Error('shatterpoint is missing from content');
    const drop = CONTENT.tuning.ledgeDropDamage;

    const ledge = priceCartAim({ ledge: true, cart: false });
    const flat = priceCartAim({ ledge: false, cart: false });

    expect(ledge - flat).toBeCloseTo(drop / shatterpoint.apCost, 5);
  });
});
