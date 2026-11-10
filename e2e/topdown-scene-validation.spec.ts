import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { MapScene } from '../src/core/types';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

// Request fixtures must reach the loader rather than a service-worker cache.
test.use({ serviceWorkers: 'block' });

type SceneApp = { scene: { firstFrameReady(): Promise<unknown> } };
const url = 'art/topdown/ba-dan/scene.json';
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
      Object.assign(scene.scenery[0], { url: 'art/topdown/ba-dan/not-the-atlas.webp' });
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

async function village(page: Page, renderer: string) {
  await resetStorage(page, `?renderer=${renderer}&style=topdown`);
  await startGame(page, ['Jared'], ['kaya'], 'scene-validation-471');
  await enterNode(page, 'village_explore');
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
    const map = app?.content.maps.get('ba_dan_village');
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
  const target = { x: 5, y: 7 };
  const point = await paintedTileCentre(page, target);
  expect(point).not.toBeNull();
  if (!point) throw new Error('No painted walking target');
  await page.mouse.click(point.x, point.y);
  await waitForIdle(page);
  await expect.poll(() => page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual(target);
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer}: shipped scenes boot top-down and remain playable`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    const loaded = await village(page, renderer);
    await test.info().attach('loaded-presentation', {
      body: JSON.stringify(loaded, null, 2),
      contentType: 'application/json',
    });
    expect(loaded.backend).toBe(renderer);
    expect(loaded.projection).toBe('topdown');
    expect(loaded.camera?.projection).toBe('topdown');
    expect(loaded.scenery).toBe(75);
    expect(loaded.ground).toEqual(['art/topdown/ba-dan/ground.webp']);
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
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const malformed = structuredClone(shipped);
      mutation.change(malformed);
      await page.route(`**/${url}`, async (route) => {
        responses += 1;
        await route.fulfill({ json: malformed });
      });
      const loaded = await village(page, renderer);
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
      expect(loaded.projection).toBe('oblique');
      expect(loaded.camera?.projection).toBe('oblique');
      const reported = errors.filter((error) =>
        error.startsWith('The top-down scenes did not load; drawing the oblique maps.'),
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
