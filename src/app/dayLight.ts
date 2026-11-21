/**
 * The day's light for the view (ADR 0121): the phase's grade from `DAY_LIGHT`, and the scene's lit
 * lamps, resolved for the renderer, which never reads the clock or the content table itself.
 */
import type { DayPhase, MapScene, Vec2 } from '../core/types';
import {
  COMBAT_LIGHT_STRENGTH,
  DAY_LIGHT,
  LAMP_GLASS,
  LAMP_POOL,
  type LightGradeDef,
} from '../content/dayLight';
import { TOPDOWN_TILE } from '../render/projection';
import type { BoardLight, LampLight, LightGrade } from '../render/view';

export type LightMode = 'explore' | 'combat';

/** A table grade at `strength` (1 is the table's, 0 none), in the view's 0..1 terms. */
export function scaleGrade(def: LightGradeDef, strength: number): LightGrade {
  const s = Math.max(0, Math.min(1, strength));
  const channel = (c: 0 | 1 | 2) => 1 - s * (1 - def.multiply[c]);
  const lift = (c: 0 | 1 | 2) => (s * def.lift[c]) / 255;
  return {
    multiply: [channel(0), channel(1), channel(2)],
    lift: [lift(0), lift(1), lift(2)],
  };
}

/**
 * The scene's lamps, each found by the scenery piece its glass hangs in (the glass point is the
 * centroid of the lamp's lit pixels, `scripts/art/topdown/boards/ground.ts`). The pool's centre is
 * the ground under the glass: straight below it, on the line the lamp's post stands on (the piece's
 * foot). A glass no piece holds is left unlit rather than guessed at.
 */
export function sceneLamps(scene: MapScene | undefined): LampLight[] {
  const lanterns = scene?.ambienceSources?.lanterns ?? [];
  const scenery = scene?.scenery ?? [];
  return lanterns.flatMap((glass): LampLight[] => {
    const px = { x: glass.x * TOPDOWN_TILE, y: glass.y * TOPDOWN_TILE };
    const piece = scenery.find(
      (p) => px.x >= p.x && px.x < p.x + p.width && px.y >= p.y && px.y < p.y + p.height,
    );
    if (!piece) return [];
    const ground: Vec2 = { x: glass.x, y: (piece.y + piece.height) / TOPDOWN_TILE };
    return [{ glass, ground, depth: piece.depth }];
  });
}

/** The light a board draws in this phase, or null when the board is drawn as painted. */
export function boardLight(
  phase: DayPhase,
  scene: MapScene | undefined,
  mode: LightMode,
): BoardLight | null {
  const def = DAY_LIGHT[phase];
  const lamps = def.lampsLit ? sceneLamps(scene) : [];
  const strength = mode === 'combat' ? COMBAT_LIGHT_STRENGTH : 1;
  const grade = def.grade && strength > 0 ? scaleGrade(def.grade, strength) : null;
  if (!grade && lamps.length === 0) return null;
  return { grade, lamps, pool: LAMP_POOL, glass: LAMP_GLASS };
}

/** Memoised per input, so the view hands the backends the same object frame after frame. */
let last: {
  phase: DayPhase;
  scene: MapScene | undefined;
  mode: LightMode;
  light: BoardLight | null;
} | null = null;
export function boardLightFor(
  phase: DayPhase,
  scene: MapScene | undefined,
  mode: LightMode,
): BoardLight | null {
  if (last && last.phase === phase && last.scene === scene && last.mode === mode) return last.light;
  const light = boardLight(phase, scene, mode);
  last = { phase, scene, mode, light };
  return light;
}
