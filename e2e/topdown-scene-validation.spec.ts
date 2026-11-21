import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { MapScene } from '../src/core/types';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

// Request fixtures must reach the loader rather than a service-worker cache.
test.use({ serviceWorkers: 'block' });

type SceneApp = { scene: { firstFrameReady(): Promise<unknown> } };
// Ba Dan has no scene while it is a grey blockout (`docs/places/ba_dan_village.md`), so the loader's validation is
// held to the Forest Road's, the demo route's first board with a baked scene.
const url = 'art/topdown/forest-road/scene.json';
const shipped = JSON.parse(readFileSync(`public/${url}`, 'utf8')) as MapScene;
const mutations = [
  {
    name: 'missing scenery crop',
    path: 'scenery.0.sourceRect',
    change: (scene: MapScene) => {
      if (!scene.scenery[0]) throw new Error('Missing shipped scenery');
      Reflect.deleteProperty(scene.scenery[0], 'sourceRect');
    },
  },
  {
    name: 'wrong atlas URL',
    path: 'scenery.0.url',
    change: (scene: MapScene) => {
      if (!scene.scenery[0]) throw new Error('Missing shipped scenery');
      Object.assign(scene.scenery[0], { url: 'art/topdown/forest-road/not-the-atlas.webp' });
    },
  },
  {
    name: 'negative scenery size',
    path: 'scenery.0.width',
    change: (scene: MapScene) => {
      if (!scene.scenery[0]) throw new Error('Missing shipped scenery');
      Object.assign(scene.scenery[0], { width: -1 });
    },
  },
] as const;

async function forestRoad(page: Page, renderer: string) {
  await resetStorage(page, `?renderer=${renderer}`);
  await startGame(page, ['Jared'], ['kaya'], 'scene-validation-471');
  await enterNode(page, 'forest_explore');
  await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
  await page.evaluate(async () => {
    const app = window.fnt?.app;
    if (!app) throw new Error('App did not boot');
    await (app as unknown as SceneApp).scene.firstFrameReady();
  });
  await page.waitForFunction(() => !window.fnt?.app.curtainBusy);
  await settleLayout(page);
  return page.evaluate(() => {
    const app = window.fnt?.app;
    const map = app?.content.maps.get('forest_road');
    return {
      backend: app?.rendererBackend(),
      camera: app?.rendererCamera(),
      projection: map?.projection,
      scenery: map?.scene?.scenery.length,
      ground: map?.scene?.ground.map((piece) => piece.url),
      position: app?.state?.location.pos,
    };
  });
}

async function walk(page: Page) {
  const target = { x: 2, y: 5 };
  const point = await paintedTileCentre(page, target);
  expect(point).not.toBeNull();
  if (!point) throw new Error('No rendered walking target');
  await page.mouse.click(point.x, point.y);
  await waitForIdle(page);
  await expect.poll(() => page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual(target);
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer}: shipped scenes boot top-down and remain playable`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`);
    });
    page.on('pageerror', (error) => errors.push(error.message));
    const loaded = await forestRoad(page, renderer);
    await test.info().attach('loaded-presentation', {
      body: JSON.stringify(loaded, null, 2),
      contentType: 'application/json',
    });
    expect(loaded.backend).toBe(renderer);
    expect(loaded.projection).toBe('topdown');
    expect(loaded.camera?.projection).toBe('topdown');
    expect(loaded.scenery).toBe(shipped.scenery.length);
    expect(loaded.ground).toEqual(['art/topdown/forest-road/ground.webp']);
    await walk(page);
    expect(errors.filter((error) => !/favicon/i.test(error))).toEqual([]);
  });

  for (const mutation of mutations) {
    test(`${renderer}: ${mutation.name} reports its path and boots a playable fallback`, async ({
      page,
    }) => {
      const errors: string[] = [];
      const pageErrors: string[] = [];
      let responses = 0;
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`);
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const malformed = structuredClone(shipped);
      mutation.change(malformed);
      await page.route(`**/${url}`, async (route) => {
        responses += 1;
        await route.fulfill({ json: malformed });
      });
      const loaded = await forestRoad(page, renderer);
      await test.info().attach('fallback-presentation-and-errors', {
        body: JSON.stringify({ loaded, responses, errors, pageErrors }, null, 2),
        contentType: 'application/json',
      });
      await test.info().attach('rendered-fallback', {
        body: await page.locator('.explore-scene .map-canvas').screenshot(),
        contentType: 'image/png',
      });
      expect(responses).toBeGreaterThan(0);
      expect(loaded.backend).toBe(renderer);
      expect(loaded.projection).toBe('topdown');
      expect(loaded.camera?.projection).toBe('topdown');
      // The Forest Road keeps its rules-side scene (painted rubble); only the baked plates and uprights are gone.
      expect(loaded.scenery ?? 0).toBe(0);
      expect(loaded.ground ?? []).toEqual([]);
      const reported = errors.filter((error) =>
        error.startsWith('The top-down scenes did not load; drawing the bare boards.'),
      );
      expect(reported.length).toBeGreaterThan(0);
      expect(reported.every((error) => error.includes(url) && error.includes(mutation.path))).toBe(
        true,
      );
      expect(
        errors.filter((error) => !reported.includes(error) && !/favicon/i.test(error)),
      ).toEqual([]);
      expect(pageErrors).toEqual([]);
      await walk(page);
      expect(
        errors.filter((error) => !reported.includes(error) && !/favicon/i.test(error)),
      ).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }
}
