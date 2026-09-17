/** Continuous rig poses, sampled on twos by the village painter. */
import type { Pose } from '../painters/figure';
import { poseFor } from '../painters/figure';

export type VillageMotion = 'idle' | 'walk' | 'wave' | 'water' | 'fire';
export const FORM_DURATION = 3800;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};

/** One clock for the held drawing, weight shift, light and released element. */
export function formBeat(elapsed: number, water: boolean) {
  const t = clamp(elapsed / FORM_DURATION);
  const releaseAt = water ? 0.42 : 0.46;
  const gather = ease((t - 0.1) / (releaseAt - 0.1));
  const release = ease((t - releaseAt) / (water ? 0.18 : 0.075));
  const recover = ease((t - 0.7) / 0.3);
  return {
    t,
    gather,
    release,
    recover,
    frame: t < releaseAt ? 0 : t < 0.7 ? 1 : 2,
    weight: (-0.06 * gather + 0.16 * release) * (1 - recover),
    energy: gather * (1 - ease((t - 0.72) / 0.2)),
  };
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const mix = (x: number, y: number) => x + (y - x) * ease(t);
  const limb = (
    x: readonly [number, number],
    y: readonly [number, number],
  ): readonly [number, number] => [mix(x[0], y[0]), mix(x[1], y[1])];
  return {
    lean: mix(a.lean, b.lean),
    head: mix(a.head, b.head),
    frontArm: limb(a.frontArm, b.frontArm),
    backArm: limb(a.backArm, b.backArm),
    frontLeg: limb(a.frontLeg, b.frontLeg),
    backLeg: limb(a.backLeg, b.backLeg),
    lift: mix(a.lift, b.lift),
    breath: mix(a.breath, b.breath),
    hint: t < 0.5 ? a.hint : b.hint,
    eyes: t < 0.5 ? a.eyes : b.eyes,
  };
}

export function villagePose(motion: VillageMotion, elapsed: number): Pose {
  const rest = poseFor('idle', 0);
  if (motion === 'idle')
    return {
      ...rest,
      breath: 1 + Math.sin(elapsed / 560) * 0.018,
      head: Math.sin(elapsed / 1300) * 0.025,
    };
  if (motion === 'walk') {
    const phase = (Math.sin(elapsed / 95) + 1) / 2;
    return {
      ...mixPose(poseFor('walk', 0), poseFor('walk', 1), phase),
      lift: Math.abs(Math.sin(elapsed / 95)) * 0.035,
    };
  }
  if (motion === 'wave') {
    const raised: Pose = {
      ...rest,
      head: -0.08,
      frontArm: [2.35, 2.8 + Math.sin(elapsed / 115) * 0.35],
      backArm: [-0.15, 0.1],
    };
    return mixPose(rest, raised, Math.min(elapsed / 300, (2200 - elapsed) / 300));
  }
  const t = clamp(elapsed / FORM_DURATION);
  const stance: Pose = {
    ...rest,
    lean: -0.1,
    frontLeg: [0.6, -0.12],
    backLeg: [-0.55, 0.2],
    frontArm: [0.5, 1.7],
    backArm: [-0.5, -1.2],
  };
  const gather: Pose =
    motion === 'water'
      ? { ...stance, lean: -0.18, head: -0.12, frontArm: [2.1, 2.7], backArm: [-1.1, -2.2] }
      : { ...stance, lean: -0.24, frontArm: [0.65, 2.2], backArm: [-0.85, 0.3] };
  const release: Pose = {
    ...poseFor('cast', 1),
    hint: 'none',
    lean: motion === 'fire' ? 0.35 : 0.2,
  };
  if (t < 0.18) return mixPose(rest, stance, t / 0.18);
  if (t < 0.45) return mixPose(stance, gather, (t - 0.18) / 0.27);
  if (t < 0.62) return mixPose(gather, release, (t - 0.45) / 0.17);
  if (t < 0.8) return mixPose(release, poseFor('cast', 2), (t - 0.62) / 0.18);
  return mixPose(poseFor('cast', 2), rest, (t - 0.8) / 0.2);
}
