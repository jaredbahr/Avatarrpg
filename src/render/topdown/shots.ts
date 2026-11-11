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
  /** The ground under `from` and under `to`, which the shot's shadow tracks. */
  readonly feet: readonly [Vec2, Vec2];
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
  // The torch burns through its six cels; a rock or stone tumbles a quarter turn every 80 ms.
  if (track.look === 'shot/torch') return `shot/torch/${Math.floor(elapsed / 70) % 6}`;
  return track.look === 'shot/jar' ? track.look : `${track.look}/${Math.floor(elapsed / 80) % 4}`;
}

/** The shot's cel over its small hard shadow on the ground below it, which gives the lob its depth. */
export function shotSprite(track: Shot, now: number, data: TopdownVfxData | null): BendFxSprite[] {
  const elapsed = now - track.start;
  const t = Math.min(1, Math.max(0, elapsed / Math.max(1, track.duration)));
  const along = (a: Vec2, b: Vec2, lift = 0) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t - lift,
  });
  const sprite = (cel: string, at: Vec2, z: BendFxSprite['z'], alpha: number) => {
    const rect = (data?.frames[cel] as { frame?: BendFxSprite['frame'] } | undefined)?.frame;
    return rect
      ? [
          {
            image: 'art/topdown/' + (data?.meta.image ?? ''),
            frame: rect,
            pivot: { x: Math.floor(rect.w / 2), y: Math.floor(rect.h / 2) },
            at,
            width: rect.w / TOPDOWN_TILE,
            height: rect.h / TOPDOWN_TILE,
            turn: 0,
            alpha,
            blend: 'normal' as const,
            flash: 0,
            z,
          },
        ]
      : [];
  };
  const shot = sprite(
    shotCel(track, elapsed),
    along(track.from, track.to, Math.sin(t * Math.PI) * track.arc),
    'overActor',
    1,
  );
  return shot.length
    ? [...sprite('shot/shadow', along(...track.feet), 'ground', 0.65), ...shot]
    : [];
}
