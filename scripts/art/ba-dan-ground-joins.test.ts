import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { BA_DAN_COURTYARD_GROUND, BA_DAN_GARDEN_PLATES } from '../../src/content/scenes/baDan';
import { decodeWebp } from './lib/webp';

it('matches the courtyard feather, including its x=15 and y=11 edges, to the garden', async () => {
  const courtyard = await decodeWebp(
    readFileSync('public/art/maps/ba-dan-scene/courtyard-ground.webp'),
  );
  const gardens = await Promise.all(
    BA_DAN_GARDEN_PLATES.map((_, index) =>
      decodeWebp(readFileSync(`public/art/maps/ba-dan-scene/garden-${index}.webp`)),
    ),
  );
  let paving = 0;
  let lit = 0;
  let compared = 0;
  let roadFeather = 0;
  let total = 0;
  let eastEdge = 0;
  let southEdge = 0;
  for (let py = 0; py < courtyard.height; py++)
    for (let px = 0; px < courtyard.width; px++) {
      const at = (py * courtyard.width + px) * 4;
      const alpha = courtyard.data[at + 3] ?? 0;
      if (alpha === 0 || alpha === 255) continue;
      const wx = BA_DAN_COURTYARD_GROUND.x + px + 0.5;
      const wy = BA_DAN_COURTYARD_GROUND.y + py + 0.5;
      const dx = (wx - 1024) / 64;
      const dy = wy / 32;
      const x = (dx + dy) / 2;
      const y = (dy - dx) / 2;
      const cell = BA_DAN_VILLAGE.rows[Math.floor(y)]?.[Math.floor(x)];
      if (cell === '=' || cell === '.' || cell === 'B' || cell === 'l') {
        // A feather over a road cell stays paving: the road runs on beneath it
        // (western and east approaches), so lawn colour there is a bar across it.
        // The plates carry the village light, so paving no longer has one
        // absolute brightness: in shade it is darker than any open lawn. What
        // makes a road feather paving and not lawn is that it stays brighter
        // than the garden lawn lit by the same light beneath it.
        const lumaOf = (data: Uint8Array | Uint8ClampedArray, i: number): number =>
          0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
        const gardenIndex = Math.floor(wx / 1280);
        const lawn = gardens[gardenIndex];
        const lawnPlate = BA_DAN_GARDEN_PLATES[gardenIndex];
        if (lawn && lawnPlate) {
          const under =
            (Math.floor(wy - lawnPlate.y) * lawn.width + Math.floor(wx - lawnPlate.x)) * 4;
          paving += lumaOf(courtyard.data, at);
          lit += lumaOf(lawn.data, under);
        }
        roadFeather++;
        continue;
      }
      const gardenIndex = Math.floor(wx / 1280);
      const garden = gardens[gardenIndex];
      const plate = BA_DAN_GARDEN_PLATES[gardenIndex];
      if (!garden || !plate) continue;
      const gx = Math.floor(wx - plate.x);
      const gy = Math.floor(wy - plate.y);
      const under = (gy * garden.width + gx) * 4;
      // Both plates are lossy and sample the one world-pixel material, so they
      // agree to the encoder's noise. The pale-brown outline this guards
      // against was a different material, tens of levels away, along the whole run.
      for (let channel = 0; channel < 3; channel++) {
        const diff = Math.abs(
          (courtyard.data[at + channel] ?? 0) - (garden.data[under + channel] ?? 0),
        );
        expect(diff, `feather ${wx},${wy} channel ${channel}`).toBeLessThanOrEqual(40);
        total += diff;
      }
      compared++;
      // The visible diamond between the merchant stall, elder and south house
      // is the lower-right courtyard feather: tile boundary x=15 / y=11.
      if (x >= 14.5 && x < 15 && y >= 3 && y < 11) eastEdge++;
      if (y >= 10.5 && y < 11 && x >= 5 && x < 15) southEdge++;
    }
  expect(compared, 'the visible courtyard perimeter is exercised').toBeGreaterThan(1_000);
  expect(roadFeather, 'road feathers are exercised').toBeGreaterThan(50);
  // On average the paving stays brighter than the lawn lit the same way beneath it.
  // (A single pixel may be a flower on the lawn, so this is a mean, not each pixel.)
  expect(paving / roadFeather, 'road feathers keep paving').toBeGreaterThan(lit / roadFeather + 15);
  expect(total / (compared * 3), 'mean feather mismatch is encoder noise').toBeLessThan(4);
  expect(eastEdge, 'courtyard tile boundary x=15 is exercised').toBeGreaterThan(100);
  expect(southEdge, 'courtyard tile boundary y=11 is exercised').toBeGreaterThan(100);
});
