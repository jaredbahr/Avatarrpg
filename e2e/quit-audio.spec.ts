/** Native scheduling evidence for the discarded state; not a listening test. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

interface QuitSource {
  source: AudioBufferSourceNode;
  at: number;
  url: string | null;
  stops: { calledAt: number; effectiveAt: number }[];
}
interface QuitAudio {
  ctx: AudioContext | null;
  master: GainNode | null;
  buffers: Map<string, AudioBuffer>;
}
interface QuitProbe {
  sources: QuitSource[];
  overflow: boolean;
  onFutureStep: (() => void) | null;
  triggered: boolean;
  triggerError: string | null;
  immediate: {
    state: unknown;
    busy: boolean;
    retired: boolean;
    oldSteps: number;
    scene: string | null | undefined;
  } | null;
  retirement: {
    context: AudioContext;
    master: GainNode;
    at: number;
    outputRetiresAt: number | null;
    outputFadeStartedAt: number | null;
    closedAt: number | null;
  } | null;
}
declare global {
  interface Window {
    quitAudioProbe: QuitProbe;
  }
}
async function clickWalk(page: Page, x: number): Promise<void> {
  const point = await paintedTileCentre(page, { x, y: 7 });
  const box = await page.locator('.map-canvas').boundingBox();
  if (!point || !box) throw new Error('Missing painted village/canvas');
  expect(point.x).toBeGreaterThan(box.x);
  expect(point.x).toBeLessThan(box.x + box.width);
  expect(point.y).toBeGreaterThan(box.y);
  expect(point.y).toBeLessThan(box.y + box.height);
  await page.mouse.click(point.x, point.y);
}

async function walk(page: Page, x: number): Promise<void> {
  await clickWalk(page, x);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.location.pos))
    .toEqual({ x, y: 7 });
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer}: Quit retires playback before opening the title`, async ({ page }, info) => {
    allowSoftwareWebgl(test, renderer);
    const errors: string[] = [];
    const evidence: unknown[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const probe: QuitProbe = {
        sources: [],
        overflow: false,
        onFutureStep: null,
        triggered: false,
        triggerError: null,
        immediate: null,
        retirement: null,
      };
      const records = new WeakMap<AudioBufferSourceNode, QuitSource>();
      const start = AudioBufferSourceNode.prototype.start;
      const stop = AudioBufferSourceNode.prototype.stop;
      AudioBufferSourceNode.prototype.start = function (...args) {
        start.apply(this, args);
        if (probe.sources.length >= 10_000) {
          probe.overflow = true;
          return;
        }
        const audio = window.fnt?.app.audio as unknown as QuitAudio | undefined;
        const url = [...(audio?.buffers ?? [])].find(([, buffer]) => buffer === this.buffer)?.[0];
        const record = { source: this, at: args[0] ?? 0, url: url ?? null, stops: [] };
        probe.sources.push(record);
        records.set(this, record);
        if (
          probe.onFutureStep &&
          record.url?.startsWith('audio/step-') &&
          record.at > this.context.currentTime + 0.25
        ) {
          const trigger = probe.onFutureStep;
          probe.onFutureStep = null;
          // Finish the native scheduling stack before activating Quit.
          queueMicrotask(() => {
            try {
              trigger();
            } catch (error) {
              probe.triggerError = String(error);
            } finally {
              probe.triggered = true;
            }
          });
        }
      };
      AudioBufferSourceNode.prototype.stop = function (...args) {
        const calledAt = this.context.currentTime;
        stop.apply(this, args);
        records.get(this)?.stops.push({ calledAt, effectiveAt: Math.max(args[0] ?? 0, calledAt) });
      };
      window.quitAudioProbe = probe;
    });
    const report = () =>
      page.evaluate(() => {
        const app = window.fnt?.app;
        const probe = window.quitAudioProbe;
        const old = probe?.retirement;
        if (!app || !probe || !old) throw new Error('No actual Quit witness');
        const future = probe.sources.filter(
          (row) =>
            row.source.context === old.context &&
            row.url?.startsWith('audio/step-') &&
            row.at > old.at + 0.25,
        );
        return {
          state: app.state,
          scene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
          busy: app.animator.busy(performance.now()),
          retired: (app.audio as unknown as QuitAudio).ctx !== old.context,
          contextState: old.context.state,
          at: old.at,
          clock: old.context.currentTime,
          outputRetiresAt: old.outputRetiresAt,
          outputFadeStartedAt: old.outputFadeStartedAt,
          outputGain: old.master.gain.value,
          closedAt: old.closedAt,
          future: future.map((row) => ({ at: row.at, url: row.url, stops: row.stops })),
          stale: future.filter(
            (row) =>
              !(old.outputRetiresAt !== null && old.outputRetiresAt < row.at) &&
              !(old.closedAt !== null && old.closedAt < row.at) &&
              !row.stops.some((stop) => stop.effectiveAt < row.at),
          ).length,
          overflow: probe.overflow,
        };
      });
    try {
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Explorer'], ['kaya'], 'quit-playback-412', { reduceMotion: false });
      await enterNode(page, 'village_explore');
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
      const box = await page.locator('.map-canvas').boundingBox();
      const zoom = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
      if (!box || !zoom) throw new Error('Missing real village');
      await page.locator('.map-canvas').dispatchEvent('wheel', {
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
        deltaX: 0,
        deltaY: Math.log(zoom / 64) / 0.002,
        deltaMode: 0,
      });
      await settleLayout(page);
      for (const x of [9, 3]) {
        await walk(page, x);
        await waitForIdle(page);
        await settleLayout(page);
      }
      const saved = await page.evaluate(() => window.fnt?.app.state);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Save game', exact: true }).click();
      await page
        .locator('.dialog')
        .last()
        .locator('.slot')
        .filter({ hasText: 'Slot 1' })
        .getByRole('button', { name: 'Save here', exact: true })
        .click();
      await page
        .locator('.dialog')
        .last()
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await settleLayout(page);
      await page.evaluate(() => {
        const app = window.fnt!.app;
        const probe = window.quitAudioProbe;
        // A native future footstep triggers the real controls after scheduling.
        // No cue or clock is fabricated, and no render round trip consumes it.
        probe.onFutureStep = () => {
          const click = (label: string) => {
            const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
              (candidate) => candidate.textContent?.trim() === label,
            );
            if (!button || button.disabled) throw new Error(`Missing enabled ${label}`);
            button.click();
          };
          click('Pause');
          click('Quit to title');
          const audio = app.audio as unknown as QuitAudio;
          const context = audio.ctx;
          const master = audio.master;
          if (!context || !master) throw new Error('No old unlocked audio graph');
          const old = {
            context,
            master,
            at: context.currentTime,
            outputRetiresAt: null as number | null,
            outputFadeStartedAt: null as number | null,
            closedAt: null as number | null,
          };
          probe.retirement = old;
          const ramp = master.gain.linearRampToValueAtTime;
          master.gain.linearRampToValueAtTime = function (value, endTime) {
            const calledAt = context.currentTime;
            const result = ramp.call(this, value, endTime);
            if (value === 0) {
              old.outputFadeStartedAt = calledAt;
              old.outputRetiresAt = Math.max(calledAt, endTime);
            }
            return result;
          };
          const close = context.close;
          context.close = function () {
            const result = close.call(this);
            void result.then(
              () => {
                old.closedAt = context.currentTime;
              },
              () => undefined,
            );
            return result;
          };
          const count = probe.sources.filter(
            (row) =>
              row.source.context === context &&
              row.url?.startsWith('audio/step-') &&
              row.at > old.at + 0.25,
          ).length;
          if (!count) throw new Error('No real future old step at Quit');
          click('Quit');
          // Capture Quit before any later title input can unlock audio or Load
          // can retire it, masking missing retirement by Quit itself.
          probe.immediate = {
            state: app.state,
            busy: app.animator.busy(performance.now()),
            retired: audio.ctx === null,
            oldSteps: count,
            scene: document.querySelector('[data-scene]')?.getAttribute('data-scene'),
          };
        };
      });
      await clickWalk(page, 9);
      await expect.poll(() => page.evaluate(() => window.quitAudioProbe.triggered)).toBe(true);
      const triggered = await page.evaluate(() => ({
        error: window.quitAudioProbe.triggerError,
        immediate: window.quitAudioProbe.immediate,
      }));
      expect(triggered.error).toBeNull();
      const immediate = triggered.immediate;
      if (!immediate) throw new Error('No immediate result from the native Quit trigger');
      evidence.push({ immediate });
      // Preserve the actual Quit result before any later title input can unlock
      // audio or Load can retire it, masking a missing Quit retirement.
      await page.waitForTimeout(60);
      const quit = await report();
      evidence.push({ quit });
      expect(immediate.state).toBeNull();
      expect(immediate.scene).toBe('title');
      expect.soft(immediate.busy, 'discarded visual walk must be cleared before title').toBe(false);
      expect
        .soft(immediate.retired, 'Quit must relinquish old context ownership immediately')
        .toBe(true);
      expect(quit.future.length).toBeGreaterThan(0);
      expect.soft(quit.stale, 'retire old output BEFORE each future deadline').toBe(0);
      expect.soft(quit.outputRetiresAt, 'successful native zero-output schedule').not.toBeNull();
      if (quit.outputRetiresAt !== null) {
        expect(quit.outputFadeStartedAt).not.toBeNull();
        expect(quit.outputRetiresAt - (quit.outputFadeStartedAt ?? quit.at)).toBeCloseTo(0.032, 5);
        expect(quit.outputRetiresAt).toBeLessThanOrEqual(quit.at + 0.05);
        expect(quit.outputRetiresAt).toBeLessThan(Math.min(...quit.future.map((row) => row.at)));
      }
      expect.soft(quit.outputGain, 'old master has actually reached zero').toBe(0);
      expect.soft(quit.contextState).toBe('closed');
      expect(quit.overflow).toBe(false);
      await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Load a save', exact: true }).click();
      await page
        .locator('.dialog')
        .last()
        .locator('.slot')
        .filter({ hasText: 'Slot 1' })
        .getByRole('button', { name: 'Load', exact: true })
        .click();
      await expect.poll(() => page.evaluate(() => window.fnt?.app.state)).toEqual(saved);
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
      const first = await page.evaluate(() => window.quitAudioProbe.sources.length);
      await walk(page, 4);
      await waitForIdle(page);
      const fresh = await page.evaluate((from) => {
        const probe = window.quitAudioProbe;
        return probe.sources
          .slice(from)
          .filter((row) => row.url?.startsWith('audio/step-'))
          .map((row) => ({
            at: row.at,
            url: row.url,
            newContext: row.source.context !== probe.retirement?.context,
            contextState: row.source.context.state,
          }));
      }, first);
      evidence.push({ fresh });
      expect(fresh.length, 'actual subsequent walk schedules fresh sound').toBeGreaterThan(0);
      expect(fresh.every((row) => row.newContext && row.contextState === 'running')).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      const live = await report().catch((error: unknown) => ({ observerReadError: String(error) }));
      await info.attach('quit-playback-native', {
        body: JSON.stringify({
          protocol:
            'API newgame/debug village; actual mouse walks/Save/Title Load; synchronous real DOM Pause/Quit confirmation; native start/stop/master-ramp/context-close forwarded. Normal game/audio clocks, scheduling evidence only, no physical/audibility claim.',
          renderer,
          evidence,
          live,
          errors,
        }),
        contentType: 'application/json',
      });
      await info.attach('quit-playback-renderer', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
  });
}
