/** Seeded equality at the immediate, nonlethal action boundary, not turn upkeep. */
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor, seedFromString } from '../rng';
import * as drafts from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import type { Ability, BattleState, GameEvent, GameState, Grid, Unit, Vec2 } from '../types';
import {
  affectedTiles,
  canUseAbility,
  isValidTarget,
  resolveAim,
  shoveOrigin,
  targetableTiles,
} from './abilities';
import { occupiedCells, posKey, samePos, tileAt } from './grid';
import { forecastReactions } from './reactions';

const BUDGET_MS = 20_000;
const SEED = 'world-forecast-484-v1';
const WORLD_EFFECTS = new Set(['damage', 'surface', 'push', 'pull', 'dash', 'wall']);
const OriginalDraft = drafts.BattleDraft;

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function freezeGraph<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeGraph(child);
    Object.freeze(value);
  }
  return value;
}

function generate(ability: Ability, index: number) {
  const label = `${SEED}/${ability.id}/${index}`;
  const random = new RngCursor(seedFromString(label));
  const encounters = [...CONTENT.encounters.values()];
  const encounter = encounters[index % encounters.length];
  ensure(encounter, 'no encounter');
  const game = createGame(CONTENT, {
    seed: label,
    party: [
      { characterId: 'kaya', level: 3, autoChoose: true },
      { characterId: 'bo', level: 3, autoChoose: true },
    ],
    startNode: '',
  });
  const cursor = new RngCursor(game.rng);
  const base = createBattle(CONTENT, game, encounter.id, cursor);
  const first = base.units.find((unit) => unit.id === game.party[0]?.id);
  const second = base.units.find((unit) => unit.id === game.party[1]?.id);
  const opponent = base.units.find((unit) => unit.faction === 'enemy');
  ensure(first && second && opponent, 'missing fixture units');
  const prepare = (unit: Unit, pos: Vec2): Unit => ({
    ...unit,
    pos,
    hp: 1_000_000,
    ap: 100,
    move: unit.base.maxMove,
    base: { ...unit.base, maxHp: 1_000_000, maxAp: 100 },
    statuses: [],
    cooldowns: {},
    bankedAp: 0,
    pendingAp: 0,
  });
  const caster = {
    ...prepare(first, { x: 2, y: 3 }),
    abilities: [...new Set([...first.abilities, ability.id])],
  };
  const ally = prepare(second, { x: 2, y: 5 });
  const enemy = prepare(opponent, { x: 3, y: 3 });
  const surfaces = [...CONTENT.surfaces.values()];
  const props = [...CONTENT.props.values()];
  ensure(surfaces.length > 1 && props.length > 0, 'missing world definitions');
  const sampledSurfaces = new Set<string>();
  // Flat, generated geometry is deliberate. High HP and ample AP isolate the
  // deterministic world horizon without altering any ability/prop definition,
  // hit roll, chance branch, or the real command's execution.
  const grid: Grid = {
    width: 8,
    height: 8,
    tiles: Array.from({ length: 64 }, () => {
      const surface =
        random.int(0, surfaces.length) === surfaces.length ? undefined : random.pick(surfaces);
      if (surface) sampledSurfaces.add(surface.id);
      return {
        terrain: 'dirt',
        elevation: 0,
        blocked: false,
        blocksSight: false,
        cover: false,
        surface: surface ? { id: surface.id, duration: random.int(2, 5), spread: 0 } : null,
      };
    }),
  };
  const battle: BattleState = {
    ...base,
    grid,
    units: [caster, ally, enemy],
    order: [caster.id, ally.id, enemy.id],
    turnIndex: 0,
    round: 1,
    phase: 'active',
    props: [],
    temporaryWalls: [],
  };
  const builder = new OriginalDraft(CONTENT, battle, new RngCursor(cursor.state));
  const taken = new Set(battle.units.flatMap((unit) => occupiedCells(unit).map(posKey)));
  const free = Array.from({ length: 64 }, (_, cell) => ({
    x: cell % 8,
    y: Math.floor(cell / 8),
  })).filter((pos) => !taken.has(posKey(pos)));
  const near = free.filter(
    (pos) => Math.max(Math.abs(pos.x - caster.pos.x), Math.abs(pos.y - caster.pos.y)) === 1,
  );
  const firstPropAt = random.pick(near);
  const secondPropAt = random.pick(free.filter((pos) => !samePos(pos, firstPropAt)));
  const sampledProps: string[] = [];
  for (const [slot, pos] of [firstPropAt, secondPropAt].entries()) {
    const def = props[(index + slot) % props.length];
    ensure(def, 'missing prop definition');
    const placed = builder.placeProp(def.id, pos);
    ensure(placed, 'prop was not placed');
    sampledProps.push(def.id);
    if ((def.fuel ?? 0) > 0 && index % 2 === 0) builder.damageProp(placed.id, 1, 'fire');
  }
  const finalBattle = builder.toBattle();
  const live = finalBattle.units.find((unit) => unit.id === caster.id);
  ensure(live, 'missing caster');
  const legal = targetableTiles(CONTENT, finalBattle, live, ability);
  ensure(legal.length > 0, `${label}: no legal generated target`);
  const propTargets = legal.filter((pos) =>
    finalBattle.props.some((prop) => samePos(prop.pos, pos)),
  );
  const rawTarget = random.pick(index % 2 === 0 && propTargets.length > 0 ? propTargets : legal);
  const target = resolveAim(CONTENT, finalBattle, live, ability, rawTarget);
  ensure(canUseAbility(CONTENT, live, ability).ok, `${label}: caster cannot use original ability`);
  ensure(
    isValidTarget(CONTENT, finalBattle, live, ability, target).ok,
    `${label}: illegal generated aim`,
  );
  const state: GameState = {
    ...game,
    screen: 'combat',
    rng: cursor.state,
    party: [caster, ally],
    battle: finalBattle,
  };
  return { label, state, caster: live, target, sampledSurfaces, sampledProps };
}

function world(battle: BattleState) {
  return structuredClone({
    grid: battle.grid,
    props: [...battle.props].sort((a, b) => a.id.localeCompare(b.id)),
    temporaryWalls: battle.temporaryWalls,
  });
}

function changes(events: readonly GameEvent[]) {
  return events
    .filter((event) => event.type === 'surfaceChanged')
    .map((event) => ({
      pos: event.pos,
      from: event.from,
      to: event.to,
      label: event.label,
    }));
}

function journal(draft: drafts.BattleDraft) {
  return draft.terrainReactions
    .flatMap((reaction) => reaction.changes)
    .map((change) => ({ ...change }));
}

function assertWorld(
  predicted: ReturnType<typeof world>,
  actual: ReturnType<typeof world>,
  label: string,
) {
  expect(predicted.grid, `${label}/per-cell grid`).toEqual(actual.grid);
  expect(predicted.props, `${label}/props`).toEqual(actual.props);
  expect(predicted.temporaryWalls, `${label}/walls`).toEqual(actual.temporaryWalls);
}

function assertJournal(
  predicted: ReturnType<typeof journal>,
  actual: ReturnType<typeof journal>,
  label: string,
) {
  expect(predicted, `${label}/cell-and-reaction-kind journal`).toEqual(actual);
}

function assertPublicReactions(
  entries: ReturnType<typeof forecastReactions>['entries'],
  actual: ReturnType<typeof journal>,
  label: string,
) {
  const ids = [...new Set(actual.map((change) => change.comboId))].sort();
  expect(entries.map((entry) => entry.comboId).sort(), `${label}/public IDs`).toEqual(ids);
  for (const entry of entries) {
    const group = actual.filter((change) => change.comboId === entry.comboId);
    const first = group[0];
    ensure(first, `${label}/${entry.comboId}: no actual reaction`);
    // Public entries group by combo and describe the first actual change.
    // A generic paint can replace different surfaces within the same group.
    expect(
      { tiles: entry.tiles, kind: entry.kind, from: entry.from, to: entry.to, label: entry.label },
      `${label}/${entry.comboId}/public surface metadata`,
    ).toEqual({
      tiles: group.length,
      kind: CONTENT.combos.some((combo) => combo.id === entry.comboId) ? 'reaction' : 'paint',
      from: first.from,
      to: first.to,
      label: first.label,
    });
  }
}

function assertPublicProps(
  entries: ReturnType<typeof forecastReactions>['props'],
  before: BattleState,
  after: BattleState,
  events: readonly GameEvent[],
  label: string,
) {
  expect(new Set(entries.map((entry) => entry.id)).size, `${label}/unique public props`).toBe(
    entries.length,
  );
  for (const event of events) {
    if (
      event.type === 'propDamaged' ||
      event.type === 'propDestroyed' ||
      event.type === 'propIgnited' ||
      event.type === 'propDoused' ||
      event.type === 'propPushed'
    ) {
      ensure(
        entries.some((entry) => entry.id === event.propId),
        `${label}/unreported ${event.type}`,
      );
    }
  }
  for (const entry of entries) {
    const previous = before.props.find((prop) => prop.id === entry.id);
    const current = after.props.find((prop) => prop.id === entry.id);
    ensure(previous, `${label}/unknown public prop ${entry.id}`);
    const destroyed = events.find(
      (event) => event.type === 'propDestroyed' && event.propId === entry.id,
    );
    if (!current) ensure(destroyed, `${label}/removed prop has no destruction event`);
    expect(
      {
        from: entry.from,
        to: entry.to,
        destroyed: entry.destroyed,
        hpBefore: entry.hpBefore,
        hpAfter: entry.hpAfter,
        catchesFire: entry.catchesFire,
        doused: entry.doused,
        moved: entry.moved,
        coverRemoved: entry.coverRemoved,
        breakLabel: entry.breakLabel,
      },
      `${label}/${entry.id}/public world outcome`,
    ).toEqual({
      from: previous.pos,
      to: current?.pos ?? null,
      destroyed: !current,
      hpBefore: previous.hp,
      hpAfter: current?.hp ?? null,
      catchesFire: events.some(
        (event) => event.type === 'propIgnited' && event.propId === entry.id,
      ),
      doused: events.some((event) => event.type === 'propDoused' && event.propId === entry.id),
      moved: current ? !samePos(previous.pos, current.pos) : false,
      coverRemoved: Boolean(
        tileAt(before.grid, previous.pos)?.cover && !tileAt(after.grid, previous.pos)?.cover,
      ),
      breakLabel: !current && destroyed?.type === 'propDestroyed' ? destroyed.label : null,
    });
  }
}

describe('seeded world reaction forecast versus reducer', () => {
  it(
    'matches at least 500 legal immediate-world actions within 20 seconds',
    () => {
      const started = performance.now();
      const abilities = [...CONTENT.abilities.values()].filter((ability) =>
        ability.effects.some((effect) => WORLD_EFFECTS.has(effect.kind)),
      );
      ensure(abilities.length > 0, 'no applicable world abilities');
      const samples = Math.ceil(500 / abilities.length);
      const coverage = new Map<string, number>();
      const surfaceCoverage = new Set<string>();
      const propCoverage = new Set<string>();
      const maps = new Set<string>();
      const failures: string[] = [];
      let attempted = 0;
      let accepted = 0;
      let mismatches = 0;
      let effectfulCells = 0;
      let changedProps = 0;
      let reactionChanges = 0;
      let misses = 0;
      let publicOracle:
        | {
            entries: ReturnType<typeof forecastReactions>['entries'];
            actual: ReturnType<typeof journal>;
          }
        | undefined;
      let propOracle:
        | {
            entries: ReturnType<typeof forecastReactions>['props'];
            before: BattleState;
            after: BattleState;
            events: readonly GameEvent[];
          }
        | undefined;
      let phase: 'forecast' | 'apply' | null = null;
      let observed: drafts.BattleDraft[] = [];
      // Forward construction and every method unchanged. Keeping the actual
      // outer draft exposes exact cell coordinates and wall/prop changes that
      // public grouped entries intentionally do not contain.
      const constructor = vi.spyOn(drafts, 'BattleDraft').mockImplementation(function (
        ...args: ConstructorParameters<typeof OriginalDraft>
      ) {
        const draft = new OriginalDraft(...args);
        if (phase !== null) observed.push(draft);
        return draft;
      });
      try {
        for (const [abilityIndex, ability] of abilities.entries()) {
          for (let sample = 0; sample < samples; sample++) {
            const index = abilityIndex * samples + sample;
            const label = `${SEED}/${ability.id}/${index}`;
            attempted++;
            try {
              const fixture = generate(ability, index);
              const input = freezeGraph(structuredClone(fixture.state));
              const before = structuredClone(input);
              const battle = input.battle;
              ensure(battle, 'missing generated battle');
              maps.add(battle.mapId);
              for (const id of fixture.sampledSurfaces) surfaceCoverage.add(id);
              for (const id of fixture.sampledProps) propCoverage.add(id);
              const caster = battle.units.find((unit) => unit.id === fixture.caster.id);
              ensure(caster, 'missing forecast caster');
              const tiles = affectedTiles(CONTENT, battle.grid, caster, ability, fixture.target);
              observed = [];
              phase = 'forecast';
              const forecast = forecastReactions(
                CONTENT,
                battle,
                caster,
                ability,
                fixture.target,
                tiles,
                shoveOrigin(CONTENT, battle.grid, caster, ability, fixture.target),
              );
              phase = null;
              const predictedDraft = observed[0];
              if (!predictedDraft) {
                // A legal line/cone aimed at its origin can affect no tiles.
                // The public fast path promises no world changes; keep this
                // case and check that promise against the actual command.
                ensure(tiles.length === 0, 'observer missed a nonempty forecast');
                expect(forecast, `${label}/empty-area public result`).toEqual({
                  entries: [],
                  props: [],
                  shoves: [],
                  statuses: [],
                  surfaceContacts: [],
                  catchesFriendly: false,
                });
              }
              const predicted = world(predictedDraft?.toBattle() ?? battle);
              const predictedChanges = predictedDraft ? changes(predictedDraft.events) : [];
              const predictedJournal = predictedDraft ? journal(predictedDraft) : [];
              expect(input, `${label}/forecast input purity`).toEqual(before);

              const commandInput = structuredClone(input);
              const commandBefore = structuredClone(commandInput);
              observed = [];
              phase = 'apply';
              const result = apply(CONTENT, commandInput, {
                type: 'useAbility',
                unitId: caster.id,
                abilityId: ability.id,
                target: fixture.target,
              });
              phase = null;
              ensure(
                result.events.some(
                  (event) => event.type === 'abilityUsed' && event.abilityId === ability.id,
                ),
                'real reducer refused the command',
              );
              accepted++;
              coverage.set(ability.id, (coverage.get(ability.id) ?? 0) + 1);
              ensure(result.state.battle?.phase === 'active', 'nonlethal horizon ended the battle');
              ensure(
                result.state.battle.turnIndex === battle.turnIndex &&
                  result.state.battle.round === battle.round,
                'action unexpectedly advanced into turn upkeep',
              );
              ensure(
                !result.events.some(
                  (event) =>
                    event.type === 'unitDied' ||
                    event.type === 'turnStarted' ||
                    event.type === 'roundStarted',
                ),
                'nonlethal immediate-action assumption failed',
              );
              expect(commandInput, `${label}/reducer input purity`).toEqual(commandBefore);
              const actualDraft = observed[0];
              ensure(actualDraft, 'forwarding observer did not capture reducer draft');
              const actual = world(result.state.battle);
              assertWorld(predicted, actual, label);
              expect(predictedChanges, `${label}/surfaceChanged cells`).toEqual(
                changes(result.events),
              );
              assertJournal(predictedJournal, journal(actualDraft), label);

              const actualJournal = journal(actualDraft);
              assertPublicReactions(forecast.entries, actualJournal, label);
              if (!publicOracle && forecast.entries.length > 0) {
                publicOracle = structuredClone({
                  entries: forecast.entries,
                  actual: actualJournal,
                });
              }
              for (const prop of battle.props) {
                const after = result.state.battle.props.find(
                  (candidate) => candidate.id === prop.id,
                );
                if (!isDeepStrictEqual(prop, after)) {
                  changedProps++;
                  ensure(
                    forecast.props.some((entry) => entry.id === prop.id),
                    `changed prop ${prop.id} absent from public forecast`,
                  );
                }
              }
              assertPublicProps(forecast.props, battle, result.state.battle, result.events, label);
              if (!propOracle && forecast.props.length > 0) {
                propOracle = structuredClone({
                  entries: forecast.props,
                  before: battle,
                  after: result.state.battle,
                  events: result.events,
                });
              }
              effectfulCells += actual.grid.tiles.filter(
                (tile, cell) => !isDeepStrictEqual(tile, battle.grid.tiles[cell]),
              ).length;
              reactionChanges += actualJournal.length;
              misses += result.events.filter((event) => event.type === 'attackMissed').length;
            } catch (error) {
              mismatches++;
              if (failures.length < 10)
                failures.push(
                  `${label}: ${error instanceof Error ? error.message : String(error)}`,
                );
            } finally {
              phase = null;
            }
          }
        }
      } finally {
        constructor.mockRestore();
      }

      // Sensitivity controls: equal aggregate counts cannot hide swapped cells,
      // changed props, or a different reaction kind/identifier.
      const oracle = generate(abilities[0]!, 0);
      ensure(oracle.state.battle, 'missing oracle world');
      const original = world(oracle.state.battle);
      const swapped = structuredClone(original);
      const other = swapped.grid.tiles.findIndex(
        (tile) => !isDeepStrictEqual(tile.surface, swapped.grid.tiles[0]?.surface),
      );
      ensure(other > 0, 'oracle needs distinct cells');
      const tiles = [...swapped.grid.tiles];
      [tiles[0], tiles[other]] = [tiles[other]!, tiles[0]!];
      expect(() =>
        assertWorld(
          original,
          { ...swapped, grid: { ...swapped.grid, tiles } },
          'swapped-cell control',
        ),
      ).toThrow();
      const prop = original.props[0];
      ensure(prop, 'oracle needs a prop');
      expect(() =>
        assertWorld(
          original,
          { ...original, props: [{ ...prop, hp: prop.hp + 1 }, ...original.props.slice(1)] },
          'prop control',
        ),
      ).toThrow();
      const reaction = [
        { pos: { x: 0, y: 0 }, from: null, to: null, label: 'oracle', comboId: 'oracle-paint' },
      ];
      expect(() =>
        assertJournal(
          reaction,
          [{ ...reaction[0]!, comboId: 'oracle-reaction' }],
          'reaction-ID control',
        ),
      ).toThrow();
      ensure(publicOracle, 'oracle needs a real public reaction');
      const publicControl = publicOracle;
      const entry = publicControl.entries[0];
      ensure(entry, 'oracle needs a real public entry');
      const rest = publicControl.entries.slice(1);
      expect(() =>
        assertPublicReactions(
          [{ ...entry, kind: entry.kind === 'reaction' ? 'paint' : 'reaction' }, ...rest],
          publicControl.actual,
          'literal-kind control',
        ),
      ).toThrow();
      expect(() =>
        assertPublicReactions(
          [{ ...entry, from: entry.from === null ? 'water' : null }, ...rest],
          publicControl.actual,
          'public-surface control',
        ),
      ).toThrow();
      expect(() =>
        assertPublicReactions(
          [{ ...entry, label: `${entry.label} wrong` }, ...rest],
          publicControl.actual,
          'public-label control',
        ),
      ).toThrow();

      ensure(propOracle, 'oracle needs a real public prop');
      const propControl = propOracle;
      const propEntry = propControl.entries[0];
      ensure(propEntry, 'oracle needs a public prop entry');
      expect(() =>
        assertPublicProps(
          [{ ...propEntry, catchesFire: !propEntry.catchesFire }, ...propControl.entries.slice(1)],
          propControl.before,
          propControl.after,
          propControl.events,
          'public ignition control',
        ),
      ).toThrow();

      process.stdout.write(
        `${JSON.stringify({ kind: 'world reaction property coverage', seed: SEED, abilities: abilities.length, samples, attempted, accepted, mismatches, failures, maps: [...maps], surfaces: [...surfaceCoverage], props: [...propCoverage], effectfulCells, changedProps, reactionChanges, misses })}\n`,
      );
      expect(attempted).toBeGreaterThanOrEqual(500);
      expect(accepted).toBe(attempted);
      expect([...coverage.keys()].sort()).toEqual(abilities.map((ability) => ability.id).sort());
      expect([...surfaceCoverage].sort()).toEqual([...CONTENT.surfaces.keys()].sort());
      expect([...propCoverage].sort()).toEqual([...CONTENT.props.keys()].sort());
      expect(effectfulCells).toBeGreaterThan(0);
      expect(changedProps).toBeGreaterThan(0);
      expect(reactionChanges).toBeGreaterThan(0);
      expect(mismatches, failures.join('\n')).toBe(0);
      expect(
        performance.now() - started,
        'complete generation, execution and oracle workload',
      ).toBeLessThan(BUDGET_MS);
    },
    BUDGET_MS,
  );
});
