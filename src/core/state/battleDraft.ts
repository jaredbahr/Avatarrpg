/**
 * A mutable working copy of a battle.
 *
 * `apply()` is pure with respect to the state it is *given*: nothing here ever
 * touches the caller's `BattleState`. Inside one reducer step, though, a
 * mutable draft is far easier to reason about than threading a dozen
 * intermediate immutable states through ability resolution, so the reducer
 * constructs a draft, mutates it, and calls `toBattle()` at the end.
 *
 * Everything that can damage, move, heal or afflict a unit funnels through
 * here, which means death, surface contact and the resulting events are
 * handled in exactly one place instead of at every call site.
 */

import type { RngCursor } from '../rng';
import type {
  BattlePhase,
  BattleState,
  ContentIndex,
  DamageType,
  GameEvent,
  Grid,
  StatusId,
  SurfaceId,
  TemporaryWall,
  Tile,
  Unit,
  Vec2,
} from '../types';
import {
  DIRECTIONS,
  distance,
  enterCost,
  inBounds,
  occupiedCells,
  occupancy,
  posKey,
  samePos,
  tileAt,
  withTile,
} from '../rules/grid';
import type { MoveContext } from '../rules/grid';
import { applyStatus, removeStatuses, tickStatuses } from '../rules/status';
import {
  MAX_BANKED_TOTAL_AP as MAX_TOTAL_AP,
  clampHp,
  effectiveStats,
  incomingMultiplier,
  isAlive,
  isSkippingTurn,
} from '../rules/stats';
import type { SurfaceReaction } from '../rules/surfaces';
import { applyImpact, contactEffects, paintSurface, tickSurfaces } from '../rules/surfaces';

const WALL_TILE: Tile = {
  terrain: 'wall',
  elevation: 0,
  blocked: true,
  blocksSight: true,
  cover: false,
  surface: null,
};

export class BattleDraft {
  grid: Grid;
  units: Unit[];
  order: string[];
  turnIndex: number;
  round: number;
  phase: BattlePhase;
  temporaryWalls: TemporaryWall[];
  nextUnitSerial: number;
  readonly encounterId: string;
  readonly mapId: string;
  readonly events: GameEvent[] = [];

  constructor(
    readonly content: ContentIndex,
    battle: BattleState,
    readonly rng: RngCursor,
  ) {
    this.grid = battle.grid;
    this.units = [...battle.units];
    this.order = [...battle.order];
    this.turnIndex = battle.turnIndex;
    this.round = battle.round;
    this.phase = battle.phase;
    this.temporaryWalls = [...battle.temporaryWalls];
    this.nextUnitSerial = battle.nextUnitSerial;
    this.encounterId = battle.encounterId;
    this.mapId = battle.mapId;
  }

  toBattle(): BattleState {
    return {
      encounterId: this.encounterId,
      mapId: this.mapId,
      grid: this.grid,
      units: this.units,
      order: this.order,
      turnIndex: this.turnIndex,
      round: this.round,
      phase: this.phase,
      temporaryWalls: this.temporaryWalls,
      nextUnitSerial: this.nextUnitSerial,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Units                                                             */
  /* ---------------------------------------------------------------- */

  unit(id: string): Unit | undefined {
    return this.units.find((u) => u.id === id);
  }

  replace(unit: Unit): void {
    const index = this.units.findIndex((u) => u.id === unit.id);
    if (index === -1) this.units.push(unit);
    else this.units[index] = unit;
  }

  living(): Unit[] {
    return this.units.filter(isAlive);
  }

  unitAt(pos: Vec2): Unit | undefined {
    const key = posKey(pos);
    return this.living().find((u) => occupiedCells(u).some((c) => posKey(c) === key));
  }

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  message(text: string): void {
    this.events.push({ type: 'message', text });
  }

  /** Cells no unit may enter. `exceptId` frees the mover's own cells. */
  blockedCells(exceptId?: string): Set<string> {
    const map = occupancy(this.units.filter((u) => u.id !== exceptId));
    return new Set(map.keys());
  }

  moveContext(unit: Unit): MoveContext {
    return {
      grid: this.grid,
      blocked: this.blockedCells(unit.id),
      surfaces: this.content.surfaces,
      size: unit.size,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Damage, healing, statuses                                         */
  /* ---------------------------------------------------------------- */

  /**
   * The single place HP goes down. `amount` is already post-mitigation for
   * ability damage; environmental damage passes through `incomingMultiplier`
   * here so Wet still halves a fire tile.
   */
  dealDamage(
    unitId: string,
    amount: number,
    damageType: DamageType,
    sourceId: string | null,
    options: { crit?: boolean; applyMultiplier?: boolean } = {},
  ): void {
    const unit = this.unit(unitId);
    if (!unit || !isAlive(unit)) return;

    const scaled = options.applyMultiplier
      ? amount * incomingMultiplier(this.content, unit, damageType)
      : amount;
    const final = Math.max(0, Math.round(scaled));
    if (final <= 0) return;

    const hp = clampHp(unit.hp - final, unit.base.maxHp);
    this.replace({ ...unit, hp });
    this.emit({
      type: 'damaged',
      unitId,
      amount: final,
      crit: options.crit ?? false,
      damageType,
      sourceId,
    });

    if (hp <= 0) this.emit({ type: 'unitDied', unitId });
  }

  heal(unitId: string, amount: number): void {
    const unit = this.unit(unitId);
    if (!unit || !isAlive(unit) || amount <= 0) return;
    const hp = clampHp(unit.hp + amount, unit.base.maxHp);
    const healed = hp - unit.hp;
    if (healed <= 0) return;
    this.replace({ ...unit, hp });
    this.emit({ type: 'healed', unitId, amount: healed });
  }

  applyStatusTo(unitId: string, status: StatusId, duration?: number): void {
    const unit = this.unit(unitId);
    if (!unit || !isAlive(unit)) return;
    const result = applyStatus(this.content, unit, status, duration);
    if (!result.applied) return;
    this.replace(result.unit);

    const applied = result.unit.statuses.find((s) => s.id === result.applied);
    this.emit({
      type: 'statusApplied',
      unitId,
      status: result.applied,
      duration: applied?.duration ?? duration ?? 0,
    });
    for (const cleared of result.cleared) {
      this.emit({ type: 'statusExpired', unitId, status: cleared });
    }
  }

  cleanseFrom(unitId: string, statuses: readonly StatusId[]): void {
    const unit = this.unit(unitId);
    if (!unit) return;
    const { unit: next, removed } = removeStatuses(unit, statuses);
    if (removed.length === 0) return;
    this.replace(next);
    for (const status of removed) this.emit({ type: 'statusExpired', unitId, status });
  }

  grantAp(unitId: string, amount: number): void {
    const unit = this.unit(unitId);
    if (!unit || !isAlive(unit) || amount <= 0) return;
    const cap = effectiveStats(this.content, unit).maxAp + unit.bankedAp;
    this.replace({ ...unit, ap: Math.min(cap + amount, unit.ap + amount) });
  }

  spendAp(unitId: string, amount: number): void {
    const unit = this.unit(unitId);
    if (!unit) return;
    this.replace({ ...unit, ap: Math.max(0, unit.ap - amount) });
  }

  setCooldown(unitId: string, abilityId: string, rounds: number): void {
    const unit = this.unit(unitId);
    if (!unit || rounds <= 0) return;
    this.replace({ ...unit, cooldowns: { ...unit.cooldowns, [abilityId]: rounds } });
  }

  /* ---------------------------------------------------------------- */
  /* Movement                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Puts a unit on a tile and runs surface contact for every cell it now
   * occupies. Used by walking, dashing, and being shoved alike, so nobody can
   * ever slide into a fire tile without feeling it.
   */
  placeUnit(unitId: string, pos: Vec2, options: { contact?: boolean } = {}): void {
    const unit = this.unit(unitId);
    if (!unit) return;
    this.replace({ ...unit, pos });
    if (options.contact === false) return;
    this.applyContact(unitId);
  }

  /** Surface damage and status for the cells a unit stands on right now. */
  applyContact(unitId: string): void {
    const unit = this.unit(unitId);
    if (!unit || !isAlive(unit)) return;

    const seen = new Set<SurfaceId>();
    for (const cell of occupiedCells(unit)) {
      const contact = contactEffects(this.content, this.grid, cell);
      if (!contact.surface || seen.has(contact.surface)) continue;
      seen.add(contact.surface);

      if (contact.damage > 0) {
        this.dealDamage(unitId, contact.damage, contact.damageType, null, {
          applyMultiplier: true,
        });
      }
      if (contact.status && this.rng.chance(contact.statusChance)) {
        this.applyStatusTo(unitId, contact.status);
      }
    }
  }

  /**
   * Shoves a unit directly away from (push) or toward (pull) an origin, one
   * tile at a time, stopping at the first tile it cannot enter. Stopping early
   * against a wall is deliberate: "shove them into the cliff" should do
   * something, and something is better than nothing happening at all.
   */
  shove(unitId: string, origin: Vec2, tiles: number, mode: 'push' | 'pull'): void {
    const unit = this.unit(unitId);
    if (!unit || !isAlive(unit) || tiles <= 0) return;

    const sign = mode === 'push' ? 1 : -1;
    const dx = Math.sign(unit.pos.x - origin.x) * sign;
    const dy = Math.sign(unit.pos.y - origin.y) * sign;
    if (dx === 0 && dy === 0) return;

    const ctx = this.moveContext(unit);
    let current = unit.pos;

    for (let step = 0; step < tiles; step++) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (!inBounds(this.grid, next)) break;
      // Pulling past the origin would look absurd; stop when adjacent.
      if (mode === 'pull' && distance(next, origin) === 0) break;
      if (enterCost(ctx, next) === null) break;
      current = next;
    }

    if (samePos(current, unit.pos)) return;
    this.placeUnit(unitId, current);
    this.emit({ type: 'unitPushed', unitId, to: current });
  }

  /* ---------------------------------------------------------------- */
  /* Terrain                                                           */
  /* ---------------------------------------------------------------- */

  /** Folds a combo-engine reaction into the draft: tiles, statuses and chains. */
  applyReaction(reaction: SurfaceReaction, sourceId: string | null): void {
    if (reaction.grid !== this.grid) this.grid = reaction.grid;

    for (const change of reaction.changes) {
      this.emit({
        type: 'surfaceChanged',
        pos: change.pos,
        from: change.from,
        to: change.to,
        label: change.label,
      });
    }

    for (const hit of reaction.chainHits) {
      const target = this.unitAt(hit.pos);
      if (!target) continue;
      this.dealDamage(target.id, hit.amount, hit.damageType, sourceId, {
        applyMultiplier: true,
      });
    }

    for (const hit of reaction.statusHits) {
      const target = this.unitAt(hit.pos);
      if (!target || !isAlive(target)) continue;
      if (!this.rng.chance(hit.chance)) continue;
      this.applyStatusTo(target.id, hit.status);
    }
  }

  /** Runs the combo table for a damage type landing on a set of tiles. */
  impact(tiles: readonly Vec2[], damageType: DamageType, sourceId: string | null): void {
    const reaction = applyImpact(this.content, this.grid, tiles, damageType);
    this.applyReaction(reaction, sourceId);
  }

  /** Paints a surface, giving the combo table first refusal on each tile. */
  paint(
    tiles: readonly Vec2[],
    surface: SurfaceId,
    duration: number,
    sourceId: string | null,
  ): void {
    const reaction = paintSurface(this.content, this.grid, tiles, surface, duration);
    this.applyReaction(reaction, sourceId);
    // Anyone already standing where a surface just appeared feels it.
    for (const change of reaction.changes) {
      if (!change.to) continue;
      const occupant = this.unitAt(change.pos);
      if (occupant) this.applyContact(occupant.id);
    }
  }

  /** Raises temporary walls. Tiles holding a unit are skipped, not crushed. */
  raiseWall(tiles: readonly Vec2[], duration: number): void {
    for (const pos of tiles) {
      const tile = tileAt(this.grid, pos);
      if (!tile || tile.blocked) continue;
      if (this.unitAt(pos)) continue;
      this.temporaryWalls.push({ pos, untilRound: this.round + duration, previous: tile });
      this.grid = withTile(this.grid, pos, { ...WALL_TILE, elevation: tile.elevation });
      this.emit({
        type: 'surfaceChanged',
        pos,
        from: tile.surface?.id ?? null,
        to: null,
        label: 'A wall of stone rises.',
      });
    }
  }

  /** Drops any wall whose round has arrived. Called during round upkeep. */
  expireWalls(): void {
    const kept: TemporaryWall[] = [];
    for (const wall of this.temporaryWalls) {
      if (wall.untilRound > this.round) {
        kept.push(wall);
        continue;
      }
      this.grid = withTile(this.grid, wall.pos, wall.previous);
      this.emit({
        type: 'surfaceChanged',
        pos: wall.pos,
        from: null,
        to: wall.previous.surface?.id ?? null,
        label: 'The stone wall crumbles.',
      });
    }
    this.temporaryWalls = kept;
  }

  /** Round upkeep for the ground: durations tick, fire crawls outward. */
  tickTerrain(): void {
    const reaction = tickSurfaces(this.content, this.grid);
    this.applyReaction(reaction, null);
    for (const change of reaction.changes) {
      if (!change.to) continue;
      const occupant = this.unitAt(change.pos);
      if (occupant) this.applyContact(occupant.id);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Turn upkeep                                                       */
  /* ---------------------------------------------------------------- */

  /**
   * Start-of-turn upkeep for one unit: cooldowns fall, statuses tick and
   * expire, damage-over-time lands, standing in fire hurts, and AP/move are
   * refilled from base plus whatever was banked.
   *
   * Returns true when the unit loses this turn entirely (Frozen, Stunned).
   * "Skips turn" is read *before* statuses tick, so a 1-round Freeze costs
   * exactly one turn and then falls off — rather than expiring on the turn it
   * was supposed to take away.
   */
  beginTurn(unitId: string): boolean {
    const start = this.unit(unitId);
    if (!start || !isAlive(start)) return false;

    const skipping = isSkippingTurn(this.content, start);

    const cooldowns: Record<string, number> = {};
    for (const [abilityId, rounds] of Object.entries(start.cooldowns)) {
      if (rounds > 1) cooldowns[abilityId] = rounds - 1;
    }
    this.replace({ ...start, cooldowns });

    const ticking = this.unit(unitId);
    if (!ticking) return skipping;
    const tick = tickStatuses(this.content, ticking);
    this.replace(tick.unit);
    for (const status of tick.expired) {
      this.emit({ type: 'statusExpired', unitId, status });
    }
    for (const dot of tick.tickDamage) {
      const type = this.content.statuses.get(dot.source)?.tickDamageType ?? 'pure';
      this.dealDamage(unitId, dot.amount, type, null, { applyMultiplier: true });
    }

    // Standing in fire at the start of your turn hurts again.
    this.applyContact(unitId);

    const refreshed = this.unit(unitId);
    if (!refreshed || !isAlive(refreshed)) return skipping;
    const stats = effectiveStats(this.content, refreshed);
    this.replace({
      ...refreshed,
      ap: skipping ? 0 : Math.max(0, Math.min(MAX_TOTAL_AP, stats.maxAp + refreshed.bankedAp)),
      move: skipping ? 0 : stats.maxMove,
      bankedAp: 0,
    });
    return skipping;
  }

  /** End-of-turn: bank at most one unused AP. */
  endTurn(unitId: string): void {
    const unit = this.unit(unitId);
    if (!unit) return;
    this.replace({ ...unit, bankedAp: Math.min(1, Math.max(0, unit.ap)), ap: 0, move: 0 });
    this.emit({ type: 'turnEnded', unitId });
  }

  /** A free adjacent cell nearest `origin` that `unit` could stand on. */
  findFreeCellNear(unit: Unit, origin: Vec2): Vec2 | null {
    const ctx = this.moveContext(unit);
    let best: Vec2 | null = null;
    let bestDistance = Infinity;
    for (const d of DIRECTIONS) {
      const candidate = { x: origin.x + d.x, y: origin.y + d.y };
      if (enterCost(ctx, candidate) === null) continue;
      const dist = distance(candidate, origin);
      if (dist < bestDistance) {
        bestDistance = dist;
        best = candidate;
      }
    }
    return best;
  }
}
