/**
 * Fixed-work, same-process core performance tripwire, not a device/FPS claim.
 * Exported measurement never writes limits; the CLI always enforces them.
 * Independent references call no core pathfinding, planner, scorer or reducer
 * inside their timed work. These are factory upper-bound fixtures, not claims
 * that every enumerated flag combination is reachable in an earned campaign.
 */
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONTENT } from '../../src/content';
import { TOPDOWN_SCENES } from '../../src/content/topdown';
import { RngCursor } from '../../src/core/rng';
import { cachedGrid, findPath, pathCost, reachable, tileAt } from '../../src/core/rules/grid';
import type { MoveContext } from '../../src/core/rules/grid';
import { partyOfSize } from '../../src/core/sim/balance';
import { createBattle, createGame } from '../../src/core/state/createGame';
import { apply } from '../../src/core/state/reducer';
import { evaluate } from '../../src/core/story/conditions';
import type { Condition, FlagValue, GameState, StepResult, Unit, Vec2 } from '../../src/core/types';
import frozenBaseline from './core-bench-baseline.json';

export const POLICY = Object.freeze({
  warmupBatches: 3,
  samples: 11,
  pathBatch: 32,
  aiBatch: 2,
  ceilingMultiplier: 4,
});

export interface BenchCase {
  readonly id: string;
  readonly kind: 'reachable' | 'findPath' | 'enemyTurn';
  readonly mapId: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly workload: () => number;
  readonly reference: () => number;
  readonly validate: () => void;
}
export interface PairedSample {
  readonly workMs: number;
  readonly referenceMs: number;
}
export interface BenchRow {
  readonly id: string;
  readonly kind: BenchCase['kind'];
  readonly mapId: string;
  readonly detail: BenchCase['detail'];
  readonly batch: number;
  readonly samples: readonly PairedSample[];
  readonly medianWorkMs: number;
  readonly medianReferenceMs: number;
  readonly normalizedMedian: number;
  readonly checksum: number;
}
export interface BenchBaseline {
  readonly calibrationSource: string;
  readonly calibrated: boolean;
  readonly policy: Readonly<{
    warmupBatches: number;
    samples: number;
    pathBatch: number;
    aiBatch: number;
    ceilingMultiplier: number;
  }>;
  readonly cases: Readonly<
    Record<string, { readonly normalizedMedian: number; readonly ceiling: number }>
  >;
}
export const BASELINE: BenchBaseline = frozenBaseline;

function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function positive(value: number, label: string): void {
  ensure(
    Number.isFinite(value) && value > 0,
    `${label} must be positive and finite; received ${value}`,
  );
}
function median(values: readonly number[]): number {
  ensure(values.length > 0, 'Cannot take an empty median');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted[middle];
  ensure(value !== undefined, 'Missing median');
  return sorted.length % 2 ? value : (value + (sorted[middle - 1] ?? value)) / 2;
}
export function summarizePairs(samples: readonly PairedSample[]) {
  const ratios: number[] = [];
  for (const sample of samples) {
    positive(sample.workMs, 'Work sample');
    positive(sample.referenceMs, 'Reference sample');
    const ratio = sample.workMs / sample.referenceMs;
    positive(ratio, 'Paired ratio');
    ratios.push(ratio);
  }
  return {
    medianWorkMs: median(samples.map((sample) => sample.workMs)),
    medianReferenceMs: median(samples.map((sample) => sample.referenceMs)),
    normalizedMedian: median(ratios),
  };
}

/** Independent eight-neighbour BFS on equally sized, flat, empty ground. */
function blankSearch(width: number, height: number, start: Vec2, budget: number) {
  const depths = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  const first = start.y * width + start.x;
  ensure(
    start.x >= 0 && start.y >= 0 && start.x < width && start.y < height,
    'Bad reference origin',
  );
  queue[0] = first;
  depths[first] = 0;
  let tail = 1;
  const cells: { x: number; y: number; cost: number }[] = [];
  for (let head = 0; head < tail; head++) {
    const cell = queue[head];
    ensure(cell !== undefined, 'Missing reference queue cell');
    const x = cell % width;
    const y = Math.floor(cell / width);
    const cost = depths[cell];
    ensure(cost !== undefined, 'Missing reference depth');
    cells.push({ x, y, cost });
    if (cost >= budget) continue;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (depths[next] !== -1) continue;
        depths[next] = cost + 1;
        queue[tail++] = next;
      }
    }
  }
  return cells;
}
function blankChecksum(width: number, height: number, start: Vec2, budget: number): number {
  let checksum = 0;
  for (const cell of blankSearch(width, height, start, budget))
    checksum += 1 + cell.x + cell.y + cell.cost * 2;
  return checksum;
}

interface Assembly {
  readonly label: string;
  readonly state: GameState;
}
function assemblies(): Assembly[] {
  const result: Assembly[] = [];
  for (const encounter of CONTENT.encounters.values()) {
    const map = CONTENT.maps.get(encounter.mapId);
    ensure(map, `Missing ${encounter.mapId}`);
    const keys = new Set(encounter.conditionalEnemies.map((group) => group.flag));
    const collect = (condition: Condition | undefined): void => {
      if (!condition) return;
      if (condition.kind === 'flag' && (condition.op === 'set' || condition.op === 'unset'))
        keys.add(condition.key);
      else if (condition.kind === 'all' || condition.kind === 'any') condition.of.forEach(collect);
      else if (condition.kind === 'not') collect(condition.of);
      else throw new Error(`Add real benchmark witnesses for ${JSON.stringify(condition)}`);
    };
    encounter.variants.forEach((variant) => collect(variant.when));
    [...map.props, ...encounter.variants.flatMap((variant) => variant.extraProps ?? [])].forEach(
      (prop) => collect(prop.when),
    );
    const flags = [...keys].sort().reduce<Record<string, FlagValue>[]>(
      (states, key) =>
        states.flatMap((state) => [
          { ...state, [key]: false },
          { ...state, [key]: true },
        ]),
      [{}],
    );
    for (const values of flags) {
      const seeded = createGame(CONTENT, {
        seed: `core-perf-566:${encounter.id}:${JSON.stringify(values)}`,
        startNode: '',
        flags: values,
        party: partyOfSize(6).map((slot) => ({
          ...slot,
          level: encounter.expectedLevel,
          autoChoose: true,
        })),
      });
      const eligible = encounter.variants.filter((variant) => evaluate(seeded, variant.when));
      const variants = eligible.some((variant) => variant.weight > 0)
        ? eligible
        : [...eligible, null];
      for (const variant of variants) {
        const rng = new RngCursor(seeded.rng);
        const battle = createBattle(
          CONTENT,
          seeded,
          encounter.id,
          rng,
          variant ? { variantId: variant.id } : {},
        );
        ensure(
          battle.variantId === (variant?.id ?? null),
          'Benchmark roster did not honor its pin',
        );
        ensure(
          battle.units.filter((unit) => unit.faction === 'party').length === 6,
          'Benchmark lost table size six',
        );
        result.push({
          label: `${encounter.id}/${variant?.id ?? 'base'}/${JSON.stringify(values)}`,
          state: { ...seeded, screen: 'combat', battle, rng: rng.state },
        });
      }
    }
  }
  return result;
}

function current(state: GameState): Unit {
  const battle = state.battle;
  ensure(battle?.phase === 'active', 'Benchmark needs an active battle');
  const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
  ensure(actor && actor.hp > 0, 'Benchmark needs a living active actor');
  return actor;
}
function prepareEnemyTurn(assembly: Assembly, id: string): GameState {
  let state = assembly.state;
  const budget = (state.battle?.order.length ?? 0) * 2;
  for (let step = 0; step < budget; step++) {
    const actor = current(state);
    if (actor.id === id) {
      ensure(actor.faction === 'enemy', 'Prepared actor is not an enemy');
      ensure(
        state.battle?.units.every((unit) => unit.hp > 0),
        'Prepared largest roster suffered a death',
      );
      return state;
    }
    const result = apply(
      CONTENT,
      state,
      actor.faction === 'party' ? { type: 'endTurn', unitId: actor.id } : { type: 'runAiTurn' },
    );
    ensure(
      result.state !== state &&
        result.events.some((event) => event.type === 'turnEnded' && event.unitId === actor.id),
      'Public benchmark advancement was refused',
    );
    state = result.state;
  }
  throw new Error(`Could not reach ${id} through public commands`);
}
function stepChecksum(step: StepResult): number {
  ensure(step.state.battle, 'AI turn lost its battle');
  let sum = step.state.rng + step.state.battle.round + step.events.length + 1;
  for (const unit of step.state.battle.units)
    sum += unit.hp + unit.ap + unit.move + unit.pos.x + unit.pos.y;
  return sum;
}

/** Lightweight spatial search reference, not a second implementation of AI. */
function aiReference(state: GameState, actor: Unit): () => number {
  const battle = state.battle;
  ensure(battle, 'Missing AI reference battle');
  const abilities = actor.abilities.map((id) => CONTENT.abilities.get(id));
  ensure(
    abilities.length > 0 && abilities.every((ability) => ability !== undefined),
    'Missing AI reference abilities',
  );
  const targets: { x: number; y: number; hp: number }[] = [];
  for (const unit of battle.units) {
    if (unit.hp <= 0) continue;
    for (let dy = 0; dy < unit.size; dy++) {
      for (let dx = 0; dx < unit.size; dx++)
        targets.push({ x: unit.pos.x + dx, y: unit.pos.y + dy, hp: unit.hp });
    }
  }
  for (const prop of battle.props) targets.push({ ...prop.pos, hp: prop.hp });
  const minimumAp = Math.min(...abilities.map((ability) => ability?.apCost ?? Infinity));
  ensure(minimumAp > 0 && Number.isFinite(minimumAp), 'Reference needs positive authored AP costs');
  const passes = Math.max(1, Math.floor(actor.ap / minimumAp));
  return () => {
    const positions = blankSearch(
      battle.grid.width - actor.size + 1,
      battle.grid.height - actor.size + 1,
      actor.pos,
      actor.move,
    );
    let sum = 1;
    for (let pass = 0; pass < passes; pass++) {
      for (const position of positions) {
        for (const ability of abilities) {
          ensure(ability, 'Missing authored reference ability');
          for (const target of targets) {
            const distance = Math.max(
              Math.abs(position.x - target.x),
              Math.abs(position.y - target.y),
            );
            sum +=
              position.cost +
              distance +
              target.hp +
              ability.apCost +
              (distance <= ability.range ? 1 : 0);
          }
        }
      }
    }
    return sum;
  };
}

/**
 * Registered top-down maps use the same logical rows/legend as CONTENT: the
 * presentation swap changes no movement inputs. Query the actual explore grid,
 * without loading art, and disclose that moving people are excluded. The
 * 39x31 Wang plate is presentation tessellation, not the 24x16 rules board.
 * Export this constructor separately so supplemental calibration measures only
 * these new cases, without constructing or remeasuring the original matrix.
 */
export function createTopDownBenchSuite() {
  const registered = [...TOPDOWN_SCENES.keys()].map((id) => {
    const map = CONTENT.maps.get(id);
    ensure(map, `Registered top-down map ${id} is missing`);
    return map;
  });
  ensure(registered.length > 0, 'No registered top-down boards');
  const maximumArea = Math.max(...registered.map((map) => map.width * map.height));
  const largest = registered
    .filter((map) => map.width * map.height === maximumArea)
    .sort((a, b) => a.id.localeCompare(b.id));
  const cases: BenchCase[] = [];
  for (const map of largest) {
    // A future top-down combat board needs a real prop-baked battle witness.
    // Do not silently benchmark its unassembled map with this explore fixture.
    ensure(
      map.kind === 'explore' && map.props.length === 0,
      `${map.id}: add an assembled top-down fixture`,
    );
    const grid = cachedGrid(map);
    const start = map.partySpawns[0];
    ensure(start && tileAt(grid, start)?.blocked === false, `${map.id}: no open authored spawn`);
    const context: MoveContext = {
      grid,
      blocked: new Set(),
      surfaces: CONTENT.surfaces,
      size: 1,
      climbCost: CONTENT.tuning.climbCost,
    };
    const component = [...reachable(context, start, Infinity).values()];
    const nw = [...component].sort(
      (a, b) => a.pos.x + a.pos.y - b.pos.x - b.pos.y || a.pos.y - b.pos.y,
    )[0]?.pos;
    const se = [...component].sort(
      (a, b) => b.pos.x + b.pos.y - a.pos.x - a.pos.y || b.pos.y - a.pos.y,
    )[0]?.pos;
    ensure(nw && se, `${map.id}: no opposite-corner component`);
    const witness = findPath(context, nw, se, Infinity);
    ensure(
      witness && witness.path.length >= Math.floor(Math.max(map.width, map.height) / 2),
      `${map.id}: no substantial legal top-down corner path`,
    );
    ensure(
      pathCost(context, nw, witness.path) === witness.cost,
      `${map.id}: top-down corner path cost mismatch`,
    );
    const original = JSON.stringify(grid);
    const detail = {
      width: map.width,
      height: map.height,
      registeredTopDown: true,
      gridSource: 'cachedGrid of unchanged logical map rules',
      peopleIgnoredForTerrainQuery: true,
      props: map.props.length,
      footprintSize: 1,
      start,
      cornerStart: nw,
      cornerEnd: se,
      cornerSteps: witness.path.length,
      cornerCost: witness.cost,
      reachableBudget: 6,
    };
    const validate = () => {
      ensure(JSON.stringify(grid) === original, 'Top-down terrain query mutated the real grid');
      const path = findPath(context, nw, se, Infinity);
      ensure(
        path && path.path.length > 0 && pathCost(context, nw, path.path) === path.cost,
        `${map.id}: top-down corner result is not a legal path`,
      );
    };
    cases.push({
      id: `reachable/topdown/${map.id}`,
      kind: 'reachable',
      mapId: map.id,
      detail,
      workload: () => {
        const result = reachable(context, start, 6);
        ensure(result.size > 1, 'Top-down six-move query did no useful work');
        let sum = 0;
        for (const cell of result.values())
          sum += 1 + cell.pos.x + cell.pos.y + cell.cost + cell.path.length;
        return sum;
      },
      reference: () => blankChecksum(map.width, map.height, start, 6),
      validate,
    });
    cases.push({
      id: `findPath/topdown/${map.id}`,
      kind: 'findPath',
      mapId: map.id,
      detail,
      workload: () => {
        const path = findPath(context, nw, se, Infinity);
        ensure(
          path && path.path.length === witness.path.length && path.cost === witness.cost,
          'Top-down corner result changed',
        );
        return 1 + path.cost + path.path.length + path.pos.x + path.pos.y;
      },
      reference: () => blankChecksum(map.width, map.height, nw, Infinity),
      validate,
    });
  }
  return {
    cases,
    coverage: {
      included: true,
      provenance:
        'Registered top-down logical terrain, ignoring people; presentation loading and rendering are outside this benchmark.',
      registeredMaps: registered.map((map) => ({
        id: map.id,
        width: map.width,
        height: map.height,
      })),
      largestMaps: largest.map((map) => ({ id: map.id, width: map.width, height: map.height })),
      maximumArea,
    },
  };
}

export function createCoreBenchSuite() {
  const built = assemblies();
  ensure(built.length > 0, 'No benchmark encounters');
  const counts = built.map((assembly) => ({
    label: assembly.label,
    encounterId: assembly.state.battle?.encounterId,
    variantId: assembly.state.battle?.variantId,
    flags: assembly.state.flags,
    total: assembly.state.battle?.units.length ?? 0,
    party: assembly.state.battle?.units.filter((unit) => unit.faction === 'party').length ?? 0,
    allies: assembly.state.battle?.units.filter((unit) => unit.faction === 'ally').length ?? 0,
    enemies: assembly.state.battle?.units.filter((unit) => unit.faction === 'enemy').length ?? 0,
  }));
  const maximumRoster = Math.max(...counts.map((entry) => entry.total));
  const maps = [...CONTENT.maps.values()].filter((map) => map.kind === 'combat');
  const area = Math.max(...maps.map((map) => map.width * map.height));
  const largestMaps = maps
    .filter((map) => map.width * map.height === area)
    .sort((a, b) => a.id.localeCompare(b.id));
  const cases: BenchCase[] = [];
  for (const map of largestMaps) {
    const assembly = built
      .filter((entry) => entry.state.battle?.mapId === map.id)
      .sort(
        (a, b) =>
          (b.state.battle?.units.length ?? 0) - (a.state.battle?.units.length ?? 0) ||
          a.label.localeCompare(b.label),
      )[0];
    ensure(assembly?.state.battle, `No assembled battle for ${map.id}`);
    const battle = assembly.state.battle;
    const mover = battle.units.find((unit) => unit.faction === 'party');
    ensure(mover, 'Missing pathfinding mover');
    const context: MoveContext = {
      grid: battle.grid,
      blocked: new Set(),
      surfaces: CONTENT.surfaces,
      size: mover.size,
      climbCost: CONTENT.tuning.climbCost,
    };
    const component = [...reachable(context, mover.pos, Infinity).values()];
    const nw = [...component].sort(
      (a, b) => a.pos.x + a.pos.y - b.pos.x - b.pos.y || a.pos.y - b.pos.y,
    )[0]?.pos;
    const se = [...component].sort(
      (a, b) => b.pos.x + b.pos.y - a.pos.x - a.pos.y || b.pos.y - a.pos.y,
    )[0]?.pos;
    ensure(nw && se, 'No corner component');
    const witness = findPath(context, nw, se, Infinity);
    ensure(
      witness && witness.path.length >= Math.floor(Math.max(map.width, map.height) / 2),
      `${map.id}: no substantial legal opposite-corner witness`,
    );
    ensure(
      pathCost(context, nw, witness.path) === witness.cost,
      `${map.id}: corner path cost mismatch`,
    );
    const original = JSON.stringify(battle.grid);
    const detail = {
      width: map.width,
      height: map.height,
      assembly: assembly.label,
      props: battle.props.length,
      unitsIgnoredForTerrainQuery: true,
      start: mover.pos,
      cornerStart: nw,
      cornerEnd: se,
      cornerSteps: witness.path.length,
      cornerCost: witness.cost,
      reachableBudget: 6,
    };
    const validate = () =>
      ensure(JSON.stringify(battle.grid) === original, 'Terrain query mutated the real grid');
    cases.push({
      id: `reachable/${map.id}`,
      kind: 'reachable',
      mapId: map.id,
      detail,
      workload: () => {
        const result = reachable(context, mover.pos, 6);
        ensure(result.size > 1, 'Six-move query did no useful work');
        let sum = 0;
        for (const cell of result.values())
          sum += 1 + cell.pos.x + cell.pos.y + cell.cost + cell.path.length;
        return sum;
      },
      reference: () => blankChecksum(map.width, map.height, mover.pos, 6),
      validate,
    });
    cases.push({
      id: `findPath/${map.id}`,
      kind: 'findPath',
      mapId: map.id,
      detail,
      workload: () => {
        const path = findPath(context, nw, se, Infinity);
        ensure(path && path.path.length > 0, 'Corner query returned no path');
        return 1 + path.cost + path.path.length + path.pos.x + path.pos.y;
      },
      reference: () => blankChecksum(map.width, map.height, nw, Infinity),
      validate,
    });
  }
  const representatives: {
    assembly: string;
    actorId: string;
    enemyId: string | null;
    kit: string;
  }[] = [];
  const largestAssemblies = built.filter(
    (entry) => entry.state.battle?.units.length === maximumRoster,
  );
  const kitOf = (unit: Unit) =>
    JSON.stringify({
      enemyId: unit.enemyId,
      ai: unit.ai,
      size: unit.size,
      abilities: unit.abilities,
    });
  const maximumRosterKits = largestAssemblies.map((assembly) => ({
    assembly: assembly.label,
    kits: [
      ...new Set(
        assembly.state.battle?.units.filter((unit) => unit.faction === 'enemy').map(kitOf),
      ),
    ].sort(),
  }));
  for (const assembly of largestAssemblies) {
    ensure(assembly.state.battle, 'Missing largest assembly');
    const seen = new Set<string>();
    for (const enemy of assembly.state.battle.units.filter((unit) => unit.faction === 'enemy')) {
      const kit = kitOf(enemy);
      if (seen.has(kit)) continue;
      seen.add(kit);
      const prepared = prepareEnemyTurn(assembly, enemy.id);
      const actor = current(prepared);
      const original = JSON.stringify(prepared);
      const check = () => {
        const step = apply(CONTENT, prepared, { type: 'runAiTurn' });
        ensure(
          step.events.some((event) => event.type === 'turnEnded' && event.unitId === actor.id),
          'AI did not finish its complete activation',
        );
        ensure(
          step.events.some(
            (event) =>
              (event.type === 'abilityUsed' || event.type === 'unitMoved') &&
              event.unitId === actor.id &&
              (event.type !== 'unitMoved' || event.path.length > 0),
          ),
          'AI benchmark was idle',
        );
        ensure(
          step.events.some((event) => event.type === 'turnStarted') ||
            step.state.battle?.phase !== 'active',
          'AI did not advance through real next-turn upkeep',
        );
        ensure(
          step.state.battle?.phase !== 'active' ||
            step.state.battle.round !== prepared.battle?.round ||
            step.state.battle.order[step.state.battle.turnIndex] !== actor.id,
          'AI left the activation unfinished',
        );
        ensure(JSON.stringify(prepared) === original, 'AI mutated benchmark input');
        return step;
      };
      const expected = JSON.stringify(check());
      representatives.push({
        assembly: assembly.label,
        actorId: actor.id,
        enemyId: actor.enemyId,
        kit,
      });
      cases.push({
        id: `enemyTurn/${assembly.label}/${actor.id}`,
        kind: 'enemyTurn',
        mapId: prepared.battle?.mapId ?? '',
        detail: {
          assembly: assembly.label,
          roster: maximumRoster,
          actorId: actor.id,
          enemyId: actor.enemyId,
          ai: actor.ai,
          size: actor.size,
          abilities: actor.abilities,
          round: prepared.battle?.round,
        },
        workload: () => stepChecksum(apply(CONTENT, prepared, { type: 'runAiTurn' })),
        reference: aiReference(prepared, actor),
        validate: () =>
          ensure(
            JSON.stringify(check()) === expected,
            'AI output changed for the same snapshot and seed',
          ),
      });
    }
  }
  const topDown = createTopDownBenchSuite();
  cases.push(...topDown.cases);
  return {
    cases,
    coverage: {
      fixtureProvenance:
        'Six-party factory upper-bound assemblies, including eligible pinned variants and binary authored flags; not an earned-campaign reachability claim.',
      largestMaps: largestMaps.map((map) => ({ id: map.id, width: map.width, height: map.height })),
      assemblies: counts,
      maximumRoster,
      maximumRosterKits,
      representatives,
      topDown: topDown.coverage,
    },
  };
}

function batch(work: () => number, count: number, expected: number) {
  let checksum = 0;
  const start = performance.now();
  for (let index = 0; index < count; index++) checksum += work();
  const elapsed = performance.now() - start;
  positive(elapsed, 'Batch elapsed time (no timer floor permitted)');
  ensure(checksum === expected * count, 'Benchmark result checksum changed');
  positive(checksum, 'Consumed checksum');
  return { ms: elapsed / count, checksum };
}
export function measureCoreBenchCase(entry: BenchCase): BenchRow {
  entry.validate();
  const count = entry.kind === 'enemyTurn' ? POLICY.aiBatch : POLICY.pathBatch;
  const workChecksum = entry.workload();
  const referenceChecksum = entry.reference();
  positive(workChecksum, 'Work checksum');
  positive(referenceChecksum, 'Reference checksum');
  for (let warmup = 0; warmup < POLICY.warmupBatches; warmup++) {
    if (warmup % 2) {
      batch(entry.workload, count, workChecksum);
      batch(entry.reference, count, referenceChecksum);
    } else {
      batch(entry.reference, count, referenceChecksum);
      batch(entry.workload, count, workChecksum);
    }
  }
  const samples: PairedSample[] = [];
  let checksum = 0;
  for (let index = 0; index < POLICY.samples; index++) {
    let work;
    let reference;
    if (index % 2) {
      work = batch(entry.workload, count, workChecksum);
      reference = batch(entry.reference, count, referenceChecksum);
    } else {
      reference = batch(entry.reference, count, referenceChecksum);
      work = batch(entry.workload, count, workChecksum);
    }
    checksum += work.checksum + reference.checksum;
    samples.push({ workMs: work.ms, referenceMs: reference.ms });
  }
  entry.validate();
  return {
    id: entry.id,
    kind: entry.kind,
    mapId: entry.mapId,
    detail: entry.detail,
    batch: count,
    samples,
    ...summarizePairs(samples),
    checksum,
  };
}
export function runCoreBench() {
  const suite = createCoreBenchSuite();
  return { policy: POLICY, coverage: suite.coverage, rows: suite.cases.map(measureCoreBenchCase) };
}
export function caseBudgetIssues(row: BenchRow, baseline: BenchBaseline = BASELINE): string[] {
  const limit = baseline.cases[row.id];
  if (!baseline.calibrated || !limit)
    return [`${row.id}: missing independently measured, frozen calibration`];
  if (
    !Number.isFinite(limit.normalizedMedian) ||
    limit.normalizedMedian <= 0 ||
    !Number.isFinite(limit.ceiling) ||
    limit.ceiling <= 0 ||
    limit.ceiling !== limit.normalizedMedian * POLICY.ceilingMultiplier
  )
    return [`${row.id}: invalid frozen 4x ceiling`];
  if (
    row.samples.length !== POLICY.samples ||
    row.batch !== (row.kind === 'enemyTurn' ? POLICY.aiBatch : POLICY.pathBatch)
  )
    return [`${row.id}: changed fixed sampling policy`];
  if (!Number.isFinite(row.normalizedMedian) || row.normalizedMedian <= 0)
    return [`${row.id}: invalid measured paired ratio`];
  return row.normalizedMedian > limit.ceiling
    ? [
        `${row.id}: paired normalized median ${row.normalizedMedian} exceeds frozen ceiling ${limit.ceiling}`,
      ]
    : [];
}
export function assertCoreBenchBudgets(
  report: ReturnType<typeof runCoreBench>,
  baseline: BenchBaseline = BASELINE,
): void {
  const issues = report.rows.flatMap((row) => caseBudgetIssues(row, baseline));
  if (JSON.stringify(report.policy) !== JSON.stringify(baseline.policy))
    issues.push('Calibration sampling policy changed');
  const ids = report.rows.map((row) => row.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(Object.keys(baseline.cases).sort()))
    issues.push('Frozen calibration case matrix does not match the full benchmark');
  if (issues.length) throw new Error(issues.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    ensure(args.length === 0, 'Usage: npm run bench:core');
    const report = runCoreBench();
    console.log(JSON.stringify(report, null, 2));
    assertCoreBenchBudgets(report);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
