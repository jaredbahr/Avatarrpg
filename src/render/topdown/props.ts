import type { Vec2 } from '../../core/types';
import { TOPDOWN_TILE } from '../projection';

/**
 * The top-down drawings of the game's breakable props (ADR 0104 T4, #459), keyed by the prop's id
 * in `src/content/props.ts`, after the prototype's `PROP_SPRITE` (`prototypes/topdown/src/b3/
 * world_quarry.js`). `pack-props.ts` ships each one, trimmed and hard-alpha, under
 * `public/art/topdown/props/`; `w` and `h` are its size in world px (one art px a world px), and
 * `base` is where its lowest pixel row ends: the prototype's foot line (`cellY`, 9 px above the
 * cell's bottom edge) plus 4 px for a prop and 2 px for the flask.
 */
export interface TopdownPropSprite {
  readonly name: string;
  readonly w: number;
  readonly h: number;
  /** World px from the cell's top edge to the prop's base row (the row under its lowest pixel). */
  readonly base: number;
}

/** The prototype's foot line in a cell (`cellY`: `CS - 9`) plus its 4 px drop for a prop. */
const PROP_BASE = TOPDOWN_TILE - 9 + 4;

export const TOPDOWN_PROPS: Readonly<Record<string, TopdownPropSprite>> = {
  water_barrel: { name: 'rain_barrel', w: 22, h: 28, base: PROP_BASE },
  oil_flask: { name: 'oil_flask', w: 20, h: 26, base: PROP_BASE - 2 },
  hay_bale: { name: 'hay_bale', w: 30, h: 28, base: PROP_BASE },
  brazier: { name: 'brazier', w: 25, h: 30, base: PROP_BASE },
  cabbage_cart: { name: 'cabbage_cart', w: 41, h: 47, base: PROP_BASE },
  rubble_pile: { name: 'lime_boulder', w: 40, h: 36, base: PROP_BASE },
};

/** The site-relative url of a shipped top-down prop drawing. */
export function topdownPropUrl(sprite: TopdownPropSprite): string {
  return `art/topdown/props/${sprite.name}.png`;
}

/**
 * Where a prop's drawing stands on a top-down board, in world px: centred on its cell, its base row
 * on the prototype's prop line (`put(PROP_SPRITE[id], cellX(x), cellY(y) + 4)`), whole pixels.
 */
export function topdownPropBox(
  pos: Vec2,
  sprite: TopdownPropSprite,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(pos.x * TOPDOWN_TILE + TOPDOWN_TILE / 2 - sprite.w / 2),
    y: pos.y * TOPDOWN_TILE + sprite.base - sprite.h,
    w: sprite.w,
    h: sprite.h,
  };
}

/** The top-down drawing for a prop, by its content id, or undefined where none is drawn. */
export function topdownProp(kind: string | undefined): TopdownPropSprite | undefined {
  return kind === undefined ? undefined : TOPDOWN_PROPS[kind];
}
