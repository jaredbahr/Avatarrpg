/**
 * The long-session soak (#525): a forty-hour game played in long sittings on one iPad must not
 * degrade or run out of memory, and nobody can attach a debugger to the tablet to find out why it
 * did. So the session is played here, in a loop, and everything with a lifetime is counted after
 * each cycle (`e2e/soak/probe.ts`), with the garbage collector forced first.
 *
 * One cycle is a whole sitting in miniature (`e2e/soak/route.ts`): title, new game, every map of
 * the demo route, every fight with a loss and a retry, the ending, back to the title, the
 * riverside preview, a saved fight loaded and quit to the title.
 *
 * A leak is a positive slope per cycle, not a big number, so each series is fitted with a line
 * over the cycles after the warm-up (`scripts/long-session/trend.ts`) and fails on growth beyond
 * its allowance. Counts that must come back exactly (listeners on the window and document,
 * observers, intervals, WebGL contexts) have no allowance at all.
 *
 * Runs on both backends (`playwright.soak.config.ts`), from the production build:
 *
 *   npm run soak:browser                      # both backends, FNT_SOAK_CYCLES cycles (default 12)
 *   npm run soak:browser -- --project canvas  # one backend
 *
 * FNT_SOAK_CYCLES sets the number of cycles, FNT_SOAK_MOTION=on plays every walk and cast in real
 * time (several times slower), FNT_SOAK_SWEEP sets how many pointer positions each sweep of the
 * board takes (28; fewer shortens a software-WebGL run), and FNT_SOAK_STACKS=1 records where each surviving canvas and
 * listener was created (useful against `npm run dev`, where the frames are readable). The samples
 * and verdicts are written to `.shots/soak/<project>.json` (or under FNT_SOAK_OUT).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { judgeTrend, type Allowance, type Verdict } from '../scripts/long-session/trend';
import { resetStorage } from './helpers';
import { installProbe, type ProbeSample } from './soak/probe';
import { newGameFromTitle, playRoute, titleLoadAndQuit, type RouteOptions } from './soak/route';

const CYCLES = Number(process.env.FNT_SOAK_CYCLES ?? 12);
const SWEEP = process.env.FNT_SOAK_SWEEP ? Number(process.env.FNT_SOAK_SWEEP) : undefined;
const WARMUP = Number(process.env.FNT_SOAK_WARMUP ?? 2);
const MOTION = process.env.FNT_SOAK_MOTION === 'on';
const STACKS = process.env.FNT_SOAK_STACKS === '1';

interface Sample extends ProbeSample {
  readonly cycle: number;
  readonly seconds: number;
  readonly heapUsed: number;
  readonly cdpNodes: number;
  readonly cdpListeners: number;
  readonly cdpDocuments: number;
  readonly caches: Readonly<Record<string, number>>;
}

/** Growth over the fitted cycles that is still noise. Zero means the count must come back exactly. */
/**
 * What the page may hold at its worst, uncollected garbage included, at this viewport (an iPad
 * in landscape at DPR 2). These are the measured peaks with room to spare, not the sum of every
 * cache's cap (ADR 0112 gives both); they fail a change that goes back to leaving canvases for
 * the collector, which measured 23 to 40 megapixels here before the owners released them.
 */
const PEAK_CANVAS_MEGAPIXELS = Number(process.env.FNT_SOAK_PEAK_MP ?? 20);
/** One renderer at a time, and one more for the instant a scene replaces another. */
const PEAK_GL_CONTEXTS = 2;

const ALLOWANCES: Readonly<Record<string, Allowance>> = {
  heapUsed: { absolute: 2_000_000, relative: 0.1 },
  cdpNodes: { absolute: 200, relative: 0.05 },
  cdpListeners: { absolute: 40, relative: 0.05 },
  domNodes: { absolute: 0 },
  canvases: { absolute: 2 },
  canvasAreaWithContext: { absolute: 0, relative: 0.02 },
  peakCanvasArea: { absolute: 0, relative: 0.1 },
  glContextsLive: { absolute: 0 },
  glTextures: { absolute: 0 },
  glTextureBytes: { absolute: 0 },
  glFramebuffers: { absolute: 0 },
  glBuffers: { absolute: 0 },
  glPrograms: { absolute: 0 },
  globalListeners: { absolute: 0 },
  resizeObservers: { absolute: 0 },
  mutationObservers: { absolute: 0 },
  intersectionObservers: { absolute: 0 },
  intervals: { absolute: 0 },
  timeouts: { absolute: 1 },
  animationFrames: { absolute: 1 },
  images: { absolute: 2 },
  imageArea: { absolute: 0, relative: 0.02 },
  audioElements: { absolute: 0 },
  audioContexts: { absolute: 0 },
  audioBuffers: { absolute: 0 },
  audioBufferBytes: { absolute: 0 },
};

/** The mid-game series: a live scene's counts wobble with where its caches happen to be. */
const MID_GAME_ALLOWANCES: Readonly<Record<string, Allowance>> = {
  heapUsed: { absolute: 3_000_000, relative: 0.1 },
  cdpNodes: { absolute: 200, relative: 0.1 },
  canvases: { absolute: 8, relative: 0.1 },
  canvasAreaWithContext: { absolute: 500_000, relative: 0.1 },
  glContextsLive: { absolute: 0 },
  glTextures: { absolute: 8, relative: 0.1 },
  glTextureBytes: { absolute: 4_000_000, relative: 0.1 },
  globalListeners: { absolute: 0 },
  resizeObservers: { absolute: 0 },
  intervals: { absolute: 0 },
  images: { absolute: 2 },
  imageArea: { absolute: 0, relative: 0.02 },
  audioContexts: { absolute: 0 },
  audioBuffers: { absolute: 2, relative: 0.1 },
  audioBufferBytes: { absolute: 500_000, relative: 0.1 },
};

async function collect(
  cdp: CDPSession,
  page: Page,
  cycle: number,
  t0: number,
  resetPeak = true,
): Promise<Sample> {
  // Twice, with a turn of the event loop between: the first pass clears what the second's
  // finalisers then let go (a canvas held only by a collected texture, say).
  for (let pass = 0; pass < 3; pass++) {
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(120);
  }
  const probe = await page.evaluate(() => {
    const soak = window.__soak;
    if (!soak) throw new Error('The soak probe is not installed');
    return soak.sample();
  });
  const caches = await page.evaluate(() => window.fnt?.caches() ?? {});
  const { metrics } = await cdp.send('Performance.getMetrics');
  const metric = (name: string): number => metrics.find((row) => row.name === name)?.value ?? 0;
  // The peak runs from one title to the next, so a sample taken mid-game leaves it running.
  if (resetPeak) await page.evaluate(() => window.__soak?.resetPeak());
  return {
    ...probe,
    cycle,
    seconds: Math.round((Date.now() - t0) / 1000),
    heapUsed: metric('JSHeapUsedSize'),
    cdpNodes: metric('Nodes'),
    cdpListeners: metric('JSEventListeners'),
    cdpDocuments: metric('Documents'),
    caches,
  };
}

function megapixels(area: number): string {
  return `${(area / 1e6).toFixed(2)} MP`;
}

test('a long session neither leaks nor outgrows its bounds', async ({ page }, info) => {
  test.setTimeout(CYCLES * (MOTION ? 900_000 : 240_000) + 120_000);
  const renderer = String(info.project.metadata.renderer ?? 'canvas');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // A failed request is reported below with its address; the console line carries none.
    if (message.type() === 'error' && !/Failed to load resource/i.test(message.text()))
      errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    // A scene change drops the track it was streaming; that abort is the player's own doing.
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    errors.push(`${request.failure()?.errorText ?? 'failed'} ${request.url()}`);
  });

  await page.addInitScript(installProbe, { stacks: STACKS });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');
  await resetStorage(page, `?renderer=${renderer}`);

  const options: RouteOptions = {
    reduceMotion: !MOTION,
    turnsPerFight: 3,
    ...(SWEEP === undefined ? {} : { sweepSteps: SWEEP }),
    ...(process.env.FNT_SOAK_TRACE === '1' ? { log: (line: string) => console.log(line) } : {}),
  };
  const t0 = Date.now();
  const samples: Sample[] = [];
  /** One a cycle on the quarry floor after the last fight, before any quit has released anything. */
  const midGame: Sample[] = [];
  const folder = process.env.FNT_SOAK_OUT ?? '.shots/soak';
  mkdirSync(folder, { recursive: true });
  const write = (verdicts: readonly Verdict[] = []): void =>
    writeFileSync(
      `${folder}/${info.project.name}.json`,
      JSON.stringify(
        {
          project: info.project.name,
          renderer,
          cycles: CYCLES,
          warmup: WARMUP,
          motion: MOTION,
          viewport: page.viewportSize(),
          dpr: info.project.use.deviceScaleFactor ?? 1,
          errors,
          verdicts,
          samples,
          midGame,
        },
        null,
        2,
      ),
    );

  samples.push(await collect(cdp, page, 0, t0));
  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    await newGameFromTitle(page, options);
    await playRoute(page, {
      ...options,
      midGame: async () => {
        expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
        midGame.push(await collect(cdp, page, cycle, t0, false));
      },
    });
    await titleLoadAndQuit(page, options);
    const sample = await collect(cdp, page, cycle, t0);
    samples.push(sample);
    write();
    console.log(
      `[${info.project.name}] cycle ${cycle}/${CYCLES} at ${sample.seconds}s: ` +
        `heap ${(sample.heapUsed / 1e6).toFixed(1)} MB, ` +
        `canvases ${sample.canvasesWithContext} = ${megapixels(sample.canvasAreaWithContext)} ` +
        `(peak ${megapixels(sample.peakCanvasArea)}), ` +
        `gl ${sample.glContextsLive} ctx / ${sample.glTextures} tex ` +
        `(peak ${sample.peakGlTextures} tex, ${(sample.peakGlTextureBytes / 1e6).toFixed(1)} MB), ` +
        `listeners ${sample.globalListeners}, nodes ${sample.cdpNodes}, ` +
        `images ${sample.images}, timers ${sample.intervals}i/${sample.timeouts}t/${sample.animationFrames}f`,
    );
  }

  // Cycle 0 is the cold title; the fit starts once every lazy cache has had its first fill.
  const measured = samples.slice(1);
  const verdicts: Verdict[] = [];
  for (const [name, allowance] of Object.entries(ALLOWANCES)) {
    const values = measured.map((sample) => sample[name as keyof Sample] as number);
    verdicts.push(judgeTrend(name, values, WARMUP, allowance));
  }
  for (const name of Object.keys(measured[0]?.caches ?? {})) {
    const values = measured.map((sample) => sample.caches[name] ?? 0);
    verdicts.push(judgeTrend(`cache.${name}`, values, WARMUP, { absolute: 0 }));
  }
  // The same point of every game, so what a mounted scene and a running campaign hold is
  // compared like with like: caches a quit empties cannot hide here.
  expect(midGame, 'one mid-game sample per cycle').toHaveLength(CYCLES);
  for (const [name, allowance] of Object.entries(MID_GAME_ALLOWANCES)) {
    const values = midGame.map((sample) => sample[name as keyof Sample] as number);
    verdicts.push(judgeTrend(`mid.${name}`, values, WARMUP, allowance));
  }
  for (const name of Object.keys(midGame[0]?.caches ?? {})) {
    const values = midGame.map((sample) => sample.caches[name] ?? 0);
    verdicts.push(judgeTrend(`mid.cache.${name}`, values, WARMUP, { absolute: 0, relative: 0.1 }));
  }
  write(verdicts);

  console.log(`\n[${info.project.name}] trend over cycles ${WARMUP + 1}..${CYCLES}`);
  for (const verdict of verdicts) {
    const { trend } = verdict;
    console.log(
      `  ${verdict.leaking ? 'LEAK' : 'ok  '} ${verdict.name.padEnd(24)} ` +
        `slope ${trend.slope.toFixed(3).padStart(12)}/cycle  ` +
        `first ${String(Math.round(trend.first)).padStart(10)}  last ${String(Math.round(trend.last)).padStart(10)}  ` +
        `max ${String(Math.round(trend.max)).padStart(10)}`,
    );
  }

  const worst = (name: 'peakCanvasArea' | 'glContextsLive'): number =>
    Math.max(...measured.map((sample) => sample[name]));
  console.log(
    `\n[${info.project.name}] worst at any moment: ${megapixels(worst('peakCanvasArea'))} of canvas ` +
      `(${((worst('peakCanvasArea') * 4) / 2 ** 20).toFixed(0)} MiB), ` +
      `${Math.max(...measured.map((sample) => sample.peakGlTextures))} GL textures = ` +
      `${(Math.max(...measured.map((sample) => sample.peakGlTextureBytes)) / 2 ** 20).toFixed(0)} MiB`,
  );

  expect(errors, 'console and page errors over the session').toEqual([]);
  expect(
    worst('peakCanvasArea') / 1e6,
    'megapixels of canvas held at the worst moment, garbage included',
  ).toBeLessThanOrEqual(PEAK_CANVAS_MEGAPIXELS);
  expect(worst('glContextsLive'), 'WebGL contexts alive after a cycle').toBeLessThanOrEqual(
    PEAK_GL_CONTEXTS,
  );
  const leaks = verdicts.filter((verdict) => verdict.leaking);
  expect(
    leaks.map(
      (leak) =>
        `${leak.name}: +${leak.trend.slope.toFixed(3)} per cycle ` +
        `(${Math.round(leak.trend.first)} -> ${Math.round(leak.trend.last)})`,
    ),
    'series that grow with every cycle',
  ).toEqual([]);
});
