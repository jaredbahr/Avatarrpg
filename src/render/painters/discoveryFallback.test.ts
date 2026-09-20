import { expect, it, vi } from 'vitest';
import { ASSETS } from '../../content/assets/manifest';
import { paletteFor } from '../palettes';
import { paintDiscovery } from './discoveries';
import { resolvePainter } from './registry';
import type { Ctx } from './shapes';

vi.mock('./discoveries', () => ({ paintDiscovery: vi.fn() }));

it('retains the original tea discovery when the authored image is unavailable', () => {
  expect(ASSETS['world.tea_station']?.kind).toBe('image');
  // SpriteCache invokes this path while loading and after image failure. An
  // unrecognized image key would invoke the generic disc and fail this check.
  const context = {} as Ctx;
  const box = { x: 10, y: 20, size: 96 };
  resolvePainter('world.tea_station').draw(context, box, { facing: -1 });
  expect(paintDiscovery).toHaveBeenCalledTimes(1);
  expect(paintDiscovery).toHaveBeenCalledWith(context, box, paletteFor('earth'), {
    facing: -1,
    variant: 'tea',
  });
});
