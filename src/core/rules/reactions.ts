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
  Grid,
  StatusId,
  SurfaceId,
  Unit,
  Vec2,
} from '../types';
import { occupiedCells, posKey } from './grid';
import { applyImpact, paintSurface } from './surfaces';
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
  /** 0-1. 1 means certain. */
  readonly statusChance: number;
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
}

const EMPTY: ReactionForecast = { entries: [], catchesFriendly: false };

/** The two sides the game actually cares about; allies count as party. */
function friendlyTo(caster: Unit, other: Unit): boolean {
  const side = (u: Unit) => (u.faction === 'enemy' ? 'enemy' : 'friendly');
  return side(caster) === side(other);
}

/**
 * Replays the ability's terrain-touching effects against a copy of the grid.
 *
 * Effects run in authored order because that is what `resolveAbility` does and
 * the order matters: an ability that soaks a tile and then chills it makes ice,
 * not a puddle.
 *
 * Known limit, and a deliberate one: a `push` or `pull` earlier in the effect
 * list can shove a unit off a tile before a later effect reaches it, and the
 * forecast does not model that displacement. Every ability in the game today
 * paints or impacts before it shoves, so the two agree; `reactions.test.ts`
 * asserts that for the whole ability list rather than trusting this comment.
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

  let grid: Grid = battle.grid;
  const changes: SurfaceChange[] = [];
  const statusHits: StatusHit[] = [];
  const chainHits: ChainHit[] = [];

  for (const effect of ability.effects) {
    if (effect.kind === 'damage') {
      // The ground reacts wherever the ability landed, hit or miss — so this
      // is certain in a way the damage chips above it are not.
      const reaction = applyImpact(content, grid, tiles, effect.damageType);
      grid = reaction.grid;
      changes.push(...reaction.changes);
      statusHits.push(...reaction.statusHits);
      chainHits.push(...reaction.chainHits);
      continue;
    }
    if (effect.kind === 'surface') {
      const painted = effect.area === 'area' ? tiles : [target];
      const reaction = paintSurface(content, grid, painted, effect.surface, effect.duration);
      grid = reaction.grid;
      changes.push(...reaction.changes);
      statusHits.push(...reaction.statusHits);
      chainHits.push(...reaction.chainHits);
    }
  }

  if (changes.length === 0 && statusHits.length === 0 && chainHits.length === 0) return EMPTY;

  return assemble(content, battle, caster, tiles, changes, statusHits, chainHits);
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
): ReactionForecast {
  const aimed = new Set(tiles.map(posKey));
  const order: string[] = [];
  const byCombo = new Map<
    string,
    {
      change: SurfaceChange;
      tiles: number;
      chainTiles: Set<string>;
      caught: Map<string, { damage: number; status: StatusId | null; statusChance: number }>;
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
    apply: (into: { damage: number; status: StatusId | null; statusChance: number }) => void,
  ) => {
    const entry = byCombo.get(comboId);
    if (!entry) return;
    const unit = unitStandingAt(battle.units, pos);
    if (!unit) return;
    let caught = entry.caught.get(unit.id);
    if (!caught) {
      caught = { damage: 0, status: null, statusChance: 0 };
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
      // Two rules landing the same status on one unit is not additive; show
      // the likelier of the two rather than inventing a combined number.
      if (into.status === null || hit.chance > into.statusChance) {
        into.status = hit.status;
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
