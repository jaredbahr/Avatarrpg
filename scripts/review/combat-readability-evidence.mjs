/**
 * Capture the same forest-road fight on #322 and #336 production previews.
 * The enemy's displayed active cue and 7/13 HP are staged in the render view;
 * the actual battle turn and HP remain untouched. Node's native TypeScript
 * stripping loads the shared E2E helpers without adding callback wrappers.
 *
 * Usage: node --experimental-strip-types scripts/review/combat-readability-evidence.mjs
 *   <base-url> <out-dir> <served-source-sha> [before-dir]
 */
/* global window, document */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from '../../e2e/helpers.ts';

const [baseURL, output, sourceSha, expectedDir] = process.argv.slice(2);
if (!baseURL || !output || !/^[a-f0-9]{40}$/.test(sourceSha ?? ''))
  throw new Error(
    'Usage: combat-readability-evidence.mjs <base-url> <out-dir> <source-sha> [before-dir]',
  );
const outDir = resolve(output);
mkdirSync(outDir, { recursive: true });

async function frameSignature(page) {
  return page.evaluate(() => {
    const camera = window.fnt.app.rendererCamera();
    const box = document.querySelector('.map-canvas')?.getBoundingClientRect();
    return {
      x: camera?.offsetX,
      y: camera?.offsetY,
      tile: camera?.tilePx,
      w: box?.width,
      h: box?.height,
    };
  });
}

const executablePath = ['/opt/pw-browsers/chromium', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800, dpr: 1, largeText: 'off' },
    { name: 'portrait-ipad', width: 834, height: 1194, dpr: 2, largeText: 'huge' },
  ]) {
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
      if (!(await takeTurn(page))) throw new Error('Battle ended before capture.');
      await waitForIdle(page);
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() =>
        Boolean(
          window.fnt?.app.scene?.renderer?.lastView?.units.some((unit) => unit.faction === 'enemy'),
        ),
      );
      assert.equal(await page.evaluate(() => window.fnt.app.rendererBackend()), 'canvas');

      await setLargeText(page, viewport.largeText);
      await page.evaluate(
        (highContrast) => window.fnt.app.updateSettings({ highContrast, reduceMotion: true }),
        viewport.name === 'portrait-ipad',
      );
      await settleLayout(page);
      await page.evaluate(() => {
        const app = window.fnt.app;
        const renderer = app.scene.renderer;
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
            cameraNudge: { x: 0, y: 0 },
            time: 0,
          });
        };
        if (!renderer.lastView) throw new Error('Missing combat view.');
        renderer.draw(renderer.lastView);
      });
      await settleLayout(page);
      const image = resolve(outDir, `${viewport.name}.png`);
      let stable = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        const before = await frameSignature(page);
        await page.screenshot({ path: image });
        const after = await frameSignature(page);
        if (JSON.stringify(before) === JSON.stringify(after)) {
          stable = true;
          break;
        }
      }
      assert.ok(stable, 'camera/canvas changed during every screenshot attempt');
      const metadata = await page.evaluate(
        ({ sourceSha, seed }) => {
          const app = window.fnt.app;
          const battle = app.state?.battle;
          const enemy = battle?.units.find((unit) => unit.faction === 'enemy' && unit.hp > 0);
          const strip = document.querySelector('.turn-strip');
          const chips = [...(strip?.querySelectorAll('.turn-chip') ?? [])];
          const camera = app.rendererCamera();
          const canvasRect = document.querySelector('.map-canvas')?.getBoundingClientRect();
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
            stripHeight: strip?.getBoundingClientRect().height,
            chipCount: chips.length,
            chipY: chips.map((chip) => chip.getBoundingClientRect().y),
            clippedNames: chips.filter((chip) => {
              const name = chip.querySelector('span');
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
      assert.ok(metadata.chipCount >= 6);
      assert.ok(metadata.stagedRenderer.targetEnemyId);
      assert.deepEqual(metadata.viewport, {
        width: viewport.width,
        height: viewport.height,
        dpr: viewport.dpr,
      });
      if (expectedDir) {
        const before = JSON.parse(
          readFileSync(resolve(expectedDir, `${viewport.name}.json`), 'utf8'),
        );
        assert.deepEqual(metadata.units, before.units, 'the seeded fight changed between builds');
        assert.deepEqual(
          metadata.stagedRenderer,
          before.stagedRenderer,
          'staged enemy or actual state changed',
        );
        assert.equal(metadata.chipCount, before.chipCount, 'initiative roster changed');
        assert.equal(metadata.camera.tilePx, before.camera.tilePx, 'camera zoom changed');
      }
      writeFileSync(resolve(outDir, `${viewport.name}.json`), JSON.stringify(metadata, null, 2));
      console.log(`${viewport.name}: ${image}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
