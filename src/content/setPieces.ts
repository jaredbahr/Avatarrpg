/**
 * The placement grammar (ADR 0119, `docs/art-cohesion.md`): a map's dressing is designed first and
 * placed second. A **set piece** is an anchor, the satellites that serve it and the ground aprons
 * that tie them to the floor, placed as one unit for one stated purpose. The **plan** around them
 * names the walking paths that stay clear, the quiet ground left open on purpose, and the zones
 * (one screen or so each) that each have exactly one focal set piece.
 *
 * Plain data, read by the content tests (`setPieces.test.ts`) and the ground baker (which draws the
 * aprons into the plate). The shipped runtime never imports it.
 */
import type { Vec2 } from '../core/types';
import type { TopDownObject } from './topdownLayout';

/**
 * A ground apron, drawn into the plate under its set piece with an organic per-pixel edge:
 * - `earth`: trodden, packed earth where people stand and work;
 * - `flags`: a pad of big, pale, worn flagstones, the floor of a place people gather;
 * - `wet`: wet, darkened stones and a few glints, where water is drawn or spilled;
 * - `hay`: earth strewn with stalks;
 * - `weeds`: tufts and weeds at the foot of posts and walls.
 */
export type ApronKind = 'earth' | 'flags' | 'wet' | 'hay' | 'weeds';

export interface Apron {
  readonly kind: ApronKind;
  /** Centre and half extents, in top-down world px (40 a cell). */
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

export interface SetPiece {
  readonly id: string;
  /** Why it is here, in the design note's words: what happens at it and who uses it. */
  readonly purpose: string;
  /** The object everything else serves (a house, a well, a table). */
  readonly anchor: string;
  readonly satellites: readonly string[];
  readonly aprons: readonly Apron[];
  /** The zone's one focal set piece: where the player's eye should land first. */
  readonly focal?: boolean;
  /**
   * An edge run (lamps along a road, posts along a fence): its members stand on one line at an
   * even spacing.
   */
  readonly run?: boolean;
}

/** A walking path between two places people go: its cells stay open and clear of every piece. */
export interface DesireLine {
  readonly id: string;
  readonly cells: readonly Vec2[];
}

/** A rectangle of cells, inclusive. */
export interface CellRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface DressingZone {
  readonly id: string;
  readonly rect: CellRect;
}

export interface DressingPlan {
  readonly mapId: string;
  /** The cells the grammar governs: every prop based here belongs to exactly one set piece. */
  readonly scope: CellRect;
  readonly setPieces: readonly SetPiece[];
  readonly paths: readonly DesireLine[];
  /** Ground left open on purpose: no piece's footprint lies here. */
  readonly quiet: readonly CellRect[];
  /** Each zone holds exactly one focal set piece. */
  readonly zones: readonly DressingZone[];
}

/** How far a satellite may stand from its anchor's footprint, in cells (Chebyshev). */
export const HUG_CELLS = 2;
/** How far a run's members may stray from one line and one spacing, in world px. */
export const RUN_SLACK = 4;

const CELL = 40;
const inRect = (r: CellRect, p: Vec2): boolean =>
  p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
/** The cell an object stands on: its centre x and the row of its base. */
export const baseCell = (o: TopDownObject): Vec2 => ({
  x: Math.floor(o.x / CELL),
  y: Math.floor((o.base - 1) / CELL),
});
const gap = (a: readonly Vec2[], b: readonly Vec2[]): number => {
  let d = Infinity;
  for (const p of a)
    for (const q of b) d = Math.min(d, Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)));
  return d;
};

/**
 * Every way a plan breaks the grammar on its layout, as sentences. `blocked(x, y)` is the rules'
 * collision (the map's rows), so a path is also held to be walkable.
 */
export function validateDressing(
  plan: DressingPlan,
  objects: readonly TopDownObject[],
  blocked: (x: number, y: number) => boolean,
): string[] {
  const out: string[] = [];
  const say = (s: string): void => {
    out.push(`dressing "${plan.mapId}": ${s}`);
  };
  const byId = new Map(objects.map((o) => [o.id, o]));
  const owner = new Map<string, string>();

  for (const sp of plan.setPieces) {
    if (!sp.purpose.trim()) say(`set piece "${sp.id}" has no purpose`);
    const anchor = byId.get(sp.anchor);
    if (!anchor) {
      say(`set piece "${sp.id}" anchors on "${sp.anchor}", which is not placed`);
      continue;
    }
    for (const id of [sp.anchor, ...sp.satellites]) {
      const prev = owner.get(id);
      if (prev && prev !== sp.id) say(`"${id}" belongs to both "${prev}" and "${sp.id}"`);
      owner.set(id, sp.id);
    }
    for (const id of sp.satellites) {
      const s = byId.get(id);
      if (!s) {
        say(`set piece "${sp.id}" lists "${id}", which is not placed`);
        continue;
      }
      // props hug what they serve: a satellite stands beside its anchor, never out on the open ground
      // (a run's members are held to their line and spacing instead)
      if (sp.run) continue;
      const d = gap(s.footprint, anchor.footprint);
      if (d > HUG_CELLS)
        say(`"${id}" stands ${d} cells from its anchor "${sp.anchor}" (at most ${HUG_CELLS})`);
    }
    for (const a of sp.aprons)
      if (!(a.rx > 0 && a.ry > 0)) say(`set piece "${sp.id}" has an empty ${a.kind} apron`);
    if (sp.run) {
      const members = [anchor, ...sp.satellites.flatMap((id) => byId.get(id) ?? [])];
      const xs = members.map((m) => m.x),
        ys = members.map((m) => m.base);
      const alongX = Math.max(...ys) - Math.min(...ys) <= RUN_SLACK;
      const alongY = Math.max(...xs) - Math.min(...xs) <= RUN_SLACK;
      if (!alongX && !alongY) say(`run "${sp.id}" does not stand on one line`);
      const pos = (alongX ? xs : ys).sort((a, b) => a - b);
      const steps = pos.slice(1).map((v, i) => v - (pos[i] ?? v));
      if (steps.length > 1 && Math.max(...steps) - Math.min(...steps) > RUN_SLACK)
        say(`run "${sp.id}" is unevenly spaced (${steps.join(', ')} px)`);
    }
  }

  // every prop in scope answers "why is this here?" through its set piece
  for (const o of objects) {
    if (o.kind !== 'prop' || !inRect(plan.scope, baseCell(o))) continue;
    if (!owner.has(o.id)) say(`prop "${o.id}" belongs to no set piece`);
  }

  const solids = objects.filter((o) => o.solid);
  for (const path of plan.paths)
    for (const c of path.cells) {
      if (blocked(c.x, c.y)) say(`path "${path.id}" crosses blocked cell (${c.x},${c.y})`);
      const on = solids.find((o) => o.footprint.some((f) => f.x === c.x && f.y === c.y));
      if (on) say(`path "${path.id}" runs under "${on.id}" at (${c.x},${c.y})`);
    }
  for (const q of plan.quiet)
    for (const o of objects)
      if (o.kind !== 'flat' && o.footprint.some((f) => inRect(q, f)))
        say(`"${o.id}" stands in quiet ground (${q.x0},${q.y0})-(${q.x1},${q.y1})`);

  for (const z of plan.zones) {
    const focal = plan.setPieces.filter((sp) => {
      const a = byId.get(sp.anchor);
      return sp.focal && a && inRect(z.rect, baseCell(a));
    });
    if (focal.length !== 1)
      say(
        `zone "${z.id}" has ${focal.length} focal set pieces (${focal.map((f) => f.id).join(', ') || 'none'}), not one`,
      );
  }
  return out;
}
