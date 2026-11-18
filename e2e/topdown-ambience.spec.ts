import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CameraInfo } from '../src/app/App';
import { CONTENT } from '../src/content';
import { loadTopDownPresentations, topDownMap } from '../src/content/topdown';
import type { Vec2 } from '../src/core/types';
import { PARTICLE_STRIDE, sampleParticles } from '../src/render/fx/simulate';
import type { Renderer } from '../src/render/renderer';
import type { EmitterInstance, MapView } from '../src/render/view';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

interface AmbientFrame {
  time: number;
  drawnAt: number;
  reduced: boolean;
  chimneys: readonly Vec2[];
  smoke: readonly EmitterInstance[];
  otherEmitters: number;
}
interface AmbientProbe {
  frames: number;
  latest: AmbientFrame | null;
}
type ExploreApp = { scene: { renderer: Renderer; firstFrameReady(): Promise<unknown> } };
declare global {
  interface Window {
    topdownAmbienceProbe?: AmbientProbe;
  }
}
/** The chimney the spec watches: the frozen scene's third, set from its data when a test starts. */
let mouth: Vec2 = { x: 0, y: 0 };

/**
 * Ba Dan's scene as it shipped before the grey blockout, frozen (`src/content/maps/fixtures/oldVillageScene.json`):
 * the village has no scene while it is a blockout, and this is the only sample with chimneys. It is merged into the
 * village exactly as the shipped scene was, then its plates are dropped so no art is fetched; its chimneys, canopies
 * and paint rules are what the ambience draws from.
 */
async function frozenScene() {
  const presentations = await loadTopDownPresentations(
    () =>
      Promise.resolve(
        JSON.parse(
          readFileSync('src/content/maps/fixtures/oldVillageScene.json', 'utf8'),
        ) as unknown,
      ),
    new Map([['ba_dan_village', { url: 'art/topdown/ba-dan/scene.json', cameraCentreMargin: 1 }]]),
  );
  const live = CONTENT.maps.get('ba_dan_village');
  const presentation = presentations.get('ba_dan_village');
  if (!live || !presentation) throw new Error('Missing the frozen top-down village');
  const scene = topDownMap(live, presentation).scene;
  if (!scene) throw new Error('The frozen village has no scene');
  return { ...scene, ground: [], scenery: [] };
}

function samples(emitters: readonly EmitterInstance[]) {
  return emitters.map(({ def, elapsed, seed, from, to, arc }) => {
    if (def.kind !== 'particles') throw new Error('Chimney must emit particles');
    const data = new Float32Array(def.count * PARTICLE_STRIDE);
    const count = sampleParticles(def, elapsed, seed, from, to, data, 0, arc);
    return Array.from(data.subarray(0, count * PARTICLE_STRIDE));
  });
}

async function observe(page: Page) {
  await page.evaluate(async () => {
    const app = window.fnt?.app;
    if (!app) throw new Error('App did not boot');
    const scene = (app as unknown as ExploreApp).scene;
    await scene.firstFrameReady();
    const probe: AmbientProbe = { latest: null, frames: 0 };
    window.topdownAmbienceProbe = probe;
    const draw = scene.renderer.draw.bind(scene.renderer);
    scene.renderer.draw = (view: MapView) => {
      draw(view);
      const smoke = view.emitters.filter(
        ({ def }) =>
          def.kind === 'particles' &&
          def.shape === 'drift' &&
          def.cell === 'glow' &&
          def.color === 'smoke' &&
          def.upright,
      );
      probe.latest = {
        time: view.time,
        drawnAt: performance.now(),
        reduced: Boolean(view.reducedMotion),
        chimneys: view.scene?.chimneys ?? [],
        smoke,
        otherEmitters: view.emitters.length - smoke.length,
      };
      probe.frames += 1;
    };
  });
  await page.waitForFunction(() => (window.topdownAmbienceProbe?.frames ?? 0) >= 2);
}

async function read(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    const frame = window.topdownAmbienceProbe?.latest;
    if (!app || !frame) throw new Error('Missing actual ambient draw');
    return {
      frame,
      state: JSON.stringify(app.state),
      camera: app.rendererCamera(),
      backend: app.rendererBackend(),
    };
  });
}

/** Includes the visible mouth and its rising wisp, without hiding any scene objects. */
async function smokeClip(page: Page) {
  const canvas = await page.locator('.explore-scene .map-canvas').boundingBox();
  const point = await page.evaluate((at) => {
    const app = window.fnt?.app;
    if (!app) throw new Error('App missing');
    const camera = (app as unknown as ExploreApp).scene.renderer.camera;
    return { ...camera.project(at), tile: camera.tile * camera.scale };
  }, mouth);
  if (!canvas) throw new Error('Canvas missing');
  const local = {
    x: Math.floor(point.x - point.tile * 1.65),
    y: Math.floor(point.y - point.tile * 1.85),
    width: Math.ceil(point.tile * 2),
    height: Math.ceil(point.tile * 2.1),
  };
  expect(local.x).toBeGreaterThanOrEqual(0);
  expect(local.y).toBeGreaterThanOrEqual(0);
  expect(local.x + local.width).toBeLessThanOrEqual(canvas.width);
  expect(local.y + local.height).toBeLessThanOrEqual(canvas.height);
  return { local, page: { ...local, x: canvas.x + local.x, y: canvas.y + local.y } };
}

function hasVisibleSmoke(
  smoke: readonly EmitterInstance[],
  camera: CameraInfo | null,
  clip: { x: number; y: number; width: number; height: number },
) {
  if (!camera) throw new Error('No actual camera');
  const matrix = camera.groundTransform;
  const column = smoke.filter(({ from }) => from.x === mouth.x && from.y === mouth.y);
  expect(column).toHaveLength(2);
  const geometry = samples(column);
  expect(geometry.flat().length).toBeGreaterThan(0);
  expect(
    geometry.some((data) => {
      for (let index = 0; index < data.length; index += PARTICLE_STRIDE) {
        const x = data[index];
        const y = data[index + 1];
        const alpha = data[index + 4];
        if (x === undefined || y === undefined || alpha === undefined) continue;
        const px = matrix.a * x * 40 + matrix.c * y * 40 + matrix.tx;
        const py = matrix.b * x * 40 + matrix.d * y * 40 + matrix.ty;
        if (
          alpha > 0 &&
          px >= clip.x &&
          px < clip.x + clip.width &&
          py >= clip.y &&
          py < clip.y + clip.height
        )
          return true;
      }
      return false;
    }),
  ).toBe(true);
  return geometry;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer}: the frozen top-down chimney is frozen under reduce motion and moves otherwise`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await resetStorage(page, `?style=topdown&renderer=${renderer}`);
    await startGame(page, ['Jared'], ['kaya'], 'topdown-ambience-471', { reduceMotion: false });
    // Give the bare village the frozen scene's chimneys before its scene mounts.
    const scene = await frozenScene();
    mouth = scene.chimneys?.[2] ?? mouth;
    await page.evaluate((scene) => {
      const map = window.fnt?.app.content.maps.get('ba_dan_village');
      if (!map) throw new Error('Ba Dan village missing');
      Object.assign(map, { scene });
    }, scene);
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await page.evaluate(async () => {
      const app = window.fnt?.app;
      if (!app) throw new Error('App missing');
      await (app as unknown as ExploreApp).scene.firstFrameReady();
    });
    await page.waitForFunction(() => !window.fnt?.app.curtainBusy);
    await settleLayout(page);
    // A real painted-tile tap brings the nearby roof into view; no camera or
    // saved-position mutation is used to arrange the smoke observation.
    const point = await paintedTileCentre(page, { x: 5, y: 7 });
    if (!point) throw new Error('No painted walk target');
    await page.mouse.click(point.x, point.y);
    await waitForIdle(page);
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.location.pos))
      .toEqual({ x: 5, y: 7 });
    await settleLayout(page);
    await observe(page);
    await page.evaluate(() => window.fnt?.app.updateSettings({ reduceMotion: true }));
    await page.waitForFunction(() => window.topdownAmbienceProbe?.latest?.reduced === true);
    await settleLayout(page);
    const clip = await smokeClip(page);
    const capture = async (name: string) => {
      const before = await read(page);
      const png = await page.screenshot({ clip: clip.page });
      const after = await read(page);
      await test.info().attach(name, { body: png, contentType: 'image/png' });
      return { before, after, pixels: PNG.sync.read(png).data };
    };
    const first = await capture('reduced-smoke-first');
    // The hold is asserted on both clocks below: the draw time and the view's
    // own time. The scene reads its time at the start of a frame, before the
    // draw, so the two intervals differ by however much the two frames' draws
    // differ (999.9 ms against 1000 on CI run 43694475932). Wait for both.
    await page.waitForFunction(
      (at) => {
        const latest = window.topdownAmbienceProbe?.latest;
        return Boolean(
          latest && latest.drawnAt >= at.drawnAt + 1000 && latest.time >= at.time + 1000,
        );
      },
      { drawnAt: first.after.frame.drawnAt, time: first.after.frame.time },
    );
    const second = await capture('reduced-smoke-second');
    expect(first.before.backend).toBe(renderer);
    expect(first.before.camera?.projection).toBe('topdown');
    expect(first.before.frame.chimneys).toHaveLength(5);
    expect(first.before.frame.smoke).toHaveLength(10);
    expect(first.before.frame.otherEmitters).toBe(0);
    expect(first.before.frame.smoke.every((emitter) => emitter.still)).toBe(true);
    expect(second.before.frame.drawnAt - first.after.frame.drawnAt).toBeGreaterThanOrEqual(1000);
    expect(second.before.frame.time - first.after.frame.time).toBeGreaterThanOrEqual(1000);
    expect(second.before.frame.smoke).toEqual(first.before.frame.smoke);
    const frozen = hasVisibleSmoke(first.before.frame.smoke, first.before.camera, clip.local);
    expect(
      samples(
        second.before.frame.smoke.filter(({ from }) => from.x === mouth.x && from.y === mouth.y),
      ),
    ).toEqual(frozen);
    expect(second.pixels.equals(first.pixels)).toBe(true);
    await page.evaluate(() => window.fnt?.app.updateSettings({ reduceMotion: false }));
    await page.waitForFunction(() => window.topdownAmbienceProbe?.latest?.reduced === false);
    const moving = await capture('moving-smoke-first');
    await page.waitForFunction(
      (at) => (window.topdownAmbienceProbe?.latest?.drawnAt ?? 0) >= at + 1000,
      moving.after.frame.drawnAt,
    );
    const moved = await capture('moving-smoke-second');
    expect(moving.before.frame.smoke.every((emitter) => !emitter.still)).toBe(true);
    expect(moved.before.frame.drawnAt - moving.after.frame.drawnAt).toBeGreaterThanOrEqual(1000);
    const from = hasVisibleSmoke(moving.before.frame.smoke, moving.before.camera, clip.local);
    const to = hasVisibleSmoke(moved.before.frame.smoke, moved.before.camera, clip.local);
    const xy = (data: number[][]) =>
      data.map((row) => row.filter((_, index) => index % PARTICLE_STRIDE < 2));
    expect(xy(to)).not.toEqual(xy(from));
    expect(moved.pixels.equals(moving.pixels)).toBe(false);
    const observations = [first, second, moving, moved];
    for (const entry of observations)
      for (const snapshot of [entry.before, entry.after]) {
        expect(snapshot.state).toBe(first.before.state);
        expect(snapshot.camera).toEqual(first.before.camera);
        expect(snapshot.frame.chimneys).toEqual(first.before.frame.chimneys);
      }
    await test.info().attach('actual-smoke-draw-observations', {
      body: JSON.stringify(
        { clip, observations: observations.map(({ before, after }) => ({ before, after })) },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    expect(errors.filter((error) => !/favicon/i.test(error))).toEqual([]);
  });
}
