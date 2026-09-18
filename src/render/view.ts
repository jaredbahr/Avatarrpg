/**
 * The view model the renderer draws.
 *
 * Built in `src/app` from game state and handed to whichever backend is
 * running. Nothing here knows about a canvas, a GL context or a scene graph —
 * that is what lets the Canvas 2D and WebGL backends be interchangeable.
 */

import type { Grid, MapBackdrop, MapScene, StatusId, Vec2 } from '../core/types';
import type { ClipName } from '../content/assets/clips';
import type { EmitterDef } from '../content/fx';

/** The pose vocabulary from ADR 0003; the sheet runtime maps these to frames. */
export type { ClipName };

export interface RenderUnit {
  readonly id: string;
  readonly pos: Vec2;
  readonly size: 1 | 2;
  readonly sprite: string;
  readonly name: string;
  readonly faction: 'party' | 'enemy' | 'ally';
  readonly hp: number;
  readonly maxHp: number;
  readonly statuses: readonly StatusId[];
  readonly fallen: boolean;
  /** Drawn at this position instead of `pos` while a move animates. */
  readonly renderPos?: Vec2;
  /** Off for the party strolling round a village. Defaults to on. */
  readonly showHealth?: boolean;
  /** Which way the sprite faces: 1 is screen-right. Defaults to the faction's side. */
  readonly facing?: 1 | -1;
  /**
   * Draw-time nudge in tile units (a walk bob, a lunge, a recoil). Never
   * part of the sort key: a unit mid-hop still sorts by where it stands.
   */
  readonly offset?: Vec2;
  /** Which pose the unit is in and how far into it, for the sheet runtime. */
  readonly clip?: ClipName;
  readonly clipTime?: number;
  /** The clip's frame, when the choreography knows it (a cast's wind-up is frame 0). */
  readonly clipFrame?: number;
  /** Draw scale about the feet; 1 at rest. */
  readonly scale?: number;
  /** Draw alpha; the backend applies the fallen fade on top. */
  readonly alpha?: number;
  /** 0..1 white flash on a hit. */
  readonly flash?: number;
}

export type OverlayKind = 'move' | 'target' | 'area' | 'hover';

export interface OverlayLayer {
  readonly kind: OverlayKind;
  readonly tiles: readonly Vec2[];
}

/**
 * A live effect emitter: the recipe piece, where it plays, and how old it is.
 * The definition travels resolved so the renderer never reads content.
 */
export interface EmitterInstance {
  readonly def: EmitterDef;
  /** Tile centres. */
  readonly from: Vec2;
  readonly to: Vec2;
  /** Ms since the emitter started. */
  readonly elapsed: number;
  readonly seed: number;
  /** Palette key the colour roles resolve through. */
  readonly palette: string;
  /** Lob height in tiles for a projectile flight. */
  readonly arc: number;
}

export interface Floater {
  readonly pos: Vec2;
  readonly text: string;
  readonly color: string;
  readonly progress: number;
}

export interface NpcMarker {
  readonly pos: Vec2;
  readonly sprite: string;
  readonly name: string;
  /** Presentation size about the ground-contact point; never changes the footprint. */
  readonly scale?: number;
}

/**
 * A prop, flattened for drawing.
 *
 * `hp`/`maxHp` rather than a `PropDef`: the renderer never reads content, so the
 * scene resolves the definition and hands over only what gets painted.
 */
export interface RenderProp {
  readonly id: string;
  readonly pos: Vec2;
  readonly sprite: string;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
}

/**
 * The flight a hurled ability will take, shown while it is being aimed: from
 * the caster's centre to the target's, lobbed `arc` tiles at the midpoint,
 * in the element's light tone. Null when nothing is aimed or it does not fly.
 */
export interface AimArc {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly arc: number;
  readonly color: string;
}

export interface MapView {
  readonly scene?: MapScene;
  readonly grid: Grid;
  readonly units: readonly RenderUnit[];
  readonly overlays: readonly OverlayLayer[];
  readonly npcs: readonly NpcMarker[];
  readonly props: readonly RenderProp[];
  readonly path: readonly Vec2[];
  /** Where `path` starts (the walker's tile), so it can be drawn as one curve. */
  readonly pathFrom: Vec2 | null;
  /** The throw being aimed, or null. */
  readonly aimArc: AimArc | null;
  readonly emitters: readonly EmitterInstance[];
  readonly floaters: readonly Floater[];
  /** How far the camera is knocked, in tiles. */
  readonly cameraNudge: Vec2;
  readonly activeUnitId: string | null;
  readonly selectedUnitId: string | null;
  readonly hoverTile: Vec2 | null;
  readonly exit: { readonly pos: Vec2; readonly label: string } | null;
  readonly exits?: readonly { readonly pos: Vec2; readonly label: string }[];
  /** Colourblind hatch patterns on surfaces. */
  readonly hatch: boolean;
  /** Tile lines over the ground. Off by default; a setting, and High contrast, turn them on. */
  readonly gridLines: boolean;
  /** Overlays as a square per tile instead of a rounded contour (High contrast). */
  readonly crispOverlays: boolean;
  /** Edge shading and the vignette round the board; off under High contrast. */
  readonly atmosphere: boolean;
  /**
   * The map's painting, drawn under the grid in place of the procedural
   * ground once it has loaded (ADR 0009). Null draws the ground as ever.
   */
  readonly backdrop: MapBackdrop | null;
  /** Milliseconds since start, for idle animation. */
  readonly time: number;
}
