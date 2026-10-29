/** Read a CSS duration token once when a JavaScript presentation starts. */
export function durationTokenMs(token: `--${string}`, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const duration = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/.exec(raw);
  if (!duration) return fallback;
  const value = Number(duration[1]) * (duration[2] === 'ms' ? 1 : 1000);
  return Number.isFinite(value) ? value : fallback;
}
