/** Four cels per clip, baked into the shared effects texture (ADR 0021). */
export const FX_CELS = [
  'flame',
  'fire-burst',
  'lightning',
  'splash',
  'ice',
  'healing',
  'boulder',
  'earth-rise',
  'metal',
  'wind',
  'cyclone',
  'cushion',
  'flask',
] as const;
export type FxCel = (typeof FX_CELS)[number];

export const CEL_FRAMES = 4;
export const CEL_SIZE = 192;
export const FX_CEL_SHEETS = [
  { url: 'art/fx/fire-cels.png', clips: ['flame', 'fire-burst', 'lightning'] },
  { url: 'art/fx/water-cels.png', clips: ['splash', 'ice', 'healing'] },
  { url: 'art/fx/earth-cels.png', clips: ['boulder', 'earth-rise', 'metal'] },
  { url: 'art/fx/air-cels.png', clips: ['wind', 'cyclone', 'cushion'] },
  { url: 'art/fx/flask-cels.png', clips: ['flask'] },
] as const satisfies readonly { url: string; clips: readonly FxCel[] }[];

/** Ground eruptions stand on the tile; everything else is centred on its emitter. */
export function celAnchorY(cel: FxCel): number {
  return cel === 'ice' || cel === 'earth-rise' || cel === 'splash' ? 0.84 : 0.5;
}

/** Sample the same cel after skipped frames, pauses or a direct filmstrip seek. */
export function celFrameIndex(cel: FxCel, elapsed: number, duration: number): number {
  const once =
    cel === 'fire-burst' ||
    cel === 'lightning' ||
    cel === 'splash' ||
    cel === 'ice' ||
    cel === 'earth-rise';
  const frame = once
    ? Math.floor((Math.max(0, elapsed) / Math.max(1, duration)) * CEL_FRAMES)
    : Math.floor(Math.max(0, elapsed) / (1000 / 12)) % CEL_FRAMES;
  return Math.min(CEL_FRAMES - 1, frame);
}
