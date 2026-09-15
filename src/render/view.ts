/**
 * The view model the renderer draws.
 *
 * Built in `src/app` from game state and handed to whichever backend is
 * running. Nothing here knows about a canvas, a GL context or a scene graph —
 * that is what lets the Canvas 2D and WebGL backends be interchangeable.
 */

import type { Grid, StatusId, Vec2 } from '../core/types';

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
}

export type OverlayKind = 'move' | 'target' | 'area' | 'hover';

export interface OverlayLayer {
  readonly kind: OverlayKind;
  readonly tiles: readonly Vec2[];
}

export interface FxInstance {
  readonly pos: Vec2;
  readonly assetKey: string;
  /** 0 to 1 across the effect's lifetime. */
  readonly progress: number;
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

export interface MapView {
  readonly grid: Grid;
  readonly units: readonly RenderUnit[];
  readonly overlays: readonly OverlayLayer[];
  readonly npcs: readonly NpcMarker[];
  readonly props: readonly RenderProp[];
  readonly path: readonly Vec2[];
  readonly fx: readonly FxInstance[];
  readonly floaters: readonly Floater[];
  readonly activeUnitId: string | null;
  readonly selectedUnitId: string | null;
  readonly hoverTile: Vec2 | null;
  readonly exit: { readonly pos: Vec2; readonly label: string } | null;
  /** Colourblind hatch patterns on surfaces. */
  readonly hatch: boolean;
  /** Milliseconds since start, for idle animation. */
  readonly time: number;
}
