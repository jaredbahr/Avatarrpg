/**
 * Pins for shipped plates that are generated art, not packer output.
 *
 * A plate the packer can rebuild is held byte-for-byte against it. A plate
 * that was generated (2026-10-03 Forest Road ground and water pass; see
 * `docs/art/forest-ground-composition.md` and `docs/art/forest-pond-shoreline.md`)
 * cannot be, so its size and SHA-256 are recorded in the test instead, and the
 * packer stays as the authority on registration: the shipped plate must carry
 * the packer's exact alpha footprint.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import type { Image } from './image';
import { decodeWebp } from './webp';

export interface ShippedPin {
  readonly bytes: number;
  readonly sha256: string;
}

/** The shipped file is exactly the recorded generated art. */
export function expectShippedPin(path: string, pin: ShippedPin): void {
  const shipped = readFileSync(path);
  expect(
    { bytes: shipped.length, sha256: createHash('sha256').update(shipped).digest('hex') },
    path,
  ).toEqual(pin);
}

/** The shipped plate has the packer's size and decoded alpha, pixel for pixel. */
export async function expectPackerAlpha(path: string, packed: Image): Promise<void> {
  const shipped = await decodeWebp(readFileSync(path));
  expect({ width: shipped.width, height: shipped.height }, path).toEqual({
    width: packed.width,
    height: packed.height,
  });
  let mismatched = 0;
  for (let i = 3; i < packed.data.length; i += 4)
    if (shipped.data[i] !== packed.data[i]) mismatched++;
  expect(mismatched, `${path} alpha pixels differing from the packer`).toBe(0);
}

/** Generated plates are not rebuilt by their procedural packers. */
export function refuseToOverwriteGenerated(name: string): void {
  if (process.env.FOREST_REPACK_PROCEDURAL === '1') return;
  throw new Error(
    `${name} ships generated art (2026-10-03); the procedural packer would overwrite it. ` +
      'Set FOREST_REPACK_PROCEDURAL=1 to rebuild the old procedural plate deliberately.',
  );
}
