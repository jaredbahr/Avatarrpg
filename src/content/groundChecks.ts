/**
 * The ground's placement checks (`docs/level-design.md` §9, validators 6 and 10; ADR 0120), report-only for now:
 * each returns its findings as sentences, and a test pins today's findings for each board, so a change shows up as a
 * diff to read rather than a failure. The numbers that make them gates come from what the owner likes.
 *
 * - `desireLinesClear` (6): no blocked cell and no object footprint lies on a named track, and every door, anchor,
 *   slot and exit touches the track network (on a track cell, or beside one).
 * - `apronReport` (10): which anchors stand on changed ground (an apron, or a worn track), and which do not.
 *
 * CI-only data, like the layouts: the shipped runtime never imports this.
 */
import type { MapDef, Vec2, WorldAnchor } from '../core/types';
import { apronDepth, trackCells, trackDepth, type GroundSpec } from './ground';
import type { TopDownObject } from './topdownLayout';

/** A place the track network must reach: a door, an anchor, a slot or an exit. */
export interface GroundPlace {
  readonly id: string;
  readonly cell: Vec2;
}

/** The village's doors and standing anchors on one map, from the world anchors. */
export function anchorPlaces(anchors: readonly WorldAnchor[], mapId: string): GroundPlace[] {
  return anchors.flatMap((a): GroundPlace[] => {
    if (a.site.kind === 'map')
      return a.site.mapId === mapId ? [{ id: a.id, cell: a.site.pos }] : [];
    return a.site.door.mapId === mapId ? [{ id: a.id, cell: a.site.door.pos }] : [];
  });
}

/** Every exit cell of a map: its exit, each exit's cells and every `exit` edge. */
export function exitPlaces(map: MapDef): GroundPlace[] {
  const out: GroundPlace[] = [];
  if (map.exit) out.push({ id: 'exit', cell: map.exit.pos });
  (map.exits ?? []).forEach((e) =>
    (e.area ?? [e.pos]).forEach((cell) => out.push({ id: `exit.${e.toMapId}`, cell })),
  );
  return out;
}

const key = (c: Vec2): string => `${c.x},${c.y}`;

/** Whether the rows let feet onto cell (x, y). */
function isWalkable(map: MapDef, x: number, y: number): boolean {
  const ch = map.rows[y]?.[x];
  return ch !== undefined && !map.legend[ch]?.blocked;
}

/** The cells of every named track. */
export function trackNetwork(spec: GroundSpec, width: number, height: number): Set<string> {
  const net = new Set<string>();
  for (const t of spec.tracks) for (const c of trackCells(t, width, height)) net.add(key(c));
  return net;
}

export function desireLinesClear(
  map: MapDef,
  spec: GroundSpec,
  places: readonly GroundPlace[],
  objects: readonly TopDownObject[] = [],
): string[] {
  const out: string[] = [];
  const say = (s: string): void => {
    out.push(`desireLinesClear "${map.id}": ${s}`);
  };
  for (const t of spec.tracks) {
    const cells = trackCells(t, map.width, map.height);
    const blocked = cells.filter((c) => !isWalkable(map, c.x, c.y));
    if (blocked.length)
      say(`track "${t.id}" crosses blocked ${blocked.map((c) => `(${c.x},${c.y})`).join(' ')}`);
    for (const o of objects) {
      const on = o.footprint.filter((f) => cells.some((c) => c.x === f.x && c.y === f.y));
      if (on.length) say(`object "${o.id}" stands on track "${t.id}" at (${on[0]?.x},${on[0]?.y})`);
    }
  }
  const net = trackNetwork(spec, map.width, map.height);
  for (const p of places) {
    const { x, y } = p.cell;
    const touches = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => net.has(`${x + (dx ?? 0)},${y + (dy ?? 0)}`));
    if (touches) continue;
    let gap = Infinity;
    for (const c of net) {
      const [cx, cy] = c.split(',').map(Number);
      gap = Math.min(gap, Math.max(Math.abs((cx ?? 0) - x), Math.abs((cy ?? 0) - y)));
    }
    say(`"${p.id}" at (${x},${y}) is ${gap} cells from the track network`);
  }
  return out;
}

/** One anchor's ground: what changed it, or nothing. */
export interface ApronRow {
  readonly id: string;
  readonly cell: Vec2;
  /** The aprons and worn tracks (wear 2 or 3) under or beside its cell, by id. */
  readonly ground: readonly string[];
}

/** Which anchors stand on changed ground: an apron reaching their cell, or a worn track over it. */
export function apronReport(spec: GroundSpec, places: readonly GroundPlace[]): ApronRow[] {
  return places.map((p) => {
    const cx = p.cell.x + 0.5,
      cy = p.cell.y + 0.5;
    const ground = [
      ...spec.aprons
        .filter((a) => a.kind !== 'sward' && a.kind !== 'treads' && apronDepth(a, cx, cy) >= -0.5)
        .map((a) => `apron:${a.id}`),
      ...spec.tracks
        .filter((t) => t.wear >= 2 && trackDepth(t, cx, cy) >= -0.25)
        .map((t) => `track:${t.id}`),
    ];
    return { id: p.id, cell: p.cell, ground };
  });
}

/** The anchors on unchanged ground, as findings. */
export const bareAnchors = (rows: readonly ApronRow[], mapId: string): string[] =>
  rows
    .filter((r) => r.ground.length === 0)
    .map(
      (r) => `aprons "${mapId}": "${r.id}" at (${r.cell.x},${r.cell.y}) stands on unchanged ground`,
    );
