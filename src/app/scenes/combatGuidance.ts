import type { Command, GameEvent, GameState, PropDef, SurfaceId } from '../../core/types';
import { occupiedCells } from '../../core/rules/grid';

export const FIRST_FIGHT_GUIDANCE = {
  eligible: 'guidance.firstFightEligible',
  stage: 'guidance.firstFightStage',
} as const;

export const COMBAT_TIP_COPY = {
  cover: 'Cover helps protect a fighter from attacks across the field.',
  prop: 'Some battlefield props can break when they take enough damage.',
  status: 'Statuses can change what a fighter can do. Check the mark by their name.',
} as const;

export type CombatTipFeature = keyof typeof COMBAT_TIP_COPY | `surface.${SurfaceId}`;

export function combatTipCopy(feature: CombatTipFeature): string {
  if (feature.startsWith('surface.')) {
    const surface = feature.slice('surface.'.length);
    return surface === 'oil'
      ? 'Oil can catch fire, changing what happens when an ability lands.'
      : `The ${surface} surface can change how abilities interact with a tile.`;
  }
  return (COMBAT_TIP_COPY as Readonly<Record<string, string>>)[feature] ?? '';
}

export function firstFightStage(state: GameState): number | null {
  if (
    state.screen !== 'combat' ||
    state.battle?.mapId !== 'forest_road' ||
    state.battle.encounterId !== 'enc_forest_road' ||
    state.battle.phase !== 'active' ||
    state.flags[FIRST_FIGHT_GUIDANCE.eligible] !== true ||
    state.flags[FIRST_FIGHT_GUIDANCE.stage] === 'done'
  )
    return null;
  const stage = state.flags[FIRST_FIGHT_GUIDANCE.stage];
  return typeof stage === 'number' && stage >= 0 && stage <= 3 ? stage : 0;
}

/** Advance only after the reducer accepted the real player action. */
export function nextFirstFightStage(
  stage: number,
  command: Command,
  events: readonly GameEvent[],
  before: GameState,
): number | null {
  const party = new Set(
    before.battle?.units.filter((unit) => unit.faction === 'party').map((unit) => unit.id),
  );
  if (
    stage === 0 &&
    command.type === 'move' &&
    events.some(
      (event) =>
        event.type === 'unitMoved' && event.unitId === command.unitId && party.has(event.unitId),
    )
  )
    return 1;

  if (
    stage === 1 &&
    command.type === 'useAbility' &&
    events.some((event) => event.type === 'abilityUsed' && event.unitId === command.unitId) &&
    party.has(command.unitId) &&
    before.battle?.units.some(
      (unit) =>
        unit.faction === 'enemy' &&
        occupiedCells(unit).some(
          (cell) => cell.x === command.target.x && cell.y === command.target.y,
        ),
    )
  )
    return 2;

  if (
    stage === 2 &&
    command.type === 'endTurn' &&
    events.some((event) => event.type === 'turnEnded' && event.unitId === command.unitId) &&
    party.has(command.unitId)
  )
    return 3;

  return null;
}

export function combatTipFeatures(
  state: GameState,
  props: ReadonlyMap<string, PropDef>,
): readonly CombatTipFeature[] {
  const battle = state.battle;
  if (
    state.screen !== 'combat' ||
    !battle ||
    battle.phase !== 'active' ||
    battle.encounterId === 'enc_forest_road'
  )
    return [];
  const found = new Set<CombatTipFeature>();
  if (battle.grid.tiles.some((tile) => tile.cover)) found.add('cover');
  for (const tile of battle.grid.tiles) {
    if (tile.surface) found.add(`surface.${tile.surface.id}` as CombatTipFeature);
  }
  if (
    battle.props.some((prop) => {
      const definition = props.get(prop.propId);
      return definition !== undefined && definition.hp > 0;
    })
  )
    found.add('prop');
  if (battle.units.some((unit) => unit.statuses.length > 0)) found.add('status');
  return [...found];
}

export function combatTipEvents(events: readonly GameEvent[]): readonly CombatTipFeature[] {
  const found = new Set<CombatTipFeature>();
  for (const event of events) {
    if (event.type === 'surfaceChanged' && event.to)
      found.add(`surface.${event.to}` as CombatTipFeature);
  }
  if (events.some((event) => event.type === 'propDestroyed')) found.add('prop');
  if (events.some((event) => event.type === 'statusApplied')) found.add('status');
  return [...found];
}

export function unseenCombatTips(
  features: readonly CombatTipFeature[],
  flags: GameState['flags'],
): readonly CombatTipFeature[] {
  return features.filter((feature) => flags[`guidance.tip.${feature}`] !== true);
}
