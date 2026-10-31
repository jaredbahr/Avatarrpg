/**
 * Local #368 review of the running production game, not a gallery recipe stage.
 * Startup skips setup/story; travel to Mira's table and every phase change use UI.
 * The local probe observes the real renderer input and always forwards it unchanged.
 * PNG sequences capture real elapsed time; frame timestamps are in provenance.json.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import type { DayPhase, Vec2 } from '../src/core/types';
import type { Renderer } from '../src/render/renderer';
import type { EmitterInstance, MapView } from '../src/render/view';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

type Kind = 'flow' | 'waterLeaf' | 'steam' | 'lantern';
type Mark = Pick<EmitterInstance, 'from' | 'to' | 'elapsed' | 'seed' | 'still'> & { kind: Kind };
interface Frame {
  time: number;
  phase: DayPhase;
  reduced: boolean;
  marks: Mark[];
}
interface Probe {
  latest: Frame | null;
  seen: Partial<Record<Kind, boolean>>;
  first: Partial<Record<Kind, string>>;
  changed: Partial<Record<Kind, boolean>>;
  violations: string[];
  frames: number;
}
type ReviewWindow = Window & { ambienceReview: Probe };
/** No production API/hook is added for this review. */
type ReviewApp = { scene: { renderer: Renderer; firstFrameReady(): Promise<unknown> } };

async function installProbe(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = window.fnt!.app;
    const scene = (app as unknown as ReviewApp).scene;
    await scene.firstFrameReady();
    const probe: Probe = {
      latest: null,
      seen: {},
      first: {},
      changed: {},
      violations: [],
      frames: 0,
    };
    (window as unknown as ReviewWindow).ambienceReview = probe;
    const draw = scene.renderer.draw.bind(scene.renderer);
    // These signatures distinguish the four new stamps from the old drifting
    // canopy leaves, smoke glow and two-stroke ripples without importing source
    // modules into the browser or synthesising an emitter.
    const kindOf = ({ def }: EmitterInstance): Kind | null => {
      if (def.kind === 'strokes')
        return def.shape === 'glint' && def.count === 1 && def.width === 1 / 64 ? 'flow' : null;
      if (def.shape !== 'projectile') return null;
      if (def.cell === 'leaf') return 'waterLeaf';
      if (def.cell === 'puff') return 'steam';
      if (def.cell === 'disc') return 'lantern';
      return null;
    };
    scene.renderer.draw = (view: MapView): void => {
      draw(view);
      const marks: Mark[] = [];
      const violation = (message: string): void => {
        if (!probe.violations.includes(message)) probe.violations.push(message);
      };
      for (const emitter of view.emitters) {
        const kind = kindOf(emitter);
        if (!kind) continue;
        const { from, to, elapsed, seed, still } = emitter;
        marks.push({ kind, from, to, elapsed, seed, ...(still ? { still } : {}) });
        probe.seen[kind] = true;
        if (kind === 'flow' || kind === 'waterLeaf') {
          for (const point of [from, to]) {
            const x = Math.floor(point.x),
              y = Math.floor(point.y);
            const tile = view.grid.tiles[y * view.grid.width + x];
            if (
              x < 0 ||
              y < 0 ||
              x >= view.grid.width ||
              y >= view.grid.height ||
              tile?.surface?.id !== 'water' ||
              tile.surface.duration >= 0
            )
              violation(`${kind} leaves permanent canal water or crosses the bridge`);
          }
          if (view.reducedMotion) violation(`${kind} present under reduced motion`);
        }
        if (kind === 'lantern' && !['evening', 'night'].includes(app.state!.world.clock.phase))
          violation('lantern present in daylight');
        if (view.reducedMotion && !still) violation(`${kind} is not marked still`);
        for (const point of [from, to]) {
          const px = (point.x - point.y) * 64,
            py = (point.x + point.y) * 32;
          if (Math.abs(px - Math.round(px)) > 1e-6 || Math.abs(py - Math.round(py)) > 1e-6)
            violation(`${kind} centre is off the world pixel grid`);
        }
      }
      for (const kind of ['flow', 'waterLeaf', 'steam', 'lantern'] as const) {
        const group = marks.filter((mark) => mark.kind === kind);
        if (!group.length) continue;
        const signature = JSON.stringify(group);
        if (!probe.first[kind]) probe.first[kind] = signature;
        else if (probe.first[kind] !== signature) probe.changed[kind] = true;
      }
      probe.frames += 1;
      probe.latest = {
        time: view.time,
        phase: app.state!.world.clock.phase,
        reduced: Boolean(view.reducedMotion),
        marks,
      };
    };
  });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as ReviewWindow).ambienceReview.frames))
    .toBeGreaterThan(1);
}

const read = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as ReviewWindow).ambienceReview);
const ofKind = (frame: Frame | null, kind: Kind): Mark[] =>
  frame?.marks.filter((mark) => mark.kind === kind) ?? [];

async function waitUntil(page: Page, phase: string): Promise<void> {
  await page.locator('.action-button').filter({ hasText: "Mira's table" }).click();
  const dialog = page.getByRole('dialog', { name: 'Wait until…', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.locator('.choice-option').filter({ hasText: phase }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.explore-phase')).toHaveText(phase);
  await expect.poll(async () => (await read(page)).latest?.phase).toBe(phase.toLowerCase());
}

/** Camera-only fixture: the game still owns the scene, clock and every draw. */
async function frameAt(page: Page, centre: Vec2): Promise<void> {
  await page.evaluate((centre) => {
    const camera = (window.fnt!.app as unknown as ReviewApp).scene.renderer.camera;
    camera.zoomAt(
      { x: camera.viewport.width / 2, y: camera.viewport.height / 2 },
      1 / camera.scale,
    );
    camera.centreOn(centre);
  }, centre);
  await settleLayout(page);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
  expect(await page.evaluate(() => window.fnt!.app.rendererCamera()?.tilePx)).toBe(64);
}

async function sequence(page: Page, info: TestInfo, name: string): Promise<unknown[]> {
  const directory = info.outputPath(name);
  mkdirSync(directory, { recursive: true });
  const frames = [];
  // Six actual game frames, at least 250 ms apart: ffmpeg -framerate 4 -i
  // frame-%02d.png -c:v libx264 -pix_fmt yuv420p sequence.mp4
  for (let index = 0; index < 6; index++) {
    if (index) await page.waitForTimeout(250);
    const path = `${directory}/frame-${String(index).padStart(2, '0')}.png`;
    await page.screenshot({ path });
    frames.push({
      file: path,
      frame: (await read(page)).latest,
      camera: await page.evaluate(() => window.fnt!.app.rendererCamera()),
    });
  }
  return frames;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test.describe.serial(`${renderer}: village life at zoom 1`, () => {
    let context: BrowserContext | undefined;
    let page: Page;
    let browserVersion = '';
    let setupStatus = 'not-run';
    let revision = '';
    let trackedChanges = '';
    let build = '';
    const errors: string[] = [];
    const sequences: Record<string, unknown[]> = {};
    const phases: Record<string, string> = {
      'midday and west live sequence': 'not-run',
      'evening and lantern live sequence': 'not-run',
      'reduced-motion stability and both sequences': 'not-run',
      'night and morning gating': 'not-run',
    };

    async function provenance(info: TestInfo, milestone: string): Promise<void> {
      const path = info.outputPath(`${milestone}-provenance.json`);
      mkdirSync(info.outputDir, { recursive: true });
      writeFileSync(
        path,
        JSON.stringify(
          {
            issue: 368,
            revision,
            build,
            trackedChanges,
            renderer,
            browser: browserVersion,
            node: process.version,
            viewport: page?.viewportSize() ?? null,
            errors,
            sequences,
            setupStatus,
            phases,
            complete:
              setupStatus === 'passed' &&
              Object.values(phases).every((status) => status === 'passed'),
            probe: page ? await read(page).catch(() => null) : null,
            setup:
              'One native Chromium context per backend, 1368x912, DPR1, touch. Seeded startup/enterNode skip unrelated setup; real Look around/table walk/Wait UI. Camera-only fixture centres at integer zoom 1. Probe forwards the real MapView unchanged. PNGs capture the running game.',
            open: 'Physical iPad/Surface checks, WebKit coverage and owner aesthetic acceptance remain open.',
          },
          null,
          2,
        ) + '\n',
      );
      await info.attach(`${milestone}-runtime-provenance`, {
        path,
        contentType: 'application/json',
      });
    }

    test.beforeAll(async ({ browser }, info) => {
      setupStatus = 'running';
      browserVersion = browser.version();
      revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      trackedChanges = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
        encoding: 'utf8',
      }).trim();
      build = revision.slice(0, 7) + (trackedChanges ? '-modified' : '');
      try {
        context = await browser.newContext({
          baseURL: info.project.use.baseURL,
          viewport: { width: 1368, height: 912 },
          deviceScaleFactor: 1,
          hasTouch: true,
          isMobile: false,
        });
        await context.tracing.start({ screenshots: false, snapshots: true, sources: true });
        page = await context.newPage();
        page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(`console: ${message.text()}`);
        });
        await resetStorage(page, `?renderer=${renderer}`);
        await expect(page.locator('[aria-label^="Game version"]')).toHaveText(
          new RegExp(`build ${build}$`),
        );
        await startGame(page, ['Review'], ['kaya'], 'village-ambience-368', {
          reduceMotion: false,
        });
        await enterNode(page, 'village_explore');
        await waitForIdle(page);
        await settleLayout(page);
        expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
        await installProbe(page);
        setupStatus = 'passed';
      } catch (error) {
        setupStatus = 'failed';
        throw error;
      } finally {
        await provenance(info, 'setup');
      }
    });

    test.afterEach(async () => {
      const info = test.info();
      phases[info.title] = info.status ?? 'unknown';
      await provenance(info, 'phase');
    });

    test.afterAll(async () => {
      const info = test.info();
      try {
        await provenance(info, 'final');
        if (context) {
          const path = info.outputPath(`${renderer}-shared-context-trace.zip`);
          await context.tracing.stop({ path });
          await info.attach('shared-context-trace', { path, contentType: 'application/zip' });
        }
      } finally {
        await context?.close();
      }
    });

    test('midday and west live sequence', async () => {
      const info = test.info();
      await expect(page.locator('.explore-phase')).toHaveText('Midday');
      expect(ofKind((await read(page)).latest, 'lantern')).toEqual([]);
      await page.getByRole('button', { name: /^Look around/ }).click();
      await page.getByRole('button', { name: "Mira's table · Sit and wait", exact: true }).click();
      await waitForIdle(page);
      expect(await page.evaluate(() => window.fnt!.app.state!.location.pos)).toEqual({
        x: 10,
        y: 5,
      });
      // Observe the sparse twelve-second flow cycle without forcing its clock.
      await expect.poll(async () => (await read(page)).seen.flow, { timeout: 15_000 }).toBe(true);
      for (const kind of ['waterLeaf', 'steam'] as const)
        expect((await read(page)).seen[kind], `${kind} reached ${renderer}`).toBe(true);
      await frameAt(page, { x: 5, y: 7 });
      sequences['west-live'] = await sequence(page, info, 'west-live');
      expect((await read(page)).violations).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('evening and lantern live sequence', async () => {
      const info = test.info();
      await waitUntil(page, 'Evening');
      await expect.poll(async () => ofKind((await read(page)).latest, 'lantern').length).toBe(3);
      await frameAt(page, { x: 18, y: 7 });
      sequences['lanterns-live'] = await sequence(page, info, 'lanterns-live');
      for (const kind of ['flow', 'steam', 'waterLeaf', 'lantern'] as const)
        expect((await read(page)).changed[kind], `${kind} changes with the live clock`).toBe(true);
      expect((await read(page)).violations).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('reduced-motion stability and both sequences', async () => {
      const info = test.info();
      await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true }));
      await expect.poll(async () => (await read(page)).latest?.reduced).toBe(true);
      const frozen = (await read(page)).latest;
      expect(ofKind(frozen, 'steam')).toHaveLength(2);
      expect(ofKind(frozen, 'lantern')).toHaveLength(3);
      expect(ofKind(frozen, 'flow')).toEqual([]);
      expect(ofKind(frozen, 'waterLeaf')).toEqual([]);
      expect(frozen!.marks.every((mark) => mark.still)).toBe(true);
      await frameAt(page, { x: 18, y: 7 });
      sequences['lanterns-reduced'] = await sequence(page, info, 'lanterns-reduced');
      await frameAt(page, { x: 5, y: 7 });
      sequences['west-reduced'] = await sequence(page, info, 'west-reduced');
      const held = (await read(page)).latest;
      expect(held!.time - frozen!.time).toBeGreaterThan(1000);
      expect(held!.marks).toEqual(frozen!.marks);
      expect((await read(page)).violations).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('night and morning gating', async () => {
      const info = test.info();
      await waitUntil(page, 'Night');
      expect(ofKind((await read(page)).latest, 'lantern')).toHaveLength(3);
      await frameAt(page, { x: 18, y: 7 });
      await page.screenshot({ path: info.outputPath('night-reduced.png') });
      await waitUntil(page, 'Morning');
      await expect.poll(async () => ofKind((await read(page)).latest, 'lantern').length).toBe(0);
      await page.screenshot({ path: info.outputPath('morning-reduced.png') });
      expect((await read(page)).violations).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
