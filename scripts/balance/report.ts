import type { ContentIndex, GameEvent } from '../../src/core/types';
import { partyOfSize } from '../../src/core/sim/balance';
import { runCombat, seedFor } from '../../src/core/sim/runCombat';

export interface PropCounts {
  ignited: number;
  burnedAway: number;
  doused: number;
}

export interface ScenarioRow {
  readonly encounterId: string;
  readonly label: string;
  readonly partySize: number;
  readonly winRate: number;
  readonly meanRounds: number;
  readonly meanPartyHpLeft: number;
  readonly props: Readonly<Record<string, PropCounts>>;
  /** Best available from existing events; see `limitations` in the JSON report. */
  readonly unattributedEnvironmentalFireDamage: { readonly party: number; readonly enemy: number };
}

export interface ScenarioReport {
  readonly trials: number;
  readonly rows: readonly ScenarioRow[];
  readonly runtimeMs: number;
}

function emptyCounts(): PropCounts {
  return { ignited: 0, burnedAway: 0, doused: 0 };
}

export function countPropEvents(
  events: readonly GameEvent[],
  propNames: ReadonlyMap<string, string>,
): { props: Record<string, PropCounts>; fire: { party: number; enemy: number } } {
  const instanceToDefinition = new Map<string, string>();
  const props: Record<string, PropCounts> = {};
  const fire = { party: 0, enemy: 0 };
  const definitionFor = (instance: string): string =>
    instanceToDefinition.get(instance) ?? instance;
  const countsFor = (definition: string): PropCounts => (props[definition] ??= emptyCounts());

  for (const event of events) {
    if (event.type === 'propDamaged') {
      const definition = propNames.get(event.name);
      if (definition) instanceToDefinition.set(event.propId, definition);
    } else if (event.type === 'propIgnited') {
      countsFor(definitionFor(event.propId)).ignited++;
    } else if (event.type === 'propDoused') {
      countsFor(definitionFor(event.propId)).doused++;
    } else if (event.type === 'propDestroyed' && / burns away\.$/.test(event.label)) {
      countsFor(definitionFor(event.propId)).burnedAway++;
    } else if (event.type === 'damaged' && event.damageType === 'fire' && event.sourceId === null) {
      if (/^p\d+$/.test(event.unitId)) fire.party += event.amount;
      else fire.enemy += event.amount;
    }
  }
  return { props, fire };
}

export function runScenarioReport(
  content: ContentIndex,
  sizes: readonly number[],
  trials: number,
): ScenarioReport {
  const started = performance.now();
  const rows: ScenarioRow[] = [];
  const propNames = new Map([...content.props].map(([id, prop]) => [prop.name, id]));

  for (const partySize of sizes) {
    const party = partyOfSize(partySize);
    for (const encounter of content.encounters.values()) {
      let wins = 0;
      let rounds = 0;
      let hp = 0;
      const props: Record<string, PropCounts> = Object.fromEntries(
        [...content.props.keys()].map((id) => [id, emptyCounts()]),
      );
      const fire = { party: 0, enemy: 0 };
      for (let trial = 0; trial < trials; trial++) {
        const result = runCombat(content, {
          seed: seedFor(`${encounter.id}:`, trial),
          encounterId: encounter.id,
          party,
          partyLevel: encounter.expectedLevel,
          recordEvents: true,
        });
        if (result.outcome === 'victory') wins++;
        rounds += result.rounds;
        hp += result.partyHpRemaining;
        const counted = countPropEvents(result.events, propNames);
        for (const [id, value] of Object.entries(counted.props)) {
          const aggregate = (props[id] ??= emptyCounts());
          aggregate.ignited += value.ignited;
          aggregate.burnedAway += value.burnedAway;
          aggregate.doused += value.doused;
        }
        fire.party += counted.fire.party;
        fire.enemy += counted.fire.enemy;
      }
      rows.push({
        encounterId: encounter.id,
        label: encounter.name,
        partySize,
        winRate: wins / trials,
        meanRounds: rounds / trials,
        meanPartyHpLeft: hp / trials,
        props,
        unattributedEnvironmentalFireDamage: {
          party: fire.party / trials,
          enemy: fire.enemy / trials,
        },
      });
    }
  }
  return { trials, rows, runtimeMs: performance.now() - started };
}
