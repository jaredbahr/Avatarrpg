/** Real Web Audio scheduling evidence, not a claim of audible device quality. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { App } from '../src/app/App';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

interface SourceRecord {
  readonly source: AudioBufferSourceNode;
  readonly at: number;
  readonly url: string | null;
  readonly stops: { calledAt: number; effectiveAt: number }[];
}
interface NativeAudio {
  readonly ctx: AudioContext | null;
  readonly buffers: Map<string, AudioBuffer>;
  readonly master: GainNode | null;
}
interface AudioReplacementProbe {
  readonly sources: SourceRecord[];
  replacement: {
    context: AudioContext;
    at: number;
    outputRetiresAt: number | null;
    closedAt: number | null;
  } | null;
}
declare global {
  interface Window {
    audioReplacementProbe?: AudioReplacementProbe;
  }
}

async function observeSources(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sources: SourceRecord[] = [];
    const records = new WeakMap<AudioBufferSourceNode, SourceRecord>();
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      start.apply(this, args);
      const audio = window.fnt?.app.audio as unknown as NativeAudio | undefined;
      const url = [...(audio?.buffers ?? [])].find(([, buffer]) => buffer === this.buffer)?.[0];
      const record = { source: this, at: args[0] ?? 0, url: url ?? null, stops: [] };
      records.set(this, record);
      sources.push(record);
    };
    AudioBufferSourceNode.prototype.stop = function (...args: Parameters<typeof stop>) {
      const calledAt = this.context.currentTime;
      stop.apply(this, args);
      records.get(this)?.stops.push({ calledAt, effectiveAt: Math.max(args[0] ?? 0, calledAt) });
    };
    window.audioReplacementProbe = { sources, replacement: null };
  });
}

async function walk(page: Page, pos: { x: number; y: number }): Promise<void> {
  const point = await paintedTileCentre(page, pos);
  const canvas = await page.locator('.map-canvas').boundingBox();
  if (!point || !canvas) throw new Error('Missing actual map geometry');
  expect(point.x).toBeGreaterThan(canvas.x);
  expect(point.x).toBeLessThan(canvas.x + canvas.width);
  expect(point.y).toBeGreaterThan(canvas.y);
  expect(point.y).toBeLessThan(canvas.y + canvas.height);
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual(pos);
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`loading a stationary save retires the discarded walk sounds on ${renderer}`, async ({
    page,
  }, info) => {
    allowSoftwareWebgl(test, renderer);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observeSources(page);
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer'], ['kaya'], 'audio-state-replacement', {
      reduceMotion: false,
    });
    await enterNode(page, 'village_explore');
    await page.evaluate(() => window.fnt?.app.updateSettings({ volume: 0.7 }));
    await settleLayout(page);
    const box = await page.locator('.map-canvas').boundingBox();
    const zoom = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
    if (!box || !zoom) throw new Error('Missing actual camera');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, Math.log(zoom / 64) / 0.002);
    await settleLayout(page);
    for (const pos of [
      { x: 9, y: 7 },
      { x: 3, y: 7 },
    ]) {
      await walk(page, pos);
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
      const app = window.fnt?.app;
      const probe = window.audioReplacementProbe;
      if (!app || !probe) throw new Error('Missing native audio observer');
      const adopt = app.adoptSave;
      app.adoptSave = function (...args: Parameters<App['adoptSave']>) {
        const audio = this.audio as unknown as NativeAudio;
        if (!audio.ctx || !audio.master) throw new Error('Sound must already be unlocked');
        const context = audio.ctx;
        const replacement = {
          context,
          at: context.currentTime,
          outputRetiresAt: null as number | null,
          closedAt: null as number | null,
        };
        probe.replacement = replacement;
        // Observe the actual old master output, not just an eventual context close.
        const gain = audio.master.gain;
        const ramp = gain.linearRampToValueAtTime;
        gain.linearRampToValueAtTime = function (value, endTime) {
          const calledAt = context.currentTime;
          const result = ramp.call(this, value, endTime);
          if (value === 0) replacement.outputRetiresAt = Math.max(calledAt, endTime);
          return result;
        };
        const close = context.close;
        context.close = function () {
          const result = close.call(this);
          void result.then(
            () => {
              replacement.closedAt = context.currentTime;
            },
            () => undefined,
          );
          return result;
        };
        adopt.apply(this, args);
      };
    });
    await walk(page, { x: 9, y: 7 });
    // Activate the existing menu controls synchronously so software WebGL cannot
    // consume the whole walk between automation round trips. These are DOM
    // activations, not physical-input or ordinary render-speed acceptance.
    await page.evaluate(() => {
      const click = (root: ParentNode, label: string) => {
        const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
          (candidate) => candidate.textContent?.trim() === label,
        );
        if (!button || button.disabled) throw new Error(`Missing enabled ${label} control`);
        button.click();
      };
      click(document, 'Pause');
      click(document, 'Load game');
      const slot = [...document.querySelectorAll('.dialog .slot')].find(
        (candidate) => candidate.querySelector('strong')?.textContent === 'Slot 1',
      );
      if (!slot) throw new Error('Missing real saved slot');
      click(slot, 'Load');
    });
    const report = () =>
      page.evaluate(() => {
        const app = window.fnt?.app;
        const probe = window.audioReplacementProbe;
        const replacement = probe?.replacement;
        if (!app || !probe || !replacement) throw new Error('Load did not replace the game');
        const old = probe.sources.filter(
          (record) =>
            record.source.context === replacement.context && record.url?.startsWith('audio/step-'),
        );
        const future = old.filter((record) => record.at > replacement.at + 0.25);
        return {
          backend: app.rendererBackend(),
          state: app.state,
          busy: app.animator.busy(performance.now()),
          oldContextState: replacement.context.state,
          outputRetiresAt: replacement.outputRetiresAt,
          closedAt: replacement.closedAt,
          future: future.map((record) => ({ at: record.at, url: record.url, stops: record.stops })),
          stale: future.filter(
            (record) =>
              !(replacement.outputRetiresAt !== null && replacement.outputRetiresAt < record.at) &&
              !(replacement.closedAt !== null && replacement.closedAt < record.at) &&
              !record.stops.some((stop) => stop.effectiveAt < record.at),
          ).length,
          replacementAt: replacement.at,
        };
      });
    await info.attach('at-load-audio-state', {
      body: JSON.stringify(await report()),
      contentType: 'application/json',
    });
    // AudioBus already retires its output with a 32 ms fade and a 40 ms close.
    await expect.poll(async () => (await report()).stale).toBe(0);
    const loaded = await report();
    await info.attach('loaded-audio-state', {
      body: JSON.stringify(loaded),
      contentType: 'application/json',
    });
    expect(
      loaded.future.length,
      'a real future footstep must have existed at load',
    ).toBeGreaterThan(0);
    expect(loaded.state).toEqual(saved);
    expect(loaded.busy).toBe(false);
    expect(loaded.backend).toBe(renderer);
    const first = await page.evaluate(() => window.audioReplacementProbe?.sources.length ?? 0);
    await walk(page, { x: 4, y: 7 });
    await waitForIdle(page);
    await expect
      .poll(() =>
        page.evaluate((from) => {
          const probe = window.audioReplacementProbe;
          return probe?.sources
            .slice(from)
            .some(
              (record) =>
                record.url?.startsWith('audio/step-') &&
                record.source.context !== probe.replacement?.context &&
                record.source.context.state === 'running',
            );
        }, first),
      )
      .toBe(true);
    await info.attach('loaded-renderer', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    expect(errors).toEqual([]);
  });
}
