import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { propSchema } from '../../src/content/schemas';
import type {
  ContentIndex,
  EncounterDef,
  EncounterPlacement,
  EnemyDef,
  MapDef,
  PropDef,
  PropPlacement,
} from '../../src/core/types';

const placementSchema = z
  .object({
    propId: z.string().min(1),
    pos: z
      .object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })
      .strict(),
  })
  .strict();

const propOverrideSchema = propSchema
  .pick({
    fuel: true,
    burnsInto: true,
    ignites: true,
    douse: true,
    hp: true,
    vulnerableTo: true,
    immuneTo: true,
  })
  .partial()
  .strict();

const encounterPlacementSchema = z
  .object({
    enemyId: z.string().min(1),
    pos: z
      .object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })
      .strict(),
    level: z.number().int().min(1).max(10).optional(),
    nameSuffix: z.string().optional(),
  })
  .strict();

const enemyStatsSchema = z
  .object({
    maxHp: z.number().int().positive(),
    maxAp: z.number().int().min(1).max(8),
    maxMove: z.number().int().min(0).max(12),
    power: z.number().int().min(0),
    defense: z.number().int().min(0),
    speed: z.number().int().min(1),
    focus: z.number().int().min(0).max(100),
  })
  .partial()
  .strict();

const encounterOverrideSchema = z
  .object({
    /** If present, replaces the authored roster; additions are appended after it. */
    enemies: z.array(encounterPlacementSchema).optional(),
    addEnemies: z.array(encounterPlacementSchema).optional(),
    /** Private per-encounter copies, so a proposal never changes another fight. */
    enemyStats: z.record(enemyStatsSchema).optional(),
    expectedLevel: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const balanceScenarioSchema = z
  .object({
    props: z.record(propOverrideSchema).optional(),
    encounters: z.record(encounterOverrideSchema).optional(),
    placements: z
      .record(
        z
          .object({
            add: z.array(placementSchema).optional(),
            remove: z.array(placementSchema).optional(),
          })
          .strict(),
      )
      .optional(),
    squareFootprints: z.boolean().optional(),
    breakRestoresLiveSurface: z.boolean().optional(),
    adjacentCover: z.boolean().optional(),
  })
  .strict();

export type BalanceScenario = z.infer<typeof balanceScenarioSchema>;

export function readScenario(path: string): BalanceScenario {
  let source: unknown;
  try {
    source = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read scenario ${path}: ${String(error)}`);
  }
  const parsed = balanceScenarioSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid balance scenario ${path}:\n${issues}`);
}

const samePlacement = (left: PropPlacement, right: PropPlacement): boolean =>
  left.propId === right.propId && left.pos.x === right.pos.x && left.pos.y === right.pos.y;

/** Builds fresh maps/definitions; authored content and its nested arrays are never changed. */
export function applyScenario(base: ContentIndex, scenario: BalanceScenario): ContentIndex {
  const props = new Map(base.props);
  for (const [id, override] of Object.entries(scenario.props ?? {})) {
    const original = props.get(id);
    if (!original) throw new Error(`Scenario references unknown prop "${id}"`);
    props.set(id, { ...original, ...override } as PropDef);
  }

  const maps = new Map(base.maps);
  for (const [id, changes] of Object.entries(scenario.placements ?? {})) {
    const original = maps.get(id);
    if (!original) throw new Error(`Scenario references unknown map "${id}"`);
    for (const placement of [...(changes.add ?? []), ...(changes.remove ?? [])]) {
      if (!props.has(placement.propId)) {
        throw new Error(
          `Scenario placement on ${id} references unknown prop "${placement.propId}"`,
        );
      }
      if (placement.pos.x >= original.width || placement.pos.y >= original.height) {
        throw new Error(
          `Scenario placement on ${id} is outside the map at ${placement.pos.x},${placement.pos.y}`,
        );
      }
    }
    let placements = original.props.filter(
      (existing) => !(changes.remove ?? []).some((removed) => samePlacement(existing, removed)),
    );
    placements = [...placements, ...(changes.add ?? [])];
    maps.set(id, { ...original, props: placements } as MapDef);
  }

  const enemies = new Map(base.enemies);
  const encounters = new Map(base.encounters);
  for (const [id, changes] of Object.entries(scenario.encounters ?? {})) {
    const original = encounters.get(id);
    if (!original) throw new Error(`Scenario references unknown encounter "${id}"`);
    const map = base.maps.get(original.mapId);
    if (!map) throw new Error(`Encounter "${id}" references unknown map "${original.mapId}"`);
    const selectedRoster = changes.enemies ?? original.enemies;
    const referencedEnemyIds = new Set([
      ...selectedRoster.map((placement) => placement.enemyId),
      ...(changes.addEnemies ?? []).map((placement) => placement.enemyId),
      ...original.reinforcements.map((placement) => placement.enemyId),
      ...original.conditionalEnemies.flatMap((group) =>
        group.placements.map((placement) => placement.enemyId),
      ),
      ...original.variants.flatMap((variant) =>
        (variant.enemies ?? []).map((placement) => placement.enemyId),
      ),
    ]);
    const scenarioEnemyIds = new Map<string, string>();
    for (const [enemyId, stats] of Object.entries(changes.enemyStats ?? {})) {
      const originalEnemy = enemies.get(enemyId);
      if (!originalEnemy) {
        throw new Error(`Scenario encounter ${id} references unknown enemy "${enemyId}"`);
      }
      if (!referencedEnemyIds.has(enemyId)) {
        throw new Error(`Scenario enemy "${enemyId}" is not used by encounter "${id}"`);
      }
      const scenarioEnemyId = `__scenario__${id}__${enemyId}`;
      if (enemies.has(scenarioEnemyId)) {
        throw new Error(`Scenario enemy id collision for encounter "${id}" and "${enemyId}"`);
      }
      scenarioEnemyIds.set(enemyId, scenarioEnemyId);
      enemies.set(scenarioEnemyId, {
        ...originalEnemy,
        id: scenarioEnemyId,
        stats: { ...originalEnemy.stats, ...stats },
      } as EnemyDef);
    }
    const scopedPlacements = (placements: readonly EncounterPlacement[]) =>
      placements.map((placement) => ({
        ...placement,
        enemyId: scenarioEnemyIds.get(placement.enemyId) ?? placement.enemyId,
        pos: { ...placement.pos },
      }));
    const placements = [
      ...scopedPlacements(selectedRoster),
      ...scopedPlacements(changes.addEnemies ?? []),
    ];
    if (placements.length === 0) {
      throw new Error(`Scenario leaves encounter "${id}" with no enemies`);
    }
    for (const placement of placements) {
      const enemy = enemies.get(placement.enemyId);
      if (!enemy) {
        throw new Error(`Scenario encounter ${id} references unknown enemy "${placement.enemyId}"`);
      }
      if (placement.pos.x >= map.width || placement.pos.y >= map.height) {
        throw new Error(
          `Scenario placement for ${placement.enemyId} in ${id} is outside the map at ${placement.pos.x},${placement.pos.y}`,
        );
      }
    }
    encounters.set(id, {
      ...original,
      enemies: placements,
      reinforcements: scopedPlacements(original.reinforcements),
      conditionalEnemies: original.conditionalEnemies.map((group) => ({
        ...group,
        placements: scopedPlacements(group.placements),
      })),
      variants: original.variants.map((variant) => ({
        ...variant,
        enemies: variant.enemies ? scopedPlacements(variant.enemies) : undefined,
      })),
      expectedLevel: changes.expectedLevel ?? original.expectedLevel,
    } as EncounterDef);
  }

  return { ...base, props, maps, enemies, encounters };
}

export interface UnsupportedScenarioKnob {
  readonly knob: 'squareFootprints' | 'breakRestoresLiveSurface' | 'adjacentCover';
  readonly reason: string;
}

/**
 * Every rules knob a scenario names but the simulation cannot apply. A knob is
 * reported whenever it is specified, true or false: an ignored `false` must
 * not read as a setting the run honoured.
 */
export function unsupportedKnobs(scenario: BalanceScenario): UnsupportedScenarioKnob[] {
  const unsupported: UnsupportedScenarioKnob[] = [];
  if (scenario.squareFootprints !== undefined) {
    unsupported.push({
      knob: 'squareFootprints',
      reason:
        'runCombat/createBattle and reducer application do not expose the existing footprint option',
    });
  }
  if (scenario.breakRestoresLiveSurface !== undefined) {
    unsupported.push({
      knob: 'breakRestoresLiveSurface',
      reason: 'prop break restoration is hard-coded in BattleDraft.removeProp',
    });
  }
  if (scenario.adjacentCover !== undefined) {
    unsupported.push({
      knob: 'adjacentCover',
      reason: 'adjacent cover is hard-coded in hitBreakdown',
    });
  }
  return unsupported;
}
