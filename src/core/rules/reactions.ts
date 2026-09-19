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

import type { Ability, BattleState, ContentIndex, StatusId, SurfaceId, Unit, Vec2 } from '../types';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import type { SurfaceContactRecord } from '../state/battleDraft';
import { allowsCasterTarget, blastTiles, occupiedCells, posKey, tileAt } from './grid';
import { applyStatus, removeStatuses } from './status';
import { contactEffects } from './surfaces';
import type { ChainHit, StatusHit, SurfaceChange } from './surfaces';
import { isAlive } from './stats';

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
  readonly id: string;
  readonly name: string;
  readonly friendly: boolean;
  readonly from: Vec2;
  readonly to: Vec2;
  readonly distance: number;
  readonly movedDistance: number;
  readonly mode: 'push' | 'pull';
  readonly blocked: boolean;
  /** Surface contact caused by landing, including the damage/status chance. */
  readonly landingSurfaces: readonly SurfaceId[];
  readonly landingDamage: number;
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

/** The two sides the game actually cares about; allies count as party. */
function friendlyTo(caster: Unit, other: Unit): boolean {
  const side = (u: Unit) => (u.faction === 'enemy' ? 'enemy' : 'friendly');
  return side(caster) === side(other);
}

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
 */
export function forecastReactions(
  content: ContentIndex,
  battle: BattleState,
  caster: Unit,
  ability: Ability,
  target: Vec2,
  tiles: readonly Vec2[],
): ReactionForecast {
  if (tiles.length === 0) return EMPTY;

  // Shared prop rules need a cursor for their status branches. We never read
  // those chance outcomes here, and this detached cursor must never be the
  // live battle cursor or expose its seed in the preview.
  const previewRng = new RngCursor(0);
  const draft = new BattleDraft(content, battle, previewRng, { resolveChanceStatuses: false });
  const struck = battle.units.filter(
    (unit) =>
      isAlive(unit) &&
      (allowsCasterTarget(ability) || unit.id !== caster.id) &&
      occupiedCells(unit).some((cell) => tiles.some((tile) => posKey(tile) === posKey(cell))),
  );
  const hitIds = struck.map((unit) => unit.id);
  const friendlyIds = struck.filter((unit) => friendlyTo(caster, unit)).map((unit) => unit.id);
  const statusForecasts: StatusForecast[] = [];
  const shoves: ShoveForecast[] = [];

  const recipientsForStatus = (to: 'hit' | 'self' | 'allies'): readonly string[] => {
    if (to === 'self') return [caster.id];
    return to === 'allies' ? friendlyIds : hitIds;
  };

  const origin =
    ability.targeting.shape === 'blast' || ability.targeting.shape === 'tile' ? target : caster.pos;

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
            shoveUnitForecast(content, draft, caster, id, origin, effect.distance, effect.kind),
          );
        }
        for (const prop of draft.propsOnTiles(tiles)) {
          shoves.push(
            shovePropForecast(content, draft, prop.id, origin, effect.distance, effect.kind),
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
              friendly: friendlyTo(caster, unit),
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
    const unit = unitStandingAt(draft.units, hit.pos);
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
  for (const event of draft.events) {
    if (event.type !== 'unitPushed') continue;
    const from = lastUnitPositions.get(event.unitId);
    const unit = draft.unit(event.unitId);
    if (!from || !unit) continue;
    const key = `unit:${event.unitId}:${posKey(event.to)}`;
    if (!knownShoves.has(key)) {
      const movedDistance = Math.max(Math.abs(event.to.x - from.x), Math.abs(event.to.y - from.y));
      shoves.push({
        kind: 'unit',
        id: event.unitId,
        name: unit.name,
        friendly: friendlyTo(caster, unit),
        from,
        to: event.to,
        distance: movedDistance,
        movedDistance,
        mode: 'push',
        blocked: false,
        ...landingInfo(content, draft, unit),
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
    friendly: friendlyTo(caster, unit),
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
    const friendly = friendlyTo(caster, unit);
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
): Pick<ShoveForecast, 'landingSurfaces' | 'landingDamage' | 'landingStatuses'> {
  if (!unit) return { landingSurfaces: [], landingDamage: 0, landingStatuses: [] };

  const surfaces: SurfaceId[] = [];
  const statuses: { id: StatusId; chance: number }[] = [];
  let damage = 0;
  for (const cell of occupiedCells(unit)) {
    const contact = contactEffects(content, draft.grid, cell);
    if (!contact.surface || surfaces.includes(contact.surface)) continue;
    surfaces.push(contact.surface);
    damage += contact.damage;
    if (contact.status) statuses.push({ id: contact.status, chance: contact.statusChance });
  }
  return { landingSurfaces: surfaces, landingDamage: damage, landingStatuses: statuses };
}

function shoveUnitForecast(
  content: ContentIndex,
  draft: BattleDraft,
  caster: Unit,
  unitId: string,
  origin: Vec2,
  distance: number,
  mode: 'push' | 'pull',
): ShoveForecast {
  const before = draft.unit(unitId);
  if (!before) {
    return {
      kind: 'unit',
      id: unitId,
      name: unitId,
      friendly: false,
      from: origin,
      to: origin,
      distance,
      movedDistance: 0,
      mode,
      blocked: true,
      ...landingInfo(content, draft, undefined),
    };
  }
  draft.shove(unitId, origin, distance, mode);
  const after = draft.unit(unitId) ?? before;
  return {
    kind: 'unit',
    id: before.id,
    name: before.name,
    friendly: friendlyTo(caster, before),
    from: before.pos,
    to: after.pos,
    distance,
    movedDistance: Math.max(
      Math.abs(after.pos.x - before.pos.x),
      Math.abs(after.pos.y - before.pos.y),
    ),
    mode,
    blocked:
      Math.max(Math.abs(after.pos.x - before.pos.x), Math.abs(after.pos.y - before.pos.y)) <
      distance,
    ...landingInfo(content, draft, after),
  };
}

function shovePropForecast(
  content: ContentIndex,
  draft: BattleDraft,
  propId: string,
  origin: Vec2,
  distance: number,
  mode: 'push' | 'pull',
): ShoveForecast {
  const before = draft.props.find((prop) => prop.id === propId);
  if (!before) {
    return {
      kind: 'prop',
      id: propId,
      name: propId,
      friendly: false,
      from: origin,
      to: origin,
      distance,
      movedDistance: 0,
      mode,
      blocked: true,
      ...landingInfo(content, draft, undefined),
    };
  }
  draft.shoveProp(propId, origin, distance, mode);
  const after = draft.props.find((prop) => prop.id === propId);
  const pushed = [...draft.events]
    .reverse()
    .find(
      (event): event is Extract<typeof event, { type: 'propPushed' }> =>
        event.type === 'propPushed' && event.propId === propId,
    );
  const to = after?.pos ?? pushed?.to ?? before.pos;
  const moved = !samePosition(to, before.pos);
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
    id: before.id,
    name: draft.propDef(before)?.name ?? before.propId,
    friendly: false,
    from: before.pos,
    to,
    distance,
    movedDistance: Math.max(Math.abs(to.x - before.pos.x), Math.abs(to.y - before.pos.y)),
    mode,
    blocked: Math.max(Math.abs(to.x - before.pos.x), Math.abs(to.y - before.pos.y)) < distance,
    ...landingInfo(content, draft, unitLike),
  };
}

function samePosition(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
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
      friendly: friendlyTo(caster, unit),
      statuses,
    });
  };

  const unitAt = (pos: Vec2): Unit | undefined => {
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
      const unit = unitAt(cell);
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
    const unit = unitStandingAt(battle.units, pos);
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
      const unit = unitStandingAt(battle.units, hit.pos);
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
      const friendly = friendlyTo(caster, unit);
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

/** The living unit occupying `pos`, counting the boss's second cell. */
function unitStandingAt(units: readonly Unit[], pos: Vec2): Unit | undefined {
  const key = posKey(pos);
  return units.find((u) => isAlive(u) && occupiedCells(u).some((c) => posKey(c) === key));
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
  if (parts.length === 0) return 'No effect on whoever stands in it.';
  return `${parts.join(', ')}.`;
}
