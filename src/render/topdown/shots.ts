/**
 * The projectiles in flight on a top-down board (#588), as painted-effect sprites both backends already draw
 * (`BendFxSprite`): a bolt, rock, stone, flask or torch from `vfx.json`, moved along its shot track and lobbed on a
 * sine, drawn at one art px a world px. The bolt takes the cel of the nearest of its eight headings, never a turn,
 * so it stays on the pixel grid.
 */
import type { Vec2 } from '../../core/types';
import type { TopdownVfxData } from '../../content/assets/topdownVfx';
import { TOPDOWN_TILE } from '../projection';
import type { BendFxSprite } from '../view';

/** A shot in flight: its cel family, from the launching hand to the mark, lobbed `arc` tiles, on the animator clock. */
export interface Shot {
  readonly look: string;
  readonly from: Vec2;
  readonly to: Vec2;
  readonly arc: number;
  readonly start: number;
  readonly duration: number;
}

/** Flight speed, world px a second (the prototype's pacing pass). */
export const SHOT_PX_PER_S = 440;

/** The cel a shot draws `elapsed` ms into its flight. */
export function shotCel(track: Shot, elapsed: number): string {
  if (track.look === 'shot/bolt') {
    const octant = Math.round(
      Math.atan2(track.to.y - track.from.y, track.to.x - track.from.x) / (Math.PI / 4),
    );
    return `shot/bolt/${(octant + 8) % 8}`;
  }
  return track.look === 'vfx13/torch' ? `vfx13/torch/${Math.floor(elapsed / 70) % 6}` : track.look;
}

export function shotSprite(
  track: Shot,
  now: number,
  data: TopdownVfxData | null,
): BendFxSprite | null {
  const elapsed = now - track.start;
  const rect = (
    data?.frames[shotCel(track, elapsed)] as { frame?: BendFxSprite['frame'] } | undefined
  )?.frame;
  if (!rect) return null;
  const t = Math.min(1, Math.max(0, elapsed / Math.max(1, track.duration)));
  return {
    image: 'art/topdown/' + (data?.meta.image ?? ''),
    frame: rect,
    pivot: { x: Math.floor(rect.w / 2), y: Math.floor(rect.h / 2) },
    at: {
      x: track.from.x + (track.to.x - track.from.x) * t,
      y: track.from.y + (track.to.y - track.from.y) * t - Math.sin(t * Math.PI) * track.arc,
    },
    width: rect.w / TOPDOWN_TILE,
    height: rect.h / TOPDOWN_TILE,
    turn: 0,
    alpha: 1,
    blend: 'normal',
    flash: 0,
    z: 'overActor',
  };
}
