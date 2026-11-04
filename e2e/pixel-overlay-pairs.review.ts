/**
 * Matched issue #341 visual evidence. Run this file twice from the #341
 * worktree with the same test code, first serving the corrected #336 parent,
 * then the final #341 head. The source SHA in each provenance file comes from
 * the app root whose production build the browser actually opened.
 *
 * FNT_PIXEL_CAPTURE_LABEL=before FNT_PIXEL_CAPTURE_SKIP_BUILD=1 \
 *   FNT_PIXEL_CAPTURE_APP_ROOT=/workspace/avatarrpg-341-baseline-336 \
 *   npx playwright test -c playwright.pixel-overlay-pairs.config.ts
 * FNT_PIXEL_CAPTURE_LABEL=after FNT_PIXEL_CAPTURE_APP_ROOT=/workspace/avatarrpg-341-standalone \
 *   npx playwright test -c playwright.pixel-overlay-pairs.config.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { MapView, RenderUnit } from '../src/render/view';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

const label = process.env.FNT_PIXEL_CAPTURE_LABEL;
if (label !== 'before' && label !== 'after')
  throw new Error('FNT_PIXEL_CAPTURE_LABEL must be before or after');
const appRoot = resolve(process.env.FNT_PIXEL_CAPTURE_APP_ROOT ?? process.cwd());
const appSha = execFileSync('git', ['-C', appRoot, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const directory = resolve(process.cwd(), '.shots/pixel-overlay-pairs', label);

async function village(
  page: Page,
  backend: 'canvas' | 'webgl',
): Promise<{ png: string; scale: number; dpr: number }> {
  await resetStorage(page, `?renderer=${backend}`);
  await startGame(page, ['Kaya'], ['kaya'], 'pixel-overlay-pairs');
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  // The first unbound marker is a route sign. Choose Gao's profiled resident
  // figure and wait for the sheet resources used by the production renderer.
  // Reduced motion bypasses the scene curtain's normal sheet readiness wait.
  await page.waitForFunction(() => {
    const app = window.fnt?.app as unknown as {
      scene?: { renderer?: { lastView?: MapView | null } };
    };
    const gao = app.scene?.renderer?.lastView?.npcs.find(
      (candidate) =>
        candidate.id === 'lw.npc.gao' &&
        candidate.sprite === 'npc.shopkeeper' &&
        !candidate.quiet &&
        (candidate.alpha ?? 1) > 0,
    );
    const resources = performance.getEntriesByType('resource');
    return (
      Boolean(gao) &&
      resources.some((entry) => new URL(entry.name).pathname.endsWith('/art/units/gao-g.json')) &&
      resources.some((entry) => new URL(entry.name).pathname.endsWith('/art/units/gao-g.webp'))
    );
  });
  // The atlas image load resolves before the sheet store replaces its baked
  // placeholder. Let the next scene frames consume the authored atlas.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return page.evaluate(() => {
    const renderer = (
      window.fnt!.app as unknown as {
        scene: {
          renderer: {
            camera: {
              scale: number;
              viewport: { dpr: number };
              centreOn(pos: { x: number; y: number }): void;
            };
            lastView: MapView | null;
            draw(view: MapView): void;
          };
        };
      }
    ).scene.renderer;
    const view = renderer.lastView;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const npc = view?.npcs.find(
      (candidate) =>
        candidate.id === 'lw.npc.gao' && candidate.sprite === 'npc.shopkeeper' && !candidate.quiet,
    );
    if (!view || !canvas || !npc) throw new Error('Gao talk cue is unavailable');
    renderer.camera.scale = 2;
    renderer.camera.centreOn(npc.pos);
    renderer.draw({
      ...view,
      time: 640_000,
      reducedMotion: true,
      cameraNudge: { x: 0, y: 0 },
      units: view.units.map((unit) => ({ ...unit, renderPos: unit.pos, clipTime: 0 })),
      npcs: view.npcs.map((resident) => ({ ...resident, renderPos: resident.pos, clipTime: 0 })),
      emitters: [],
      bendFx: [],
      floaters: [],
    });
    return {
      png: canvas.toDataURL('image/png'),
      scale: renderer.camera.scale,
      dpr: renderer.camera.viewport.dpr,
    };
  });
}

async function forestAndKo(
  page: Page,
  backend: 'canvas' | 'webgl',
): Promise<{ forest: string; ko: string; scale: number; dpr: number }> {
  await resetStorage(page, `?renderer=${backend}`);
  await startGame(page, ['Kaya'], ['kaya'], 'pixel-overlay-pairs');
  await enterNode(page, 'battle_forest_road');
  await waitForIdle(page);
  await page.waitForFunction(() => {
    const app = window.fnt?.app as unknown as {
      scene?: { renderer?: { lastView?: MapView | null } };
    };
    const units = app.scene?.renderer?.lastView?.units ?? [];
    return (
      units.some((unit) => unit.faction === 'party') &&
      units.some((unit) => unit.faction === 'enemy')
    );
  });
  return page.evaluate(() => {
    const renderer = (
      window.fnt!.app as unknown as {
        scene: {
          renderer: {
            camera: {
              scale: number;
              viewport: { dpr: number };
              centreOn(pos: { x: number; y: number }): void;
            };
            lastView: MapView | null;
            draw(view: MapView): void;
          };
        };
      }
    ).scene.renderer;
    const source = renderer.lastView;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const party = source?.units.find((unit) => unit.faction === 'party');
    const enemy = source?.units.find((unit) => unit.faction === 'enemy');
    if (!source || !canvas || !party || !enemy) throw new Error('Missing forest fight actors');
    const staged = (
      unit: RenderUnit,
      id: string,
      pos: { x: number; y: number },
      changes: Partial<RenderUnit> = {},
    ): RenderUnit => ({
      ...unit,
      ...changes,
      id,
      pos,
      renderPos: pos,
      offset: { x: 0, y: 0 },
      scale: 1,
      alpha: 1,
      clip: undefined,
      clipTime: 0,
      clipFrame: undefined,
      bend: undefined,
    });
    const chosen = staged(party, 'pixel-pair-chosen', { x: 8, y: 4 });
    const hostile = staged(enemy, 'pixel-pair-hostile', { x: 8, y: 6 });
    const fallen = staged(party, 'pixel-pair-fallen', { x: 10, y: 4 }, { fallen: true });
    const fixed: MapView = {
      ...source,
      time: 640_000,
      reducedMotion: true,
      cameraNudge: { x: 0, y: 0 },
      emitters: [],
      bendFx: [],
      floaters: [],
      units: [chosen, hostile],
      npcs: [],
      overlays: [
        { kind: 'move', tiles: [{ x: 6, y: 6 }] },
        { kind: 'target', tiles: [{ x: 7, y: 6 }] },
        { kind: 'area', tiles: [{ x: 8, y: 6 }] },
      ],
      hoverTile: { x: 10, y: 6 },
      path: [
        { x: 7, y: 7 },
        { x: 8, y: 7 },
      ],
      pathFrom: { x: 6, y: 7 },
      pathOrigin: null,
      pathStart: 0,
      calmPath: false,
      aimArc: { from: { x: 6.2, y: 3.5 }, to: { x: 8.8, y: 3.5 }, arc: 0.5, color: '#7ec8e3' },
      exit: null,
      exits: [],
      targetReticle: { pos: { x: 8, y: 5 }, elevation: 'above', obscured: true },
      selectedUnitId: chosen.id,
      activeUnitId: null,
    };
    renderer.camera.scale = 2;
    renderer.camera.centreOn({ x: 8, y: 5 });
    renderer.draw(fixed);
    const forest = canvas.toDataURL('image/png');
    renderer.camera.centreOn({ x: 10, y: 4 });
    renderer.draw({
      ...fixed,
      units: [chosen, hostile, fallen],
      overlays: [],
      hoverTile: null,
      path: [],
      pathFrom: null,
      aimArc: null,
      targetReticle: null,
      selectedUnitId: null,
    });
    return {
      forest,
      ko: canvas.toDataURL('image/png'),
      scale: renderer.camera.scale,
      dpr: renderer.camera.viewport.dpr,
    };
  });
}

for (const backend of ['canvas', 'webgl'] as const) {
  test(`capture matched Ba Dan, forest and KO frames on ${backend}`, async ({ page }) => {
    allowSoftwareWebgl(test, backend);
    test.setTimeout(360_000);
    mkdirSync(resolve(directory, backend), { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const baDan = await village(page, backend);
    const battle = await forestAndKo(page, backend);
    expect(baDan).toMatchObject({ scale: 2, dpr: 1 });
    expect(battle).toMatchObject({ scale: 2, dpr: 1 });
    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(backend);
    for (const [name, dataUrl] of [
      ['ba-dan', baDan.png],
      ['forest', battle.forest],
      ['ko', battle.ko],
    ] as const) {
      writeFileSync(
        resolve(directory, backend, `${name}.png`),
        Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'),
      );
    }
    writeFileSync(
      resolve(directory, backend, 'provenance.json'),
      JSON.stringify(
        {
          issue: 341,
          label,
          appRoot,
          appSha,
          backend,
          viewport: { width: 1280, height: 800, dpr: 1 },
          zoom: 2,
          seed: 'pixel-overlay-pairs',
          images: ['ba-dan.png', 'forest.png', 'ko.png'],
          errors,
        },
        null,
        2,
      ) + '\n',
    );
    expect(errors).toEqual([]);
  });
}
