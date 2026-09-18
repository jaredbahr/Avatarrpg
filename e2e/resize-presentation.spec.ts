import { expect, test } from '@playwright/test';
import type { MapView } from '../src/render/view';
import type { Camera, Viewport } from '../src/render/camera';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

interface ResizeSample {
  beforeHeight: number;
  afterHeight: number;
  repainted: boolean;
  opaquePixels: number;
}

type ProbeWindow = Window & { resizeSamples: ResizeSample[] };

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const mode of ['normal', 'reduced', 'missing sheets'] as const) {
    test(`Confirm repaints resized ${renderer} before presentation with ${mode}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      const missingSheets: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      if (mode === 'missing sheets') {
        await page.route('**/art/units/*.json', (route) => {
          missingSheets.push(route.request().url());
          return route.abort();
        });
        await page.route('**/art/units/*.png', (route) => route.abort());
      }
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Kaya'], ['kaya'], 'resize-presentation', {
        reduceMotion: mode === 'reduced',
      });
      await enterNode(page, 'battle_forest_road');
      await takeTurn(page);
      await waitForIdle(page);
      await page.waitForFunction(() => Boolean(window.fnt?.app.rendererCamera()));
      // A staged encounter isolates presentation. The attack still goes through
      // real aim, target preview and Confirm, without forcing its outcome.
      const staged = await page.evaluate(() => {
        const app = window.fnt!.app;
        const state = app.state!;
        const battle = state.battle!;
        const actor = battle.units.find((u) => u.id === battle.order[battle.turnIndex])!;
        const enemy = battle.units.find((u) => u.faction === 'enemy' && u.hp > 0)!;
        const target = { x: 13, y: 5 };
        app.state = {
          ...state,
          battle: {
            ...battle,
            units: battle.units.map((u) =>
              u.id === actor.id
                ? { ...u, pos: { x: 9, y: 4 } }
                : u.id === enemy.id
                  ? { ...u, pos: target }
                  : u,
            ),
          },
        };
        return { actorId: actor.id, ap: actor.ap, enemyName: enemy.name, target };
      });
      await page.getByRole('button', { name: /Fire Jab/i }).click();
      await page
        .getByRole('button', { name: `Focus ${staged.enemyName}`, exact: true })
        .first()
        .click();
      await settleLayout(page);
      const target = await paintedTileCentre(page, staged.target);
      if (!target) throw new Error('Missing target projection');
      await page.touchscreen.tap(target.x, target.y);
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
      await settleLayout(page);

      // Observe the real backend; do not freeze frames or invoke a draw. The
      // microtask runs after the resize observer callback, before paint. This
      // catches the empty frame that a settled screenshot would miss.
      await page.evaluate(() => {
        const probe = window as unknown as ProbeWindow;
        probe.resizeSamples = [];
        const app = window.fnt!.app as unknown as {
          scene: {
            renderer: {
              backend: {
                resize: (viewport: Viewport) => void;
                draw: (view: MapView, camera: Camera) => void;
              };
            };
          };
        };
        const backend = app.scene.renderer.backend;
        const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas')!;
        let draws = 0;
        const draw = backend.draw.bind(backend);
        backend.draw = (view, camera) => {
          draw(view, camera);
          draws++;
        };
        const resize = backend.resize.bind(backend);
        backend.resize = (viewport) => {
          const beforeHeight = canvas.height;
          resize(viewport);
          const afterHeight = canvas.height;
          const previousDraws = draws;
          queueMicrotask(() => {
            const scratch = document.createElement('canvas');
            scratch.width = scratch.height = 32;
            const ctx = scratch.getContext('2d')!;
            ctx.drawImage(canvas, 0, 0, 32, 32);
            const pixels = ctx.getImageData(0, 0, 32, 32).data;
            let opaquePixels = 0;
            for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 0) opaquePixels++;
            probe.resizeSamples.push({
              beforeHeight,
              afterHeight,
              repainted: draws > previousDraws,
              opaquePixels,
            });
          });
        };
      });
      await page.getByRole('button', { name: 'Confirm', exact: true }).tap();
      await waitForIdle(page);
      await settleLayout(page);
      const samples = await page.evaluate(() => (window as unknown as ProbeWindow).resizeSamples);
      await test.info().attach('confirm-resize-timing', {
        body: JSON.stringify(samples, null, 2),
        contentType: 'application/json',
      });
      expect(samples.some((sample) => sample.afterHeight > sample.beforeHeight)).toBe(true);
      for (const sample of samples) {
        expect(sample.repainted, JSON.stringify(sample)).toBe(true);
        expect(sample.opaquePixels, JSON.stringify(sample)).toBeGreaterThan(0);
      }
      expect(
        await page.evaluate(
          (id) => window.fnt!.app.state!.battle!.units.find((u) => u.id === id)!.ap,
          staged.actorId,
        ),
      ).toBe(staged.ap - 1);
      expect(errors).toEqual([]);
      if (mode === 'missing sheets') {
        expect(missingSheets.some((url) => url.endsWith('/walking-kaya.json'))).toBe(true);
        await test.info().attach('painter-fallback-after-cast', {
          body: await page.locator('.map-canvas').screenshot(),
          contentType: 'image/png',
        });
      }
      if (mode === 'normal') {
        // A window resize also schedules scene.resize(), independently of the
        // canvas observer. It must not clear a just-repainted observer frame.
        await page.evaluate(() => {
          (window as unknown as ProbeWindow).resizeSamples = [];
        });
        const viewport = page.viewportSize()!;
        await page.setViewportSize({ width: viewport.width, height: viewport.height + 80 });
        await settleLayout(page);
        const rotation = await page.evaluate(
          () => (window as unknown as ProbeWindow).resizeSamples,
        );
        await test.info().attach('window-resize-timing', {
          body: JSON.stringify(rotation, null, 2),
          contentType: 'application/json',
        });
        expect(rotation.length).toBeGreaterThan(0);
        for (const sample of rotation) {
          expect(sample.repainted, JSON.stringify(sample)).toBe(true);
          expect(sample.opaquePixels, JSON.stringify(sample)).toBeGreaterThan(0);
        }
      }
    });
  }
}
