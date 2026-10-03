import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { expect, it } from 'vitest';
import { checkSurround, SURROUND_PAGES, SURROUND_SIZE } from './quarry-surround-pack';

/**
 * Generated art, 2026-10-03: the crisp quarry surround. The packer cannot
 * rebuild it (docs/art/quarry-surround-composition.md), so the shipped bytes
 * are pinned by hash and size here.
 */
const SHIPPED = {
  west: {
    bytes: 192_872,
    sha256: '7d024677ab6db9fe841843b3e673220e5a0ed550ab72ab2c360877e767dea906',
  },
  east: {
    bytes: 193_788,
    sha256: '512d602a38c631dbd421526d898a2ed7265c0310d79ea18d86b7d05761479bf6',
  },
} as const;

it.each(SURROUND_PAGES)('pins the $side surround page to its recorded bytes', ({ side }) => {
  const path = `public/art/maps/quarry-surround/${side}.webp`;
  expect(statSync(path).size).toBe(SHIPPED[side].bytes);
  expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(SHIPPED[side].sha256);
});

it.each(SURROUND_PAGES)(
  'keeps the $side surround binary and clear exactly over the floor',
  async ({ side }) => {
    const report = await checkSurround(side);
    expect({ width: report.width, height: report.height }).toEqual(SURROUND_SIZE);
    expect(report.partialAlpha).toBe(0);
    expect(report.opaqueInside).toBe(0);
    expect(report.clearOutside).toBe(0);
  },
);
