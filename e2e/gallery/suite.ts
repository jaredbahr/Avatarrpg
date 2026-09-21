import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test } from './fixtures';
import { BEATS, capturedOn } from './beats';
import type { Beat, BeatContext } from './beats';
import { pauseClock, waitForIdle } from '../helpers';
import { settleCurtain } from './stage';

/**
 * The gallery suite, shared by the slice spec files (`gallery-a.spec.ts` and
 * its siblings).
 *
 * Playwright shards by *file*, so one spec file is one shard: a single
 * `gallery.spec.ts` cannot be split, and 340 cases no longer fit one runner's
 * job budget (see the gallery jobs in `.github/workflows/ci.yml`). The beats
 * are therefore dealt into `GALLERY_SLICES` files round robin — a new beat
 * lands in exactly one of them, with no list here to keep in step — and CI
 * runs one slice per runner. Round robin rather than consecutive thirds
 * because the expensive filmstrip beats are authored in runs.
 *
 * The gallery: one still or filmstrip per beat, per project, written under
 * `gallery/<project>/` with a `shots.jsonl` beside them that
 * `scripts/gallery-index.mjs` turns into a page.
 *
 * It is a review artefact, not a test: nothing here asserts on pixels. What it
 * asserts is that every beat can still be staged, which is a useful canary on
 * its own. Determinism comes from the fixed seed and from Playwright's fake
 * clock, which lets a filmstrip sample the animator at exact milliseconds.
 */

export const GALLERY_DIR = 'gallery';

/** How many slice spec files the beat catalogue is dealt into. */
export const GALLERY_SLICES = 3;

/** This slice of the catalogue, in catalogue order. */
export function beatsInSlice(slice: number): readonly Beat[] {
  return BEATS.filter((_, index) => index % GALLERY_SLICES === slice);
}

/**
 * Filmstrips are captured at 1x on both backends; the 2x projects keep one
 * mid-playback still. Skip unsaved intermediate frames on the software
 * rasteriser: the renderer samples poses and effects from absolute time.
 */
const FILMSTRIP_PROJECTS = ['surface-canvas', 'surface-webgl'];

class Stage implements BeatContext {
  private shots = 0;
  /** True between `pauseAt` and `resume`, when nothing frame-driven can be awaited. */
  private paused = false;
  /**
   * A 2x WebGL frame on CI's software rasteriser can take over a second, and
   * `settleLayout` reads the camera three times two frames apart; on a slow
   * runner that outlasted its 10 s on eight beats while the parallel runner
   * passed. The same allowance `settleCurtain` has, for the same reason.
   *
   * 60 s, not 30: `09-rock-throw` spent the whole 30 s of run 35590666334 on
   * the first iPad-WebGL shard and never got four frames that agreed, while the
   * same beat passed on the pull-request run minutes earlier. This project
   * paints 2388x1668 pixels through a software rasteriser, so a contended
   * runner can plausibly stretch one frame past the 7.5 s that a four-frame
   * 30 s budget allows. `settleLayout` now reports the frame timings it saw, so
   * the next failure says whether this bound was still too tight or the camera
   * truly never settled.
   */
  readonly settleTimeout: number;

  constructor(
    readonly page: Page,
    readonly renderer: 'canvas' | 'webgl',
    readonly project: string,
    private readonly dir: string,
    private readonly beat: Beat,
  ) {
    this.settleTimeout = renderer === 'webgl' ? 60_000 : 10_000;
  }

  query(extra: Record<string, string> = {}): string {
    const params = new URLSearchParams();
    if (this.renderer === 'webgl') params.set('renderer', 'webgl');
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  async shoot(note: string, suffix?: string): Promise<void> {
    const file = suffix ? `${this.beat.id}-${suffix}.png` : `${this.beat.id}.png`;
    if (!this.paused) await settleCurtain(this.page);
    await this.page.screenshot({
      path: join(this.dir, file),
      scale: 'css',
      caret: 'hide',
    });
    this.shots += 1;
    appendFileSync(
      join(this.dir, 'shots.jsonl'),
      `${JSON.stringify({ file, beat: this.beat.id, title: this.beat.title, note })}\n`,
    );
  }

  async filmstrip(note: string, times: readonly number[], act: () => Promise<void>): Promise<void> {
    const frames = FILMSTRIP_PROJECTS.includes(this.project)
      ? [...times]
      : [times[Math.floor(times.length / 2)] ?? 200];

    /*
     * Pause just ahead of the fake clock so the animator's `push(now)` lands
     * on a frozen `performance.now()`; every `runFor` then advances the
     * playback by exactly that much and fires the render loop's animation
     * frames on the way.
     */
    await settleCurtain(this.page);
    await this.pause();
    await act();

    let elapsed = 0;
    for (const [index, time] of frames.entries()) {
      const delta = time - elapsed;
      // Keep the final frame interval so the renderer paints at the sample.
      // Advancing hundreds of unused frames costs minutes under software GL.
      // Timers due in the skipped interval still fire through fastForward.
      const settle = Math.min(17, delta);
      if (delta > settle) await this.page.clock.fastForward(delta - settle);
      await this.page.clock.runFor(settle);
      elapsed = time;
      await this.shoot(`${note} (${time} ms in)`, `f${index + 1}`);
    }

    // Let the clock run free again and wait the playback out in real time:
    // fast-forwarding it under the fake clock would render a frame for every
    // sixteen milliseconds of it, which on software GL is minutes.
    await this.page.clock.resume();
    this.paused = false;
    await waitForIdle(this.page);
  }

  /** `pauseClock` reads, tries and widens: see its note on slow frames. */
  private async pause(): Promise<void> {
    await pauseClock(this.page);
    this.paused = true;
  }
}

/**
 * Stage one beat. A slice spec file registers its own cases in a `for` loop
 * over `beatsInSlice`, so the case belongs to that file for Playwright's
 * reports and for `--shard`; everything only the capture needs lives here.
 */
export async function runGalleryBeat(
  beat: Beat,
  page: Page,
  renderer: 'canvas' | 'webgl',
  testInfo: TestInfo,
): Promise<void> {
  const project = testInfo.project.name;
  test.skip(!capturedOn(beat, project), `${beat.id} is not captured on ${project}`);
  if (renderer === 'webgl') test.slow();

  const dir = join(GALLERY_DIR, project);
  mkdirSync(dir, { recursive: true });

  // Installed before the first navigation so the page never sees a real clock.
  await page.clock.install();
  await beat.run(new Stage(page, renderer, project, dir, beat));
}
