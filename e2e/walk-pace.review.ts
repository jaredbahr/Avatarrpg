/** Continuous local native playback; observes and forwards the real view unchanged. */
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { MapView } from '../src/render/view';
import type { Renderer } from '../src/render/renderer';
import type { Vec2 } from '../src/core/types';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { allowSoftwareWebgl } from './budget';

interface Frame {
  time: number;
  units: { id: string; sprite: string; pos: Vec2; clip?: string; clipTime?: number }[];
}
interface Probe {
  frames: Frame[];
}
type ReviewWindow = Window & { paceReview: Probe };
type ReviewApp = { scene: { renderer: Renderer; firstFrameReady(): Promise<unknown> } };

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const style of ['default'] as const) {
    test(`Ba Dan continuous walk: ${renderer}, ${style}`, async ({ page }, info) => {
      test.setTimeout(120_000);
      allowSoftwareWebgl(test, renderer);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['One', 'Two', 'Three'], ['kaya', 'sura', 'bo'], 'walk-pace-383', {
        reduceMotion: false,
      });
      await enterNode(page, 'village_explore');
      await page.locator('.explore-scene .map-canvas').waitFor();
      await waitForIdle(page);
      await settleLayout(page);
      const initial = await page.evaluate(async () => {
        const app = window.fnt!.app;
        const scene = (app as unknown as ReviewApp).scene;
        await scene.firstFrameReady();
        const probe: Probe = { frames: [] };
        (window as unknown as ReviewWindow).paceReview = probe;
        const draw = scene.renderer.draw.bind(scene.renderer);
        scene.renderer.draw = (view: MapView): void => {
          draw(view);
          probe.frames.push({
            time: view.time,
            units: view.units.map((unit) => ({
              id: unit.id,
              sprite: unit.sprite,
              pos: unit.renderPos ?? unit.pos,
              ...(unit.clip ? { clip: unit.clip } : {}),
              ...(unit.clipTime === undefined ? {} : { clipTime: unit.clipTime }),
            })),
          });
        };
        return {
          pos: app.state!.location.pos,
          camera: app.rendererCamera(),
          backend: app.rendererBackend(),
        };
      });
      expect(initial.backend, 'requested native renderer actually ran').toBe(renderer);
      const legs = [
        { x: initial.pos.x + 4, y: initial.pos.y },
        initial.pos,
        { x: initial.pos.x, y: initial.pos.y + 1 },
        initial.pos,
      ];
      const moves = [];
      for (const target of legs) {
        const planned = await page.evaluate((target) => {
          const app = window.fnt!.app;
          const before = app.state!.location.pos;
          const now = performance.now();
          app.dispatch({ type: 'walkTo', pos: target });
          return {
            before,
            after: app.state!.location.pos,
            commandAt: now,
            finishesAt: app.animator.finishesAt,
          };
        }, target);
        expect(planned.after, 'legal walk command reached the requested tile').toEqual(target);
        await waitForIdle(page);
        const drawn = await page.evaluate(() => window.fnt!.app.partyPositions());
        if (!drawn) throw new Error('Party positions unavailable after walk');
        expect(drawn[0], 'leader settled on its rules tile').toEqual(target);
        expect(new Set(drawn.map((pos) => `${pos.x},${pos.y}`)).size).toBe(3);
        moves.push({ ...planned, target, drawn });
      }
      const frames = await page.evaluate(
        () => (window as unknown as ReviewWindow).paceReview.frames,
      );
      const moving = frames.flatMap((frame) =>
        frame.units.filter((unit) => unit.clip?.startsWith('walk')),
      );
      expect(moving.length, 'native renderer received walking frames').toBeGreaterThan(2);
      expect(
        frames.flatMap((frame) => frame.units).some((unit) => /^jog/.test(unit.clip ?? '')),
      ).toBe(false);
      expect(errors.filter((message) => !/favicon/i.test(message))).toEqual([]);
      await page.screenshot({ path: info.outputPath('settled.png') });
      writeFileSync(
        info.outputPath('playback.json'),
        JSON.stringify(
          {
            renderer,
            style,
            initial,
            moves,
            frames,
            errors,
            clock: 'ordinary performance.now; no clock installation or acceleration',
            acceptance: 'local native observation only; no physical-device or owner style approval',
          },
          null,
          2,
        ),
      );
    });
  }
}
