import type { Unit, Vec2 } from '../../core/types';
import { isAlive } from '../../core/rules/stats';
import type { Camera } from '../../render/camera';

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

/** Center the surviving party and zoom out only until its bounds and cues fit. */
export function frameLivingParty(camera: Camera, units: readonly Unit[]): Vec2 | null {
  const living = livingParty(units);
  const focus = livingPartyFocus(living);
  if (!focus) return null;

  const padding = Math.min(48, camera.viewport.width / 2, camera.viewport.height / 2);
  const fits = () =>
    living.every((unit) => {
      const right = unit.pos.x + unit.size;
      const bottom = unit.pos.y + unit.size;
      return [
        { x: unit.pos.x, y: unit.pos.y },
        { x: right, y: unit.pos.y },
        { x: right, y: bottom },
        { x: unit.pos.x, y: bottom },
      ].every((point) => {
        const screen = camera.project(point);
        return (
          screen.x >= padding &&
          screen.x <= camera.viewport.width - padding &&
          screen.y >= padding &&
          screen.y <= camera.viewport.height - padding
        );
      });
    });

  const centre = { x: camera.viewport.width / 2, y: camera.viewport.height / 2 };
  camera.centreOn(focus);
  for (let attempt = 0; attempt < 32 && !fits(); attempt += 1) {
    const scale = camera.scale;
    camera.zoomAt(centre, 0.8);
    camera.centreOn(focus);
    if (camera.scale === scale) break;
  }
  return focus;
}

function livingParty(units: readonly Unit[]): Unit[] {
  return units.filter((unit) => unit.faction === 'party' && isAlive(unit));
}
