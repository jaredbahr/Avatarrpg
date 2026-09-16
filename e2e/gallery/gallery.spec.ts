import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test } from './fixtures';
import { BEATS, capturedOn } from './beats';
import type { Beat, BeatContext } from './beats';
import { waitForIdle } from '../helpers';
import { settleCurtain } from './stage';

/**
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

/** Filmstrips are worth the disk on one 1x project and the WebGL one; elsewhere one mid-playback still does. */
const FILMSTRIP_PROJECTS = ['surface-canvas', 'ipad-webgl'];

class Stage implements BeatContext {
  private shots = 0;
  /** True between `pauseAt` and `resume`, when nothing frame-driven can be awaited. */
  private paused = false;

  constructor(
    readonly page: Page,
    readonly renderer: 'canvas' | 'webgl',
    readonly project: string,
    private readonly dir: string,
    private readonly beat: Beat,
  ) {}

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
      await this.page.clock.runFor(time - elapsed);
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

  /**
   * `pauseAt` needs a moment that is still ahead of the fake clock, and the
   * clock keeps pace with real time until it is paused. On software GL a
   * frame takes a sixth of a second, so the gap between reading the clock
   * and pausing it can be wider than any fixed margin; read, try, widen.
   */
  private async pause(): Promise<void> {
    let margin = 500;
    for (let attempt = 0; ; attempt++) {
      const now = await this.page.evaluate(() => Date.now());
      try {
        await this.page.clock.pauseAt(now + margin);
        this.paused = true;
        return;
      } catch (error) {
        if (attempt >= 4) throw error;
        margin *= 2;
      }
    }
  }
}

for (const beat of BEATS) {
  test(`${beat.id} ${beat.title}`, async ({ page, renderer }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(!capturedOn(beat, project), `${beat.id} is not captured on ${project}`);
    if (renderer === 'webgl') test.slow();

    const dir = join(GALLERY_DIR, project);
    mkdirSync(dir, { recursive: true });

    // Installed before the first navigation so the page never sees a real clock.
    await page.clock.install();
    await beat.run(new Stage(page, renderer, project, dir, beat));
  });
}
