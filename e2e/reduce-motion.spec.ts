import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';
import type { Renderer } from '../src/render/renderer';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

type BoardScene = { renderer: Renderer; firstFrameReady?(): Promise<unknown> };
type Draw = { time: number; drawnAt: number; reduced: boolean };

declare global {
  interface Window {
    reducedMotionDraw?: Draw;
  }
}

async function observeBoard(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = window.fnt!.app as unknown as { scene: BoardScene };
    const scene = app.scene;
    await scene.firstFrameReady?.();
    const original = scene.renderer.draw.bind(scene.renderer);
    scene.renderer.draw = (view) => {
      original(view);
      window.reducedMotionDraw = {
        time: view.time,
        drawnAt: performance.now(),
        reduced: Boolean(view.reducedMotion),
      };
    };
  });
  await page.waitForFunction(() => window.reducedMotionDraw !== undefined);
}

async function checkpoint(page: Page) {
  return page.evaluate(() => ({
    draw: window.reducedMotionDraw!,
    state: window.fnt!.app.state,
    camera: window.fnt!.app.rendererCamera(),
    backend: window.fnt!.app.rendererBackend(),
  }));
}

async function waitForDrawAfter(page: Page, draw: Draw, delay: number): Promise<void> {
  await page.waitForFunction(
    ({ previous, gap }) =>
      window.reducedMotionDraw !== undefined &&
      window.reducedMotionDraw.drawnAt >= previous.drawnAt + gap &&
      window.reducedMotionDraw.time >= previous.time + gap,
    { previous: draw, gap: delay },
  );
}

const preferences = [
  { name: 'OS', media: 'reduce', saved: false, reduced: true },
  { name: 'in-game', media: 'no-preference', saved: true, reduced: true },
  { name: 'motion on', media: 'no-preference', saved: false, reduced: false },
] as const;
const reducedPreferences = preferences.filter(({ reduced }) => reduced);
const boards = [
  {
    name: 'Ba Dan',
    node: 'village_explore',
    selector: '.explore-scene .map-canvas',
    preferences,
  },
  {
    name: 'Forest Road combat',
    node: 'battle_forest_road',
    selector: '.combat-scene .map-canvas',
    preferences: reducedPreferences,
  },
] as const;

for (const board of boards) {
  for (const renderer of ['canvas', 'webgl'] as const) {
    for (const preference of board.preferences) {
      test(`${board.name} idle board, ${renderer}, ${preference.name}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.emulateMedia({ reducedMotion: preference.media });
        await resetStorage(page, `?renderer=${renderer}`);
        await startGame(page, ['Kaya'], ['kaya'], 'idle-motion', {
          reduceMotion: preference.saved,
        });
        await enterNode(page, board.node);
        if (board.node === 'battle_forest_road') {
          expect(await takeTurn(page, { settleCamera: false })).toBe(true);
          // The encounter callout intentionally expires even at reduced motion.
          await expect(page.locator('.toasts .toast')).toHaveCount(0);
        }
        await waitForIdle(page);
        await observeBoard(page);
        await page.waitForFunction(() => !window.fnt?.app.curtainBusy);
        await settleLayout(page);

        const canvas = page.locator(board.selector);
        const first = await checkpoint(page);
        expect(first.backend).toBe(renderer);
        expect(first.camera?.projection).toBe('topdown');
        expect(first.draw.reduced).toBe(preference.reduced);
        const frames = [await canvas.screenshot()];
        await waitForDrawAfter(page, (await checkpoint(page)).draw, 1500);
        frames.push(await canvas.screenshot());
        // A second later sample prevents one coincident animation phase from
        // satisfying the motion-on control.
        await waitForDrawAfter(page, (await checkpoint(page)).draw, 420);
        frames.push(await canvas.screenshot());
        const last = await checkpoint(page);
        expect(last.draw.reduced).toBe(first.draw.reduced);
        expect(last.state).toEqual(first.state);
        expect(last.camera).toEqual(first.camera);
        expect(errors).toEqual([]);

        const [reference, ...samples] = frames.map((frame) => PNG.sync.read(frame));
        if (!reference) throw new Error('Missing first board capture');
        for (const [index, frame] of frames.entries()) {
          await test.info().attach(`board-${index + 1}`, { body: frame, contentType: 'image/png' });
        }
        for (const sample of samples) {
          expect([sample.width, sample.height]).toEqual([reference.width, reference.height]);
        }
        expect(samples.every((sample) => sample.data.equals(reference.data))).toBe(
          preference.reduced,
        );
      });
    }
  }
}

async function expectReducedAnimations(page: Page): Promise<void> {
  const active = await page.evaluate(() =>
    document
      .getAnimations()
      .filter(({ playState }) => playState === 'running')
      .map(({ effect }) => effect?.getComputedTiming().activeDuration ?? 0),
  );
  for (const duration of active) expect(duration).toBeLessThanOrEqual(1);
}

for (const preference of reducedPreferences) {
  test(`idle title and dialogue, ${preference.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: preference.media });
    await page.goto('/robots.txt');
    await page.evaluate(
      (reduceMotion) => localStorage.setItem('fnt.settings', JSON.stringify({ reduceMotion })),
      preference.saved,
    );
    await page.goto('/?renderer=canvas&titleArt=a&titleArtHold=3000');
    await page.waitForFunction(() => Boolean(window.fnt?.app));
    const title = page.locator('.title-art');
    const art = title.locator('.title-art-layer[data-active="true"] img');
    await expect(art).toBeVisible();
    await art.evaluate((image: HTMLImageElement) => image.decode());
    await page.evaluate(() => document.fonts.ready);
    const titleFirst = PNG.sync.read(await page.screenshot());
    await expectReducedAnimations(page);
    // Cross a real 3000 ms rotation boundary while the app remains active.
    const titleStart = await page.evaluate(() => performance.now());
    await page.waitForFunction((start) => performance.now() >= start + 3100, titleStart);
    const titleSecond = PNG.sync.read(await page.screenshot());
    expect(titleSecond.data.equals(titleFirst.data)).toBe(true);
    await expect(title).toHaveAttribute('data-current', 'a');
    await expectReducedAnimations(page);

    await startGame(page, ['Kaya'], ['kaya'], 'idle-dialogue', { reduceMotion: preference.saved });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await enterNode(page, 'mira_intro');
    const dialogue = page.locator('.explore-conversation');
    await expect(dialogue.locator('.line-count')).toHaveText(/^1 of /);
    await observeBoard(page);
    await page.waitForFunction(() => !window.fnt?.app.curtainBusy);
    await settleLayout(page);
    const before = await checkpoint(page);
    expect(before.draw.reduced).toBe(true);
    const dialogueFirst = PNG.sync.read(await page.screenshot());
    await expectReducedAnimations(page);
    await waitForDrawAfter(page, (await checkpoint(page)).draw, 1500);
    const dialogueSecond = PNG.sync.read(await page.screenshot());
    const after = await checkpoint(page);
    expect(after.state).toEqual(before.state);
    expect(after.camera).toEqual(before.camera);
    expect(dialogueSecond.data.equals(dialogueFirst.data)).toBe(true);
    await expectReducedAnimations(page);
    expect(errors).toEqual([]);
  });
}
