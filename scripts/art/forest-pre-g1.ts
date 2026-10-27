/**
 * The forest road's ground plates as they stood before G1 (main @ 5a41f98),
 * kept as the recorded inputs of the G1 restyle (ADR 0086) in
 * `art/source/forest-road-g1/pre-g1/`. They no longer ship. The procedural
 * apron is still derived from them, so its footprint is the one the G1 apron
 * bands carry.
 */
export const PRE_G1_DIR = 'art/source/forest-road-g1/pre-g1';

/** The file a scene ground URL was drawn from before G1. */
export function preG1Path(url: string): string {
  const name = url.split('/').pop() ?? url;
  // The heaps were never restyled in place: the shared plates still ship.
  if (/^rubble(-\d)?\.webp$/.test(name)) return `public/art/maps/forest-scene/${name}`;
  if (url.startsWith('art/maps/forest-g1/')) return `${PRE_G1_DIR}/${name}`;
  return `public/${url}`;
}
