import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';
import type { MapView } from '../src/render/view';

const REVIEW_DIR = resolve(process.cwd(), '.shots/combat-readability');
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'landscape-tablet', width: 1180, height: 820 },
] as const;

for (const backend of ['canvas', 'webgl'] as const) {
  test(`combat bars, active cues, and landscape initiative stay readable on ${backend}`, async ({
    page,
  }) => {
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
          stripHeight: rect.height,
          scrollWidth: strip.scrollWidth,
          clientWidth: strip.clientWidth,
          overflowX: getComputedStyle(strip).overflowX,
          chips,
        };
      });
      expect(layout.tilePx, `expected the zoom-1 camera in ${viewport.name}`).toBeCloseTo(64, 3);
      expect(layout.chips.length).toBeGreaterThanOrEqual(6);
      expect(layout.chips.every((chip) => chip.height >= 44)).toBe(true);
      expect(layout.chips.every((chip) => chip.direction === 'row')).toBe(true);
      expect(new Set(layout.chips.map((chip) => Math.round(chip.y))).size).toBe(1);
      expect(layout.stripHeight).toBeLessThan(72);
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
    }
  });
}
