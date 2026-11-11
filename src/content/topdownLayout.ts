/**
 * The shape of a top-down map's layout (ADR 0104 §3, phase T3): its terrain layer and the objects
 * placed on it, beside the map's rules data, which stays the authority for collision. The content
 * validation (`validateTopDownLayout` in `schemas.ts`) and the ground packer read these; the shipped
 * runtime draws the packed result (`public/art/topdown/<map>/scene.json`) and never imports a layout.
 */
import type { Vec2 } from '../core/types';
import type { TopDownTerrainLayer } from './scenes/baDan.topdown.terrain';

export type { TopDownTerrainLayer };

/**
 * How a placed object is grounded and drawn:
 * - `house`: a building, front on, with its apron, doorstep, wall-side shadow and skirt;
 * - `tree`: a tree or bush, the sun-swept joined shadow;
 * - `prop`: anything else that stands, the short floor shadow;
 * - `flat`: lies on the ground (flowers, tufts), baked into the plates, never sorted;
 * - `bridge`, `walkway`, `steps`: structures the ground carries a way over, baked into the plates.
 */
export type TopDownObjectKind = 'house' | 'tree' | 'prop' | 'flat' | 'bridge' | 'walkway' | 'steps';

/** One placed object, the prototype's `put()`: a sprite with its centre x and base y. */
export interface TopDownObject {
  readonly id: string;
  /** The PixelLab object's key (`prototypes/topdown/assets/objects12` or `objects_bd13`). */
  readonly sprite: string;
  readonly kind: TopDownObjectKind;
  /** Centre x and base y (the row the object stands on), in top-down world px (40 a cell). */
  readonly x: number;
  readonly base: number;
  /** The cells it stands on; off the map only when `exterior`. */
  readonly footprint: readonly Vec2[];
  /** Stops feet: every on-map footprint cell is a blocked cell of the rows. */
  readonly solid: boolean;
  /** Carries a way over water: its cells read as walkable whatever the ground beneath. */
  readonly deck?: boolean;
  /** Scenery whose footprint sits (partly) off the map: the rim's trees, the houses past the edge. */
  readonly exterior?: boolean;
  /** Sort key in fractional cells: its centre x and base y over 40, so `boardDepth` sorts it by its base. */
  readonly depth: Vec2;
  readonly fadeWhenOccluding?: boolean;
  readonly revealOccluded?: boolean;
  /** Drawn mirrored left to right (the prototype flips some of its dressing). */
  readonly flip?: boolean;
}

/** A reserved cell for art another change supplies (the route sign, the school notice). */
export interface TopDownSlot {
  readonly id: string;
  /** The map NPC that stands there. */
  readonly npc: string;
  readonly cell: Vec2;
}

export interface TopDownLayout {
  readonly mapId: string;
  readonly terrain: TopDownTerrainLayer;
  readonly objects: readonly TopDownObject[];
  readonly slots: readonly TopDownSlot[];
}
