import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, setLargeText, startGame, takeTurn, waitForIdle } from './helpers';
import { activeGroundCue } from '../src/render/geometry/actorSilhouette';
import { liftAlong } from '../src/render/geometry/elevation';
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

test.describe('fractional-offset painted pixel parity', () => {
  test.use({ deviceScaleFactor: 2 });

  test('Canvas and WebGL paint the same whole-pixel damaged health fill and active cue', async ({
    page,
  }) => {
    test.setTimeout(360_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const rows: string[] = [];
    const placements: {
      frameX: number;
      frameY: number;
      paintedTop: number;
      paintedBottom: number;
      offsetX: number;
      offsetY: number;
      cue: { minX: number; minY: number; maxX: number; maxY: number; count: number };
    }[] = [];
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
        const win = window as Window & { barParityCueActive?: boolean };
        win.barParityCueActive = true;
        const renderer = (
          window.fnt!.app as unknown as {
            scene: {
              renderer: {
                backendName: 'canvas' | 'webgl';
                backend: { barTops: Map<string, number> };
                camera: {
                  scale: number;
                  projection: 'orthographic' | 'oblique';
                  offsetX: number;
                  offsetY: number;
                  centreOn(pos: { x: number; y: number }, size: 1 | 2): void;
                  spriteBox(
                    pos: { x: number; y: number },
                    size: 1 | 2,
                  ): {
                    x: number;
                    y: number;
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
          // Both offsets sit on the DPR-2 device grid, half a CSS pixel away
          // from the screen-origin lattice that used to misplace Canvas bars.
          renderer.camera.offsetX = Math.floor(renderer.camera.offsetX) + 0.5;
          renderer.camera.offsetY = Math.floor(renderer.camera.offsetY) + 0.5;
          draw({
            ...view,
            units: [
              { ...enemy, hp: 7, maxHp: 13, scale: 1, renderPos: undefined, offset: undefined },
            ],
            activeUnitId: win.barParityCueActive ? enemy.id : null,
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
          centreX: box.x + (box.size * enemy.size) / 2,
          boxY: box.y,
          size: box.size,
          scale: renderer.camera.scale,
          offsetX: renderer.camera.offsetX,
          offsetY: renderer.camera.offsetY,
          projection: renderer.camera.projection,
          grid: renderer.lastView.grid,
          enemyPos: enemy.pos,
          topY:
            renderer.backendName === 'webgl'
              ? barTop * renderer.camera.scale - renderer.camera.offsetY
              : barTop,
        };
      });
      expect(bar.scale).toBe(1);
      expect(bar.offsetX % 1).toBe(0.5);
      expect(bar.offsetY % 1).toBe(0.5);
      expect((bar.topY + bar.offsetY) / bar.scale).toBeCloseTo(
        Math.round((bar.topY + bar.offsetY) / bar.scale),
        8,
      );
      const board = page.locator('.map-canvas');
      const active = PNG.sync.read(await board.screenshot({ scale: 'device' }));
      await page.evaluate(() => {
        const win = window as Window & { barParityCueActive?: boolean };
        win.barParityCueActive = false;
        const renderer = (
          window.fnt!.app as unknown as {
            scene: { renderer: { lastView: MapView | null; draw(view: MapView): void } };
          }
        ).scene.renderer;
        if (renderer.lastView) renderer.draw(renderer.lastView);
      });
      const inactive = PNG.sync.read(await board.screenshot({ scale: 'device' }));
      expect(inactive.width).toBe(active.width);
      expect(inactive.height).toBe(active.height);
      const channel = (png: PNG, x: number, y: number, index: number) =>
        png.data[(y * png.width + x) * 4 + index] ?? 0;
      const near = (x: number, y: number, color: readonly number[]) => {
        return [0, 1, 2].every(
          (index) => Math.abs(channel(active, x, y, index) - (color[index] ?? 0)) <= 8,
        );
      };
      const centreWorld = (bar.centreX + bar.offsetX) / bar.scale;
      const frameX = Math.round((Math.round(centreWorld) - 18) * bar.scale * 2 - bar.offsetX * 2);
      const frameY = Math.round(bar.topY * 2);
      expect(Math.abs(frameX % 2)).toBe(1);
      expect(Math.abs(frameY % 2)).toBe(1);
      // Find the actual painted highlight rather than trusting barTops for
      // the vertical edge. It spans the whole interior one world pixel below
      // the opaque frame and is two device pixels high at this zoom.
      const highlightYs: number[] = [];
      for (let y = frameY - 8; y <= frameY + 12; y++)
        if ([5, 35, 65].every((dx) => near(frameX + dx, y, [255, 246, 224]))) highlightYs.push(y);
      expect(highlightYs, `${backend} painted upper highlight`).toHaveLength(2);
      const paintedTop = (highlightYs[0] ?? 0) - 2;
      const paintedBottom = paintedTop + 8 * 2 - 1;
      expect(near(frameX, paintedTop, [27, 20, 16])).toBe(true);
      expect(near(frameX, paintedBottom, [27, 20, 16])).toBe(true);
      expect(Math.abs(paintedTop % 2)).toBe(1);
      expect(paintedTop).toBe(frameY);
      // The 36px outer bar has a 34px track; 7/13 HP rounds to 18 whole pixels.
      // Read device pixels at the absolute world-grid anchor, not a backend's
      // own local bar crop: a half-CSS-pixel displacement must fail this row.
      const row = Array.from({ length: 36 }, (_, offset) => {
        const x = frameX + 1 + offset * 2;
        const y = frameY + 7;
        if (near(x, y, [27, 20, 16])) return 'F';
        if (near(x, y, [217, 74, 58])) return 'H';
        return '.';
      }).join('');
      expect(row, `${backend} bar must have a painted frame and 18px fill`).toMatch(
        /^FH{18}\.{16}F$/,
      );
      rows.push(row);
      const cuePoints: { x: number; y: number }[] = [];
      const x0 = Math.max(0, Math.floor((bar.centreX - bar.size) * 2));
      const x1 = Math.min(active.width, Math.ceil((bar.centreX + bar.size) * 2));
      const y0 = Math.max(0, Math.floor((bar.boxY + bar.size * 0.4) * 2));
      const y1 = Math.min(active.height, Math.ceil((bar.boxY + bar.size * 1.3) * 2));
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const delta = Math.max(
            ...[0, 1, 2].map((index) =>
              Math.abs(channel(active, x, y, index) - channel(inactive, x, y, index)),
            ),
          );
          if (delta > 24) cuePoints.push({ x, y });
        }
      expect(cuePoints.length, `${backend} active cue must change painted pixels`).toBeGreaterThan(
        30,
      );
      const lift = liftAlong(bar.grid, bar.enemyPos, bar.projection);
      const expectedCue = activeGroundCue(
        (bar.centreX + bar.offsetX) / bar.scale,
        (bar.boxY - lift * bar.size + bar.size * 0.86 + bar.offsetY) / bar.scale,
        bar.size / bar.scale,
        bar.size / bar.scale,
        1,
        1,
        4,
      );
      const expectedMinX = Math.min(
        ...expectedCue.outer.map((run) => Math.round((run.x * bar.scale - bar.offsetX) * 2)),
      );
      const expectedMaxX = Math.max(
        ...expectedCue.outer.map(
          (run) => Math.round(((run.x + run.width) * bar.scale - bar.offsetX) * 2) - 1,
        ),
      );
      expect(Math.min(...cuePoints.map((point) => point.x))).toBe(expectedMinX);
      expect(Math.max(...cuePoints.map((point) => point.x))).toBe(expectedMaxX);
      placements.push({
        frameX,
        frameY,
        paintedTop,
        paintedBottom,
        offsetX: bar.offsetX,
        offsetY: bar.offsetY,
        cue: {
          minX: Math.min(...cuePoints.map((point) => point.x)),
          minY: Math.min(...cuePoints.map((point) => point.y)),
          maxX: Math.max(...cuePoints.map((point) => point.x)),
          maxY: Math.max(...cuePoints.map((point) => point.y)),
          count: cuePoints.length,
        },
      });
    }
    expect(rows[1], 'Canvas and WebGL bar pixels must agree').toBe(rows[0]);
    const canvas = placements[0];
    const webgl = placements[1];
    expect(canvas).toBeDefined();
    expect(webgl).toBeDefined();
    expect(canvas?.offsetX).toBe(webgl?.offsetX);
    expect(canvas?.offsetY).toBe(webgl?.offsetY);
    expect(canvas?.frameX).toBe(webgl?.frameX);
    expect(canvas?.frameY).toBe(webgl?.frameY);
    expect(canvas?.paintedTop).toBe(webgl?.paintedTop);
    expect(canvas?.paintedBottom).toBe(webgl?.paintedBottom);
    for (const edge of ['minX', 'minY', 'maxX', 'maxY'] as const)
      expect(canvas?.cue[edge], `cue ${edge} must share the exact device-pixel edge`).toBe(
        webgl?.cue[edge],
      );
  });
});
