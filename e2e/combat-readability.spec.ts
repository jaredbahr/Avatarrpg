import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, setLargeText, startGame, takeTurn, waitForIdle } from './helpers';
import { screenshotPixels } from './pixels';
import type { MapView } from '../src/render/view';

const REVIEW_DIR = resolve(process.cwd(), '.shots/combat-readability');
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'portrait-ipad', width: 834, height: 1194 },
] as const;

for (const backend of ['canvas', 'webgl'] as const) {
  test(`combat bars, active cues, and initiative stay readable on ${backend}`, async ({ page }) => {
    allowSoftwareWebgl(test, backend);
    test.setTimeout(360_000);
    mkdirSync(REVIEW_DIR, { recursive: true });
    await page.setViewportSize(viewports[0]);
    await resetStorage(page, `?renderer=${backend}`);
    await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'combat-readability');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await expect(page.locator('.combat-scene')).toHaveCount(1);
    await page.waitForFunction(
      () => {
        const app = window.fnt?.app as unknown as {
          scene?: { renderer?: { lastView?: MapView | null } };
        };
        return (
          app.scene?.renderer?.lastView?.units.some((unit) => unit.faction === 'enemy') ?? false
        );
      },
      undefined,
      { timeout: 60_000 },
    );

    await page.evaluate(() => {
      type ProbeWindow = Window & { combatReadabilityMode?: 'party' | 'enemy' };
      const win = window as ProbeWindow;
      const app = window.fnt!.app;
      const renderer = (
        app as unknown as {
          scene: {
            renderer: {
              camera: { centreOn(pos: { x: number; y: number }, size?: 1 | 2): void };
              lastView: MapView | null;
              draw(view: MapView): void;
            };
          };
        }
      ).scene.renderer;
      const originalDraw = renderer.draw.bind(renderer);
      renderer.draw = (view) => {
        const battle = app.state?.battle;
        if (!battle || !win.combatReadabilityMode) {
          originalDraw(view);
          return;
        }
        const party = battle.units.find((unit) => unit.faction === 'party' && unit.hp > 0);
        const enemy = battle.units.find((unit) => unit.faction === 'enemy' && unit.hp > 0);
        const active = win.combatReadabilityMode === 'party' ? party : enemy;
        if (!active) throw new Error('Missing living actor for the readability capture.');
        renderer.camera.centreOn(active.pos, active.size);
        const units = view.units.map((unit) => {
          if (win.combatReadabilityMode === 'enemy' && unit.id === enemy?.id) {
            return { ...unit, hp: Math.max(1, Math.round(unit.maxHp * 0.45)) };
          }
          return unit;
        });
        originalDraw({ ...view, units, activeUnitId: active.id });
      };
    });

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

      const layout = await page.evaluate(() => {
        const app = window.fnt!.app;
        const camera = app.rendererCamera();
        const strip = document.querySelector<HTMLElement>('.turn-strip');
        if (!strip) throw new Error('Missing combat initiative strip.');
        const rect = strip.getBoundingClientRect();
        const tap = document.createElement('div');
        tap.style.height = 'var(--tap)';
        strip.append(tap);
        const tapPx = tap.getBoundingClientRect().height;
        tap.remove();
        const chips = [...strip.querySelectorAll<HTMLElement>('.turn-chip')].map((chip) => {
          const box = chip.getBoundingClientRect();
          return {
            label: chip.getAttribute('aria-label'),
            height: box.height,
            y: box.y,
            direction: getComputedStyle(chip).flexDirection,
          };
        });
        return {
          tilePx: camera?.tilePx ?? null,
          tapPx,
          remPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
          stripHeight: rect.height,
          scrollWidth: strip.scrollWidth,
          clientWidth: strip.clientWidth,
          overflowX: getComputedStyle(strip).overflowX,
          chips,
        };
      });
      expect(layout.tilePx, `expected the zoom-1 camera in ${viewport.name}`).toBeCloseTo(64, 3);
      expect(layout.chips.length).toBeGreaterThanOrEqual(6);
      expect(layout.chips.every((chip) => chip.height + 1 >= layout.tapPx)).toBe(true);
      if (viewport.name === 'desktop') {
        expect(layout.chips.every((chip) => chip.direction === 'row')).toBe(true);
        expect(new Set(layout.chips.map((chip) => Math.round(chip.y))).size).toBe(1);
        expect(layout.stripHeight).toBeLessThanOrEqual(layout.remPx * 3.75 + 1);
      }
      expect(layout.overflowX).toBe('auto');
      expect(layout.chips.every((chip) => Boolean(chip.label))).toBe(true);

      const renderer = backend === 'canvas' ? 'canvas' : 'webgl';
      const board = page.locator('.map-canvas');
      await page.evaluate(() => {
        (window as Window & { combatReadabilityMode?: 'party' | 'enemy' }).combatReadabilityMode =
          'party';
        const renderer = (
          window.fnt!.app as unknown as {
            scene: { renderer: { lastView: MapView | null; draw(view: MapView): void } };
          }
        ).scene.renderer;
        if (renderer.lastView) renderer.draw(renderer.lastView);
      });
      await board.screenshot({
        path: resolve(REVIEW_DIR, `${renderer}-${viewport.name}-party-full.png`),
      });
      if (viewport.name === 'desktop') {
        await page.screenshot({
          path: resolve(REVIEW_DIR, `${renderer}-desktop-viewport-party-full.png`),
        });
      }
      await page.evaluate(() => {
        (window as Window & { combatReadabilityMode?: 'party' | 'enemy' }).combatReadabilityMode =
          'enemy';
        const renderer = (
          window.fnt!.app as unknown as {
            scene: { renderer: { lastView: MapView | null; draw(view: MapView): void } };
          }
        ).scene.renderer;
        if (renderer.lastView) renderer.draw(renderer.lastView);
      });
      await board.screenshot({
        path: resolve(REVIEW_DIR, `${renderer}-${viewport.name}-enemy-damaged.png`),
      });
      if (viewport.name === 'portrait-ipad') {
        await setLargeText(page, 'huge');
        await page.evaluate(() => window.fnt!.app.updateSettings({ highContrast: true }));
        const names = await page.locator('.turn-strip .turn-chip span').evaluateAll((spans) =>
          spans.map((span) => ({
            text: span.textContent?.trim(),
            clippedX: span.scrollWidth > span.clientWidth + 1,
            clippedY: span.scrollHeight > span.clientHeight + 1,
            overflow: getComputedStyle(span).overflow,
          })),
        );
        expect(names.length).toBeGreaterThanOrEqual(6);
        expect(names.every((name) => name.text && !name.clippedX && !name.clippedY)).toBe(true);
        await board.screenshot({
          path: resolve(
            REVIEW_DIR,
            `${renderer}-${viewport.name}-largest-contrast-enemy-damaged.png`,
          ),
        });
        await setLargeText(page, 'off');
        await page.evaluate(() => window.fnt!.app.updateSettings({ highContrast: false }));
      }
    }
  });
}

test('Canvas and WebGL paint the same whole-pixel damaged health fill', async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const rows: string[] = [];
  for (const backend of ['canvas', 'webgl'] as const) {
    await resetStorage(page, `?renderer=${backend}`);
    await startGame(page, ['Kaya'], ['kaya'], 'bar-pixel-parity');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(backend);
    await page.evaluate(() =>
      window.fnt!.app.updateSettings({ highContrast: true, reduceMotion: true }),
    );
    await page.waitForFunction(() =>
      Boolean(
        (
          window.fnt!.app as unknown as {
            scene: { renderer: { lastView: MapView | null } };
          }
        ).scene.renderer.lastView?.units.some((unit) => unit.faction === 'enemy'),
      ),
    );
    const bar = await page.evaluate(() => {
      const renderer = (
        window.fnt!.app as unknown as {
          scene: {
            renderer: {
              backendName: 'canvas' | 'webgl';
              backend: { barTops: Map<string, number> };
              camera: {
                scale: number;
                offsetY: number;
                centreOn(pos: { x: number; y: number }, size: 1 | 2): void;
                spriteBox(
                  pos: { x: number; y: number },
                  size: 1 | 2,
                ): {
                  x: number;
                  size: number;
                };
              };
              lastView: MapView | null;
              draw(view: MapView): void;
            };
          };
        }
      ).scene.renderer;
      const draw = renderer.draw.bind(renderer);
      renderer.draw = (view) => {
        const enemy = view.units.find((unit) => unit.faction === 'enemy' && unit.hp > 0);
        if (!enemy) return draw(view);
        renderer.camera.centreOn(enemy.pos, enemy.size);
        draw({
          ...view,
          units: [
            { ...enemy, hp: 7, maxHp: 13, scale: 1, renderPos: undefined, offset: undefined },
          ],
          activeUnitId: enemy.id,
          selectedUnitId: null,
          crispOverlays: true,
          reducedMotion: true,
          time: 0,
        });
      };
      if (!renderer.lastView) throw new Error('Missing combat view for bar pixel probe.');
      renderer.draw(renderer.lastView);
      const enemy = renderer.lastView.units.find((unit) => unit.faction === 'enemy');
      if (!enemy) throw new Error('Missing enemy for bar pixel probe.');
      const barTop = renderer.backend.barTops.get(enemy.id);
      if (barTop === undefined) throw new Error('Enemy bar was not painted.');
      const box = renderer.camera.spriteBox(enemy.pos, enemy.size);
      return {
        x: Math.round(box.x + (box.size * enemy.size) / 2),
        y: Math.round(
          renderer.backendName === 'webgl'
            ? barTop * renderer.camera.scale - renderer.camera.offsetY
            : barTop,
        ),
      };
    });
    const pixels = await screenshotPixels(page.locator('.map-canvas'));
    const near = (x: number, y: number, color: readonly number[]) => {
      const pixel = pixels.at(x, y);
      return (
        pixel !== null &&
        Math.abs(pixel.r - (color[0] ?? 0)) <= 8 &&
        Math.abs(pixel.g - (color[1] ?? 0)) <= 8 &&
        Math.abs(pixel.b - (color[2] ?? 0)) <= 8
      );
    };
    // The 36px outer bar has a 34px track; 7/13 HP rounds to 18 whole pixels.
    // This reads the browser's painted pixels, including the Pixi raster path.
    const row = Array.from({ length: 36 }, (_, offset) => {
      const x = bar.x - 18 + offset;
      if (near(x, bar.y + 3, [27, 20, 16])) return 'F';
      if (near(x, bar.y + 3, [217, 74, 58])) return 'H';
      return '.';
    }).join('');
    expect(row, `${backend} bar must have a painted frame and 18px fill`).toMatch(
      /^FH{18}\.{16}F$/,
    );
    rows.push(row);
  }
  expect(rows[1], 'Canvas and WebGL bar pixels must agree').toBe(rows[0]);
});
