import { expect, it } from 'vitest';
import { RUBBLE_CHIP } from '../palettes';
import { GROUND_FRAGMENT } from './shaders';

const glsl = (hex: string): string =>
  `vec3(${[1, 3, 5].map((offset) => (parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(5)).join(', ')})`;

it('speckles WebGL rubble in the spoil chip tone, never the ink bank', () => {
  // WebGL is the default backend; it must match Canvas's chip tone. Soft
  // blotches laid in the ink `rim` read as oil or scorch inside the patch.
  const start = GROUND_FRAGMENT.indexOf('} else if (surface == 7) {');
  expect(start).toBeGreaterThan(-1);
  const branch = GROUND_FRAGMENT.slice(start, GROUND_FRAGMENT.indexOf('\n  }', start));
  expect(branch).toContain(`lay(acc, ${glsl(RUBBLE_CHIP)}, smoothstep(0.74, 0.87, chunk)`);
  expect(branch).not.toMatch(/lay\(acc,\s*rim\b/);
  // The bank line after the material branches still lays the rim (the ink).
  expect(GROUND_FRAGMENT).toMatch(/lay\(acc, rim, max\(bank \* 0\.12, line \*/);
});

/*
 * The GLSL value noise ported to TypeScript, so the stone crack mask can be
 * measured over a stretch of board instead of eyeballed. Doubles rather than
 * the GPU's floats shift individual pixels, not the coverage.
 */
const fract = (x: number): number => x - Math.floor(x);
function hash12(px: number, py: number): number {
  let x = fract(px * 0.1031);
  let y = fract(py * 0.1031);
  let z = x;
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d;
  y += d;
  z += d;
  return fract((x + y) * z);
}
function vnoise(px: number, py: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  let fx = px - ix;
  let fy = py - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const ab = hash12(ix, iy) + (hash12(ix + 1, iy) - hash12(ix, iy)) * fx;
  const cd = hash12(ix, iy + 1) + (hash12(ix + 1, iy + 1) - hash12(ix, iy + 1)) * fx;
  return ab + (cd - ab) * fy;
}
function fbm(px: number, py: number): number {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 3; i++) {
    v += a * vnoise(px, py);
    px = px * 2.03 + 1.7;
    py = py * 2.03 + 9.2;
    a *= 0.5;
  }
  return v;
}
/** GLSL smoothstep, including what drivers do with reversed edges. */
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

it('cracks WebGL stone sparsely, so it stays as light as Canvas stone', () => {
  // The port above is only a measurement if it is the noise the shader runs.
  expect(GROUND_FRAGMENT).toContain(
    'for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }',
  );
  expect(GROUND_FRAGMENT).toContain('p3 += dot(p3, p3.yzx + 33.33);');
  expect(GROUND_FRAGMENT).toContain('vec2 w = (cell + f) * 0.5;');
  expect(GROUND_FRAGMENT).toContain('float macro = fbm(w * 0.7);');

  const start = GROUND_FRAGMENT.indexOf('} else if (terrain == 3 || terrain == 7) {');
  expect(start).toBeGreaterThan(-1);
  const branch = GROUND_FRAGMENT.slice(start, GROUND_FRAGMENT.indexOf('} else if', start + 10));
  const mask = branch.match(
    /float crack = (1\.0 - )?smoothstep\(([\d.]+), ([\d.]+), abs\(macro - ([\d.]+)\)\);/,
  );
  const depth = branch.match(/col \*= 1\.0 - ([\d.]+) \* crack;/);
  expect(mask, 'the stone branch computes one crack mask from macro').not.toBeNull();
  expect(depth, 'the stone branch darkens by the crack mask').not.toBeNull();
  if (!mask || !depth) return;
  const [, invert, e0, e1, centre] = mask;
  const crackAt = (macro: number): number => {
    const s = smoothstep(Number(e0), Number(e1), Math.abs(macro - Number(centre)));
    return invert ? 1 - s : s;
  };

  // A 48x48-tile stretch of board, eight samples a tile each way.
  let sum = 0;
  let n = 0;
  for (let y = 0; y < 48; y += 1 / 8)
    for (let x = 0; x < 48; x += 1 / 8) {
      sum += crackAt(fbm(x * 0.5 * 0.7, y * 0.5 * 0.7));
      n++;
    }
  const coverage = sum / n;
  // Cracks are incident on the paving, not a coat over it: the reversed
  // smoothstep(0.42, 0.40) this replaced covered all of it and held WebGL stone
  // at 0.7x the `#d8cbb0` Canvas paints.
  expect(coverage, 'crack coverage').toBeLessThan(0.1);
  expect(coverage, 'stone still cracks somewhere').toBeGreaterThan(0.02);
  expect(1 - Number(depth[1]) * coverage, 'mean stone darkening').toBeGreaterThan(0.97);
});
