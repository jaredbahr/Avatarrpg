/**
 * Repairs a loaded game against the current content.
 *
 * A save is a snapshot of a party, not of the rules that made it. Between a
 * family closing the lid on a Saturday and opening it again, the kits can have
 * moved: a discipline gate added, a level it sits at changed. The save is not
 * wrong — it just predates the gate.
 *
 * `migrate` in `serialize.ts` cannot fix this, because it works on raw JSON and
 * has no content to look a kit up in. This does, and it runs on load.
 *
 * The rule it enforces is narrow on purpose: a party member who is at or past a
 * discipline gate and has not taken a path is owed the pick. Owing it again is
 * harmless (the dialog simply appears), where *not* owing it means a player
 * quietly never receives the reward for the level they earned.
 */

import type {
  BattleState,
  ContentIndex,
  GameState,
  Grid,
  MapDef,
  PendingChoice,
  ResidentDef,
  ResidentSlot,
  ResidentSlotValue,
  Vec2,
} from '../types';
import {
  buildGrid,
  cachedGrid,
  occupiedCells,
  posKey,
  reachable,
  tileAt,
  withTile,
} from '../rules/grid';
import { SQUARE_FOOTPRINTS } from '../rules/footprint';
import { specializationsUpTo } from '../rules/leveling';
import { settle } from '../story/settle';
import { npcResident } from '../story/residents';

export function reconcileDisciplines(content: ContentIndex, state: GameState): GameState {
  const owed: PendingChoice[] = [];

  for (const member of state.party) {
    if (member.disciplineId) continue;
    if (!member.characterId) continue;

    const character = content.characters.get(member.characterId);
    if (!character) continue;

    const options = specializationsUpTo(character.kit, member.level);
    if (options.length === 0) continue;

    const alreadyOffered = state.pendingChoices.some(
      (c) => c.unitId === member.id && c.kind === 'discipline',
    );
    if (alreadyOffered) continue;

    owed.push({ unitId: member.id, level: member.level, kind: 'discipline', options });
  }

  if (owed.length === 0) return state;
  return { ...state, pendingChoices: [...state.pendingChoices, ...owed] };
}

/**
 * Repairs a loaded game's world state (ADR 0047 §5). Runs `settle` silently
 * (no events: there is nothing to animate on a load), which clears a pin
 * whose screen or map no longer holds it and steps the leader off an NPC
 * tile, then clears the one kind of stale pin `settle` cannot see: content
 * that has drifted since the save, so the pinned NpcDef, its resident
 * binding or the pinned map anchor no longer exists. Before `settle`, it
 * snaps a saved explore position back onto walkable ground when a map edit
 * has buried it (M9). Idempotent.
 */
export function reconcileWorld(content: ContentIndex, state: GameState): GameState {
  // Snap first, so `settle` then sees the repaired tile: if the nearest
  // walkable cell happens to be one somebody else is standing on, the
  // leader step moves the party off it in the same pass.
  const snapped = snapExplore(content, reconcileBattle(content, state));
  const settled = settle(content, snapped, snapped).state;
  const talk = settled.world.talk;
  if (!talk) return settled;
  const resident = npcResident(content, talk.mapId, talk.npcId);
  const record = resident ? content.residents.get(resident) : undefined;
  const site = content.anchors.get(talk.anchor)?.site;
  const holds =
    record !== undefined &&
    residentSlots(record).some((slot) => slot.anchor === talk.anchor && slot.npc === talk.npcId) &&
    site?.kind === 'map' &&
    site.mapId === talk.mapId;
  return holds ? settled : { ...settled, world: { ...settled.world, talk: null } };
}

export type BattleReconcileWarning =
  | { readonly kind: 'missing-map'; readonly mapId: string }
  | { readonly kind: 'disconnected-snap'; readonly unitId: string; readonly pos: Vec2 }
  | { readonly kind: 'no-free-cell'; readonly unitId: string };

export interface BattleReconcileResult {
  readonly state: GameState;
  readonly warnings: readonly BattleReconcileWarning[];
}

export interface ReconcileBattleOptions {
  /**
   * TEMPORARY COMPATIBILITY GATE (see `rules/footprint.ts`): when true a
   * buried size-2 unit is snapped to a whole 2x2 square, not the legacy 2x1
   * pair. Tests pass it in rather than mutating module state; shipped loads
   * default to `SQUARE_FOOTPRINTS`, so shipped loads use square behaviour.
   */
  readonly squareFootprints?: boolean;
  /**
   * @internal Test seam for proving the square-anchor flood stays component-bounded.
   * Callers must pass a flood with `reachable`'s stop/reachability semantics.
   */
  readonly reachable?: typeof reachable;
}

/**
 * Re-applies an in-progress battle's current authored terrain after a map edit.
 * Surfaces, props and temporary walls are battle state, so they are layered
 * back over that terrain and their restore journals are updated. Idempotent:
 * when the saved static cells already match the current map, the grid is not
 * rebuilt. The square-footprint pass still runs over an unchanged map, because
 * a legacy save can hold a size-2 anchor that is open as a 2x1 but buried as a
 * 2x2 — the migration the A-6 flip needs — and snapping it touches no terrain.
 * Rebuilding is atomic: if a living unit cannot fit in the rebuilt map's main
 * walkable component, the old battle grid is retained so its units and terrain
 * remain mutually consistent. With the footprint gate off, an unchanged map is
 * still returned verbatim.
 */
export function reconcileBattle(
  content: ContentIndex,
  state: GameState,
  options: ReconcileBattleOptions = {},
): GameState {
  return reconcileBattleResult(content, state, options).state;
}

/** Detailed form used by the load path so an unsafe repair is never silent. */
export function reconcileBattleResult(
  content: ContentIndex,
  state: GameState,
  options: ReconcileBattleOptions = {},
): BattleReconcileResult {
  const battle = state.battle;
  if (!battle || battle.phase !== 'active') return { state, warnings: [] };
  const map = content.maps.get(battle.mapId);
  if (!map) return { state, warnings: [{ kind: 'missing-map', mapId: battle.mapId }] };
  const square = options.squareFootprints ?? SQUARE_FOOTPRINTS;
  // Enemy definitions own presentation keys. This also covers story allies,
  // whose enemyId points at the same definitions, without rebuilding saved
  // health, stats, or any other battle state.
  const units = battle.units.map((unit) => {
    const sprite = unit.enemyId ? content.enemies.get(unit.enemyId)?.sprite : undefined;
    return sprite && sprite !== unit.sprite ? { ...unit, sprite } : unit;
  });
  const presentationChanged = units.some((unit, index) => unit !== battle.units[index]);
  // What to hand back when nothing else changes: the saved state, with fresh sprites if any moved on.
  const refreshed = presentationChanged ? { ...state, battle: { ...battle, units } } : state;

  const authored = buildGrid(map);
  if (staticGridMatches(authored, battle)) {
    if (!square) return { state: refreshed, warnings: [] };
    // Terrain needs no rebuild, but the saved anchor may still be illegal as a
    // square: open as a legacy 2x1, yet blocked, off-map or overlapping as a
    // 2x2. Snap it against the live grid (props and temporary walls included),
    // and leave the save untouched when every unit already fits.
    const snapped = snapBattleUnits(battle.grid, map, units, square, content, options.reachable);
    if (!snapped.units) return { state: refreshed, warnings: snapped.warnings };
    if (!presentationChanged && snapped.units.every((unit, index) => unit === units[index]))
      return { state, warnings: snapped.warnings };
    return {
      state: { ...state, battle: { ...battle, units: snapped.units } },
      warnings: snapped.warnings,
    };
  }

  let grid: Grid = {
    ...authored,
    tiles: authored.tiles.map((tile, index) => {
      const pos = { x: index % authored.width, y: Math.floor(index / authored.width) };
      const saved = savedBaseTile(battle, pos);
      const staticChanged = saved === undefined || !staticTileMatches(tile, saved);
      const savedSurface = saved?.surface ?? null;
      // Temporary surfaces remain live battle state. Null/permanent surfaces on a
      // changed cell follow the newly authored map (for example M3's added water).
      const surface =
        staticChanged && (savedSurface === null || savedSurface.duration === -1)
          ? tile.surface
          : savedSurface;
      return { ...tile, surface: tile.blocked ? null : surface };
    }),
  };

  const props: BattleState['props'][number][] = [];
  for (const prop of battle.props) {
    const tile = tileAt(grid, prop.pos);
    const authoredTile = tileAt(authored, prop.pos);
    const def = content.props.get(prop.propId);
    // Decide whether the prop survives from authored terrain only. `tile` can
    // already be blocked by another saved prop legally pushed onto this cell.
    if (!tile || !authoredTile || authoredTile.blocked || !def) continue;
    // The journal deliberately captures the current rebuilt tile, including a
    // prior prop's saved original tile/surface. Breaking this prop in play then
    // restores exactly the same chained state as it did before the load (F2).
    // The spread keeps live per-instance state too — `burning` (B-1) rides
    // along here — so never rebuild a prop field by field.
    props.push({ ...prop, previous: tile });
    grid = withTile(grid, prop.pos, {
      ...tile,
      blocked: tile.blocked || def.blocksMove,
      blocksSight: tile.blocksSight || def.blocksSight,
      cover: tile.cover || def.grantsCover,
    });
  }

  const temporaryWalls: BattleState['temporaryWalls'][number][] = [];
  for (const wall of battle.temporaryWalls) {
    const tile = tileAt(grid, wall.pos);
    if (!tile) continue;
    temporaryWalls.push({ ...wall, previous: tile });
    grid = withTile(grid, wall.pos, {
      terrain: 'wall',
      elevation: tile.elevation,
      blocked: true,
      blocksSight: true,
      cover: false,
      surface: null,
    });
  }

  const snapped = snapBattleUnits(grid, map, units, square, content, options.reachable);
  if (!snapped.units) return { state: refreshed, warnings: snapped.warnings };
  return {
    state: {
      ...state,
      battle: { ...battle, grid, props, temporaryWalls, units: snapped.units },
    },
    warnings: snapped.warnings,
  };
}

/** Read through baked dynamic overlays to the tile whose static fields came from the map. */
function savedBaseTile(battle: BattleState, pos: Vec2) {
  const prop = battle.props.find((item) => item.pos.x === pos.x && item.pos.y === pos.y);
  const wall = battle.temporaryWalls.find((item) => item.pos.x === pos.x && item.pos.y === pos.y);
  return prop?.previous ?? wall?.previous ?? tileAt(battle.grid, pos);
}

function staticGridMatches(authored: Grid, battle: BattleState): boolean {
  if (authored.width !== battle.grid.width || authored.height !== battle.grid.height) return false;
  return authored.tiles.every((current, index) => {
    const saved = savedBaseTile(battle, {
      x: index % authored.width,
      y: Math.floor(index / authored.width),
    });
    return saved !== undefined && staticTileMatches(current, saved);
  });
}

function staticTileMatches(current: Grid['tiles'][number], saved: Grid['tiles'][number]): boolean {
  return (
    current.terrain === saved.terrain &&
    current.elevation === saved.elevation &&
    current.blocked === saved.blocked &&
    current.blocksSight === saved.blocksSight &&
    current.cover === saved.cover
  );
}

/** Snap buried living units in array order; distance ties are row-major. */
function snapBattleUnits(
  grid: Grid,
  map: MapDef,
  units: BattleState['units'],
  square: boolean,
  content: ContentIndex,
  reachableOverride?: typeof reachable,
): { units: BattleState['units'] | null; warnings: BattleReconcileWarning[] } {
  const warnings: BattleReconcileWarning[] = [];
  const flood = reachableOverride ?? reachable;
  const main = mainWalkableCells(grid, map);
  const owners = new Map<string, string>();
  const flat = (unit: BattleState['units'][number], pos = unit.pos): boolean => {
    if (!square || unit.size !== 2) return true;
    let elevation: number | undefined;
    return occupiedCells({ pos, size: unit.size }, square).every((cell) => {
      const tile = tileAt(grid, cell);
      if (!tile) return false;
      if (elevation === undefined) elevation = tile.elevation;
      return tile.elevation === elevation;
    });
  };
  for (const unit of units) {
    if (unit.hp <= 0) continue;
    const cells = occupiedCells(unit, square);
    if (
      cells.every((cell) => {
        const tile = tileAt(grid, cell);
        return tile !== undefined && !tile.blocked && !owners.has(posKey(cell));
      }) &&
      flat(unit)
    ) {
      for (const cell of cells) owners.set(posKey(cell), unit.id);
    }
  }
  const valid = (unit: BattleState['units'][number], pos = unit.pos): boolean =>
    flat(unit, pos) &&
    occupiedCells({ pos, size: unit.size }, square).every((cell) => {
      const tile = tileAt(grid, cell);
      return tile !== undefined && !tile.blocked && !owners.has(posKey(cell));
    });
  /**
   * A square candidate must be in the same anchor component as the party, not
   * merely have each of its cells in the one-cell component.  The latter lets
   * a 2x2 jump through a one-cell corridor: every tile is reachable, while no
   * square anchor is.  `reachable` deliberately expands through transitional
   * (non-flat) footprints and only records standable anchors, mirroring the
   * content validator's squareReachFrom flood.
   */
  // A spawn buried by a map edit is not a meaningful connectivity target. When
  // every authored spawn is buried, retain mainWalkableCells' deterministic
  // fallback to the first walkable terrain cell instead.
  const walkableSpawns = map.partySpawns.filter((spawn) => walkable(grid, spawn));
  const partyTargets =
    walkableSpawns.length > 0
      ? walkableSpawns
      : grid.tiles
          .map((_, index) => ({ x: index % grid.width, y: Math.floor(index / grid.width) }))
          .filter((pos) => walkable(grid, pos))
          .slice(0, 1);
  const anchorNearParty = (anchor: Vec2): boolean =>
    occupiedCells({ pos: anchor, size: 2 }, true).some((cell) =>
      partyTargets.some(
        (spawn) => Math.max(Math.abs(cell.x - spawn.x), Math.abs(cell.y - spawn.y)) <= 1,
      ),
    );

  // `result` contains the units already repaired in this pass. Keep later
  // units from disappearing from contact checks, while ensuring an opponent
  // moved earlier in the loop is tested at its current (not stale) position.
  const result: BattleState['units'][number][] = [];
  const currentUnit = (unit: BattleState['units'][number]): BattleState['units'][number] =>
    result.find((candidate) => candidate.id === unit.id) ?? unit;
  const contactable = (unit: BattleState['units'][number], anchor: Vec2): boolean =>
    units.some(
      (opponent) =>
        opponent.hp > 0 &&
        opponent.faction !== unit.faction &&
        occupiedCells(currentUnit(opponent), true).some((cell) =>
          occupiedCells({ pos: anchor, size: unit.size }, true).some(
            (ownCell) => Math.max(Math.abs(cell.x - ownCell.x), Math.abs(cell.y - ownCell.y)) <= 1,
          ),
        ),
    );

  // A terrain-only flood defines connectivity. A second flood, with living
  // units blocked, defines contact reachability. Cache every stop in each
  // component so a buried unit does not run a full Infinity flood per anchor.
  const terrainInfo = new Map<string, boolean>();
  const contactInfo = new Map<string, boolean>();
  const anchorInfoFor = (unit: BattleState['units'][number], pos: Vec2) => {
    const key = posKey(pos);
    if (!terrainInfo.has(key)) {
      const anchors = flood(
        {
          grid,
          blocked: new Set<string>(),
          surfaces: content.surfaces,
          size: unit.size,
          squareFootprints: true,
          climbCost: content.tuning.climbCost,
        },
        pos,
        Infinity,
      );
      const nearParty = [...anchors.values()].some((entry) => anchorNearParty(entry.pos));
      for (const entry of anchors.values()) {
        const entryKey = posKey(entry.pos);
        terrainInfo.set(entryKey, nearParty);
      }
    }
    if (!contactInfo.has(key)) {
      const blocked = new Set(owners.keys());
      for (const cell of occupiedCells({ pos, size: unit.size }, true))
        blocked.delete(posKey(cell));
      const anchors = flood(
        {
          grid,
          blocked,
          surfaces: content.surfaces,
          size: unit.size,
          squareFootprints: true,
          climbCost: content.tuning.climbCost,
        },
        pos,
        Infinity,
      );
      const canContact = [...anchors.values()].some((entry) => contactable(unit, entry.pos));
      for (const entry of anchors.values()) {
        const entryKey = posKey(entry.pos);
        contactInfo.set(entryKey, canContact);
      }
    }
    return {
      nearParty: terrainInfo.get(key) ?? false,
      canContact: contactInfo.get(key) ?? false,
    };
  };
  const connected = (unit: BattleState['units'][number], pos: Vec2): boolean => {
    if (!square || unit.size !== 2)
      return occupiedCells({ pos, size: unit.size }, square).every((cell) =>
        main.has(posKey(cell)),
      );
    return anchorInfoFor(unit, pos).nearParty;
  };
  const canContact = (unit: BattleState['units'][number], pos: Vec2): boolean =>
    square && unit.size === 2 && anchorInfoFor(unit, pos).canContact;
  for (const unit of units) {
    if (unit.hp <= 0) {
      result.push(unit);
      continue;
    }
    // Earlier living units claim shared cells first; only remove this unit's own claims.
    for (const cell of occupiedCells(unit, square)) {
      const key = posKey(cell);
      if (owners.get(key) === unit.id) owners.delete(key);
    }
    // Unit cells and contact targets change after every repair; component
    // caches are therefore scoped to this unit's candidate search.
    terrainInfo.clear();
    contactInfo.clear();
    let pos = unit.pos;
    if (!valid(unit)) {
      const candidates: Vec2[] = [];
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) candidates.push({ x, y });
      }
      candidates.sort(
        (a, b) =>
          Math.max(Math.abs(a.x - unit.pos.x), Math.abs(a.y - unit.pos.y)) -
            Math.max(Math.abs(b.x - unit.pos.x), Math.abs(b.y - unit.pos.y)) ||
          a.y - b.y ||
          a.x - b.x,
      );
      const usable = candidates.filter((candidate) => valid(unit, candidate));
      // A usable candidate that can immediately walk into contact with a
      // living opponent is the most useful deterministic placement. Fall back
      // to the party-connected square component when combat contact is not yet
      // possible (for example, the opponent was also buried in the save).
      const nearestConnected = usable.find((item) => connected(unit, item));
      const candidate =
        nearestConnected && canContact(unit, nearestConnected)
          ? nearestConnected
          : (usable.find((item) => connected(unit, item) && canContact(unit, item)) ??
            nearestConnected);
      const nearest = usable[0];
      if (nearest && !connected(unit, nearest))
        warnings.push({ kind: 'disconnected-snap', unitId: unit.id, pos: nearest });
      if (!candidate) {
        warnings.push({ kind: 'no-free-cell', unitId: unit.id });
        return { units: null, warnings };
      }
      pos = candidate;
    }
    for (const cell of occupiedCells({ pos, size: unit.size }, square))
      owners.set(posKey(cell), unit.id);
    result.push(pos === unit.pos ? unit : { ...unit, pos });
  }
  return { units: result, warnings };
}

function mainWalkableCells(grid: Grid, map: MapDef): Set<string> {
  const first = map.partySpawns.find((pos) => walkable(grid, pos));
  const start =
    first ??
    grid.tiles
      .map((_, index) => ({ x: index % grid.width, y: Math.floor(index / grid.width) }))
      .find((pos) => walkable(grid, pos));
  const seen = new Set<string>();
  if (!start) return seen;
  const pending = [start];
  while (pending.length > 0) {
    const pos = pending.shift();
    if (!pos || seen.has(posKey(pos)) || !walkable(grid, pos)) continue;
    seen.add(posKey(pos));
    pending.push(
      { x: pos.x, y: pos.y - 1 },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x + 1, y: pos.y },
      { x: pos.x, y: pos.y + 1 },
    );
  }
  return seen;
}

/**
 * How far a saved explore position may move to find walkable ground before
 * the map's own entry is used instead. Chebyshev steps, like `distance`.
 */
const EXPLORE_SNAP_RADIUS = 6;

/**
 * A saved explore position a map edit has buried (M9).
 *
 * Explore keeps exactly one position for the whole party — `location.pos`;
 * the followers are a presentation line the scene re-seats at load, never
 * saved, so there is nothing per-member to repair. That one cell can be
 * off-grid or inside new terrain once the map changes, so the party is moved
 * to the nearest cell explore movement would accept, or to the map's entry
 * spawn (the same one `enterStoryNode` uses) when nothing is reachable close
 * by. Mid-battle saves are left alone: a battle carries its own grid.
 */
function snapExplore(content: ContentIndex, state: GameState): GameState {
  if (state.screen !== 'explore' || state.battle) return state;
  const map = content.maps.get(state.location.mapId);
  if (!map) return state;
  const grid = cachedGrid(map);
  if (walkable(grid, state.location.pos)) return state;
  const pos = nearestWalkable(grid, state.location.pos, EXPLORE_SNAP_RADIUS) ?? entrySpawn(map);
  return { ...state, location: { ...state.location, pos } };
}

/** Explore movement's walkability: an in-bounds tile that is not blocked. */
function walkable(grid: Grid, p: Vec2): boolean {
  const tile = tileAt(grid, p);
  return tile !== undefined && !tile.blocked;
}

/** The party's entry cell on an explore map, matching `enterStoryNode`'s `exploreStart`. */
function entrySpawn(map: MapDef): Vec2 {
  return map.partySpawns[0] ?? { x: 1, y: 1 };
}

/**
 * The nearest walkable cell to `from`, searched geometrically: ring by ring
 * outward by Chebyshev distance, up to `radius` steps. This is not pathing —
 * a map edit only buries the saved cell, so the repair is a distance search,
 * not a route. Candidates are in-bounds, non-blocked cells; an off-grid cell
 * is simply not one, and the rings still reach past it, so a position off the
 * map edge finds that edge's walkable cells. The first ring holding a
 * candidate wins, and ties break row-major — smallest y, then smallest x — so
 * the same map and cell always snap to the same tile. Returns null when
 * nothing walkable is that close.
 */
function nearestWalkable(grid: Grid, from: Vec2, radius: number): Vec2 | null {
  for (let distance = 1; distance <= radius; distance++) {
    let best: Vec2 | null = null;
    for (let dy = -distance; dy <= distance; dy++) {
      for (let dx = -distance; dx <= distance; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
        const cell = { x: from.x + dx, y: from.y + dy };
        if (!walkable(grid, cell)) continue;
        if (best === null || cell.y < best.y || (cell.y === best.y && cell.x < best.x)) {
          best = cell;
        }
      }
    }
    if (best !== null) return best;
  }

  return null;
}

/** Every authored public slot a resident may occupy, independent of the loaded state's phase. */
function residentSlots(resident: ResidentDef): readonly ResidentSlot[] {
  const values: (ResidentSlotValue | undefined)[] = [
    resident.fallback,
    ...Object.values(resident.schedule),
    ...(resident.overrides ?? []).flatMap((override) => [
      override.all,
      ...Object.values(override.slots),
    ]),
  ];
  return values.filter((value): value is ResidentSlot => typeof value === 'object');
}
