/**
 * The Pixi ground pass is skipped when it would draw nothing (`groundPassIsBlank`). Over a
 * painting `GROUND_FRAGMENT` starts clear and lays only a surface, a dry patch or the grid, so
 * those are exactly the texels and settings that must keep it running.
 */
import { describe, expect, it } from 'vitest';
import { DRY_PATCH_TERRAIN_OFFSET } from '../sceneSurfaces';
import { groundPassIsBlank } from './pixi';

/** RGBA map texels, red packed as `(terrain + dry offset) * 8 + surface`. */
function texels(reds: readonly number[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(reds.length * 4);
  reds.forEach((red, i) => {
    data[i * 4] = red;
    data[i * 4 + 3] = 255;
  });
  return data;
}

const bareGround = texels([0 * 8, 1 * 8, 2 * 8, 6 * 8]);

describe('groundPassIsBlank', () => {
  it('skips the pass over a painting with no surface, dry patch or grid', () => {
    expect(groundPassIsBlank(true, false, bareGround)).toBe(true);
  });

  it('keeps the pass wherever there is no painting, since it draws the terrain', () => {
    expect(groundPassIsBlank(false, false, bareGround)).toBe(false);
  });

  it('keeps the pass when the grid is on', () => {
    expect(groundPassIsBlank(true, true, bareGround)).toBe(false);
  });

  it('keeps the pass for any surface the shader still draws', () => {
    for (let surface = 1; surface < 8; surface++)
      expect(groundPassIsBlank(true, false, texels([8, 2 * 8 + surface, 8])), `${surface}`).toBe(
        false,
      );
  });

  it('keeps the pass for a dry patch over painted water', () => {
    expect(groundPassIsBlank(true, false, texels([(1 + DRY_PATCH_TERRAIN_OFFSET) * 8]))).toBe(
      false,
    );
  });

  it('reads only the red channel: firelight and intensity ride on surfaces', () => {
    const data = texels([8, 8]);
    data[1] = 255;
    data[2] = 255;
    expect(groundPassIsBlank(true, false, data)).toBe(true);
  });
});
