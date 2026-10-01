import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { propSchema } from '../../src/content/schemas';
import type { ContentIndex, MapDef, PropDef, PropPlacement } from '../../src/core/types';

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

export const balanceScenarioSchema = z
  .object({
    props: z.record(propOverrideSchema).optional(),
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

  return { ...base, props, maps };
}

export interface UnsupportedScenarioKnob {
  readonly knob: 'squareFootprints' | 'breakRestoresLiveSurface' | 'adjacentCover';
  readonly reason: string;
}

export function unsupportedKnobs(scenario: BalanceScenario): UnsupportedScenarioKnob[] {
  const unsupported: UnsupportedScenarioKnob[] = [];
  if (scenario.squareFootprints === true) {
    unsupported.push({
      knob: 'squareFootprints',
      reason:
        'runCombat/createBattle and reducer application do not expose the existing footprint option',
    });
  }
  if (scenario.breakRestoresLiveSurface === true) {
    unsupported.push({
      knob: 'breakRestoresLiveSurface',
      reason: 'prop break restoration is hard-coded in BattleDraft.removeProp',
    });
  }
  if (scenario.adjacentCover === true) {
    unsupported.push({
      knob: 'adjacentCover',
      reason: 'adjacent cover is hard-coded in hitBreakdown',
    });
  }
  return unsupported;
}
