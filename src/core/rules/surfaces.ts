/**
 * The combo engine.
 *
 * Everything that changes a tile's surface goes through here: ability damage
 * landing on a tile, an ability painting a surface, and the per-round upkeep
 * that burns durations down and lets fire spread.
 *
 * The functions return *descriptions* of what should happen to units (status
 * hits, chain damage) rather than applying them. The reducer owns unit
 * mutation so that death, events and XP are handled in exactly one place.
 */

import type {
  ComboRule,
  ContentIndex,
  DamageType,
  Grid,
  StatusId,
  SurfaceId,
  Vec2,
} from '../types';
import { ORTHOGONAL, connectedSurface, inBounds, posKey, tileAt, withSurface } from './grid';

export interface SurfaceChange {
  readonly pos: Vec2;
  readonly from: SurfaceId | null;
  readonly to: SurfaceId | null;
  readonly label: string;
  readonly comboId: string;
}

export interface StatusHit {
  readonly pos: Vec2;
  readonly status: StatusId;
  readonly chance: number;
  /** The rule that caused it, so the confirm-step preview can attribute it. */
  readonly comboId: string;
}

export interface ChainHit {
  readonly pos: Vec2;
  readonly amount: number;
  readonly damageType: DamageType;
  readonly comboId: string;
}

export interface SurfaceReaction {
  readonly grid: Grid;
  readonly changes: readonly SurfaceChange[];
  readonly statusHits: readonly StatusHit[];
  readonly chainHits: readonly ChainHit[];
}

const NO_REACTION = (grid: Grid): SurfaceReaction => ({
  grid,
  changes: [],
  statusHits: [],
  chainHits: [],
});

/** First matching rule wins — the table is ordered specific-to-general. */
export function findCombo(
  content: ContentIndex,
  existing: SurfaceId | null,
  applied: DamageType | SurfaceId,
): ComboRule | null {
  return content.combos.find((r) => r.existing === existing && r.applied === applied) ?? null;
}

function resolveDuration(content: ContentIndex, id: SurfaceId, requested: number): number {
  if (requested !== 0) return requested;
  return content.surfaces.get(id)?.defaultDuration ?? 2;
}

/**
 * Runs the combo table over a set of tiles that were just hit by `applied`.
 *
 * Chain rules (lightning into a puddle) are resolved against the grid *before*
 * the tile is transformed, so the whole puddle is found while it is still a
 * puddle.
 */
export function applyImpact(
  content: ContentIndex,
  grid: Grid,
  positions: readonly Vec2[],
  applied: DamageType | SurfaceId,
): SurfaceReaction {
  let next = grid;
  const changes: SurfaceChange[] = [];
  const statusHits: StatusHit[] = [];
  const chainHits: ChainHit[] = [];
  const chained = new Set<string>();

  for (const pos of positions) {
    const tile = tileAt(next, pos);
    if (!tile || tile.blocked) continue;

    const existing = tile.surface?.id ?? null;
    const rule = findCombo(content, existing, applied);
    if (!rule) continue;

    if (rule.chainThroughExisting && existing) {
      for (const cell of connectedSurface(next, pos, existing)) {
        const key = posKey(cell);
        if (chained.has(key)) continue;
        chained.add(key);
        if (rule.chainDamage > 0) {
          chainHits.push({
            pos: cell,
            amount: rule.chainDamage,
            damageType: typeof applied === 'string' ? toDamageType(applied) : 'pure',
            comboId: rule.id,
          });
        }
        if (rule.status) {
          statusHits.push({
            pos: cell,
            status: rule.status,
            chance: rule.statusChance,
            comboId: rule.id,
          });
        }
      }
    }

    next = rule.result
      ? withSurface(next, pos, {
          id: rule.result,
          duration: resolveDuration(content, rule.result, rule.duration),
          spread: rule.spread,
        })
      : withSurface(next, pos, null);

    changes.push({
      pos,
      from: existing,
      to: rule.result,
      label: rule.label,
      comboId: rule.id,
    });

    if (rule.status && !rule.chainThroughExisting) {
      statusHits.push({
        pos,
        status: rule.status,
        chance: rule.statusChance,
        comboId: rule.id,
      });
    }
  }

  if (changes.length === 0 && chainHits.length === 0 && statusHits.length === 0) {
    return NO_REACTION(grid);
  }
  return { grid: next, changes, statusHits, chainHits };
}

/** DamageType and SurfaceId overlap on 'fire'/'water'; everything else is pure. */
function toDamageType(applied: DamageType | SurfaceId): DamageType {
  switch (applied) {
    case 'fire':
    case 'water':
    case 'earth':
    case 'air':
    case 'lightning':
    case 'cold':
    case 'physical':
    case 'pure':
      return applied;
    case 'ice':
      return 'cold';
    case 'mud':
    case 'rubble':
      return 'earth';
    case 'steam':
    case 'oil':
      return 'pure';
    default:
      return 'pure';
  }
}

/**
 * Paints a surface onto tiles (an ability's `surface` effect).
 *
 * If the tile already carries a surface, the combo table gets first refusal —
 * a Fire Wall cast into a puddle makes steam rather than stubbornly becoming
 * fire. Only when no rule matches does the new surface simply replace the old.
 */
export function paintSurface(
  content: ContentIndex,
  grid: Grid,
  positions: readonly Vec2[],
  surface: SurfaceId,
  duration: number,
): SurfaceReaction {
  let next = grid;
  const changes: SurfaceChange[] = [];
  const statusHits: StatusHit[] = [];
  const chainHits: ChainHit[] = [];

  for (const pos of positions) {
    const tile = tileAt(next, pos);
    if (!tile || tile.blocked) continue;

    const existing = tile.surface?.id ?? null;

    if (existing) {
      const reaction = applyImpact(content, next, [pos], surface);
      if (reaction.changes.length > 0) {
        next = reaction.grid;
        changes.push(...reaction.changes);
        statusHits.push(...reaction.statusHits);
        chainHits.push(...reaction.chainHits);
        continue;
      }
      if (existing === surface) {
        // Refresh rather than stack.
        next = withSurface(next, pos, {
          id: surface,
          duration: Math.max(tile.surface?.duration ?? 0, duration),
          spread: tile.surface?.spread ?? 0,
        });
        continue;
      }
    }

    next = withSurface(next, pos, { id: surface, duration, spread: 0 });
    changes.push({
      pos,
      from: existing,
      to: surface,
      label: `${content.surfaces.get(surface)?.name ?? surface} spreads across the ground.`,
      comboId: 'paint',
    });
  }

  if (changes.length === 0) return NO_REACTION(grid);
  return { grid: next, changes, statusHits, chainHits };
}

/**
 * Per-round upkeep: durations tick down, expired surfaces vanish, and fire with
 * spread left crawls one tile outward.
 *
 * Spread is computed against a snapshot so a single upkeep never cascades
 * across the whole map in one round — fire advances exactly one ring per round.
 */
export function tickSurfaces(content: ContentIndex, grid: Grid): SurfaceReaction {
  let next = grid;
  const changes: SurfaceChange[] = [];

  const spreadFrom: { pos: Vec2; duration: number; spread: number }[] = [];

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const pos = { x, y };
      const tile = tileAt(grid, pos);
      if (!tile?.surface) continue;
      const surface = tile.surface;

      if (surface.spread > 0 && surface.id === 'fire') {
        spreadFrom.push({ pos, duration: surface.duration, spread: surface.spread });
      }

      if (surface.duration < 0) continue; // permanent

      const duration = surface.duration - 1;
      if (duration <= 0) {
        next = withSurface(next, pos, null);
        changes.push({
          pos,
          from: surface.id,
          to: null,
          label: `${content.surfaces.get(surface.id)?.name ?? surface.id} fades.`,
          comboId: 'expire',
        });
        continue;
      }
      next = withSurface(next, pos, { ...surface, duration });
    }
  }

  for (const source of spreadFrom) {
    for (const d of ORTHOGONAL) {
      const target = { x: source.pos.x + d.x, y: source.pos.y + d.y };
      if (!inBounds(next, target)) continue;
      const tile = tileAt(next, target);
      if (!tile || tile.blocked) continue;
      // Fire spreads onto bare ground and, eagerly, onto oil.
      const existing = tile.surface?.id ?? null;
      if (existing !== null && existing !== 'oil') continue;
      next = withSurface(next, target, {
        id: 'fire',
        duration: Math.max(1, source.duration - 1),
        spread: source.spread - 1,
      });
      changes.push({
        pos: target,
        from: existing,
        to: 'fire',
        label: 'The fire spreads!',
        comboId: 'spread',
      });
    }
    // The source tile has spent one ring of spread.
    const tile = tileAt(next, source.pos);
    if (tile?.surface && tile.surface.id === 'fire') {
      next = withSurface(next, source.pos, {
        ...tile.surface,
        spread: Math.max(0, tile.surface.spread - 1),
      });
    }
  }

  if (changes.length === 0) return NO_REACTION(grid);
  return { grid: next, changes, statusHits: [], chainHits: [] };
}

/** What standing on this tile does to whoever is on it. */
export interface SurfaceContact {
  readonly damage: number;
  readonly damageType: DamageType;
  readonly status: StatusId | null;
  readonly statusChance: number;
  readonly surface: SurfaceId | null;
}

export function contactEffects(content: ContentIndex, grid: Grid, pos: Vec2): SurfaceContact {
  const tile = tileAt(grid, pos);
  const surface = tile?.surface;
  if (!surface) {
    return { damage: 0, damageType: 'pure', status: null, statusChance: 0, surface: null };
  }
  const def = content.surfaces.get(surface.id);
  if (!def) {
    return { damage: 0, damageType: 'pure', status: null, statusChance: 0, surface: surface.id };
  }
  return {
    damage: def.enterDamage,
    damageType: def.enterDamageType,
    status: def.enterStatus,
    statusChance: def.enterStatusChance,
    surface: surface.id,
  };
}
