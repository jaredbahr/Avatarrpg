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
