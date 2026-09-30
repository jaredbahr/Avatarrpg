import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Ability, Grid, Unit, Vec2 } from '../types';
import { ledgeExposure, planAiTurn, previewAiPlan, scoreAbility, weightsFor } from './ai';
import { resolveAbility } from './abilities';
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
/** A caster south of the cart, so a shove sends the cart north, clear of the victim. */
const CART_SOUTH: Vec2 = { x: 3, y: 2 };
/** Where that shove leaves the cart: one tile north, still intact. */
const CART_NORTH: Vec2 = { x: 3, y: 0 };

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
function cartFixture(options: {
  readonly ledge: boolean;
  readonly cart: boolean;
  readonly caster?: Vec2;
  readonly abilities?: readonly string[];
}): {
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
    pos: options.caster ?? CART_CASTER,
    abilities: options.abilities ?? ['shatterpoint'],
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

  it('prices no fall for the shove that only slides an intact cart', () => {
    const shove = CONTENT.abilities.get('shove');
    if (!shove) throw new Error('shove is missing from content');
    const weights = weightsFor('aggressive');
    const walls = new Map<string, readonly Unit[]>();
    const price = (board: ReturnType<typeof cartFixture>): number =>
      scoreAbility(board.draft, board.caster, shove, CART, weights, walls);

    // A caster south of the cart, armed only with Shove: the shove slides the
    // cart north into a free tile while the victim stays beside its old cell.
    const shover = { caster: CART_SOUTH, abilities: ['shove'] };
    // One seed and one board shape; only the tier past the victim differs.
    // Shoving a prop slides it and never breaks it, so there is no cabbage burst
    // and no fall to price: the two aims must cost exactly the same.
    const ledge = cartFixture({ ledge: true, cart: true, ...shover });
    const flat = cartFixture({ ledge: false, cart: true, ...shover });
    expect(price(ledge)).toBe(price(flat));
    // And with no unit struck either, the aim is worth nothing at all.
    expect(price(ledge)).toBe(-Infinity);

    // The board is the scenario, not a shove the victim blocks: Shove really
    // does move the cart a tile north, and the cart survives it.
    const before = ledge.draft.propAt(CART);
    if (!before) throw new Error('missing cart fixture');
    resolveAbility(ledge.draft, ledge.caster, shove, CART, new RngCursor(0x5a0e));
    expect(ledge.draft.propAt(CART)).toBeUndefined();
    const moved = ledge.draft.propAt(CART_NORTH);
    expect(moved?.propId).toBe('cabbage_cart');
    expect(moved?.hp).toBe(before.hp);
  });
});

/** The party caster: west of the blast, outside its own area. */
const FRIENDLY_CASTER: Vec2 = { x: 0, y: 2 };
/** The blast centre: an empty tile with one victim either side of it. */
const FRIENDLY_AIM: Vec2 = { x: 2, y: 2 };
/** The ally, inside the blast; a shove away from its centre sends it south. */
const ALLY_LIP: Vec2 = { x: 2, y: 3 };
/** The enemy, inside the blast; a shove away from its centre sends it north. */
const FOE_LIP: Vec2 = { x: 2, y: 1 };
/** The ally's landing tile: the tier the ledge board removes. */
const ALLY_LANDING: Vec2 = { x: 2, y: 4 };

/**
 * A party caster, one party ally and one enemy, each victim standing on a
 * one-tier lip either side of the blast centre. Shatterpoint pushes them apart,
 * so both fall. One seed for both boards and only the ally's landing tile
 * differs, which is what lets the subtraction below isolate the ally's fall:
 * the enemy falls in both, the way an area shove that catches both sides does.
 */
function friendlyFallFixture(options: { readonly ledge: boolean }): {
  readonly draft: BattleDraft;
  readonly caster: Unit;
} {
  const seeded = createGame(CONTENT, {
    seed: 'ai-ledge-friendly',
    party: [
      { characterId: 'kaya', level: 3, autoChoose: true },
      { characterId: 'bo', level: 3, autoChoose: true },
    ],
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_forest_road', rng);
  const party = battle.units.filter((unit) => unit.faction === 'party');
  const casterBase = party[0];
  const allyBase = party[1];
  const foeBase = battle.units.find((unit) => unit.faction === 'enemy');
  if (!casterBase || !allyBase || !foeBase) throw new Error('missing friendly fall units');

  let grid: Grid = {
    width: 5,
    height: 5,
    tiles: Array.from({ length: 5 * 5 }, () => DEFAULT_TILE),
  };
  const raise = (pos: Vec2, elevation: number) => {
    const tile = tileAt(grid, pos);
    if (!tile) throw new Error('friendly fall fixture is off the grid');
    grid = withTile(grid, pos, { ...tile, elevation });
  };
  raise(ALLY_LIP, 1);
  raise(FOE_LIP, 1);
  if (!options.ledge) raise(ALLY_LANDING, 1);

  const caster: Unit = {
    ...casterBase,
    ai: 'aggressive',
    pos: FRIENDLY_CASTER,
    abilities: ['shatterpoint'],
    cooldowns: {},
    ap: 3,
    move: 0,
  };
  const ally: Unit = { ...allyBase, pos: ALLY_LIP };
  const foe: Unit = { ...foeBase, pos: FOE_LIP };
  const units = [ally, foe, caster];

  return {
    draft: new BattleDraft(
      CONTENT,
      {
        ...battle,
        grid,
        units,
        order: units.map((unit) => unit.id),
        turnIndex: 0,
        props: [],
      },
      new RngCursor(0xf1e5),
    ),
    caster,
  };
}

/** Shatterpoint centred between the ally and the enemy, priced by the AI. */
function priceFriendlyFall(options: { readonly ledge: boolean }): number {
  const { draft, caster } = friendlyFallFixture(options);
  const shatterpoint = CONTENT.abilities.get('shatterpoint');
  if (!shatterpoint) throw new Error('shatterpoint is missing from content');
  return scoreAbility(
    draft,
    caster,
    shatterpoint,
    FRIENDLY_AIM,
    weightsFor('aggressive'),
    new Map<string, readonly Unit[]>(),
  );
}

describe('the AI and a friendly fall', () => {
  it('charges an ally’s drop at the friendly-fire weight, not nothing', () => {
    const shatterpoint = CONTENT.abilities.get('shatterpoint');
    if (!shatterpoint) throw new Error('shatterpoint is missing from content');
    const weights = weightsFor('aggressive');
    const drop = CONTENT.tuning.ledgeDropDamage;

    const ledge = priceFriendlyFall({ ledge: true });
    const flat = priceFriendlyFall({ ledge: false });

    // The enemy is thrown off in both boards, so it cancels. The ally's fall
    // exists only on the ledge board and is charged like any other friendly
    // damage. The push's early exit used to drop it entirely, which priced the
    // two boards equal — as though only the enemy had fallen.
    expect(ledge - flat).toBeCloseTo(-(drop * weights.friendlyFire) / shatterpoint.apCost, 5);
  });
});

/** The lip the exposed unit stands on. */
const EXPOSURE_LIP: Vec2 = { x: 2, y: 2 };
/** Neighbours kept level with the lip, so it drops east and nowhere else. */
const EXPOSURE_LEVEL: readonly Vec2[] = [
  { x: 2, y: 1 },
  { x: 2, y: 3 },
  { x: 1, y: 2 },
];
/** North of the lip: a push travels south, away from the eastern edge. */
const EXPOSURE_NORTH: Vec2 = { x: 2, y: 1 };
/** West of the lip: the same push now runs straight over the edge. */
const EXPOSURE_WEST: Vec2 = { x: 1, y: 2 };
/** On the far corner: a push travels diagonally, off the corner drop. */
const EXPOSURE_SOUTH_WEST: Vec2 = { x: 1, y: 3 };

/**
 * One party unit on a lip whose only fall is east, and one enemy that knows
 * Shove, standing wherever the caller puts it. Every other neighbour of the lip
 * is level, so the shove direction is the only thing that decides whether the
 * edge is a threat.
 */
function exposureFixture(shoverAt: Vec2): { readonly draft: BattleDraft; readonly hero: Unit } {
  const seeded = createGame(CONTENT, {
    seed: 'ai-ledge-exposure',
    party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_forest_road', rng);
  const heroBase = battle.units.find((unit) => unit.faction === 'party');
  const shoverBase = battle.units.find((unit) => unit.faction === 'enemy');
  if (!heroBase || !shoverBase) throw new Error('missing exposure fixture units');

  let grid: Grid = {
    width: 5,
    height: 5,
    tiles: Array.from({ length: 5 * 5 }, () => DEFAULT_TILE),
  };
  for (const pos of [EXPOSURE_LIP, ...EXPOSURE_LEVEL]) {
    const tile = tileAt(grid, pos);
    if (!tile) throw new Error('exposure fixture is off the grid');
    grid = withTile(grid, pos, { ...tile, elevation: 1 });
  }

  const hero: Unit = { ...heroBase, pos: EXPOSURE_LIP };
  const shover: Unit = {
    ...shoverBase,
    ai: 'aggressive',
    pos: shoverAt,
    abilities: ['shove'],
    cooldowns: {},
    ap: 1,
    move: 0,
  };
  const units = [hero, shover];

  return {
    draft: new BattleDraft(
      CONTENT,
      {
        ...battle,
        grid,
        units,
        order: units.map((unit) => unit.id),
        turnIndex: 0,
        props: [],
      },
      new RngCursor(0x1ed),
    ),
    hero,
  };
}

describe('the AI and ledge exposure', () => {
  it('counts the lip only when the shove’s own trajectory runs off it', () => {
    const exposure = (shover: Vec2): number => {
      const { draft, hero } = exposureFixture(shover);
      return ledgeExposure(draft, hero, EXPOSURE_LIP);
    };
    // The flat lip penalty; nothing else reads it, so it is not exported.
    const risk = 3;

    // Enemy north, drop east: the push travels south, off the level side, and
    // cannot turn the edge into a fall. The board-wide check used to call this
    // exposed because *an* edge existed somewhere.
    expect(exposure(EXPOSURE_NORTH)).toBe(0);
    // Enemy west: the shove now runs straight over the drop.
    expect(exposure(EXPOSURE_WEST)).toBe(risk);
    // A diagonal shover pushes diagonally, so the corner drop counts as well.
    expect(exposure(EXPOSURE_SOUTH_WEST)).toBe(risk);
  });
});

/**
 * A cone shove in the Driller's slam shape — one tile of knockback out of a
 * wedge — but with the range a size-2 caster needs for its raised second cell
 * to out-reach its anchor by one tier.
 */
const CONE_SLAM: Ability = {
  id: 'test_cone_slam',
  name: 'Test cone slam',
  element: 'earth',
  apCost: 1,
  cooldown: 0,
  range: 3,
  minRange: 0,
  requiresLineOfSight: true,
  targeting: { shape: 'cone', length: 3 },
  effects: [{ kind: 'push', distance: 1 }],
  tags: ['attack', 'control'],
  description: '',
  flavor: '',
  fx: 'fx.none',
};

/** The size-2 caster's anchor: its first occupied cell, on the low tier. */
const CONE_ANCHOR: Vec2 = { x: 2, y: 2 };
/** Its second occupied cell, one tier up: the only cell that can reach the aim. */
const CONE_SECOND: Vec2 = { x: CONE_ANCHOR.x + 1, y: CONE_ANCHOR.y };
/** The victim, straight ahead of the second cell and inside the wedge. */
const CONE_VICTIM: Vec2 = { x: CONE_SECOND.x, y: CONE_SECOND.y + 1 };
/** One tile past the anchor's reach and inside the second cell's height reach. */
const CONE_AIM: Vec2 = { x: CONE_SECOND.x, y: CONE_ANCHOR.y + 4 };
/** Where a shove measured from the second cell sends the victim: one tier down. */
const CONE_LANDING: Vec2 = { x: CONE_SECOND.x, y: CONE_VICTIM.y + 1 };
/** Where a shove measured from the anchor would send it: level, no fall. */
const CONE_ANCHOR_LANDING: Vec2 = { x: CONE_SECOND.x + 1, y: CONE_VICTIM.y + 1 };

/**
 * A boss-sized caster and one victim in front of its raised second cell. The
 * aim sits one tile past the anchor's reach and inside the second cell's, so
 * `validatingOrigin` names the second cell the firing cell. Only the victim's
 * landing tier differs between the compared boards.
 */
function coneOriginFixture(options: { readonly ledge: boolean }): {
  readonly draft: BattleDraft;
  readonly caster: Unit;
} {
  const seeded = createGame(CONTENT, {
    seed: 'ai-cone-origin',
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
  if (!casterBase || !victimBase) throw new Error('missing cone-origin fixture units');

  let grid: Grid = {
    width: 8,
    height: 8,
    tiles: Array.from({ length: 8 * 8 }, () => DEFAULT_TILE),
  };
  const setElevation = (pos: Vec2, elevation: number) => {
    const tile = tileAt(grid, pos);
    if (!tile) throw new Error('cone-origin fixture is off the grid');
    grid = withTile(grid, pos, { ...tile, elevation });
  };
  // The second cell stands a tier above the aim, so it reaches one further.
  setElevation(CONE_SECOND, 1);
  // The victim stands on a lip; its fall is the only difference between boards.
  setElevation(CONE_VICTIM, 1);
  setElevation(CONE_LANDING, options.ledge ? 0 : 1);
  setElevation(CONE_ANCHOR_LANDING, 1);

  const caster: Unit = {
    ...casterBase,
    ai: 'aggressive',
    size: 2,
    pos: CONE_ANCHOR,
    abilities: [CONE_SLAM.id],
    cooldowns: {},
    ap: 1,
    move: 0,
  };
  const victim: Unit = { ...victimBase, pos: CONE_VICTIM };
  const units = [victim, caster];

  return {
    draft: new BattleDraft(
      CONTENT,
      {
        ...battle,
        grid,
        units,
        order: units.map((unit) => unit.id),
        turnIndex: 0,
        props: [],
      },
      new RngCursor(0xc04e),
    ),
    caster,
  };
}

/** The cone aim priced by the AI's own scorer. */
function priceConeOrigin(options: { readonly ledge: boolean }): number {
  const { draft, caster } = coneOriginFixture(options);
  return scoreAbility(
    draft,
    caster,
    CONE_SLAM,
    CONE_AIM,
    weightsFor('aggressive'),
    new Map<string, readonly Unit[]>(),
  );
}

describe('the AI and a size-2 caster’s shove origin', () => {
  it('measures the cone shove from the firing cell, not the anchor', () => {
    const drop = CONTENT.tuning.ledgeDropDamage;

    const ledge = priceConeOrigin({ ledge: true });
    const flat = priceConeOrigin({ ledge: false });

    // Flat ground: the shove alone, at the aggressive profile's damage weight.
    expect(flat).toBeCloseTo(2, 5);
    expect(ledge).toBeCloseTo(2 + drop, 5);
    // The victim is shoved straight ahead of the second cell and falls a tier.
    // Measured from the anchor instead, the same shove travels diagonally onto
    // the level tile beside it, so a forecast that falls back to `caster.pos`
    // prices no fall at all and this difference vanishes.
    expect(ledge - flat).toBeCloseTo(drop, 5);
  });
});
