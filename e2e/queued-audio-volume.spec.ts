import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

interface AudioInternals {
  ctx: AudioContext | null;
  buffers: Map<string, AudioBuffer>;
}
interface GainReading {
  id: number;
  value: number;
}
interface ParamCall {
  id: number;
  kind: 'set' | 'linear' | 'cancel';
  calledAt: number;
  at: number;
  value: number | null;
}
interface QueuedSource {
  source: AudioBufferSourceNode;
  at: number;
  url: string | null;
}
interface VolumeProbe {
  sources: QueuedSource[];
  calls: ParamCall[];
  path(source: AudioNode): GainReading[];
  first: number;
  pending: QueuedSource[];
  context: AudioContext | null;
  overflow: boolean;
}
declare global {
  interface Window {
    queuedVolumeProbe: VolumeProbe;
  }
}

// Forward native calls unchanged. Inspect the complete connected output path,
// not private implementation fields or a newly created replacement source.
function observeAudio(): void {
  const edges = new Map<AudioNode, AudioNode[]>();
  const disconnected = new Set<AudioNode>();
  const gains = new Map<GainNode, number>();
  const params = new Map<AudioParam, { id: number; context: BaseAudioContext }>();
  const sources: QueuedSource[] = [];
  const calls: ParamCall[] = [];
  const limit = 10_000;
  let overflow = false;
  const createGain = BaseAudioContext.prototype.createGain;
  BaseAudioContext.prototype.createGain = function () {
    const node = createGain.call(this);
    const id = gains.size;
    gains.set(node, id);
    params.set(node.gain, { id, context: this });
    return node;
  };
  type ConnectArgs = [AudioNode, number?, number?] | [AudioParam, number?];
  const connect = AudioNode.prototype.connect as unknown as (
    this: AudioNode,
    ...args: ConnectArgs
  ) => AudioNode | void;
  AudioNode.prototype.connect = function (this: AudioNode, ...args: ConnectArgs) {
    const result = connect.apply(this, args);
    if (args[0] instanceof AudioNode) {
      const next = edges.get(this) ?? [];
      next.push(args[0]);
      edges.set(this, next);
    }
    return result;
  } as typeof AudioNode.prototype.connect;
  // Any disconnect invalidates this conservative single-path witness. Tracking
  // it prevents historical connect edges from masquerading as live playback.
  type DisconnectArgs = [] | [number] | [AudioNode, number?, number?] | [AudioParam, number?];
  const disconnect = AudioNode.prototype.disconnect as unknown as (
    this: AudioNode,
    ...args: DisconnectArgs
  ) => void;
  AudioNode.prototype.disconnect = function (this: AudioNode, ...args: DisconnectArgs) {
    disconnect.apply(this, args);
    disconnected.add(this);
  } as typeof AudioNode.prototype.disconnect;
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    start.apply(this, args);
    if (sources.length >= limit) {
      overflow = true;
      return;
    }
    const audio = window.fnt?.app.audio as unknown as AudioInternals | undefined;
    const url = [...(audio?.buffers ?? [])].find(([, buffer]) => buffer === this.buffer)?.[0];
    sources.push({ source: this, at: args[0] ?? 0, url: url ?? null });
  };
  const record = (param: AudioParam, kind: ParamCall['kind'], at: number, value: number | null) => {
    const owner = params.get(param);
    if (!owner) return;
    if (calls.length >= limit) {
      overflow = true;
      return;
    }
    calls.push({ id: owner.id, kind, calledAt: owner.context.currentTime, at, value });
  };
  const set = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (value, at) {
    const result = set.call(this, value, at);
    record(this, 'set', at, value);
    return result;
  };
  const linear = AudioParam.prototype.linearRampToValueAtTime;
  AudioParam.prototype.linearRampToValueAtTime = function (value, at) {
    const result = linear.call(this, value, at);
    record(this, 'linear', at, value);
    return result;
  };
  const cancel = AudioParam.prototype.cancelScheduledValues;
  AudioParam.prototype.cancelScheduledValues = function (at) {
    const result = cancel.call(this, at);
    record(this, 'cancel', at, null);
    return result;
  };
  const path = (node: AudioNode, seen = new Set<AudioNode>()): GainReading[] => {
    if (seen.has(node)) throw new Error('Loop in the one-shot audio graph');
    if (disconnected.has(node)) throw new Error('Retained one-shot output was disconnected');
    seen.add(node);
    if (node instanceof AudioDestinationNode) return [];
    const next = edges.get(node);
    if (next?.length !== 1 || !next[0]) throw new Error('Expected one connected output path');
    const own = node instanceof GainNode ? [{ id: gains.get(node)!, value: node.gain.value }] : [];
    return [...own, ...path(next[0], seen)];
  };
  window.queuedVolumeProbe = {
    sources,
    calls,
    path,
    first: 0,
    pending: [],
    context: null,
    get overflow() {
      return overflow;
    },
  };
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer}: Quiet and Loud update the same queued footsteps`, async ({ page }, info) => {
    allowSoftwareWebgl(test, renderer);
    const errors: string[] = [];
    const evidence: unknown[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(observeAudio);
    try {
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Explorer'], ['kaya'], 'queued-volume-415', { reduceMotion: false });
      await enterNode(page, 'village_explore');
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
      expect(await page.evaluate(() => window.fnt?.app.settings.volume)).toBe(0.7);
      const box = await page.locator('.map-canvas').boundingBox();
      const zoom = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
      if (!box || !zoom) throw new Error('Missing rendered village/camera');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, Math.log(zoom / 64) / 0.002);
      await settleLayout(page);
      const walk = async (x: number) => {
        const point = await paintedTileCentre(page, { x, y: 7 });
        if (!point) throw new Error('Missing painted walk target');
        await page.mouse.click(point.x, point.y);
        await expect
          .poll(() => page.evaluate(() => window.fnt?.app.state?.location?.pos))
          .toEqual({
            x,
            y: 7,
          });
        await waitForIdle(page);
        await settleLayout(page);
      };
      // Decode both native step variants through actual walks before measuring.
      await walk(9);
      await walk(3);
      await page.evaluate(() => {
        window.queuedVolumeProbe.first = window.queuedVolumeProbe.sources.length;
      });
      const target = await paintedTileCentre(page, { x: 9, y: 7 });
      if (!target) throw new Error('Missing long-walk target');
      await page.mouse.click(target.x, target.y);

      // Activating real DOM controls synchronously avoids spending a queued cue's
      // deadline on automation round trips on a software WebGL renderer. The
      // browser clock and the game's motion remain unmodified throughout.
      const changes = await page.evaluate(async () => {
        const app = window.fnt?.app;
        if (!app) throw new Error('Missing App');
        const probe = window.queuedVolumeProbe;
        const audio = app.audio as unknown as AudioInternals;
        const context = audio.ctx;
        if (!context) throw new Error('No unlocked audio context');
        probe.context = context;
        const click = (text: string) => {
          const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
            (node) => node.textContent?.trim() === text,
          );
          if (!button || button.disabled) throw new Error(`Missing enabled ${text} control`);
          button.click();
        };
        click('Pause');
        click('Settings');
        probe.pending = probe.sources
          .slice(probe.first)
          .filter(
            (row) => row.url?.startsWith('audio/step-') && row.at > context.currentTime + 0.5,
          );
        if (!probe.pending.length) throw new Error('No future decoded footstep to measure');
        const snapshot = () =>
          probe.pending.map((row) => ({ at: row.at, url: row.url, gains: probe.path(row.source) }));
        const results = [];
        for (const [label, volume] of [
          ['Quiet', 0.35],
          ['Loud', 1],
        ] as const) {
          const radio = [
            ...document.querySelectorAll<HTMLButtonElement>(
              '[role="radiogroup"][aria-label="Sound"] [role="radio"]',
            ),
          ].find((node) => node.textContent?.trim() === label);
          if (!radio) throw new Error(`Missing ${label} sound control`);
          // Software rendering may consume the first deadline while the Quiet
          // control refreshes. Measure Loud only on retained sources still ahead
          // of the audio clock; never pass a past requested endTime as proof.
          probe.pending = probe.pending.filter((row) => row.at > context.currentTime + 0.2);
          if (!probe.pending.length) throw new Error(`No old future footstep remains for ${label}`);
          const before = snapshot();
          const state = JSON.stringify(app.state);
          const firstCall = probe.calls.length;
          const at = context.currentTime;
          radio.click();
          await new Promise<void>((resolve) => setTimeout(resolve, 45));
          results.push({
            label,
            volume,
            selected: app.settings.volume,
            checked: document
              .querySelector('[role="radiogroup"][aria-label="Sound"] [aria-checked="true"]')
              ?.textContent?.trim(),
            at,
            afterAt: context.currentTime,
            before,
            after: snapshot(),
            calls: probe.calls.slice(firstCall),
            stateUnchanged: JSON.stringify(app.state) === state,
            sameContext: audio.ctx === context && context.state === 'running',
          });
        }
        return results;
      });
      evidence.push({ changes });
      for (const [index, change] of changes.entries()) {
        expect(change.selected).toBe(change.volume);
        expect(change.checked).toBe(change.label);
        expect(change.stateUnchanged).toBe(true);
        expect(change.sameContext).toBe(true);
        expect(change.afterAt).toBeGreaterThanOrEqual(change.at + 0.032);
        for (const [i, before] of change.before.entries()) {
          const after = change.after[i]!;
          expect(after.at).toBe(before.at);
          expect(after.gains.map((gain) => gain.id)).toEqual(before.gains.map((gain) => gain.id));
          const product = (gains: GainReading[]) =>
            gains.reduce((value, gain) => value * gain.value, 1);
          const from = index === 0 ? 0.7 : 0.35;
          expect
            .soft(product(before.gains), 'intrinsic step × setting × fixed master')
            .toBeCloseTo(0.45 * from * 0.6, 6);
          expect
            .soft(product(after.gains), `${change.label} must reach an OLD queued source`)
            .toBeCloseTo(0.45 * change.volume * 0.6, 6);
          const ramps = change.calls.filter(
            (call) =>
              call.kind === 'linear' &&
              after.gains.some((gain) => gain.id === call.id) &&
              call.value === change.volume &&
              call.calledAt >= change.at &&
              Math.max(call.at, call.calledAt) <= change.at + 0.05 &&
              Math.max(call.at, call.calledAt) < before.at,
          );
          expect
            .soft(ramps, 'native transition on the retained source path before its deadline')
            .toHaveLength(1);
          expect(after.gains.at(-1)?.value, 'master remains fixed').toBeCloseTo(0.6, 6);
        }
      }
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await waitForIdle(page);
      await settleLayout(page);
      await page.evaluate(() => {
        window.queuedVolumeProbe.first = window.queuedVolumeProbe.sources.length;
      });
      await walk(3);
      const fresh = await page.evaluate(() => {
        const probe = window.queuedVolumeProbe;
        return probe.sources
          .slice(probe.first)
          .filter((row) => row.url?.startsWith('audio/step-'))
          .map((row) => ({ at: row.at, url: row.url, gains: probe.path(row.source) }));
      });
      evidence.push({ fresh });
      expect(fresh.length, 'fresh actual walk remains audible-capable').toBeGreaterThan(0);
      for (const row of fresh)
        expect(row.gains.reduce((product, gain) => product * gain.value, 1)).toBeCloseTo(
          0.45 * 0.6,
          6,
        );
      const off = await page.evaluate(async () => {
        const app = window.fnt!.app;
        const audio = app.audio as unknown as AudioInternals;
        const old = audio.ctx;
        const click = (text: string) => {
          const node = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
            (button) => button.textContent?.trim() === text,
          );
          if (!node) throw new Error(`Missing ${text}`);
          node.click();
        };
        click('Pause');
        click('Settings');
        click('Off');
        await new Promise<void>((resolve) => setTimeout(resolve, 60));
        return { volume: app.settings.volume, retired: audio.ctx === null, state: old?.state };
      });
      evidence.push({ off });
      expect(off).toEqual({ volume: 0, retired: true, state: 'closed' });
      expect(await page.evaluate(() => window.queuedVolumeProbe.overflow)).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      const live = await page
        .evaluate(() => {
          const probe = window.queuedVolumeProbe;
          if (!probe) return null;
          const snapshot = (row: QueuedSource) => {
            try {
              return { at: row.at, url: row.url, gains: probe.path(row.source) };
            } catch (error) {
              return { at: row.at, url: row.url, error: String(error) };
            }
          };
          return {
            calls: probe.calls,
            sources: probe.sources.map(snapshot),
            pending: probe.pending.map(snapshot),
            overflow: probe.overflow,
          };
        })
        .catch((error: unknown) => ({ observerReadError: String(error) }));
      evidence.push({ live });
      await info.attach('queued-volume-native-graph', {
        body: JSON.stringify({
          protocol:
            'API new-game/debug village entry; actual mouse walks; synchronous DOM Settings controls; normal audio/game clocks. Forwarding native connection/source/parameter observers. Graph scheduling evidence, no listening or physical-device claim.',
          renderer,
          evidence,
          errors,
        }),
        contentType: 'application/json',
      });
      await info.attach('queued-volume-renderer', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
  });
}
