/**
 * Reaction forecasting — what the ground is about to do.
 *
 * The combo table is the best thing in this game and, until now, the only
 * place it was ever explained was the README. The confirm step said
 * "Leaves Fire" whether you aimed at bare dirt, at a puddle (steam) or at a
 * pool of lamp oil (spreading fire that sets the whole flank alight). That is
 * exactly the promise-then-do-something-else that `abilities.ts` warns about
 * for damage numbers, and it is worse here, because terrain is the part a kid
 * is supposed to *discover*. You cannot discover a rule you were lied to about.
 *
 * So this module does not describe the combo table. It **runs** it: the same
 * `applyImpact` and `paintSurface` the reducer calls, in the same order, on a
 * throwaway copy of the grid. If the table changes, the forecast changes with
 * it, and `reactions.test.ts` fails the build if the two ever part company.
 *
 * Consumes no RNG, mutates nothing. Opening the preview a dozen times cannot
 * change the shot.
 */

import type {
  Ability,
  BattleState,
  ContentIndex,
  GameEvent,
  StatusId,
  SurfaceId,
  Unit,
  Vec2,
} from '../types';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import type { SurfaceContactRecord } from '../state/battleDraft';
import { isAreaShove, sameSide } from './abilities';
import {
  allowsCasterTarget,
  blastTiles,
  occupiedCells,
  posKey,
  samePos,
  tileAt,
  unitAt,
} from './grid';
import { SQUARE_FOOTPRINTS, footprintCells, shoveStep } from './footprint';
import { applyStatus, removeStatuses } from './status';
import { contactEffects } from './surfaces';
import type { ChainHit, StatusHit, SurfaceChange } from './surfaces';
import { isAlive } from './stats';

/** Only the unit that immediately follows a ledge-damage event owns that drop. */
export function precedingLedgeDrop(
  previous: GameEvent | undefined,
  pushed: Extract<GameEvent, { type: 'unitPushed' }>,
  damagePerTier: number,
): { tiers: number; damage: number } {
  if (
    previous?.type !== 'damaged' ||
    previous.cause !== 'ledgeDrop' ||
    previous.unitId !== pushed.unitId
  ) {
    return { tiers: 0, damage: 0 };
  }
  return {
    tiers: damagePerTier > 0 ? Math.round(previous.amount / damagePerTier) : 0,
    damage: previous.amount,
  };
}

/** A unit standing where a reaction lands. */
export interface CaughtUnit {
  readonly unitId: string;
  readonly name: string;
  readonly friendly: boolean;
  /** Chain damage, before defence and multipliers. Zero when the rule deals none. */
  readonly damage: number;
  readonly status: StatusId | null;
  /** The status the effect requested, before the status table upgrades it. */
  readonly requestedStatus?: StatusId;
  /** Statuses removed by the same application (for example Wet clears Burning). */
  readonly clearedStatuses?: readonly StatusId[];
  /** 0-1. 1 means certain. */
  readonly statusChance: number;
}

/** A status outcome shown without rolling its chance. */
export interface StatusForecast {
  readonly unitId: string;
  readonly name: string;
  readonly friendly: boolean;
  readonly kind: 'apply' | 'cleanse';
  /** Null for a cleanse, where `clearedStatuses` is the useful answer. */
  readonly requestedStatus: StatusId | null;
  /** The status that `applyStatus` would actually leave on the unit. */
  readonly appliedStatus: StatusId | null;
  /** 0-1. A cleanse is always 1. */
  readonly chance: number;
  readonly clearedStatuses: readonly StatusId[];
}

export interface PropAffectedUnit {
  readonly unitId: string;
  readonly name: string;
  readonly friendly: boolean;
  readonly statuses: readonly StatusForecast[];
}

/** What a prop will be left doing after this action. */
export interface PropForecast {
  readonly id: string;
  readonly propId: string;
  readonly name: string;
  readonly from: Vec2;
  readonly to: Vec2 | null;
  readonly destroyed: boolean;
  /** The action starts this prop's fuel clock without reducing its HP. */
  readonly catchesFire: boolean;
  /** The action clears this prop's running fuel clock. */
  readonly doused: boolean;
  readonly moved: boolean;
  readonly coverRemoved: boolean;
  readonly hpBefore: number;
  readonly hpAfter: number | null;
  readonly breakLabel: string | null;
  readonly affectedAllies: readonly PropAffectedUnit[];
  readonly affectedEnemies: readonly PropAffectedUnit[];
}

export interface ShoveForecast {
  readonly kind: 'unit' | 'prop';
  /**
   * What released the shove. `'ability'` is the action's own push/pull or a
   * prop it moved; `'propBreak'` is a body thrown clear by a destroyed prop's
   * on-break push. A scorer prices the break itself through `scoreProps`, so it
   * must read only the ability's own shoves or it counts the fall twice.
   */
  readonly cause: 'ability' | 'propBreak';
  readonly id: string;
  readonly name: string;
  readonly friendly: boolean;
  readonly from: Vec2;
  readonly to: Vec2;
  readonly distance: number;
  readonly movedDistance: number;
  readonly mode: 'push' | 'pull';
  /** What the movement measures from, for truthful display wording. */
  readonly originKind: 'caster' | 'area' | 'propBreak';
  /** Why fewer than the authored number of tiles were travelled. */
  readonly stopReason: 'obstacle' | 'centre' | 'adjacent' | null;
  readonly blocked: boolean;
  /** Surface contact caused by landing, including the damage/status chance. */
  readonly landingSurfaces: readonly SurfaceId[];
  readonly landingDamage: number;
  /** Nominal tier count from the forced-movement rule, for display only. */
  readonly ledgeDropTiers: number;
  /** Defense-ignoring damage from the largest tier drop across the footprint. */
  readonly ledgeDropDamage: number;
  readonly landingStatuses: readonly { readonly id: StatusId; readonly chance: number }[];
}

/** One unit contact recorded by the shared surface resolver. */
export interface SurfaceContactForecast {
  readonly unitId: string;
  readonly name: string;
  readonly friendly: boolean;
  readonly surface: SurfaceId;
  /** Actual HP lost after mitigation and the unit's HP floor. */
  readonly damage: number;
  /** The contact status, if any; chance is described but never rolled. */
  readonly status: StatusForecast | null;
}

export interface ForecastEntry {
  /**
   * 'reaction' — the combo table fired and the tile becomes something other
   * than what the ability nominally leaves behind.
   * 'paint' — no rule matched; the surface simply lands as authored.
   */
  readonly kind: 'reaction' | 'paint';
  readonly comboId: string;
  /** The table's own plain-words line, which is what the combat log prints. */
  readonly label: string;
  readonly from: SurfaceId | null;
  readonly to: SurfaceId | null;
  /** How many tiles change this way. */
  readonly tiles: number;
  /** True when the result crawls outward on its own each round (fire on oil). */
  readonly spreads: boolean;
  /**
   * Tiles the reaction reaches beyond the ones the ability itself touches —
   * the connected puddle a bolt of lightning races through. Zero for
   * everything that does not chain.
   */
  readonly chainTiles: number;
  readonly caught: readonly CaughtUnit[];
}

export interface ReactionForecast {
  readonly entries: readonly ForecastEntry[];
  /** True when any reaction catches someone on the caster's own side. */
  readonly catchesFriendly: boolean;
  /** Props damaged, broken or moved by the action. */
  readonly props: readonly PropForecast[];
  /** Exact destinations produced by the real shove pathing rules. */
  readonly shoves: readonly ShoveForecast[];
  /** Ability, combo and prop status outcomes, without a random roll. */
  readonly statuses: readonly StatusForecast[];
  /** Units already standing on a newly painted surface, kept separate from direct hits. */
  readonly surfaceContacts: readonly SurfaceContactForecast[];
}

const EMPTY: ReactionForecast = {
  entries: [],
  catchesFriendly: false,
  props: [],
  shoves: [],
  statuses: [],
  surfaceContacts: [],
};

/**
 * Replays the ability's terrain-touching effects against a throwaway
 * `BattleDraft`. Effects run in authored order because that is what
 * `resolveAbility` does. In particular, prop damage and its break effect run
 * before the damage impact, so an oil flask can spill and then catch fire in
 * the same action.
 *
 * The draft owns movement, prop restoration, landing contact and the combo
 * engine. The preview cursor is deliberately detached from the live game RNG;
 * chance-based statuses are described below instead of being treated as facts.
 *
 * `origin` is the cell push and pull measure from — the blast centre for area
 * shapes, otherwise the firing cell (see `shoveOrigin` and
 * `validatingOrigin`). Callers that omit it fall back to the old anchor-based
 * choice, which is only correct for size-1 casters.
 */
export function forecastReactions(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  ability: Ability,
  target: Vec2,
  tiles: readonly Vec2[],
  origin?: Vec2,
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): ReactionForecast {
  if (tiles.length === 0) return EMPTY;

  // Shared prop rules need a cursor for their status branches. We never read
  // those chance outcomes here, and this detached cursor must never be the
  // live battle cursor or expose its seed in the preview.
  const previewRng = new RngCursor(0);
  const draft = new BattleDraft(content, battle, previewRng, {
    resolveChanceStatuses: false,
    squareFootprints,
  });
  const struck = battle.units.filter(
    (unit) =>
      isAlive(unit) &&
      (allowsCasterTarget(ability) || unit.id !== caster.id) &&
      occupiedCells(unit, squareFootprints).some((cell) =>
        tiles.some((tile) => posKey(tile) === posKey(cell)),
      ),
  );
  const hitIds = struck.map((unit) => unit.id);
  const friendlyIds = struck.filter((unit) => sameSide(caster, unit)).map((unit) => unit.id);
  const statusForecasts: StatusForecast[] = [];
  const shoves: ShoveForecast[] = [];

  const recipientsForStatus = (to: 'hit' | 'self' | 'allies'): readonly string[] => {
    if (to === 'self') return [caster.id];
    return to === 'allies' ? friendlyIds : hitIds;
  };

  const areaShove = isAreaShove(ability);
  const shoveFrom = origin ?? (areaShove ? target : caster.pos);
  const originKind = areaShove ? 'area' : 'caster';

  for (const effect of ability.effects) {
    switch (effect.kind) {
      case 'damage':
        // Keep this order in lockstep with abilities.ts: a prop can spill a
        // surface that the impact immediately reacts with.
        draft.damageProps(tiles, effect.base, effect.damageType);
        draft.impact(tiles, effect.damageType, caster.id);
        break;
      case 'surface': {
        const painted = effect.area === 'area' ? tiles : [target];
        draft.paint(painted, effect.surface, effect.duration, caster.id);
        break;
      }
      case 'push':
      case 'pull': {
        for (const id of hitIds) {
          shoves.push(
            shoveUnitForecast(
              content,
              draft,
              caster,
              id,
              shoveFrom,
              effect.distance,
              effect.kind,
              originKind,
            ),
          );
        }
        for (const prop of draft.propsOnTiles(tiles)) {
          shoves.push(
            shovePropForecast(
              content,
              draft,
              prop.id,
              shoveFrom,
              effect.distance,
              effect.kind,
              originKind,
            ),
          );
        }
        break;
      }
      case 'dash':
        draft.placeUnit(caster.id, target);
        break;
      case 'wall':
        draft.raiseWall(tiles, effect.duration);
        break;
      case 'status': {
        for (const id of recipientsForStatus(effect.to)) {
          // Read the draft so guaranteed statuses released by an earlier prop
          // break or reaction participate in upgrades and clears. Chance
          // statuses are intentionally absent from this draft (see
          // resolveChanceStatuses), so an unknown branch cannot steer later
          // deterministic forecasts.
          const unit = draft.unit(id);
          if (!unit) continue;
          const forecast = previewStatus(
            content,
            unit,
            caster,
            effect.status,
            effect.duration,
            effect.chance,
            'apply',
          );
          statusForecasts.push(forecast);
          // A guaranteed status is part of the deterministic throwaway state;
          // a chance outcome is reported but does not steer later predictions.
          if (effect.chance >= 1 && forecast.appliedStatus) {
            draft.applyStatusTo(id, effect.status, effect.duration);
          }
        }
        break;
      }
      case 'cleanse': {
        const recipients = ability.targeting.shape === 'self' ? [caster.id] : friendlyIds;
        for (const id of recipients) {
          const unit = draft.unit(id);
          if (!unit) continue;
          const removed = removeStatuses(unit, effect.statuses).removed;
          if (removed.length > 0) {
            statusForecasts.push({
              unitId: unit.id,
              name: unit.name,
              friendly: sameSide(caster, unit),
              kind: 'cleanse',
              requestedStatus: null,
              appliedStatus: null,
              chance: 1,
              clearedStatuses: removed,
            });
          }
          draft.cleanseFrom(id, effect.statuses);
        }
        break;
      }
      default:
        break;
    }
  }

  const reactions = draft.terrainReactions;
  const changes = reactions.flatMap((reaction) => reaction.changes);
  const statusHits = reactions.flatMap((reaction) => reaction.statusHits);
  const chainHits = reactions.flatMap((reaction) => reaction.chainHits);
  const reactionStatuses = statusHits.flatMap((hit) => {
    const unit = unitAt(draft.units, hit.pos);
    if (!unit) return [];
    return [previewStatus(content, unit, caster, hit.status, undefined, hit.chance, 'apply')];
  });
  statusForecasts.push(...reactionStatuses);

  // Prop break effects can shove units too (the cabbage cart is the shipped
  // example). Those shoves use the same draft method but are not authored as
  // an ability push, so add their event destinations to the same preview list.
  const knownShoves = new Set(
    shoves.map((shove) => `${shove.kind}:${shove.id}:${posKey(shove.to)}`),
  );
  const lastUnitPositions = new Map(battle.units.map((unit) => [unit.id, unit.pos]));
  for (const [eventIndex, event] of draft.events.entries()) {
    if (event.type !== 'unitPushed') continue;
    const from = lastUnitPositions.get(event.unitId);
    const unit = draft.unit(event.unitId);
    if (!from || !unit) continue;
    const key = `unit:${event.unitId}:${posKey(event.to)}`;
    if (!knownShoves.has(key)) {
      const previous = draft.events[eventIndex - 1];
      const precedingDrop = precedingLedgeDrop(previous, event, content.tuning.ledgeDropDamage);
      const movedDistance = Math.max(Math.abs(event.to.x - from.x), Math.abs(event.to.y - from.y));
      shoves.push({
        kind: 'unit',
        cause: 'propBreak',
        id: event.unitId,
        name: unit.name,
        friendly: sameSide(caster, unit),
        from,
        to: event.to,
        distance: movedDistance,
        movedDistance,
        mode: 'push',
        originKind: 'propBreak',
        stopReason: null,
        blocked: false,
        ...landingInfo(content, draft, unit),
        ledgeDropTiers: draft.shoveLedgeTiers.get(eventIndex) ?? precedingDrop.tiers,
        ledgeDropDamage: precedingDrop.damage,
      });
      knownShoves.add(key);
    }
    lastUnitPositions.set(event.unitId, event.to);
  }

  const props = propForecasts(
    content,
    battle,
    draft,
    caster,
    tiles,
    ability.effects.some((effect) => effect.kind === 'push' || effect.kind === 'pull'),
  );
  const propStatuses = props.flatMap((prop) => [
    ...prop.affectedAllies.flatMap((unit) => unit.statuses),
    ...prop.affectedEnemies.flatMap((unit) => unit.statuses),
  ]);
  statusForecasts.push(...propStatuses);

  // BattleDraft owns the contact pass. Map its journal into the public
  // forecast without re-discovering occupants or re-running surface maths.
  const surfaceContacts = surfaceContactForecasts(caster, battle, draft.surfaceContacts);

  if (
    changes.length === 0 &&
    statusHits.length === 0 &&
    chainHits.length === 0 &&
    props.length === 0 &&
    shoves.length === 0 &&
    statusForecasts.length === 0 &&
    surfaceContacts.length === 0
  ) {
    return EMPTY;
  }

  const assembled = assemble(content, battle, caster, tiles, changes, statusHits, chainHits);
  return {
    ...assembled,
    props,
    shoves,
    statuses: statusForecasts,
    surfaceContacts,
  };
}

/** Apply the status table without changing the live unit or spending RNG. */
export function previewStatus(
  content: ContentIndex,
  unit: Unit,
  caster: Unit,
  requestedStatus: StatusId,
  duration: number | undefined,
  chance: number,
  kind: 'apply' = 'apply',
): StatusForecast {
  const result = applyStatus(content, unit, requestedStatus, duration);
  return {
    unitId: unit.id,
    name: unit.name,
    friendly: sameSide(caster, unit),
    kind,
    requestedStatus,
    appliedStatus: result.applied,
    chance,
    clearedStatuses: result.cleared,
  };
}

/** Convert the shared draft journal to the public preview shape. */
function surfaceContactForecasts(
  caster: Unit,
  battle: BattleState,
  records: readonly SurfaceContactRecord[],
): SurfaceContactForecast[] {
  return records.flatMap((record) => {
    // BattleDraft keeps defeated units in its array, so a lethal contact still
    // has a stable name and faction here.
    const unit = battle.units.find((candidate) => candidate.id === record.unitId);
    if (!unit) return [];
    const friendly = sameSide(caster, unit);
    const status = record.status
      ? {
          unitId: record.unitId,
          name: unit.name,
          friendly,
          kind: 'apply' as const,
          requestedStatus: record.status.requestedStatus,
          appliedStatus: record.status.appliedStatus,
          chance: record.status.chance,
          clearedStatuses: record.status.clearedStatuses,
        }
      : null;
    return [
      {
        unitId: record.unitId,
        name: unit.name,
        friendly,
        surface: record.surface,
        damage: record.damage,
        status,
      },
    ];
  });
}

function landingInfo(
  content: ContentIndex,
  draft: BattleDraft,
  unit: Unit | undefined,
): Pick<
  ShoveForecast,
  'landingSurfaces' | 'landingDamage' | 'ledgeDropTiers' | 'ledgeDropDamage' | 'landingStatuses'
> {
  if (!unit) {
    return {
      landingSurfaces: [],
      landingDamage: 0,
      ledgeDropTiers: 0,
      ledgeDropDamage: 0,
      landingStatuses: [],
    };
  }

  const surfaces: SurfaceId[] = [];
  const statuses: { id: StatusId; chance: number }[] = [];
  let damage = 0;
  for (const cell of occupiedCells(unit, draft.squareFootprints)) {
    const contact = contactEffects(content, draft.grid, cell);
    if (!contact.surface || surfaces.includes(contact.surface)) continue;
    surfaces.push(contact.surface);
    damage += contact.damage;
    if (contact.status) statuses.push({ id: contact.status, chance: contact.statusChance });
  }
  return {
    landingSurfaces: surfaces,
    landingDamage: damage,
    ledgeDropTiers: 0,
    ledgeDropDamage: 0,
    landingStatuses: statuses,
  };
}

function shoveUnitForecast(
  content: ContentIndex,
  draft: BattleDraft,
  caster: Unit,
  unitId: string,
  origin: Vec2,
  distance: number,
  mode: 'push' | 'pull',
  originKind: ShoveForecast['originKind'],
): ShoveForecast {
  const before = draft.unit(unitId);
  if (!before) {
    return {
      kind: 'unit',
      cause: 'ability',
      id: unitId,
      name: unitId,
      friendly: false,
      from: origin,
      to: origin,
      distance,
      movedDistance: 0,
      mode,
      originKind,
      stopReason: 'obstacle',
      blocked: true,
      ...landingInfo(content, draft, undefined),
    };
  }
  const eventStart = draft.events.length;
  const slide = draft.slideFrom(draft.moveContext(before), before.pos, origin, distance, mode);
  const ledgeDropTiers = draft.shove(unitId, origin, distance, mode);
  const after = draft.unit(unitId) ?? before;
  const movedDistance = Math.max(
    Math.abs(after.pos.x - before.pos.x),
    Math.abs(after.pos.y - before.pos.y),
  );
  const ledgeDropDamage = draft.events
    .slice(eventStart)
    .reduce(
      (total, event) =>
        event.type === 'damaged' && event.cause === 'ledgeDrop' ? total + event.amount : total,
      0,
    );
  return {
    kind: 'unit',
    cause: 'ability',
    id: before.id,
    name: before.name,
    friendly: sameSide(caster, before),
    from: before.pos,
    to: after.pos,
    distance,
    movedDistance,
    mode,
    originKind,
    stopReason: displayStopReason(
      slide.stopReason,
      before.pos,
      slide.pos,
      origin,
      mode,
      before.size,
      // Only a caster-origin shove can be stopped "next to the caster"; an area
      // shove is measured from its centre, and a caster never blocks itself.
      originKind === 'caster' && caster?.id !== before.id ? caster : undefined,
      draft.squareFootprints,
    ),
    blocked: movedDistance < distance,
    ...landingInfo(content, draft, after),
    ledgeDropTiers,
    ledgeDropDamage,
  };
}

/**
 * HP one forced move would knock off by dropping the unit over a ledge,
 * measured through the same `shoveUnitForecast` the confirm preview reads.
 *
 * A caller that already knows the origin — the AI pricing a prop's break shove
 * — can ask for a single shove without running the whole ability forecast. The
 * detached preview draft and cursor keep it pure and RNG-free, exactly like the
 * confirm step.
 */
export function shoveLedgeDropDamage(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  unitId: string,
  origin: Vec2,
  distance: number,
  mode: 'push' | 'pull',
  squareFootprints: boolean = SQUARE_FOOTPRINTS,
): number {
  const preview = new BattleDraft(content, battle, new RngCursor(0), {
    resolveChanceStatuses: false,
    squareFootprints,
  });
  return shoveUnitForecast(content, preview, caster, unitId, origin, distance, mode, 'caster')
    .ledgeDropDamage;
}

function shovePropForecast(
  content: ContentIndex,
  draft: BattleDraft,
  propId: string,
  origin: Vec2,
  distance: number,
  mode: 'push' | 'pull',
  originKind: ShoveForecast['originKind'],
): ShoveForecast {
  const before = draft.props.find((prop) => prop.id === propId);
  if (!before) {
    return {
      kind: 'prop',
      cause: 'ability',
      id: propId,
      name: propId,
      friendly: false,
      from: origin,
      to: origin,
      distance,
      movedDistance: 0,
      mode,
      originKind,
      stopReason: 'obstacle',
      blocked: true,
      ...landingInfo(content, draft, undefined),
    };
  }
  const slide = draft.shoveProp(propId, origin, distance, mode);
  const after = draft.props.find((prop) => prop.id === propId);
  const pushed = [...draft.events]
    .reverse()
    .find(
      (event): event is Extract<typeof event, { type: 'propPushed' }> =>
        event.type === 'propPushed' && event.propId === propId,
    );
  const to = after?.pos ?? pushed?.to ?? before.pos;
  const moved = !samePos(to, before.pos);
  const movedDistance = Math.max(Math.abs(to.x - before.pos.x), Math.abs(to.y - before.pos.y));
  const unitLike = moved
    ? ({
        id: after?.id ?? before.id,
        name: after ? (draft.propDef(after)?.name ?? after.propId) : before.propId,
        pos: to,
        size: 1,
      } as Unit)
    : undefined;
  return {
    kind: 'prop',
    cause: 'ability',
    id: before.id,
    name: draft.propDef(before)?.name ?? before.propId,
    friendly: false,
    from: before.pos,
    to,
    distance,
    movedDistance,
    mode,
    originKind,
    stopReason: displayStopReason(
      slide?.stopReason ?? 'obstacle',
      before.pos,
      slide?.pos ?? to,
      origin,
      mode,
      1,
      undefined,
      false,
    ),
    blocked: movedDistance < distance,
    ...landingInfo(content, draft, unitLike),
  };
}

/** Maps the movement rule's mechanical stop to the preview's player-facing reason. */
function displayStopReason(
  reason: 'none' | 'centre' | 'origin' | 'obstacle',
  from: Vec2,
  to: Vec2,
  origin: Vec2,
  mode: 'push' | 'pull',
  size: Unit['size'],
  caster: Unit | undefined,
  square: boolean,
): ShoveForecast['stopReason'] {
  if (reason === 'none') return null;
  if (reason === 'centre') return 'centre';
  if (reason === 'origin') return 'adjacent';
  // The slide keeps the direction it started with (BattleDraft.slideFrom), so
  // the blocked step is taken from the starting cell, not the stopping one.
  // `shoveStep` is the same helper slideFrom uses, so the two cannot drift.
  const step = shoveStep(from, origin, size, mode, square);
  const next = {
    x: to.x + step.x,
    y: to.y + step.y,
  };
  const casterCells = new Set(caster ? occupiedCells(caster, square).map(posKey) : []);
  for (const offset of footprintCells({ x: 0, y: 0 }, size, square)) {
    const cell = { x: next.x + offset.x, y: next.y + offset.y };
    if (samePos(cell, origin) || casterCells.has(posKey(cell))) return 'adjacent';
  }
  return 'obstacle';
}

function propForecasts(
  content: ContentIndex,
  battle: BattleState,
  draft: BattleDraft,
  caster: Unit,
  tiles: readonly Vec2[],
  includePropTargets: boolean,
): PropForecast[] {
  const touched = new Set<string>();
  for (const event of draft.events) {
    if (
      event.type === 'propDamaged' ||
      event.type === 'propDestroyed' ||
      event.type === 'propIgnited' ||
      event.type === 'propDoused' ||
      event.type === 'propPushed'
    ) {
      touched.add(event.propId);
    }
  }
  // A non-damaging Shove can be the whole action. Its target is a prop even
  // when no event was emitted because a wall or another unit stopped it.
  if (includePropTargets) {
    const aimed = new Set(tiles.map(posKey));
    for (const prop of battle.props) {
      if (aimed.has(posKey(prop.pos))) touched.add(prop.id);
    }
  }

  const out: PropForecast[] = [];
  for (const prop of battle.props) {
    if (!touched.has(prop.id)) continue;
    const def = content.props.get(prop.propId);
    if (!def) continue;
    const after = draft.props.find((candidate) => candidate.id === prop.id);
    const destroyed = !after;
    const catchesFire = draft.events.some(
      (event) => event.type === 'propIgnited' && event.propId === prop.id,
    );
    const doused = draft.events.some(
      (event) => event.type === 'propDoused' && event.propId === prop.id,
    );
    const moved = after ? posKey(after.pos) !== posKey(prop.pos) : false;
    const coverRemoved = Boolean(
      tileAt(battle.grid, prop.pos)?.cover && !tileAt(draft.grid, prop.pos)?.cover,
    );
    const affected = propAffectedUnits(content, battle, draft, caster, prop, def);
    out.push({
      id: prop.id,
      propId: prop.propId,
      name: def.name,
      from: prop.pos,
      to: after?.pos ?? null,
      destroyed,
      catchesFire,
      doused,
      moved,
      coverRemoved,
      hpBefore: prop.hp,
      hpAfter: after?.hp ?? null,
      breakLabel: destroyed
        ? (draft.events.find(
            (event): event is Extract<typeof event, { type: 'propDestroyed' }> =>
              event.type === 'propDestroyed' && event.propId === prop.id,
          )?.label ?? def.breakLabel)
        : null,
      affectedAllies: affected.filter((unit) => unit.friendly),
      affectedEnemies: affected.filter((unit) => !unit.friendly),
    });
  }
  return out;
}

function propAffectedUnits(
  content: ContentIndex,
  battle: BattleState,
  draft: BattleDraft,
  caster: Unit,
  prop: BattleState['props'][number],
  def: NonNullable<ReturnType<BattleDraft['propDef']>>,
): PropAffectedUnit[] {
  if (draft.props.some((candidate) => candidate.id === prop.id)) return [];

  const byUnit = new Map<string, PropAffectedUnit>();
  const add = (unit: Unit, statuses: readonly StatusForecast[] = []) => {
    const prior = byUnit.get(unit.id);
    if (prior) {
      byUnit.set(unit.id, { ...prior, statuses: [...prior.statuses, ...statuses] });
      return;
    }
    byUnit.set(unit.id, {
      unitId: unit.id,
      name: unit.name,
      friendly: sameSide(caster, unit),
      statuses,
    });
  };

  const unitAtBreak = (pos: Vec2): Unit | undefined => {
    const key = posKey(pos);
    return battle.units.find(
      (unit) =>
        isAlive(unit) &&
        aliveAtBreak(draft, prop.id, unit.id) &&
        occupiedCells(unit).some((cell) => posKey(cell) === key),
    );
  };

  for (const effect of def.onBreak) {
    const cells = blastTiles(battle.grid, prop.pos, effect.radius);
    for (const cell of cells) {
      const unit = unitAtBreak(cell);
      if (!unit) continue;
      if (effect.kind === 'status') {
        add(unit, [
          previewStatus(content, unit, caster, effect.status, effect.duration, effect.chance),
        ]);
      } else if (effect.kind === 'surface') {
        const surface = content.surfaces.get(effect.surface);
        if (surface?.enterStatus) {
          add(unit, [
            previewStatus(
              content,
              unit,
              caster,
              surface.enterStatus,
              undefined,
              surface.enterStatusChance,
            ),
          ]);
        } else {
          add(unit);
        }
      } else {
        // Direct prop damage and its push effect still tell the player who is
        // in the consequence radius, even when they carry no status.
        add(unit);
      }
    }
  }

  return [...byUnit.values()];
}

/** A direct hit can kill a unit before the same effect breaks a prop. */
function aliveAtBreak(draft: BattleDraft, propId: string, unitId: string): boolean {
  const destroyedIndex = draft.events.findIndex(
    (event) => event.type === 'propDestroyed' && event.propId === propId,
  );
  if (destroyedIndex < 0) return true;
  return !draft.events
    .slice(0, destroyedIndex)
    .some((event) => event.type === 'unitDied' && event.unitId === unitId);
}

/** Groups the raw per-tile changes into one entry per rule that fired. */
function assemble(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  tiles: readonly Vec2[],
  changes: readonly SurfaceChange[],
  statusHits: readonly StatusHit[],
  chainHits: readonly ChainHit[],
): Pick<ReactionForecast, 'entries' | 'catchesFriendly'> {
  const aimed = new Set(tiles.map(posKey));
  const order: string[] = [];
  const byCombo = new Map<
    string,
    {
      change: SurfaceChange;
      tiles: number;
      chainTiles: Set<string>;
      caught: Map<
        string,
        {
          damage: number;
          status: StatusId | null;
          requestedStatus: StatusId | null;
          clearedStatuses: readonly StatusId[];
          statusChance: number;
        }
      >;
    }
  >();

  const slot = (comboId: string, change: SurfaceChange) => {
    let entry = byCombo.get(comboId);
    if (!entry) {
      entry = { change, tiles: 0, chainTiles: new Set(), caught: new Map() };
      byCombo.set(comboId, entry);
      order.push(comboId);
    }
    return entry;
  };

  for (const change of changes) {
    slot(change.comboId, change).tiles += 1;
  }

  // A chain can reach tiles that never changed surface (the far end of a
  // puddle keeps being a puddle), so hits get their own pass and may open an
  // entry the change list never did.
  const noteReach = (comboId: string, pos: Vec2) => {
    const entry = byCombo.get(comboId);
    if (!entry) return;
    if (!aimed.has(posKey(pos))) entry.chainTiles.add(posKey(pos));
  };

  const catchUnit = (
    comboId: string,
    pos: Vec2,
    apply: (into: {
      damage: number;
      status: StatusId | null;
      requestedStatus: StatusId | null;
      clearedStatuses: readonly StatusId[];
      statusChance: number;
    }) => void,
  ) => {
    const entry = byCombo.get(comboId);
    if (!entry) return;
    const unit = unitAt(battle.units, pos);
    if (!unit) return;
    let caught = entry.caught.get(unit.id);
    if (!caught) {
      caught = {
        damage: 0,
        status: null,
        requestedStatus: null,
        clearedStatuses: [],
        statusChance: 0,
      };
      entry.caught.set(unit.id, caught);
    }
    apply(caught);
  };

  for (const hit of chainHits) {
    noteReach(hit.comboId, hit.pos);
    catchUnit(hit.comboId, hit.pos, (into) => {
      into.damage += hit.amount;
    });
  }

  for (const hit of statusHits) {
    noteReach(hit.comboId, hit.pos);
    catchUnit(hit.comboId, hit.pos, (into) => {
      const unit = unitAt(battle.units, hit.pos);
      if (!unit) return;
      const application = previewStatus(content, unit, caster, hit.status, undefined, hit.chance);
      // Two rules landing the same status on one unit is not additive; show
      // the likelier of the two rather than inventing a combined number.
      if (into.status === null || hit.chance > into.statusChance) {
        into.status = application.appliedStatus;
        into.requestedStatus = application.requestedStatus;
        into.clearedStatuses = application.clearedStatuses;
        into.statusChance = hit.chance;
      }
    });
  }

  const entries: ForecastEntry[] = [];
  let catchesFriendly = false;

  for (const comboId of order) {
    const entry = byCombo.get(comboId);
    if (!entry) continue;

    const caught: CaughtUnit[] = [];
    for (const [unitId, hit] of entry.caught) {
      const unit = battle.units.find((u) => u.id === unitId);
      if (!unit) continue;
      const friendly = sameSide(caster, unit);
      if (friendly) catchesFriendly = true;
      caught.push({
        unitId,
        name: unit.name,
        friendly,
        damage: hit.damage,
        status: hit.status,
        requestedStatus: hit.requestedStatus ?? undefined,
        clearedStatuses: hit.clearedStatuses,
        statusChance: hit.statusChance,
      });
    }

    const rule = content.combos.find((c) => c.id === comboId) ?? null;
    entries.push({
      kind: rule ? 'reaction' : 'paint',
      comboId,
      label: entry.change.label,
      from: entry.change.from,
      to: entry.change.to,
      tiles: entry.tiles,
      spreads: (rule?.spread ?? 0) > 0,
      chainTiles: entry.chainTiles.size,
      caught,
    });
  }

  return { entries, catchesFriendly };
}

/**
 * A one-line summary of what a surface does to whoever stands in it, for the
 * reference sheet and the inspector. Built from the surface data rather than
 * written out, so a tuning change to `enterDamage` cannot leave prose behind.
 */
export function describeFooting(content: ContentIndex, surface: SurfaceId): string {
  const def = content.surfaces.get(surface);
  if (!def) return '';

  const parts: string[] = [];
  if (def.enterDamage > 0) parts.push(`${def.enterDamage} damage on entering and each turn in it`);
  if (def.enterStatus) {
    const name = content.statuses.get(def.enterStatus)?.name ?? def.enterStatus;
    parts.push(
      def.enterStatusChance >= 1
        ? `always ${name}`
        : `${Math.round(def.enterStatusChance * 100)}% ${name}`,
    );
  }
  if (def.moveCost > 0) parts.push(`costs ${def.moveCost} extra move`);
  if (def.blocksSight) parts.push('blocks line of sight');
  if (def.grantsCover) parts.push('gives cover');
  if (def.obscures) {
    const penalty = (value: number) => (value < 0 ? `−${Math.abs(value)}` : `+${value}`);
    const inside = penalty(def.obscures.inside);
    const through = penalty(def.obscures.through);
    parts.push(`${inside} to hit anyone inside, ${through} to shoot through`);
  }
  if (parts.length === 0) return 'No effect on whoever stands in it.';
  return `${parts.join(', ')}.`;
}
