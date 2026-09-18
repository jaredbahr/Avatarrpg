/** Distance-based exploration timing, with brief starts/stops even on long routes. */
export function strollTiming(length: number, msPerTile: number) {
  const travel = Math.max(0, length) * msPerTile;
  const ramp = Math.min(120, travel);
  const duration = travel + ramp;
  const rampDistance = ramp / (2 * msPerTile);
  const distanceAt = (ms: number): number => {
    const t = Math.max(0, Math.min(duration, ms));
    if (duration === 0) return 0;
    if (t < ramp) return (t * t) / (2 * ramp * msPerTile);
    if (t > duration - ramp) return length - (duration - t) ** 2 / (2 * ramp * msPerTile);
    return (t - ramp / 2) / msPerTile;
  };
  return {
    duration,
    ease: (fraction: number): number => (length > 0 ? distanceAt(fraction * duration) / length : 0),
    /** Inverse of the walk, so a footfall sounds when that foot reaches the ground. */
    atDistance: (distance: number): number => {
      const d = Math.max(0, Math.min(length, distance));
      if (d < rampDistance) return Math.sqrt(2 * ramp * msPerTile * d);
      if (d > length - rampDistance)
        return duration - Math.sqrt(2 * ramp * msPerTile * (length - d));
      return d * msPerTile + ramp / 2;
    },
  };
}
