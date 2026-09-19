/** Shared material treatment; the complete rules tile always receives a wash. */
export const SURFACE_BANK = { width: 0.075, line: 0.018, alpha: 0.48 } as const;

/** Permanent surfaces stay solid; temporary ones thin without disappearing. */
export function surfaceIntensity(duration: number): number {
  return duration < 0 ? 1 : Math.min(1, 0.45 + duration / 6);
}
