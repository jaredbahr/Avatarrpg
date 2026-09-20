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
  PropDef,
  PropInstance,
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
  startingAp,
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

/** A contact status described without choosing a chance branch. */
export interface SurfaceContactStatusRecord {
  readonly requestedStatus: StatusId;
  readonly appliedStatus: StatusId | null;
  readonly chance: number;
  readonly clearedStatuses: readonly StatusId[];
}

/** One contact caused by one changed occupied cell during a preview draft. */
export interface SurfaceContactRecord {
  readonly unitId: string;
  readonly surface: SurfaceId;
  /** Actual HP lost after mitigation and the unit's HP floor. */
  readonly damage: number;
  readonly status: SurfaceContactStatusRecord | null;
}

export class BattleDraft {
  grid: Grid;
  units: Unit[];
  order: string[];
  turnIndex: number;
  round: number;
  phase: BattlePhase;
  temporaryWalls: TemporaryWall[];
  props: PropInstance[];
  nextUnitSerial: number;
  readonly encounterId: string;
  readonly variantId: string | null;
  readonly mapId: string;
  /** Preview drafts describe chance branches without choosing one. */
  readonly resolveChanceStatuses: boolean;
  readonly events: GameEvent[] = [];
  /**
   * Terrain reactions produced while this draft runs.  The reducer does not
   * need this journal, but the confirm-step forecast can consume the exact
   * reactions (including ones released by a prop breaking) without copying
   * the combo rules into a second simulator.
   */
  readonly terrainReactions: SurfaceReaction[] = [];
  /**
   * Preview-only journal of the contacts the shared paint path actually ran.
   * Keeping this beside applyContact means a multi-cell unit and a lethal
   * contact cannot drift from the resolver in a second forecast loop.
   */
  readonly surfaceContacts: SurfaceContactRecord[] = [];

  constructor(
    readonly content: ContentIndex,
    battle: BattleState,
    readonly rng: RngCursor,
    options: { readonly resolveChanceStatuses?: boolean } = {},
  ) {
    this.grid = battle.grid;
    this.units = [...battle.units];
    this.order = [...battle.order];
    this.turnIndex = battle.turnIndex;
    this.round = battle.round;
    this.phase = battle.phase;
    this.temporaryWalls = [...battle.temporaryWalls];
    this.props = [...battle.props];
    this.nextUnitSerial = battle.nextUnitSerial;
    this.encounterId = battle.encounterId;
    this.variantId = battle.variantId;
    this.mapId = battle.mapId;
    this.resolveChanceStatuses = options.resolveChanceStatuses ?? true;
  }

  toBattle(): BattleState {
    return {
      encounterId: this.encounterId,
      variantId: this.variantId,
      mapId: this.mapId,
      grid: this.grid,
      units: this.units,
      order: this.order,
      turnIndex: this.turnIndex,
      round: this.round,
      phase: this.phase,
      temporaryWalls: this.temporaryWalls,
      props: this.props,
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
    if (!unit || !isAlive(unit) || !Number.isFinite(amount) || amount <= 0) return;
    if (this.order[this.turnIndex] === unitId) {
      this.replace({ ...unit, ap: Math.min(MAX_TOTAL_AP, unit.ap + amount) });
    } else {
      this.replace({ ...unit, pendingAp: Math.min(MAX_TOTAL_AP, unit.pendingAp + amount) });
    }
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
  applyContact(unitId: string, options: { readonly journal?: boolean } = {}): void {
    const unit = this.unit(unitId);
    if (!unit || !isAlive(unit)) return;

    const seen = new Set<SurfaceId>();
    for (const cell of occupiedCells(unit)) {
      const contact = contactEffects(this.content, this.grid, cell);
      if (!contact.surface || seen.has(contact.surface)) continue;
      seen.add(contact.surface);

      const before = this.unit(unitId);
      const beforeHp = before?.hp ?? 0;
      if (contact.damage > 0) {
        this.dealDamage(unitId, contact.damage, contact.damageType, null, {
          applyMultiplier: true,
        });
      }

      const afterDamage = this.unit(unitId);
      const damage = Math.max(0, beforeHp - (afterDamage?.hp ?? beforeHp));
      let status: SurfaceContactStatusRecord | null = null;
      const statusUnit = this.unit(unitId);
      if (contact.status && statusUnit && isAlive(statusUnit)) {
        const application = applyStatus(this.content, statusUnit, contact.status);
        status = {
          requestedStatus: contact.status,
          appliedStatus: application.applied,
          chance: contact.statusChance,
          clearedStatuses: application.cleared,
        };
      }

      const appliesStatus = this.resolveChanceStatuses
        ? contact.status !== null && this.rng.chance(contact.statusChance)
        : contact.status !== null && contact.statusChance >= 1;
      if (appliesStatus && contact.status) {
        this.applyStatusTo(unitId, contact.status);
      }

      if (!this.resolveChanceStatuses && options.journal) {
        this.surfaceContacts.push({
          unitId,
          surface: contact.surface,
          damage,
          status,
        });
      }
    }
  }

  /**
   * Walks one tile at a time away from (push) or toward (pull) an origin,
   * stopping at the first tile that cannot be entered. Shared by units and props
   * so the two never drift apart on what "shoved into a wall" means.
   *
   * Stopping early against a wall is deliberate: "shove them into the cliff"
   * should do something, and something is better than nothing happening at all.
   */
  private slideFrom(
    ctx: MoveContext,
    from: Vec2,
    origin: Vec2,
    tiles: number,
    mode: 'push' | 'pull',
  ): Vec2 {
    const sign = mode === 'push' ? 1 : -1;
    const dx = Math.sign(from.x - origin.x) * sign;
    const dy = Math.sign(from.y - origin.y) * sign;
    if (dx === 0 && dy === 0) return from;

    let current = from;
    for (let step = 0; step < tiles; step++) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (!inBounds(this.grid, next)) break;
      // Pulling past the origin would look absurd; stop when adjacent.
      if (mode === 'pull' && distance(next, origin) === 0) break;
      if (enterCost(ctx, next) === null) break;
      current = next;
    }
    return current;
  }

  shove(unitId: string, origin: Vec2, tiles: number, mode: 'push' | 'pull'): void {
    const unit = this.unit(unitId);
    if (!unit || !isAlive(unit) || tiles <= 0) return;

    const current = this.slideFrom(this.moveContext(unit), unit.pos, origin, tiles, mode);
    if (samePos(current, unit.pos)) return;
    this.placeUnit(unitId, current);
    this.emit({ type: 'unitPushed', unitId, to: current });
  }

  /* ---------------------------------------------------------------- */
  /* Props                                                             */
  /* ---------------------------------------------------------------- */

  propAt(pos: Vec2): PropInstance | undefined {
    const key = posKey(pos);
    return this.props.find((p) => posKey(p.pos) === key);
  }

  propsOnTiles(tiles: readonly Vec2[]): PropInstance[] {
    const keys = new Set(tiles.map(posKey));
    return this.props.filter((p) => keys.has(posKey(p.pos)));
  }

  propDef(prop: PropInstance): PropDef | undefined {
    return this.content.props.get(prop.propId);
  }

  private replaceProp(prop: PropInstance): void {
    const index = this.props.findIndex((p) => p.id === prop.id);
    if (index === -1) this.props.push(prop);
    else this.props[index] = prop;
  }

  /**
   * Bakes a prop's spatial flags into the tile it stands on and journals the
   * tile it replaced.
   *
   * This is the `raiseWall` pattern, and it is the whole reason props cost almost
   * nothing to integrate: movement, line of sight, cover and the AI's positional
   * scoring all read `Tile`, so a prop that writes itself into the tile is
   * visible to every one of them without a single call site changing.
   */
  placeProp(propId: string, pos: Vec2): PropInstance | undefined {
    const def = this.content.props.get(propId);
    const tile = tileAt(this.grid, pos);
    if (!def || !tile) return undefined;

    const instance: PropInstance = {
      id: `prop${this.nextUnitSerial++}`,
      propId,
      pos,
      hp: def.hp,
      previous: tile,
    };
    this.props.push(instance);
    this.bakeProp(instance, def);
    return instance;
  }

  private bakeProp(prop: PropInstance, def: PropDef): void {
    if (!def.blocksMove && !def.blocksSight && !def.grantsCover) return;
    const tile = tileAt(this.grid, prop.pos);
    if (!tile) return;
    this.grid = withTile(this.grid, prop.pos, {
      ...tile,
      blocked: tile.blocked || def.blocksMove,
      blocksSight: tile.blocksSight || def.blocksSight,
      cover: tile.cover || def.grantsCover,
    });
  }

  /**
   * Damage to a prop is flat: no to-hit roll, no crit, no defence.
   *
   * That is not laziness. `previewAbility` promises it "consumes no RNG, so
   * opening and closing the preview a dozen times cannot change the outcome" —
   * rolling against props would either break that promise or make the preview
   * lie about what is going to happen.
   */
  damageProps(tiles: readonly Vec2[], amount: number, damageType: DamageType): void {
    if (amount <= 0) return;
    for (const prop of this.propsOnTiles(tiles)) {
      this.damageProp(prop.id, amount, damageType);
    }
  }

  damageProp(propId: string, amount: number, damageType: DamageType): void {
    const prop = this.props.find((p) => p.id === propId);
    if (!prop) return;
    const def = this.propDef(prop);
    if (!def) return;

    if (def.immuneTo.includes(damageType)) return;
    const dealt = def.vulnerableTo.includes(damageType) ? amount * 2 : amount;
    const hp = prop.hp - dealt;

    this.emit({ type: 'propDamaged', propId, name: def.name, amount: dealt, pos: prop.pos });

    if (hp > 0) {
      this.replaceProp({ ...prop, hp });
      return;
    }
    this.breakProp(propId);
  }

  /**
   * Breaks a prop and runs what it was holding.
   *
   * The tile is restored *first*. `paintSurface` and `applyImpact` both skip a
   * blocked tile, so a barrel that is still standing when its own water is
   * painted would be painting onto itself and getting nothing.
   */
  breakProp(propId: string): void {
    const prop = this.props.find((p) => p.id === propId);
    if (!prop) return;
    const def = this.propDef(prop);

    this.props = this.props.filter((p) => p.id !== propId);
    this.grid = withTile(this.grid, prop.pos, prop.previous);
    if (!def) return;

    this.emit({ type: 'propDestroyed', propId, pos: prop.pos, label: def.breakLabel });

    for (const effect of def.onBreak) {
      const tiles = this.tilesAround(prop.pos, effect.radius);
      switch (effect.kind) {
        case 'surface':
          this.paint(tiles, effect.surface, effect.duration, null);
          break;
        case 'damage':
          for (const tile of tiles) {
            const victim = this.unitAt(tile);
            if (!victim) continue;
            this.dealDamage(victim.id, effect.base, effect.damageType, null, {
              applyMultiplier: true,
            });
          }
          // The ground reacts too, so a brazier's coals can find the oil.
          this.impact(tiles, effect.damageType, null);
          break;
        case 'status':
          for (const tile of tiles) {
            const victim = this.unitAt(tile);
            if (!victim || !isAlive(victim)) continue;
            const appliesStatus = this.resolveChanceStatuses
              ? this.rng.chance(effect.chance)
              : effect.chance >= 1;
            if (!appliesStatus) continue;
            this.applyStatusTo(victim.id, effect.status, effect.duration);
          }
          break;
        case 'push':
          for (const tile of tiles) {
            const victim = this.unitAt(tile);
            if (!victim) continue;
            this.shove(victim.id, prop.pos, effect.distance, 'push');
          }
          break;
      }
    }
  }

  /** Shoves a prop, if it is the sort of prop that shoves. */
  shoveProp(propId: string, origin: Vec2, tiles: number, mode: 'push' | 'pull'): void {
    const prop = this.props.find((p) => p.id === propId);
    if (!prop || tiles <= 0) return;
    const def = this.propDef(prop);
    if (!def || !def.pushable) return;

    // Unbake before pathing, or a blocking prop's own tile reads as impassable
    // and nothing can ever move.
    this.grid = withTile(this.grid, prop.pos, prop.previous);

    const ctx: MoveContext = {
      grid: this.grid,
      blocked: this.blockedCells(),
      surfaces: this.content.surfaces,
      size: 1,
    };
    const landing = this.slideFrom(ctx, prop.pos, origin, tiles, mode);

    if (samePos(landing, prop.pos)) {
      this.bakeProp(prop, def);
      return;
    }

    const arriving = tileAt(this.grid, landing);
    if (!arriving) {
      this.bakeProp(prop, def);
      return;
    }

    const moved: PropInstance = { ...prop, pos: landing, previous: arriving };
    this.replaceProp(moved);
    this.bakeProp(moved, def);
    this.emit({ type: 'propPushed', propId, to: landing });

    // A barrel rolled into a fire is the point of barrels.
    const contact = contactEffects(this.content, this.grid, landing);
    if (contact.damage > 0) this.damageProp(propId, contact.damage, contact.damageType);
  }

  /**
   * The worst damaging surface a prop is standing in, or standing next to.
   *
   * The neighbour check exists because a solid prop bakes `blocked` into its own
   * tile, and `paintSurface` refuses to paint a blocked tile — so fire can never
   * appear *underneath* a hay bale. Physically that is right (there is a bale
   * there, not ground), but "the fire reached the hay and nothing happened" is
   * the wrong answer to the only question a player is asking. For a solid prop,
   * the fire at its feet is in the next tile over, so that is where we look.
   */
  private surfaceExposure(
    prop: PropInstance,
  ): { damage: number; damageType: DamageType } | undefined {
    const own = contactEffects(this.content, this.grid, prop.pos);
    if (own.damage > 0) return { damage: own.damage, damageType: own.damageType };

    const tile = tileAt(this.grid, prop.pos);
    if (!tile?.blocked) return undefined;

    let worst: { damage: number; damageType: DamageType } | undefined;
    for (const dir of DIRECTIONS) {
      const neighbour = { x: prop.pos.x + dir.x, y: prop.pos.y + dir.y };
      if (!inBounds(this.grid, neighbour)) continue;
      const contact = contactEffects(this.content, this.grid, neighbour);
      if (contact.damage <= 0) continue;
      if (!worst || contact.damage > worst.damage) {
        worst = { damage: contact.damage, damageType: contact.damageType };
      }
    }
    return worst;
  }

  /** Cells within `radius` of a centre, clamped to the grid. */
  private tilesAround(centre: Vec2, radius: number): Vec2[] {
    if (radius <= 0) return [centre];
    const out: Vec2[] = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const pos = { x: centre.x + dx, y: centre.y + dy };
        if (inBounds(this.grid, pos)) out.push(pos);
      }
    }
    return out;
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
      const appliesStatus = this.resolveChanceStatuses
        ? this.rng.chance(hit.chance)
        : hit.chance >= 1;
      if (!appliesStatus) continue;
      this.applyStatusTo(target.id, hit.status);
    }
  }

  /** Runs the combo table for a damage type landing on a set of tiles. */
  impact(tiles: readonly Vec2[], damageType: DamageType, sourceId: string | null): SurfaceReaction {
    const reaction = applyImpact(this.content, this.grid, tiles, damageType);
    this.terrainReactions.push(reaction);
    this.applyReaction(reaction, sourceId);
    return reaction;
  }

  /** Paints a surface, giving the combo table first refusal on each tile. */
  paint(
    tiles: readonly Vec2[],
    surface: SurfaceId,
    duration: number,
    sourceId: string | null,
  ): SurfaceReaction {
    const reaction = paintSurface(this.content, this.grid, tiles, surface, duration);
    this.terrainReactions.push(reaction);
    this.applyReaction(reaction, sourceId);
    // Anyone already standing where a surface just appeared feels it.
    for (const change of reaction.changes) {
      if (!change.to) continue;
      const occupant = this.unitAt(change.pos);
      if (occupant) this.applyContact(occupant.id, { journal: true });
    }
    return reaction;
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

    /*
     * Props burn too. Without this, fire creeping across the map stops dead at a
     * hay bale, which is exactly backwards — and "light the oil at one end of the
     * line of flasks" is the sort of plan the whole feature exists to reward.
     *
     * Snapshotted because breaking one prop can paint fire onto the next.
     */
    for (const prop of [...this.props]) {
      if (!this.props.some((p) => p.id === prop.id)) continue;
      const exposure = this.surfaceExposure(prop);
      if (exposure) this.damageProp(prop.id, exposure.damage, exposure.damageType);
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
      ap: skipping ? 0 : startingAp(this.content, refreshed),
      move: skipping ? 0 : stats.maxMove,
      bankedAp: 0,
      pendingAp: 0,
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
