/**
 * The riverside's ids and named spots, apart from its map so the app can name them without pulling
 * the map (region data, ADR 0111 §2) into the boot chunk.
 */
export const RIVERSIDE_ID = 'ba_dan_riverside';
export const RIVERSIDE_ENTRY = 'riverside_explore';
export const RIVERSIDE_SPOTS = {
  mira: { x: 15, y: 9 },
  canopy: { x: 13, y: 9 },
  otter: { x: 17, y: 15 },
  tea: { x: 8, y: 18 },
  practice: { x: 30, y: 13 },
  shrine: { x: 31, y: 5 },
} as const;
