import { expect, test, type Page } from '@playwright/test';
import type { EncounterDef, MapDef, Vec2 } from '../src/core/types';
import { buildGrid } from '../src/core/rules/grid';
import { TOPDOWN_FIXTURE } from '../src/render/topdown.fixture';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

type Renderer = 'canvas' | 'webgl';
type Corner = 'northWest' | 'northEast' | 'southWest' | 'southEast';

interface PickObservation {
  readonly pointerType: string | null;
  readonly intent: 'tap' | 'inspect';
  readonly tile: Vec2 | null;
}

interface PickTrace {
  readonly pointerDowns: string[];
  readonly resolutions: PickObservation[];
}

declare global {
  interface Window {
    __topdownEveryCellTrace?: PickTrace;
  }
}

const DEVICES = [
  { name: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
  { name: 'tablet', viewport: { width: 834, height: 1194 }, deviceScaleFactor: 2 },
] as const;

const CORNERS: readonly Corner[] = ['northWest', 'northEast', 'southWest', 'southEast'];

/** The same cell edge inset by three CSS pixels, using the shared painted projection helper. */
async function insideCorner(page: Page, pos: Vec2, corner: Corner) {
  const origin = await paintedTileCentre(page, pos);
  const nextColumn = await paintedTileCentre(page, { x: pos.x + 1, y: pos.y });
  const nextRow = await paintedTileCentre(page, { x: pos.x, y: pos.y + 1 });
  if (!origin || !nextColumn || !nextRow) return null;
  const width = Math.hypot(nextColumn.x - origin.x, nextColumn.y - origin.y);
  const height = Math.hypot(nextRow.x - origin.x, nextRow.y - origin.y);
  const insetX = 3 / width;
  const insetY = 3 / height;
  const u = corner.endsWith('East') ? 1 - insetX : insetX;
  const v = corner.startsWith('south') ? 1 - insetY : insetY;
  // paintedTileCentre adds 0.5 internally, so fractional inputs keep the
  // shared camera affine and backing-store stretch for all test points.
  return paintedTileCentre(page, { x: pos.x + u - 0.5, y: pos.y + v - 0.5 });
}

/**
 * Observe only real canvas pointer input and the scene's ordinary resolver.
 * The wrapper calls the original once with its original receiver and returns or
 * throws exactly what the resolver did; the test never calls it itself.
 */
async function installScenePickObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt?.app;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const scene = (
      app as unknown as {
        scene?: {
          resolvePointer?: (
            x: number,
            y: number,
            intent: 'tap' | 'inspect',
          ) => { tile: Vec2 } | null;
        };
      }
    )?.scene;
    const original = scene?.resolvePointer;
    if (!canvas || !scene || !original)
      throw new Error('Combat scene pointer resolver unavailable.');

    const trace: PickTrace = { pointerDowns: [], resolutions: [] };
    window.__topdownEveryCellTrace = trace;
    canvas.addEventListener(
      'pointerdown',
      (event) => trace.pointerDowns.push(event.pointerType),
      true,
    );
    scene.resolvePointer = function (
      this: NonNullable<typeof scene>,
      x: number,
      y: number,
      intent: 'tap' | 'inspect',
    ) {
      const result = original.call(this, x, y, intent);
      trace.resolutions.push({
        pointerType: trace.pointerDowns.at(-1) ?? null,
        intent,
        tile: result?.tile ?? null,
      });
      return result;
    };
  });
}

async function assertTouchPicked(page: Page, point: { x: number; y: number }, pos: Vec2) {
  const prior = await page.evaluate(() => window.__topdownEveryCellTrace?.resolutions.length ?? 0);
  await page.touchscreen.tap(point.x, point.y);
  const observed = await page.evaluate((count) => {
    const trace = window.__topdownEveryCellTrace;
    return {
      resolutionCount: (trace?.resolutions.length ?? 0) - count,
      observation: trace?.resolutions.at(-1) ?? null,
    };
  }, prior);
  expect(observed.resolutionCount).toBeGreaterThan(0);
  expect(observed.observation).toMatchObject({
    pointerType: 'touch',
    intent: 'tap',
    tile: pos,
  });

  const sceneState = await page.evaluate(() => {
    const scene = (window.fnt?.app as unknown as { scene?: { pending?: Vec2 | null } })?.scene;
    return scene?.pending ?? null;
  });
  expect(sceneState).toEqual(pos);
}

const grid = buildGrid(TOPDOWN_FIXTURE);
const walkable = grid.tiles.flatMap((tile, index) =>
  tile.blocked ? [] : [{ x: index % grid.width, y: Math.floor(index / grid.width) }],
);
const blockedFixtureCells = [
  { x: 5, y: 2 }, // raised rock face
  { x: 1, y: 4 }, // west wall
  { x: 1, y: 5 }, // west wall
] as const;

// One sample of each corner orientation on the board edge, ramp, raised shelf,
// and standing water catches the four edge-rounding directions across distinct
// tile transitions. Every walkable tile still receives a centre tap.
const cornerCells = [
  { category: 'board-edge grass', pos: { x: 0, y: 0 } },
  { category: 'ramp', pos: { x: 2, y: 1 } },
  { category: 'raised shelf', pos: { x: 4, y: 1 } },
  { category: 'water', pos: { x: 7, y: 2 } },
] as const;

for (const renderer of ['canvas', 'webgl'] as const satisfies readonly Renderer[]) {
  for (const device of DEVICES) {
    test(`top-down picking reaches every walkable cell on ${device.name} with ${renderer}`, async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'surface-touch',
        'This exhaustive touch matrix runs in the Chromium touch project; the shared suite covers WebKit iPad separately.',
      );
      allowSoftwareWebgl(test, renderer);

      const context = await browser.newContext({
        baseURL: `http://127.0.0.1:${process.env.FNT_E2E_PORT ?? '4173'}`,
        viewport: device.viewport,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        if (renderer === 'webgl') {
          await page.goto('/');
          const available = await page.evaluate(() => {
            const probe = document.createElement('canvas');
            const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
            gl?.getExtension('WEBGL_lose_context')?.loseContext();
            return gl !== null;
          });
          test.skip(!available, 'WebGL context creation is unavailable on this Chromium host.');
        }

        await resetStorage(page, `?renderer=${renderer}`);
        await startGame(
          page,
          ['Picker'],
          ['kaya'],
          `topdown-every-cell-${device.name}-${renderer}`,
        );

        // The existing story encounter supplies the real combat scene; replace
        // its runtime map and roster with this spec's unlisted fixture only.
        await page.evaluate((fixture) => {
          const app = window.fnt?.app;
          const encounter = app?.content.encounters.get('enc_forest_road');
          if (!app || !encounter) throw new Error('Forest road encounter unavailable.');
          const maps = app.content.maps as Map<string, MapDef>;
          const encounters = app.content.encounters as Map<string, EncounterDef>;
          maps.set(encounter.mapId, { ...fixture, id: encounter.mapId });
          encounters.set(encounter.id, {
            ...encounter,
            enemies: [{ enemyId: 'bandit_thug', pos: { x: 8, y: 5 } }],
            allies: [],
            conditionalEnemies: [],
            reinforcements: [],
            variants: [],
          });
        }, TOPDOWN_FIXTURE);

        await enterNode(page, 'battle_forest_road');
        await takeTurn(page);
        await waitForIdle(page);
        await expect
          .poll(() => page.evaluate(() => window.fnt?.app.rendererBackend()))
          .toBe(renderer);
        await expect
          .poll(() => page.evaluate(() => window.fnt?.app.rendererCamera()?.projection))
          .toBe('topdown');
        await expect(page.locator('.map-canvas')).toBeVisible();
        await page.getByRole('button', { name: /^Move\b/ }).click();
        await installScenePickObserver(page);

        const centreCount = walkable.length;
        const walkableKeys = new Set(walkable.map((pos) => `${pos.x},${pos.y}`));
        expect(centreCount).toBeGreaterThan(0);
        expect(centreCount).toBe(54 - blockedFixtureCells.length);
        for (const blocked of blockedFixtureCells)
          expect(walkableKeys.has(`${blocked.x},${blocked.y}`)).toBe(false);
        for (const pos of walkable) {
          const point = await paintedTileCentre(page, pos);
          expect(point, `missing painted centre for (${pos.x},${pos.y})`).not.toBeNull();
          if (!point) throw new Error(`Missing painted centre for (${pos.x},${pos.y}).`);
          await assertTouchPicked(page, point, pos);
        }

        const cornerCounts: Record<string, number> = {};
        for (const { category, pos } of cornerCells) {
          expect(walkableKeys.has(`${pos.x},${pos.y}`), `${category} must be walkable`).toBe(true);
          let count = 0;
          for (const corner of CORNERS) {
            const point = await insideCorner(page, pos, corner);
            expect(point, `missing ${corner} point for ${category}`).not.toBeNull();
            if (!point) throw new Error(`Missing ${corner} point for ${category}.`);
            await assertTouchPicked(page, point, pos);
            count += 1;
          }
          cornerCounts[category] = count;
          expect(count, `corner samples for ${category}`).toBe(CORNERS.length);
        }

        const counts = await page.evaluate(() => ({
          pointerDowns: window.__topdownEveryCellTrace?.pointerDowns.length ?? 0,
          resolutions: window.__topdownEveryCellTrace?.resolutions.length ?? 0,
        }));
        const cornerCount = cornerCells.length * CORNERS.length;
        expect(Object.values(cornerCounts)).toEqual(cornerCells.map(() => CORNERS.length));
        expect(counts.pointerDowns).toBe(centreCount + cornerCount);
        expect(counts.resolutions).toBe(centreCount + cornerCount);
      } finally {
        await context.close();
      }
    });
  }
}
