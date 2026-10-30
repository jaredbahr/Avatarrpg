/**
 * Capture the same forest-road fight from two built revisions for #336 review.
 * Run this driver from the #336 worktree against each revision's own preview
 * server; it uses only app and Playwright helper APIs present on #322 3c305155.
 * The active enemy and its displayed 7/13 HP are staged in the render view to
 * expose the cue and damaged bar; the actual battle turn and HP stay unchanged.
 *
 * Usage: node --import tsx scripts/review/combat-readability-evidence.ts
 *   <base-url> <out-dir> <source-sha> [before-dir]
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  setLargeText,
  startGame,
  takeTurn,
  waitForIdle,
} from '../../e2e/helpers';
import type { MapView } from '../../src/render/view';

interface CaptureMetadata {
  sourceSha: string;
  seed: string;
  viewport: { width: number; height: number; dpr: number };
  settings: { largeText: string; highContrast: boolean; reduceMotion: boolean };
  node: string | null | undefined;
  units: { id: string; x: number; y: number; faction: string }[] | undefined;
  stagedRenderer: {
    targetEnemyId: string | undefined;
    displayedHp: number;
    displayedMaxHp: number;
    stateHp: number | undefined;
    stateMaxHp: number | undefined;
    actualTurnId: string | undefined;
  };
  backend: 'canvas' | 'webgl' | null;
  camera: {
    tilePx: number | undefined;
    offsetX: number | undefined;
    offsetY: number | undefined;
    fitted: boolean | undefined;
  };
  canvasRect: { x: number; y: number; width: number; height: number } | undefined;
  stripHeight: number | undefined;
  chipCount: number;
  chipY: number[];
  clippedNames: number;
}

const baseURL = process.argv[2];
const output = process.argv[3];
const sourceSha = process.argv[4];
const expectedDir = process.argv[5];
if (!baseURL || !output || !sourceSha || !/^[a-f0-9]{40}$/.test(sourceSha))
  throw new Error(
    'Usage: combat-readability-evidence.ts <base-url> <out-dir> <source-sha> [before-dir]',
  );

const outDir = resolve(output);
mkdirSync(outDir, { recursive: true });
const executablePath = ['/opt/pw-browsers/chromium', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch(executablePath ? { executablePath } : {});

try {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800, dpr: 1, largeText: 'off' },
    { name: 'portrait-ipad', width: 834, height: 1194, dpr: 2, largeText: 'huge' },
  ] as const) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr,
      hasTouch: true,
      isMobile: false,
    });
    try {
      const page = await context.newPage();
      await resetStorage(page, '?renderer=canvas');
      await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'combat-readability');
      await enterNode(page, 'battle_forest_road');
      if (!(await takeTurn(page))) throw new Error('Battle ended before the capture.');
      await waitForIdle(page);
      await page.waitForFunction(() =>
        Boolean(
          (
            window.fnt?.app as unknown as {
              scene?: { renderer?: { lastView?: MapView | null } };
            }
          )?.scene?.renderer?.lastView?.units.some((unit) => unit.faction === 'enemy'),
        ),
      );
      if ((await page.evaluate(() => window.fnt?.app.rendererBackend())) !== 'canvas')
        throw new Error('Canvas backend was not selected.');

      await setLargeText(page, viewport.largeText);
      await page.evaluate((highContrast) => {
        window.fnt!.app.updateSettings({ highContrast, reduceMotion: true });
      }, viewport.name === 'portrait-ipad');
      await page.evaluate(() => {
        const app = window.fnt!.app;
        const renderer = (
          app as unknown as {
            scene: {
              renderer: {
                camera: { centreOn(pos: { x: number; y: number }, size: 1 | 2): void };
                lastView: MapView | null;
                draw(view: MapView): void;
              };
            };
          }
        ).scene.renderer;
        const originalDraw = renderer.draw.bind(renderer);
        renderer.draw = (view) => {
          const enemy = view.units.find((unit) => unit.faction === 'enemy' && unit.hp > 0);
          if (!enemy) return originalDraw(view);
          renderer.camera.centreOn(enemy.pos, enemy.size);
          originalDraw({
            ...view,
            units: view.units.map((unit) =>
              unit.id === enemy.id
                ? { ...unit, hp: 7, maxHp: 13, scale: 1, renderPos: undefined, offset: undefined }
                : unit,
            ),
            activeUnitId: enemy.id,
            selectedUnitId: null,
            crispOverlays: app.settings.highContrast,
            reducedMotion: true,
            time: 0,
          });
        };
        if (!renderer.lastView) throw new Error('Missing combat view.');
        renderer.draw(renderer.lastView);
      });
      await page.evaluate(
        () =>
          new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          ),
      );
      const metadata: CaptureMetadata = await page.evaluate(
        ({ sourceSha, seed }) => {
          const app = window.fnt!.app;
          const battle = app.state?.battle;
          const enemy = battle?.units.find((unit) => unit.faction === 'enemy' && unit.hp > 0);
          const strip = document.querySelector<HTMLElement>('.turn-strip');
          const chips = [...(strip?.querySelectorAll<HTMLElement>('.turn-chip') ?? [])];
          const rect = strip?.getBoundingClientRect();
          const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
          const canvasRect = canvas?.getBoundingClientRect();
          const camera = app.rendererCamera();
          return {
            sourceSha,
            seed,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
              dpr: window.devicePixelRatio,
            },
            settings: {
              largeText: app.settings.largeText,
              highContrast: app.settings.highContrast,
              reduceMotion: app.settings.reduceMotion,
            },
            node: app.state?.story.nodeId,
            units: battle?.units.map((unit) => ({
              id: unit.id,
              x: unit.pos.x,
              y: unit.pos.y,
              faction: unit.faction,
            })),
            stagedRenderer: {
              targetEnemyId: enemy?.id,
              displayedHp: 7,
              displayedMaxHp: 13,
              stateHp: enemy?.hp,
              stateMaxHp: enemy?.base.maxHp,
              actualTurnId: battle?.order[battle.turnIndex],
            },
            backend: app.rendererBackend(),
            camera: {
              tilePx: camera?.tilePx,
              offsetX: camera?.offsetX,
              offsetY: camera?.offsetY,
              fitted: camera?.fitted,
            },
            canvasRect: canvasRect && {
              x: canvasRect.x,
              y: canvasRect.y,
              width: canvasRect.width,
              height: canvasRect.height,
            },
            stripHeight: rect?.height,
            chipCount: chips.length,
            chipY: chips.map((chip) => chip.getBoundingClientRect().y),
            clippedNames: chips.filter((chip) => {
              const name = chip.querySelector<HTMLElement>('span');
              return (
                name &&
                (name.scrollWidth > name.clientWidth + 1 ||
                  name.scrollHeight > name.clientHeight + 1)
              );
            }).length,
          };
        },
        { sourceSha, seed: 'combat-readability' },
      );
      assert.equal(metadata.backend, 'canvas');
      assert.equal(metadata.camera.tilePx, 64);
      assert.equal(metadata.units?.filter((unit) => unit.faction === 'party').length, 3);
      assert.ok((metadata.chipCount ?? 0) >= 6);
      assert.ok(metadata.stagedRenderer.targetEnemyId);
      assert.deepEqual(metadata.viewport, {
        width: viewport.width,
        height: viewport.height,
        dpr: viewport.dpr,
      });
      if (expectedDir) {
        const before = JSON.parse(
          readFileSync(resolve(expectedDir, `${viewport.name}.json`), 'utf8'),
        ) as Pick<CaptureMetadata, 'units' | 'stagedRenderer' | 'chipCount' | 'camera'>;
        assert.deepEqual(metadata.units, before.units, 'the seeded fight changed between builds');
        assert.deepEqual(
          metadata.stagedRenderer,
          before.stagedRenderer,
          'the staged enemy or actual state changed between builds',
        );
        assert.equal(metadata.chipCount, before.chipCount, 'initiative roster changed');
        assert.equal(metadata.camera.tilePx, before.camera.tilePx, 'camera zoom changed');
      }
      const image = resolve(outDir, `${viewport.name}.png`);
      await page.screenshot({ path: image });
      writeFileSync(resolve(outDir, `${viewport.name}.json`), JSON.stringify(metadata, null, 2));
      console.log(`${viewport.name}: ${image}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
