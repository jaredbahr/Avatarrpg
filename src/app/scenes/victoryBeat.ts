import type { Grid, Unit, Vec2 } from '../../core/types';
import { isAlive } from '../../core/rules/stats';
import { SQUARE_FOOTPRINTS } from '../../core/rules/footprint';
import type { Camera } from '../../render/camera';
import {
  actorBodyBounds,
  combatActorSilhouetteGeometry,
} from '../../render/geometry/actorSilhouette';
import { liftAlong } from '../../render/geometry/elevation';

export interface VictoryBeatClock {
  readonly remainingMs: number;
  readonly lastAt: number | null;
}

export function beginVictoryBeat(now: number, durationMs: number): VictoryBeatClock {
  return { remainingMs: Math.max(0, durationMs), lastAt: now };
}

export function pauseVictoryBeat(clock: VictoryBeatClock): VictoryBeatClock {
  return { ...clock, lastAt: null };
}

export function advanceVictoryBeat(
  clock: VictoryBeatClock,
  now: number,
  paused: boolean,
  reducedMotion: boolean,
): { readonly clock: VictoryBeatClock; readonly complete: boolean } {
  if (reducedMotion || clock.remainingMs <= 0) return { clock, complete: true };
  if (paused) return { clock: pauseVictoryBeat(clock), complete: false };
  if (clock.lastAt === null) return { clock: { ...clock, lastAt: now }, complete: false };

  const elapsed = Math.max(0, now - clock.lastAt);
  if (elapsed >= clock.remainingMs)
    return { clock: { ...clock, remainingMs: 0, lastAt: now }, complete: true };
  return {
    clock: { remainingMs: clock.remainingMs - elapsed, lastAt: now },
    complete: false,
  };
}

/** Returns a camera anchor for the complete bounds of every living party member. */
export function livingPartyFocus(units: readonly Unit[]): Vec2 | null {
  const living = livingParty(units);
  if (living.length === 0) return null;

  const left = Math.min(...living.map((unit) => unit.pos.x));
  const top = Math.min(...living.map((unit) => unit.pos.y));
  const right = Math.max(...living.map((unit) => unit.pos.x + unit.size));
  const bottom = Math.max(...living.map((unit) => unit.pos.y + unit.size));
  // Camera.centreOn adds the center of a 1x1 tile; subtract that offset here
  // to make its final ground point the center of the party bounds.
  return { x: (left + right) / 2 - 0.5, y: (top + bottom) / 2 - 0.5 };
}

export interface VictoryActorPresentation {
  readonly pos: Vec2;
  readonly scale: number;
  readonly frameHeadroom: number | null;
  readonly offset?: Vec2;
}

export interface VictoryActorBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Bounds of the upright actor, health bar, status badges, and target cue. */
export function victoryActorBounds(
  camera: Camera,
  unit: Unit,
  presentation: VictoryActorPresentation,
  grid?: Grid,
): VictoryActorBounds {
  const box = camera.spriteBox(presentation.pos, unit.size, SQUARE_FOOTPRINTS);
  if (presentation.offset) {
    box.x += presentation.offset.x * box.size;
    box.y += presentation.offset.y * box.size;
  }
  if (grid) box.y -= liftAlong(grid, presentation.pos, camera.projection) * box.size;

  const scale = presentation.scale * 1.02;
  const heightTiles = SQUARE_FOOTPRINTS ? unit.size : 1;
  const footprintWidth = box.size * unit.size;
  // Loaded frames provide their actual silhouette headroom. Keep a generous
  // fallback only for art without frame metadata; forcing every measured
  // frame to 1.5 tiles needlessly shrinks otherwise well-framed parties.
  const headroom = presentation.frameHeadroom ?? 1.5;
  const actorBox = { ...box, width: footprintWidth };
  const body = actorBodyBounds(actorBox, heightTiles, headroom, scale);
  const cues = combatActorSilhouetteGeometry(actorBox, heightTiles, headroom, scale, camera.scale);
  const radius = Math.max(4, box.size * 0.09);
  const stagger = 4 * Math.max(2, cues.bar.height * 0.8);
  const edge = Math.max(2, box.size * 0.04);

  return {
    left: Math.min(body.left, cues.bar.x - radius) - edge,
    top:
      Math.min(body.top, cues.bar.y - stagger, cues.badgeY - radius, cues.reticleY - radius) - edge,
    right: Math.max(body.right, cues.bar.x + cues.bar.width + radius) + edge,
    bottom: Math.max(body.bottom, box.y + box.size) + edge,
  };
}

/** Center the surviving party and zoom out only until its rendered bounds fit. */
export function frameLivingParty(
  camera: Camera,
  units: readonly Unit[],
  boundsFor: (unit: Unit) => VictoryActorBounds,
): Vec2 | null {
  const living = livingParty(units);
  const focus = livingPartyFocus(living);
  if (!focus) return null;

  const fits = () =>
    living.every((unit) => {
      const bounds = boundsFor(unit);
      return (
        bounds.left >= 0 &&
        bounds.right <= camera.viewport.width &&
        bounds.top >= 0 &&
        bounds.bottom <= camera.viewport.height
      );
    });

  const centre = { x: camera.viewport.width / 2, y: camera.viewport.height / 2 };
  camera.centreOn(focus);
  let unchangedRequests = 0;
  for (let attempt = 0; attempt < 32 && !fits(); attempt += 1) {
    const scale = camera.scale;
    // A 0.9 request intentionally lets integer zoom accumulate intent across
    // unchanged snaps before stepping to the next whole-device stop.
    camera.zoomAt(centre, 0.9);
    camera.centreOn(focus);
    if (camera.scale === scale) {
      // Integer zoom may snap one request back to the current stop while its
      // private zoom intent accumulates. Retry a bounded number of requests;
      // only a persistent unchanged stop is treated as the camera's lower bound.
      unchangedRequests += 1;
      if (unchangedRequests >= 8) break;
    } else unchangedRequests = 0;
  }
  return focus;
}

function livingParty(units: readonly Unit[]): Unit[] {
  return units.filter((unit) => unit.faction === 'party' && isAlive(unit));
}
