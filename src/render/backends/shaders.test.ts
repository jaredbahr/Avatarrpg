import { expect, it } from 'vitest';
import { RUBBLE_CHIP, TERRAIN_STYLES } from '../palettes';
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

it('gives WebGL stone and wall no shader cracks, so they match Canvas', () => {
  // A crack keyed to a contour of the macro noise widens wherever the field is
  // flat and drew tapered grey worms across stone and oil pools. The house
  // crack is the shared decal pass, which runs on both backends.
  expect(GROUND_FRAGMENT).not.toMatch(/float crack/);
  expect(GROUND_FRAGMENT).not.toMatch(/terrain == 3/);
  expect(GROUND_FRAGMENT).not.toMatch(/terrain == 7/);

  // Parity: every procedural base the shader starts from is the Canvas fill.
  const indices = ['grass', 'dirt', 'road', 'stone', 'sand', 'wood', 'water_deep', 'wall'] as const;
  for (const [index, terrain] of indices.entries()) {
    const line = GROUND_FRAGMENT.match(
      new RegExp(String.raw`if \(t == ${index}\) return vec3\(([\d.]+), ([\d.]+), ([\d.]+)\);`),
    );
    expect(line, terrain).not.toBeNull();
    const fill = TERRAIN_STYLES[terrain].fill;
    [1, 3, 5].forEach((offset, channel) =>
      expect(Number(line?.[channel + 1]), `${terrain} channel ${channel}`).toBeCloseTo(
        parseInt(fill.slice(offset, offset + 2), 16) / 255,
        2,
      ),
    );
  }
  expect(TERRAIN_STYLES.wall.fill).toBe('#3a352f');
});

it('seats WebGL rubble on its heap art without a bank, as Canvas does', () => {
  // pixi.ts packs terrain * 16 + surface and writes 8 for rubble seated on its
  // heap art. The shader reads it as rubble but skips the edge measure, so the
  // bank line (1 - smoothstep(..., edgeDistance)) stays at zero.
  expect(GROUND_FRAGMENT).toContain('int terrain = packed / 16;');
  expect(GROUND_FRAGMENT).toContain('return packed - (packed / 16) * 16;');
  expect(GROUND_FRAGMENT).toContain('bool seated = surface == 8;');
  expect(GROUND_FRAGMENT).toContain('if (opacity > 0.0 && !seated) {');
  const start = GROUND_FRAGMENT.indexOf('} else if (surface == 7) {');
  const branch = GROUND_FRAGMENT.slice(start, GROUND_FRAGMENT.indexOf('\n  }', start));
  // Gone by 0.85 of the way to an edge's middle, full strength inside 0.35.
  expect(branch).toMatch(
    /if \(seated\) \{\s+seat = clamp\(\(0\.85 - length\(f - 0\.5\) \* 2\.0\) \/ 0\.50, 0\.0, 1\.0\);/,
  );
  expect(branch).toContain('* 0.28 * seat * intensity');
});
