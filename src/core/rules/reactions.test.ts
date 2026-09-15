import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { COMBOS } from '../../content/combos';
import { RngCursor, seedFromString } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import { BattleDraft } from '../state/battleDraft';
import { affectedTiles, previewAbility, resolveAbility } from './abilities';
import { forecastReactions } from './reactions';
import { posKey, tileAt, withSurface } from './grid';
import type {
  Ability,
  AbilityEffect,
  BattleState,
  DamageType,
  Grid,
  SurfaceId,
  Unit,
  Vec2,
} from '../types';

/**
 * The forecast exists so the confirm step can stop lying about terrain. A
 * forecast that drifts from the resolver is worse than no forecast at all, so
 * the central assertion here is not "the forecast says something sensible" but
 * "the forecast says exactly what the resolver then does", checked against
 * every rule in the combo table rather than a hand-picked few.
 */

const DAMAGE_TYPES = new Set<string>([
  'fire',
  'water',
  'earth',
  'air',
  'lightning',
  'cold',
  'physical',
  'pure',
]);

/** A horizontal run of open tiles, found rather than hardcoded so a map edit
 *  does not silently turn these tests into assertions about walls. */
function openRun(grid: Grid, length: number): Vec2[] {
  for (let y = 0; y < grid.height; y++) {
    let run: Vec2[] = [];
    for (let x = 0; x < grid.width; x++) {
      const pos = { x, y };
      const tile = tileAt(grid, pos);
      if (!tile || tile.blocked) {
        run = [];
        continue;
      }
      run.push(pos);
      if (run.length === length) return run;
    }
  }
  throw new Error(`No open run of ${length} tiles on this map`);
}

interface Scene {
  readonly battle: BattleState;
  readonly caster: Unit;
  readonly victim: Unit;
  readonly run: Vec2[];
}

/**
 * Two units on an open stretch of the forest road, with whatever surfaces the
 * test wants underfoot. Built from real content so the units have real stats.
 */
function scene(paint: { pos: Vec2; id: SurfaceId; duration?: number }[] = []): Scene {
  const seeded = createGame(CONTENT, {
    seed: 'reactions',
    party: [
      { characterId: 'kaya', level: 5, autoChoose: true },
      { characterId: 'bo', level: 5, autoChoose: true },
    ],
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  const base = createBattle(CONTENT, seeded, 'enc_forest_road', rng);

  const run = openRun(base.grid, 7);
  const casterAt = run[0];
  const victimAt = run[3];
  if (!casterAt || !victimAt) throw new Error('open run too short');

  const party = base.units.filter((u) => u.faction === 'party');
  const enemies = base.units.filter((u) => u.faction === 'enemy');
  const first = party[0];
  const second = enemies[0] ?? party[1];
  if (!first || !second) throw new Error('fixture needs two units');

  // One unit per side, placed where the test wants them, and nobody else on
  // the field to wander into a blast.
  const caster: Unit = { ...first, pos: casterAt, size: 1 };
  const victim: Unit = { ...second, pos: victimAt, size: 1 };

  let grid = base.grid;
  for (const spot of paint) {
    grid = withSurface(grid, spot.pos, {
      id: spot.id,
      duration: spot.duration ?? 4,
      spread: 0,
    });
  }

  return {
    battle: {
      ...base,
      grid,
      units: [caster, victim],
      order: [caster.id, victim.id],
      turnIndex: 0,
    },
    caster,
    victim,
    run,
  };
}

/** A throwaway ability that applies exactly one thing to the ground. */
function applier(applied: DamageType | SurfaceId): Ability {
  const effect: AbilityEffect = DAMAGE_TYPES.has(applied)
    ? { kind: 'damage', base: 1, scale: 0, damageType: applied as DamageType }
    : { kind: 'surface', surface: applied as SurfaceId, duration: 3, area: 'center' };

  return {
    id: `test_apply_${applied}`,
    name: `Test ${applied}`,
    element: 'fire',
    apCost: 1,
    cooldown: 0,
    range: 9,
    minRange: 0,
    requiresLineOfSight: false,
    targeting: { shape: 'tile' },
    effects: [effect],
    tags: [],
    description: '',
    flavor: '',
    fx: 'fx.fire.jab',
  };
}

/** The surfaceChanged events the real resolver emits for this shot. */
function resolvedChanges(battle: BattleState, caster: Unit, ability: Ability, target: Vec2) {
  const draft = new BattleDraft(CONTENT, battle, new RngCursor(seedFromString('resolve')));
  const live = draft.unit(caster.id);
  if (!live) throw new Error('caster missing from draft');
  resolveAbility(draft, live, ability, target, draft.rng);
  return draft.events
    .filter((e): e is Extract<typeof e, { type: 'surfaceChanged' }> => e.type === 'surfaceChanged')
    .map((e) => ({ from: e.from, to: e.to, label: e.label }));
}

function forecastChanges(battle: BattleState, caster: Unit, ability: Ability, target: Vec2) {
  const tiles = affectedTiles(battle.grid, caster, ability, target);
  const forecast = forecastReactions(CONTENT, battle, caster, ability, target, tiles);
  return forecast.entries.flatMap((entry) =>
    // One entry stands for every tile it changed, which is how the resolver
    // emits them too.
    Array.from({ length: entry.tiles }, () => ({
      from: entry.from,
      to: entry.to,
      label: entry.label,
    })),
  );
}

function sorted(rows: { from: unknown; to: unknown; label: string }[]) {
  return [...rows].map((r) => `${String(r.from)}>${String(r.to)}:${r.label}`).sort();
}

describe('reaction forecast', () => {
  it('has rules to check', () => {
    expect(COMBOS.length).toBeGreaterThan(0);
  });

  it.each(COMBOS.map((rule) => [rule.id, rule] as const))(
    'forecasts what the resolver actually does: %s',
    (_id, rule) => {
      const fixture = scene();
      const target = fixture.run[3];
      if (!target) throw new Error('no target tile');

      const seededScene =
        rule.existing === null ? fixture : scene([{ pos: target, id: rule.existing }]);

      const ability = applier(rule.applied);

      const predicted = forecastChanges(seededScene.battle, seededScene.caster, ability, target);
      const actual = resolvedChanges(seededScene.battle, seededScene.caster, ability, target);

      // Two empty lists are equal and prove nothing. Every rule in the table
      // is reachable by construction here, so both sides must be non-empty.
      expect(predicted.length, `${rule.id} forecast nothing`).toBeGreaterThan(0);
      expect(sorted(predicted)).toEqual(sorted(actual));
    },
  );

  it.each(COMBOS.filter((r) => r.existing !== null).map((rule) => [rule.id, rule] as const))(
    'names the rule that fired: %s',
    (_id, rule) => {
      const fixture = scene();
      const target = fixture.run[3];
      if (!target || rule.existing === null) throw new Error('bad fixture');

      const seededScene = scene([{ pos: target, id: rule.existing }]);
      const ability = applier(rule.applied);
      const tiles = affectedTiles(seededScene.battle.grid, seededScene.caster, ability, target);
      const forecast = forecastReactions(
        CONTENT,
        seededScene.battle,
        seededScene.caster,
        ability,
        target,
        tiles,
      );

      const entry = forecast.entries.find((e) => e.comboId === rule.id);
      expect(entry, `no forecast entry for ${rule.id}`).toBeDefined();
      expect(entry?.kind).toBe('reaction');
      expect(entry?.to).toBe(rule.result);
      expect(entry?.from).toBe(rule.existing);
      expect(entry?.label).toBe(rule.label);
      expect(entry?.spreads).toBe(rule.spread > 0);
    },
  );
});

describe('the reactions the README promises', () => {
  it('warns that fire on oil spreads, rather than saying "leaves fire"', () => {
    const fixture = scene();
    const target = fixture.run[3];
    if (!target) throw new Error('no target');

    const oiled = scene([{ pos: target, id: 'oil' }]);
    const ability = applier('fire');
    const tiles = affectedTiles(oiled.battle.grid, oiled.caster, ability, target);
    const forecast = forecastReactions(CONTENT, oiled.battle, oiled.caster, ability, target, tiles);

    const entry = forecast.entries[0];
    expect(entry?.comboId).toBe('fire-into-oil');
    expect(entry?.to).toBe('fire');
    expect(entry?.spreads).toBe(true);
  });

  it('says steam, not fire, when a fireball lands in water', () => {
    const fixture = scene();
    const target = fixture.run[3];
    if (!target) throw new Error('no target');

    const wet = scene([{ pos: target, id: 'water' }]);
    const ability = applier('fire');
    const tiles = affectedTiles(wet.battle.grid, wet.caster, ability, target);
    const forecast = forecastReactions(CONTENT, wet.battle, wet.caster, ability, target, tiles);

    expect(forecast.entries[0]?.to).toBe('steam');
  });

  it('counts the puddle a bolt of lightning will race through', () => {
    const fixture = scene();
    const puddle = fixture.run.slice(1, 6).map((pos) => ({ pos, id: 'water' as const }));
    const flooded = scene(puddle);
    const target = fixture.run[3];
    if (!target) throw new Error('no target');

    const ability = applier('lightning');
    const tiles = affectedTiles(flooded.battle.grid, flooded.caster, ability, target);
    const forecast = forecastReactions(
      CONTENT,
      flooded.battle,
      flooded.caster,
      ability,
      target,
      tiles,
    );

    const entry = forecast.entries.find((e) => e.comboId === 'lightning-into-water');
    expect(entry).toBeDefined();
    // The bolt reaches tiles the ability itself never touched. That reach is
    // the whole warning.
    expect(entry?.chainTiles).toBeGreaterThan(0);
    // The victim is standing in the puddle at run[3].
    expect(entry?.caught.map((c) => c.unitId)).toContain(flooded.victim.id);
    const caught = entry?.caught.find((c) => c.unitId === flooded.victim.id);
    expect(caught?.damage).toBeGreaterThan(0);
    expect(caught?.status).toBe('shocked');
  });

  it('flags a chain that reaches back through your own side', () => {
    const fixture = scene();
    // Flood the caster's own tile as well as the target's, so the puddle
    // connects the two.
    const puddle = fixture.run.slice(0, 5).map((pos) => ({ pos, id: 'water' as const }));
    const flooded = scene(puddle);
    const target = fixture.run[3];
    if (!target) throw new Error('no target');

    const ability = applier('lightning');
    const preview = previewAbility(CONTENT, flooded.battle, flooded.caster, ability, target);

    expect(preview.hitsFriendly).toBe(true);
  });
});

describe('forecast hygiene', () => {
  it('consumes no randomness', () => {
    const fixture = scene([{ pos: { x: 0, y: 0 }, id: 'water' }]);
    const target = fixture.run[3];
    if (!target) throw new Error('no target');

    const before = JSON.stringify(fixture.battle.grid);
    const ability = applier('fire');
    const tiles = affectedTiles(fixture.battle.grid, fixture.caster, ability, target);

    const a = forecastReactions(CONTENT, fixture.battle, fixture.caster, ability, target, tiles);
    const b = forecastReactions(CONTENT, fixture.battle, fixture.caster, ability, target, tiles);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // And it left the real grid alone.
    expect(JSON.stringify(fixture.battle.grid)).toBe(before);
  });

  it('never shoves a unit before the ground has had its say', () => {
    // `forecastReactions` replays effects in authored order but does not model
    // a push displacing someone out of a later effect's area. That is only
    // sound while no ability shoves before it touches the ground, so assert it
    // rather than trusting the comment that says so.
    for (const ability of CONTENT.abilities.values()) {
      const shove = ability.effects.findIndex((e) => e.kind === 'push' || e.kind === 'pull');
      if (shove === -1) continue;
      const ground = ability.effects.findIndex((e) => e.kind === 'damage' || e.kind === 'surface');
      if (ground === -1) continue;
      expect(
        ground,
        `${ability.id} shoves at effect ${shove} before its ground effect at ${ground}`,
      ).toBeLessThan(shove);
    }
  });

  it('produces a preview for every shipped ability without throwing', () => {
    const fixture = scene([{ pos: { x: 1, y: 1 }, id: 'water' }]);
    const target = fixture.run[3];
    if (!target) throw new Error('no target');

    for (const ability of CONTENT.abilities.values()) {
      const preview = previewAbility(CONTENT, fixture.battle, fixture.caster, ability, target);
      expect(Array.isArray(preview.reactions)).toBe(true);
      for (const entry of preview.reactions) {
        expect(entry.label.length).toBeGreaterThan(0);
        expect(entry.tiles).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

/** Belt and braces: the positions the forecast reports are on the map. */
describe('forecast bounds', () => {
  it('keeps every chain tile inside the grid', () => {
    const fixture = scene();
    const puddle = fixture.run.map((pos) => ({ pos, id: 'water' as const }));
    const flooded = scene(puddle);
    const target = fixture.run[3];
    if (!target) throw new Error('no target');

    const ability = applier('lightning');
    const tiles = affectedTiles(flooded.battle.grid, flooded.caster, ability, target);
    const forecast = forecastReactions(
      CONTENT,
      flooded.battle,
      flooded.caster,
      ability,
      target,
      tiles,
    );

    const grid = flooded.battle.grid;
    const keys = new Set<string>();
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) keys.add(posKey({ x, y }));
    }
    expect(forecast.entries.every((e) => e.chainTiles <= keys.size)).toBe(true);
  });
});
