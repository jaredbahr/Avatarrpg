import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHARACTERS, checkSources, sha256 } from './g-sprites';

const PARTY = Object.values(CHARACTERS);

// The party's shipped sheets are packed on the G1 grid by party-g1.ts since
// ADR 0089; their decoded-atlas checks are in party-g1.test.ts. What is left
// here is this packer's own data and its source-pin rule, which the enemy and
// resident packers share.
describe('G source pins', () => {
  it('places every rest on a walk cel and keeps each heading inside its frame', () => {
    for (const character of PARTY) {
      for (const h of character.headings) {
        expect(h.restCel, `${character.name} ${h.direction}`).toBeGreaterThanOrEqual(0);
        expect(h.restCel, `${character.name} ${h.direction}`).toBeLessThan(12);
        for (const shift of [h.walkDx, h.walkDy, h.idleDy, h.stanceDy])
          expect(Math.abs(shift), `${character.name} ${h.direction}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it('rejects a changed, missing, unpinned or stray source cel', () => {
    const root = mkdtempSync(join(tmpdir(), 'g-src-'));
    mkdirSync(join(root, 'walk'), { recursive: true });
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5, 6]);
    writeFileSync(join(root, 'walk', 'a.png'), a);
    writeFileSync(join(root, 'walk', 'b.png'), b);
    const good = { 'walk/a.png': sha256(a), 'walk/b.png': sha256(b) };
    const files = ['walk/a.png', 'walk/b.png'];
    expect(checkSources(root, files, good, 'PixelLab')).toEqual([]);
    writeFileSync(join(root, 'walk', 'b.png'), new Uint8Array([4, 5, 7]));
    expect(checkSources(root, files, good, 'PixelLab')).toEqual([
      'PixelLab walk/b.png does not match its pin',
    ]);
    expect(checkSources(root, [...files, 'walk/c.png'], good, 'PixelLab')).toContain(
      'PixelLab walk/c.png has no pin',
    );
    expect(checkSources(root, files, { ...good, 'walk/c.png': sha256(a) }, 'PixelLab')).toContain(
      'PixelLab pin walk/c.png is not a file the build reads',
    );
    expect(
      checkSources(join(root, 'elsewhere'), files, good, 'PixelLab').every((p) =>
        p.includes('is missing'),
      ),
    ).toBe(true);
  });
});
