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

/* ------------------------------------------------------------------------------------------------
 * Stage 5 of `docs/level-design.md`: the set pieces placed as boxes, before any art. The same grammar,
 * one step on: each member now has a footprint in cells, a height in figures, whether it is solid and
 * what kind of thing it is, so the plan can be checked against the rows, the ground's named tracks
 * and the quiet ground, and drawn in the game as labelled boxes (`?boxes`, dev builds only).
 * ---------------------------------------------------------------------------------------------- */

/**
 * What a member is, for what hides what and what the checks skip:
 * - `building`: a house or hut; it reveals a figure walking behind it;
 * - `prop`: a thing that stands on the ground and never fades, so none taller than a figure stands south of
 *   a walkable cell (validator 14);
 * - `fades`: a tall thing over walkable ground, a tree, a lamp or an awning, that fades when a figure
 *   walks behind it (the `house`/`tree` kinds of the layout);
 * - `flat`: lies on the ground (a doorstep, treads): never an obstacle, so no check on tracks or quiet ground.
 */
export type MemberKind = 'building' | 'prop' | 'fades' | 'flat';

/** One thing in a set piece, placed as a box. Cells are the board's; `x`, `y` is the footprint's top-left corner. */
export interface PlanMember {
  /** Unique across the plan. Where the same thing stood on the old board, its old object id. */
  readonly id: string;
  /** What to call it in the review ("awning post NW"). */
  readonly name: string;
  readonly x: number;
  readonly y: number;
  /** Footprint size in cells; fractions are allowed (a post is 0.2). */
  readonly w: number;
  readonly h: number;
  /** Height in figures (Kaya, 45 px, is 1.0); 0 for a flat. */
  readonly height: number;
  /** Stands only on cells the rows block; everything else is non-solid. */
  readonly solid: boolean;
  readonly kind: MemberKind;
  /** Hangs over the ground (a canopy, a washing line): nobody stands under it as an obstacle, so tracks may pass. */
  readonly overhead?: boolean;
  /** Carries a glow: counts against the map's four lanterns. */
  readonly lantern?: boolean;
  /** Existing art that can stand for it (a path under `public/art/topdown` or `prototypes/topdown`). */
  readonly have?: string;
}

export interface PlannedSetPiece {
  readonly id: string;
  readonly purpose: string;
  /** The id of the member everything else serves; it is one of `members`. */
  readonly anchor: string;
  readonly members: readonly PlanMember[];
  /** The zone's one focal piece. */
  readonly focal?: boolean;
  /**
   * An edge run (lamps along a kerb): its members stand on blocked cells, spaced by design, so they are not asked to
   * touch each other or to have a neighbour.
   */
  readonly run?: boolean;
  /** Many near-identical members (the rim's trees): drawn without a label each. */
  readonly bulk?: boolean;
  /** A thing the brief names as a marker or a landmark, standing alone on purpose: exempt from looseSingles. */
  readonly marker?: boolean;
  /**
   * A track disk this piece stands on by right (the table on its own disk): its standing members, and the
   * cells of any other track that lie inside the disk, are not held to "nothing on a track".
   */
  readonly ownDisk?: string;
  /** Quiet rects this piece may stand in (the table piece in the square's open middle). */
  readonly quietOk?: readonly string[];
}

export interface PlannedQuiet extends CellRect {
  readonly id: string;
}

export interface SetPiecePlan {
  readonly mapId: string;
  readonly pieces: readonly PlannedSetPiece[];
  readonly zones: readonly DressingZone[];
  readonly quiet: readonly PlannedQuiet[];
  /** Lanterns the map's ambience allows (`ambienceSources`). */
  readonly maxLanterns: number;
}

/** What the plan is held against: the rows' collision and the ground's named tracks. */
export interface PlanContext {
  readonly width: number;
  readonly height: number;
  /** The rules' collision: true where the rows block the cell (and off the board). */
  readonly blocked: (x: number, y: number) => boolean;
  /** Every named track's cells, by track id (`trackCells` of the ground spec). */
  readonly tracks: ReadonlyMap<string, readonly Vec2[]>;
  /** The disk tracks' centres and radii in cells, by id, for a piece's `ownDisk`. */
  readonly disks: ReadonlyMap<string, { x: number; y: number; r: number }>;
}

const EPS = 1e-6;
/** The cells a member's footprint overlaps. */
export function memberCells(m: PlanMember): Vec2[] {
  const out: Vec2[] = [];
  for (let y = Math.floor(m.y + EPS); y <= Math.ceil(m.y + m.h - EPS) - 1; y++)
    for (let x = Math.floor(m.x + EPS); x <= Math.ceil(m.x + m.w - EPS) - 1; x++)
      out.push({ x, y });
  return out;
}

/** The cell a member stands on: its footprint's south-west corner cell (the row of its base). */
export const memberBase = (m: PlanMember): Vec2 => ({
  x: Math.floor(m.x + EPS),
  y: Math.ceil(m.y + m.h - EPS) - 1,
});

/** Standing members are the ones that can be in the way: not flats, not overhead. */
const standing = (m: PlanMember): boolean => m.kind !== 'flat' && !m.overhead;

/** How near a loose member may stand to anything else, in cells (validator 5). */
export const LOOSE_CELLS = 2;
/** How near a member stands to its anchor or a fellow, in cells (validator 4). */
export const ANCHOR_CELLS = 1;
/** A prop is a thing a figure can see over up to this height, in figures (validator 14). */
export const FIGURE = 1;

/**
 * Every way a plan breaks the placement rules, as sentences (`docs/level-design.md` §9, validators 3 to 5 and 14,
 * with P1, P6, P8, P9 and P10 of the core).
 */
export function validateSetPiecePlan(plan: SetPiecePlan, ctx: PlanContext): string[] {
  const out: string[] = [];
  const say = (s: string): void => {
    out.push(`set pieces "${plan.mapId}": ${s}`);
  };
  const at = (m: PlanMember): string => `"${m.id}" at (${m.x},${m.y})`;
  const owner = new Map<string, string>();
  const all: { m: PlanMember; piece: PlannedSetPiece }[] = [];

  // 3 setPieceParent: every member belongs to exactly one piece, and every piece has its one anchor among them
  for (const piece of plan.pieces) {
    if (!piece.purpose.trim()) say(`set piece "${piece.id}" has no purpose`);
    if (!piece.members.some((m) => m.id === piece.anchor))
      say(`set piece "${piece.id}" anchors on "${piece.anchor}", which is not one of its members`);
    for (const m of piece.members) {
      const prev = owner.get(m.id);
      if (prev) say(`"${m.id}" belongs to both "${prev}" and "${piece.id}"`);
      owner.set(m.id, piece.id);
      all.push({ m, piece });
      if (!(m.w > 0 && m.h > 0)) say(`${at(m)} has no footprint`);
      if (m.kind === 'flat' && m.height !== 0) say(`${at(m)} is flat but has a height`);
    }
  }

  for (const { m, piece } of all) {
    const cells = memberCells(m);
    const onBoard = cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < ctx.width && c.y < ctx.height);
    if (!onBoard) say(`${at(m)} reaches off the board`);

    // solid members stand only on blocked cells; non-solid members stand on open ground
    if (m.solid) {
      const open = cells.find((c) => !ctx.blocked(c.x, c.y));
      if (open)
        say(
          `solid ${at(m)} stands on open cell (${open.x},${open.y}), which the rows do not block`,
        );
    } else if (standing(m)) {
      const shut = cells.find((c) => ctx.blocked(c.x, c.y));
      if (shut) say(`non-solid ${at(m)} stands on blocked cell (${shut.x},${shut.y})`);
    }

    // a tall thing over walkable ground that is not solid fades, so the figure behind it stays seen (P9)
    if (!m.solid && m.height > FIGURE && m.kind !== 'fades')
      say(`non-solid ${at(m)} is ${m.height} figures tall but is a ${m.kind}, not a fades`);

    // 6 desireLinesClear on the plan: no non-solid standing member on a named track (P8). A solid member stands
    // on blocked cells the blockout fixed, and a track that crosses one is the ground check's finding
    // (`groundChecks.ts`), not a placement to move.
    if (standing(m) && !m.solid) {
      const disk = piece.ownDisk ? ctx.disks.get(piece.ownDisk) : undefined;
      for (const [id, tcells] of ctx.tracks) {
        if (id === piece.ownDisk) continue;
        const on = cells.find((c) => tcells.some((t) => t.x === c.x && t.y === c.y));
        if (!on) continue;
        if (disk && Math.hypot(on.x + 0.5 - disk.x, on.y + 0.5 - disk.y) <= disk.r) continue;
        say(`${at(m)} stands on track "${id}" at (${on.x},${on.y})`);
      }
    }

    // nothing stands in the quiet ground
    if (standing(m))
      for (const q of plan.quiet) {
        if (piece.quietOk?.includes(q.id)) continue;
        const in_ = cells.find((c) => inRect(q, c));
        if (in_) say(`${at(m)} stands in quiet ground "${q.id}" at (${in_.x},${in_.y})`);
      }

    // 14 tallPropSouth: a tall prop never stands in the row below a walkable cell
    if (m.kind === 'prop' && m.height > FIGURE && !m.overhead)
      for (const c of cells.filter((c) => !cells.some((d) => d.x === c.x && d.y === c.y - 1))) {
        if (c.y > 0 && !ctx.blocked(c.x, c.y - 1))
          say(
            `${at(m)} is ${m.height} figures tall and stands south of walkable cell (${c.x},${c.y - 1})`,
          );
      }
  }

  // 4 anchored: each member touches its anchor or a fellow member (within one cell); a run stands on blocked cells instead
  for (const piece of plan.pieces) {
    const anchor = piece.members.find((m) => m.id === piece.anchor);
    for (const m of piece.members) {
      if (m === anchor || piece.bulk) continue;
      const mine = memberCells(m);
      const near = piece.members.some((o) => o !== m && gap(mine, memberCells(o)) <= ANCHOR_CELLS);
      if (near) continue;
      if (piece.run && memberCells(m).every((c) => ctx.blocked(c.x, c.y))) continue;
      say(
        `${at(m)} stands away from its anchor "${piece.anchor}" and every fellow member of "${piece.id}"`,
      );
    }
  }

  // 5 looseSingles: no standing member without a neighbour (of any piece) within two cells, unless a marker
  for (const { m, piece } of all) {
    if (!standing(m) || piece.marker || piece.run) continue;
    const mine = memberCells(m);
    const alone = !all.some((o) => o.m !== m && gap(mine, memberCells(o.m)) <= LOOSE_CELLS);
    if (alone) say(`${at(m)} stands alone: nothing within ${LOOSE_CELLS} cells`);
  }

  // glows: each lantern is a member, and the map allows four
  const lanterns = all.filter(({ m }) => m.lantern);
  if (lanterns.length > plan.maxLanterns)
    say(
      `${lanterns.length} lanterns (${lanterns.map((l) => l.m.id).join(', ')}), the map allows ${plan.maxLanterns}`,
    );

  // one focal piece a zone
  for (const z of plan.zones) {
    const focal = plan.pieces.filter((p) => {
      const a = p.members.find((m) => m.id === p.anchor);
      return p.focal && a && inRect(z.rect, memberBase(a));
    });
    if (focal.length !== 1)
      say(
        `zone "${z.id}" has ${focal.length} focal set pieces (${focal.map((f) => f.id).join(', ') || 'none'}), not one`,
      );
  }
  return out;
}
