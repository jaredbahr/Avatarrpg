import { FADE_MS, RESIDENT_AMBLE } from '../src/app/world/residentMotion';
import { TIMING } from '../src/app/anim/choreography';
import { strollTiming } from '../src/app/anim/stroll';
import { smoothPath } from '../src/render/geometry/curve';
import { sheetLocomotion } from '../src/content/assets/manifest';
import type { Vec2 } from '../src/core/types';

export const RESIDENT_COMPLETION_STEP_MS = 60;
export const RESIDENT_COMPLETION_MAX_BUDGET_MS = 180_000;
const RESIDENT_CLOCK_CLAMP_MS = 100;
const FINAL_RENDER_WINDOW_MS = RESIDENT_COMPLETION_STEP_MS * 4;

type PlannedWalk = {
  kind: 'walk';
  who: { id: string; sprite: string };
  from: Vec2;
  path: readonly Vec2[];
  enter: boolean;
  leave: boolean;
};

type PlannedFade = {
  kind: 'fade';
  from: Vec2 | null;
  to: Vec2 | null;
};

export type PlannedResidentTrack = {
  start: number;
  motion: PlannedWalk | PlannedFade;
};

export type ResidentPlanSnapshot = {
  clock: number;
  tracks: readonly PlannedResidentTrack[];
};

export type ResidentCompletionPlan = {
  authoredRemainingMs: number;
  interiorMs: number;
  renderedMs: number;
  totalBudgetMs: number;
};

function finitePosition(position: Vec2): boolean {
  return Number.isFinite(position.x) && Number.isFinite(position.y);
}

/**
 * Derive a bounded completion allowance from the paths ResidentWalks planned.
 * This deliberately recomputes route time from geometry and authored pacing;
 * it does not trust the runtime track's own end timestamp.
 */
export function residentCompletionPlan(snapshot: ResidentPlanSnapshot): ResidentCompletionPlan {
  if (!Number.isFinite(snapshot.clock) || snapshot.clock < 0)
    throw new Error('Resident completion clock must be finite and non-negative');

  let latestExpectedEnd = snapshot.clock;
  for (const track of snapshot.tracks) {
    if (!Number.isFinite(track.start) || track.start < 0)
      throw new Error('Resident track start must be finite and non-negative');

    const { motion } = track;
    let duration: number;
    if (motion.kind === 'fade') {
      duration = (motion.from ? FADE_MS : 0) + (motion.to ? FADE_MS : 0);
    } else {
      if (!motion.who.sprite || motion.path.length === 0)
        throw new Error('Resident walk must include a sprite and a planned route');
      if (!finitePosition(motion.from) || motion.path.some((position) => !finitePosition(position)))
        throw new Error('Resident route coordinates must be finite');
      const curveLength = smoothPath(motion.from, motion.path).length;
      const timing = strollTiming(curveLength, TIMING.strollStep);
      const pace = sheetLocomotion(motion.who.sprite)?.amble ? RESIDENT_AMBLE : 1;
      duration =
        timing.duration * pace + (motion.enter ? FADE_MS : 0) + (motion.leave ? FADE_MS : 0);
    }

    if (!Number.isFinite(duration) || duration < 0)
      throw new Error('Resident route duration must be finite and non-negative');
    latestExpectedEnd = Math.max(latestExpectedEnd, track.start + duration);
  }

  const authoredRemainingMs = Math.max(0, latestExpectedEnd - snapshot.clock);
  const interiorMs = Math.max(0, authoredRemainingMs - FINAL_RENDER_WINDOW_MS);
  const renderedMs = authoredRemainingMs - interiorMs + RESIDENT_CLOCK_CLAMP_MS;
  const totalBudgetMs = interiorMs + renderedMs;
  if (totalBudgetMs > RESIDENT_COMPLETION_MAX_BUDGET_MS)
    throw new Error(`Resident completion budget exceeds ${RESIDENT_COMPLETION_MAX_BUDGET_MS} ms`);
  return { authoredRemainingMs, interiorMs, renderedMs, totalBudgetMs };
}

export function residentCompletionBudgetMs(snapshot: ResidentPlanSnapshot): number {
  return residentCompletionPlan(snapshot).totalBudgetMs;
}

export type ResidentCompletionFrame = {
  moving: boolean;
  markers: readonly {
    id: string;
    pos: Vec2;
    at: Vec2;
    alpha: number;
  }[];
};

/** The phase-change end state whose visual assertions the browser spec owns. */
export function residentPhaseChangeSettled(frame: ResidentCompletionFrame): boolean {
  if (frame.moving) return false;
  if (frame.markers.some((marker) => marker.id === 'lw.npc.mira')) return false;
  const dorin = frame.markers.find((marker) => marker.id === 'lw.npc.dorin');
  return Boolean(
    dorin &&
    dorin.pos.x === 17 &&
    dorin.pos.y === 6 &&
    dorin.at.x === 17 &&
    dorin.at.y === 6 &&
    dorin.alpha === 1,
  );
}

/** Poll a bounded number of virtual-time steps; a stalled clock fails deterministically. */
export async function waitWithinResidentBudget(
  budgetMs: number,
  advance: (stepMs: number) => Promise<void>,
  settled: () => Promise<boolean>,
): Promise<boolean> {
  if (!Number.isFinite(budgetMs) || budgetMs < 0)
    throw new Error('Resident completion budget must be finite and non-negative');
  if (budgetMs > RESIDENT_COMPLETION_MAX_BUDGET_MS)
    throw new Error(`Resident completion budget exceeds ${RESIDENT_COMPLETION_MAX_BUDGET_MS} ms`);

  let remaining = budgetMs;
  const maxSteps = Math.ceil(budgetMs / RESIDENT_COMPLETION_STEP_MS);
  for (let index = 0; index < maxSteps; index++) {
    const step = Math.min(RESIDENT_COMPLETION_STEP_MS, remaining);
    await advance(step);
    remaining -= step;
    if (await settled()) return true;
  }
  return settled();
}
