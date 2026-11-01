/** Native, uninterrupted #368 proof of the three painted chimney mouths. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page, Video } from '@playwright/test';
import { BA_DAN_CHIMNEYS } from '../src/content/scenes/baDan';
import type { Vec2 } from '../src/core/types';
import type { Renderer } from '../src/render/renderer';
import type { EmitterInstance, MapView } from '../src/render/view';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

type Mark = Pick<EmitterInstance, 'from' | 'to' | 'elapsed' | 'seed' | 'still'> & {
  def: { kind: 'particles'; shape: 'drift'; cell: 'glow'; color: 'smoke'; count: number };
};
interface Frame {
  time: number;
  reduced: boolean;
  sources: Vec2[];
  marks: Mark[];
}
interface Probe {
  frames: number;
  latest: Frame | null;
  firstLive: string[];
  changedLive: boolean[];
  violations: string[];
}
type ReviewWindow = Window & { chimneyReview: Probe };
type ReviewApp = { scene: { renderer: Renderer; firstFrameReady(): Promise<unknown> } };

const read = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as ReviewWindow).chimneyReview);

async function installProbe(page: Page): Promise<void> {
  await page.evaluate(async (expectedSources) => {
    const scene = (window.fnt!.app as unknown as ReviewApp).scene;
    await scene.firstFrameReady();
    const probe: Probe = {
      frames: 0,
      latest: null,
      firstLive: [],
      changedLive: [],
      violations: [],
    };
    (window as unknown as ReviewWindow).chimneyReview = probe;
    const draw = scene.renderer.draw.bind(scene.renderer);
    scene.renderer.draw = (view: MapView): void => {
      // Observe only after forwarding the exact real input. Never draw a synthetic frame.
      draw(view);
      const marks: Mark[] = [];
      for (const emitter of view.emitters) {
        const { def, from, to, elapsed, seed, still } = emitter;
        if (
          def.kind !== 'particles' ||
          def.shape !== 'drift' ||
          def.cell !== 'glow' ||
          def.color !== 'smoke' ||
          def.count !== 7
        )
          continue;
        marks.push({
          def: {
            kind: 'particles',
            shape: 'drift',
            cell: 'glow',
            color: 'smoke',
            count: def.count,
          },
          from: { ...from },
          to: { ...to },
          elapsed,
          seed,
          ...(still ? { still } : {}),
        });
      }
      const violation = (message: string): void => {
        if (!probe.violations.includes(message)) probe.violations.push(message);
      };
      const sources = (view.scene?.chimneys ?? []).map((point) => ({ ...point }));
      if (JSON.stringify(sources) !== JSON.stringify(expectedSources))
        violation('rendered chimney sources differ from current BA_DAN_CHIMNEYS');
      if (marks.length !== 6) violation(`expected six chimney loops, received ${marks.length}`);
      expectedSources.forEach((point, index) => {
        const group = marks.filter(
          (mark) =>
            mark.from.x === point.x &&
            mark.from.y === point.y &&
            mark.to.x === point.x &&
            mark.to.y === point.y,
        );
        if (group.length !== 2) violation(`chimney ${index} does not have exactly two loops`);
        if (!view.reducedMotion) {
          const signature = JSON.stringify(group);
          if (!probe.firstLive[index]) probe.firstLive[index] = signature;
          else if (probe.firstLive[index] !== signature) probe.changedLive[index] = true;
        }
      });
      if (view.reducedMotion && marks.some((mark) => !mark.still))
        violation('reduced-motion smoke is not marked still');
      if (!view.reducedMotion && marks.some((mark) => mark.still))
        violation('live smoke is marked still');
      probe.frames += 1;
      probe.latest = { time: view.time, reduced: Boolean(view.reducedMotion), sources, marks };
    };
  }, BA_DAN_CHIMNEYS);
  await expect.poll(async () => (await read(page)).frames).toBeGreaterThan(1);
}

async function framing(page: Page) {
  return page.evaluate((sources) => {
    const app = window.fnt!.app;
    const camera = (app as unknown as ReviewApp).scene.renderer.camera;
    const rect = document.querySelector('.map-canvas')!.getBoundingClientRect();
    return {
      camera: app.rendererCamera(),
      scale: camera.scale,
      viewport: { ...camera.viewport },
      canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      dpr: window.devicePixelRatio,
      sources: sources.map((point) => {
        const mouth = camera.project(point);
        return {
          point,
          // toScreen returns a sprite box. project gives the continuous source
          // mouth; at oblique projection it is (box.x + box.size/2, box.y).
          box: camera.toScreen(point),
          mouth,
          viewportMouth: { x: rect.x + mouth.x, y: rect.y + mouth.y },
        };
      }),
    };
  }, BA_DAN_CHIMNEYS);
}

async function preservedState(page: Page) {
  return page.evaluate(() => window.fnt!.app.state);
}

function assertSmoke(probe: Probe, reduced: boolean): void {
  expect(probe.violations).toEqual([]);
  expect(probe.latest?.sources).toEqual(BA_DAN_CHIMNEYS);
  expect(probe.latest?.reduced).toBe(reduced);
  expect(probe.latest?.marks).toHaveLength(6);
  for (const source of BA_DAN_CHIMNEYS) {
    const marks = probe.latest!.marks.filter(
      (mark) => mark.from.x === source.x && mark.from.y === source.y,
    );
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(mark.to).toEqual(source);
      expect(Boolean(mark.still)).toBe(reduced);
    }
  }
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer}: all three chimney mouths live and reduced at zoom 1`, async ({
    browser,
  }, info) => {
    allowSoftwareWebgl(test, renderer);
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    let video: Video | null = null;
    let videoPath: string | null = null;
    let revision = '';
    let tree = '';
    let dirty = '';
    let build = '';
    let actualRenderer: string | null = null;
    let milestone = 'source identity';
    let outcome = 'failed';
    let failure: string | null = null;
    const errors: string[] = [];
    const observations: Record<string, unknown> = {};
    let finalProbe: Probe | null = null;
    let initialState: unknown = null;
    let finalState: unknown = null;
    let finalFraming: Awaited<ReturnType<typeof framing>> | null = null;
    try {
      revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
      dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
      expect(dirty, 'native proof requires a clean exact source revision').toBe('');
      build = revision.slice(0, 7);
      expect(BA_DAN_CHIMNEYS).toEqual([
        { x: 11.25, y: -1.55 },
        { x: 5.375, y: 7.575 },
        { x: 13.078125, y: 9.734375 },
      ]);
      milestone = 'native startup';
      context = await browser.newContext({
        baseURL: info.project.use.baseURL,
        viewport: { width: 1368, height: 912 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: false,
        serviceWorkers: 'block',
        recordVideo: {
          dir: info.outputPath('continuous-video'),
          size: { width: 1368, height: 912 },
        },
      });
      // The runner owns the configured trace; do not start a second trace.
      page = await context.newPage();
      video = page.video();
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
      });
      await resetStorage(page, `?renderer=${renderer}`);
      await expect(page.locator('[aria-label^="Game version"]')).toHaveText(
        new RegExp(`build ${build}$`),
      );
      await startGame(page, ['Review'], ['kaya'], 'village-ambience-368', { reduceMotion: false });
      await enterNode(page, 'village_explore');
      await waitForIdle(page);
      await settleLayout(page);
      actualRenderer = await page.evaluate(() => window.fnt!.app.rendererBackend());
      expect(actualRenderer).toBe(renderer);
      initialState = await preservedState(page);
      await installProbe(page);

      milestone = 'simultaneous source framing';
      await page.evaluate(() => {
        const camera = (window.fnt!.app as unknown as ReviewApp).scene.renderer.camera;
        camera.zoomAt(
          { x: camera.viewport.width / 2, y: camera.viewport.height / 2 },
          1 / camera.scale,
        );
        camera.centreOn({ x: 11, y: 4 });
      });
      await settleLayout(page);
      finalFraming = await framing(page);
      expect(finalFraming.dpr).toBe(1);
      expect(finalFraming.scale).toBe(1);
      expect(finalFraming.camera?.tilePx).toBe(64);
      expect(finalFraming.camera?.projection).toBe('oblique');
      for (const { box, mouth } of finalFraming.sources) {
        expect(mouth.x).toBeCloseTo(box.x + box.size / 2, 6);
        expect(mouth.y).toBeCloseTo(box.y, 6);
        expect(mouth.x).toBeGreaterThanOrEqual(24);
        expect(mouth.x).toBeLessThanOrEqual(finalFraming.canvas.width - 24);
        expect(mouth.y).toBeGreaterThanOrEqual(60);
        expect(mouth.y).toBeLessThanOrEqual(finalFraming.canvas.height - 24);
      }

      milestone = 'eight-second live observation';
      const liveBefore = await read(page);
      const liveStartWall = Date.now();
      observations.live = { requestedMs: 8000, startWall: liveStartWall, before: liveBefore };
      await page.waitForTimeout(8000);
      const liveAfter = await read(page);
      observations.live = {
        requestedMs: 8000,
        wallMs: Date.now() - liveStartWall,
        before: liveBefore,
        after: liveAfter,
      };
      assertSmoke(liveBefore, false);
      assertSmoke(liveAfter, false);
      expect(liveAfter.frames).toBeGreaterThan(liveBefore.frames);
      expect(liveAfter.latest!.time - liveBefore.latest!.time).toBeGreaterThanOrEqual(7000);
      for (const index of [0, 1, 2]) expect(liveAfter.changedLive[index]).toBe(true);
      for (const source of BA_DAN_CHIMNEYS) {
        const group = (probe: Probe) =>
          probe.latest!.marks.filter(
            (mark) => mark.from.x === source.x && mark.from.y === source.y,
          );
        expect(group(liveAfter)).not.toEqual(group(liveBefore));
      }
      await page.screenshot({ path: info.outputPath('all-three-live.png') });

      milestone = 'six-second reduced-motion observation';
      await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true }));
      await expect.poll(async () => (await read(page!)).latest?.reduced).toBe(true);
      const frozenBefore = await read(page);
      const frozenStartWall = Date.now();
      observations.reduced = {
        requestedMs: 6000,
        startWall: frozenStartWall,
        before: frozenBefore,
      };
      await page.waitForTimeout(6000);
      const frozenAfter = await read(page);
      observations.reduced = {
        requestedMs: 6000,
        wallMs: Date.now() - frozenStartWall,
        before: frozenBefore,
        after: frozenAfter,
      };
      assertSmoke(frozenBefore, true);
      assertSmoke(frozenAfter, true);
      expect(frozenAfter.frames).toBeGreaterThan(frozenBefore.frames);
      expect(frozenAfter.latest!.time - frozenBefore.latest!.time).toBeGreaterThanOrEqual(5000);
      expect(frozenAfter.latest!.marks).toEqual(frozenBefore.latest!.marks);
      await page.screenshot({ path: info.outputPath('all-three-reduced.png') });
      finalState = await preservedState(page);
      expect(finalState).toEqual(initialState);
      expect(await framing(page)).toEqual(finalFraming);
      expect(errors).toEqual([]);
      outcome = 'passed';
      milestone = 'complete';
    } catch (error) {
      failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
      throw error;
    } finally {
      if (page && !page.isClosed()) {
        finalProbe = await read(page).catch(() => null);
        finalState = await preservedState(page).catch(() => null);
        finalFraming = await framing(page).catch(() => finalFraming);
      }
      try {
        await context?.close();
      } catch (error) {
        outcome = 'failed';
        failure = `${failure ?? ''}\nContext finalization: ${String(error)}`.trim();
      } finally {
        try {
          videoPath = (await video?.path()) ?? null;
        } catch (error) {
          outcome = 'failed';
          failure = `${failure ?? ''}\nVideo finalization: ${String(error)}`.trim();
        } finally {
          if (!videoPath || !existsSync(videoPath)) {
            outcome = 'failed';
            failure =
              `${failure ?? ''}\nNative video was not finalized to an existing file.`.trim();
          }
          const attachedTrace = info.attachments.find((attachment) => attachment.name === 'trace');
          const tracePath = attachedTrace?.path ?? info.outputPath('trace.zip');
          const path = info.outputPath('chimney-provenance.json');
          mkdirSync(info.outputDir, { recursive: true });
          writeFileSync(
            path,
            JSON.stringify(
              {
                issue: 368,
                revision,
                tree,
                dirty,
                build,
                renderer,
                actualRenderer,
                browser: { type: browser.browserType().name(), version: browser.version() },
                node: process.version,
                viewport: { width: 1368, height: 912 },
                expectedSources: BA_DAN_CHIMNEYS,
                framing: finalFraming,
                videoPath,
                trace: {
                  path: existsSync(tracePath) ? tracePath : null,
                  configured: info.project.use.trace,
                  manualStart: false,
                  note: 'Runner tracing finalizes after test teardown. Resolve any later failure trace from the final Playwright report; no absent trace is claimed here.',
                },
                outcome,
                actualTestStatusAtTeardown: info.status,
                milestone,
                failure,
                errors,
                observations,
                probe: finalProbe,
                preservation: { initial: initialState, final: finalState },
                method:
                  'Native continuous browser video covers startup, live smoke and Reduce motion. Only camera framing and settings change after seeded enterNode. Observer forwards every real MapView unchanged; no clock, position, HP, outcome, forced draw or reconstructed video.',
                limits:
                  'Installed browser Canvas/software WebGL only. No sustained60fps, physical-device, pinned WebKit or aesthetic acceptance claim.',
              },
              null,
              2,
            ) + '\n',
          );
          await info.attach('chimney-runtime-provenance', {
            path,
            contentType: 'application/json',
          });
        }
      }
      if (videoPath && existsSync(videoPath))
        await info.attach('continuous-native-video', {
          path: videoPath,
          contentType: 'video/webm',
        });
    }
    expect(outcome, failure ?? 'native capture completed').toBe('passed');
    expect(videoPath, 'native capture has a finalized video path').not.toBeNull();
    expect(existsSync(videoPath!), 'the finalized native video exists').toBe(true);
  });
}
