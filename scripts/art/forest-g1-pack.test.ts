import { readFileSync, readdirSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { FOREST_ROAD_SCENE } from '../../src/content/scenes/forestRoad';
import { imageSize, readPng } from './lib/image';
import { alphaBounds } from './lib/trim';
import { FOREST_G1_OUT, FOREST_G1_SOURCE, PROP_FOOT, packForestG1 } from './forest-g1-pack';

// Encoding the whole board takes most of a minute on a busy machine.
vi.setConfig({ testTimeout: 240_000 });

const files = await packForestG1();

it('ships exactly what the committed G1 sources pack to', () => {
  for (const [path, bytes] of files)
    expect(Buffer.from(bytes).equals(readFileSync(path)), `${path} is stale`).toBe(true);
  const shipped = readdirSync(FOREST_G1_OUT).map((name) => `${FOREST_G1_OUT}/${name}`);
  expect(shipped.sort()).toEqual(
    [...files.keys()].filter((path) => path.startsWith(FOREST_G1_OUT)).sort(),
  );
});

it('is every G1 file the scene draws, and draws every one', () => {
  const urls = new Set(
    [...FOREST_ROAD_SCENE.ground, ...FOREST_ROAD_SCENE.scenery]
      .map((piece) => piece.url)
      .filter((url) => url.startsWith('art/maps/forest-g1/')),
  );
  expect([...urls].map((url) => `public/${url}`).sort()).toEqual(
    [...files.keys()].filter((path) => path.startsWith(FOREST_G1_OUT)).sort(),
  );
});

it('draws each upright at 1.5 file px per world px, so the registration did not move', () => {
  for (const piece of FOREST_ROAD_SCENE.scenery) {
    if (!piece.url.startsWith('art/maps/forest-g1/')) continue;
    const size = imageSize(readFileSync(`public/${piece.url}`));
    if (!size) throw new Error(`${piece.url} has no size`);
    // Each upright was generated on the rectangle its pre-G1 art was drawn at,
    // rounded to whole world px; the delivery is 1.5x that.
    expect(Math.abs(size.width / 1.5 - piece.width), `${piece.id} width`).toBeLessThanOrEqual(1);
    expect(Math.abs(size.height / 1.5 - piece.height), `${piece.id} height`).toBeLessThanOrEqual(1);
  }
});

it('stands every prop on its old foot, at 1 art px per world px', () => {
  for (const [id, foot] of Object.entries(PROP_FOOT)) {
    const frame = readPng(`public/art/props/${id}.png`);
    const source = readPng(`${FOREST_G1_SOURCE}/props/${id}.png`);
    expect({ width: frame.width, height: frame.height }).toEqual({ width: 256, height: 256 });
    const bounds = alphaBounds(frame);
    if (!bounds) throw new Error(`${id} is empty`);
    expect(bounds.y + bounds.height, `${id} foot`).toBe(foot.bottom);
    // The renderer draws the 256 px frame into one 64 world px sprite box.
    expect(bounds.width, `${id} width`).toBe(source.width * 4);
    expect(bounds.height, `${id} height`).toBe(source.height * 4);
    expect(Math.abs(bounds.x + bounds.width / 2 - foot.x), `${id} centre`).toBeLessThanOrEqual(2);
  }
});
