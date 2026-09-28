import { expect, it } from 'vitest';
import { readPng } from './lib/image';
import { BARREL_PATH, closeLid, isWater } from './barrel-lid';

const barrel = readPng(BARREL_PATH);

it('ships the barrel lidded in its own wood, with no water on top', () => {
  let water = 0;
  for (let i = 0; i < barrel.data.length; i += 4)
    if (
      (barrel.data[i + 3] ?? 0) > 0 &&
      isWater(barrel.data[i] ?? 0, barrel.data[i + 1] ?? 0, barrel.data[i + 2] ?? 0)
    )
      water++;
  expect(water).toBe(0);
  // The shipped art is the tool's output: running it again changes nothing.
  expect(Buffer.from(closeLid(barrel).data).equals(Buffer.from(barrel.data))).toBe(true);
});
