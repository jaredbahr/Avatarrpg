import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

for (const backend of ['canvas', 'webgl']) {
  test(`tea holds on the porch and yields to walking and forms (${backend})`, async ({ page }) => {
    // Four seconds of stepped RAF frames are costly on software WebGL.
    allowSoftwareWebgl(test, backend);
    // Install before navigation so setup runs on the real clock; pause only
    // once the normal-motion tea pose is ready for the deterministic cel check.
    await page.clock.install();
    await page.setViewportSize({ width: 1280, height: 720 });
    await resetStorage(page, `?renderer=${backend}`);
    await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true }));
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    const tea = page.getByRole('button', { name: 'Tea break', exact: true });
    const stage = page.locator('.village-life-canvas');
    await tea.click();
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    expect(await page.evaluate(() => window.fnt!.app.partyPositions())).toEqual([
      { x: 8, y: 18 },
      { x: 8, y: 19 },
    ]);
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await test.info().attach(`tea-${backend}-reduced`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await expect(stage).toHaveAttribute('data-illustrated-actors', '2');
    await settleLayout(page);
    /*
     * Closing the activities panel reflows the HUD, which resizes the map a
     * frame later through the ResizeObserver, and the camera refits a frame
     * after that. `settleLayout` reads the camera three times two frames
     * apart, so three identical reads inside that gap can hand back a fit that
     * is one layout behind. That fit is not wrong, but the seated party stands
     * below the bottom edge of the stage in it — run 35547980370 measured the
     * projected foot at y 518 on a 485 px stage on CI's software rasteriser,
     * where a frame takes long enough that every retry below stayed inside the
     * same lag — and the sample it fed was an empty crop.
     *
     * Do not ask for the foot itself to be inside the stage. Measured on a
     * settled camera at this viewport the foot sits at y 475 in one run and
     * y 524 on the same 1280x485 stage in another, with a stable camera and a
     * sample that still contains the figure in both: the crop reaches 55 px
     * above the foot, so it reads the seated figure's head and shoulders and
     * the fixture asserts on ink, not framing. A predicate that demands the
     * whole crop land inside the stage would never be true and would only time
     * out. What the crop actually needs is the state the drawing was made in.
     *
     * The clock is faked from here on, so a frame is published when the test
     * asks for one and not before: a `waitForFunction` parked on
     * `requestAnimationFrame` never gets a frame to wake on and can only time
     * out (the first attempt at this repair did exactly that). Step whole
     * frames from this side instead, and stop when the life layer has drawn at
     * the box it is showing — its backing store is sized from the camera's
     * viewport, so a store that disagrees with the CSS box is a layer that has
     * been resized and not repainted, which is the crop that reads blank — and
     * the camera has held still across two published frames. Exhausting the
     * rail is not a failure: the inked assertion further down owns the real
     * claim, and a figure that was never drawn fails it however long the wait.
     */
    const teaFoot = () =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('.village-life-canvas');
        const camera = window.fnt?.app.rendererCamera();
        if (!canvas || !camera) return null;
        const m = camera.groundTransform;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const x = (m.a * 8.5 + m.c * 18.85) * 64 + m.tx;
        const y = (m.b * 8.5 + m.d * 18.85) * 64 + m.ty;
        return {
          store: `${canvas.width}x${canvas.height}@${dpr}`,
          box: `${canvas.clientWidth}x${canvas.clientHeight}`,
          key: `${x.toFixed(2)}:${y.toFixed(2)}:${canvas.clientWidth}x${canvas.clientHeight}`,
          painted:
            Math.abs(canvas.width / dpr - canvas.clientWidth) < 1 &&
            Math.abs(canvas.height / dpr - canvas.clientHeight) < 1,
        };
      });
    /** Frames the settle may use; 30 is seconds on a software rasteriser. */
    const FOOT_RAIL = 30;
    let settled = false;
    let previous: string | null = null;
    let last: Awaited<ReturnType<typeof teaFoot>> = null;
    for (let attempt = 0; attempt < FOOT_RAIL; attempt++) {
      last = await teaFoot();
      settled = Boolean(last?.painted) && last?.key === previous;
      previous = last?.key ?? null;
      if (settled) break;
      await page.clock.runFor(17);
      await page.waitForTimeout(40);
    }
    // Evidence when the rail gave up: the state the crop would have used.
    if (!settled) {
      await test.info().attach(`tea-${backend}-foot-settle`, {
        body: JSON.stringify({ last, attempts: FOOT_RAIL }),
        contentType: 'application/json',
      });
    }
    /*
     * The seated figure is drawn by the shared 2D life layer, above a board
     * that differs by backend. Comparing two composited page captures instead
     * made the cel assertion depend on how long a software rasteriser took to
     * hand frames back: on CI the two clipped reads landed more than one
     * authored four-second cel apart and came back byte-identical, while the
     * app's own clock had advanced by exactly the mocked interval. Reading
     * this layer's own pixels compares the cel the app drew, on both
     * backends, without waiting on the compositor.
     *
     * The projection is read with each sample rather than once, and in the same
     * evaluate as the pixels: opening and closing the activities panel changes
     * the map's height and the camera refits onto the new viewport, so a foot
     * position read a tick before the canvas it is used on points the crop at
     * empty paving. A frame or two of grace after that covers a layer that has
     * not repainted at the new size yet on a slow rasteriser; the figure still
     * has to be in the crop, so a genuinely missing actor fails.
     */
    const sampleTeaCel = () =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('.village-life-canvas');
        const ctx = canvas?.getContext('2d');
        const camera = window.fnt?.app.rendererCamera();
        if (!canvas || !ctx || !camera) throw new Error('missing village life layer');
        // The seated figure's foot through the same logical-pixel affine the
        // `groundPoint` helper uses, now read with the canvas it crops.
        const m = camera.groundTransform;
        const foot = {
          x: (m.a * 8.5 + m.c * 18.85) * 64 + m.tx,
          y: (m.b * 8.5 + m.d * 18.85) * 64 + m.ty,
        };
        const sx = canvas.width / canvas.clientWidth;
        const sy = canvas.height / canvas.clientHeight;
        const scratch = document.createElement('canvas');
        scratch.width = Math.max(1, Math.round(60 * sx));
        scratch.height = Math.max(1, Math.round(110 * sy));
        const out = scratch.getContext('2d');
        if (!out) throw new Error('missing life layer probe');
        out.drawImage(
          canvas,
          Math.round((foot.x - 30) * sx),
          Math.round((foot.y - 55) * sy),
          scratch.width,
          scratch.height,
          0,
          0,
          scratch.width,
          scratch.height,
        );
        const pixels = out.getImageData(0, 0, scratch.width, scratch.height).data;
        let inked = 0;
        for (let i = 3; i < pixels.length; i += 4) if ((pixels[i] ?? 0) > 0) inked += 1;
        return { cel: scratch.toDataURL('image/png'), inked };
      });

    const teaCel = async () => {
      let sample = await sampleTeaCel();
      for (let attempt = 0; attempt < 24 && sample.inked === 0; attempt++) {
        // Publish a frame and read again against the camera that is live then.
        // A wall-clock wait is not enough once the clock is paused: nothing
        // draws, so a layer that has just resized and cleared stays blank for
        // every retry. Seventeen milliseconds is a frame, far short of the
        // four-second cel these checks measure. The count is bounded by the
        // settle it may have to outlast rather than by a hope: a rail of 24
        // frames is seconds on a software rasteriser and a few hundred
        // milliseconds on a GPU, and the assertion below still fails outright
        // when the figure never arrives.
        await page.clock.runFor(17);
        await page.waitForTimeout(40);
        sample = await sampleTeaCel();
      }
      // A crop of empty canvas would compare two blanks and prove nothing, so
      // a missing figure is a failure however long it takes to appear.
      if (sample.inked === 0) {
        /*
         * Two attempts of run 35568889528 (Chromium touch and WebKit) ended
         * here against the same page — board painted, nothing on the veranda
         * (attachment `tea-webgl-reduced`, file 12936d91) — and nothing in that
         * report said whether the layer drew the pair off the stage, drew it
         * somewhere else, or stopped drawing at all. Carry the layer and the
         * geometry that placed the crop, so the next failure is a diagnosis
         * rather than another reproduction. This costs one readback and two
         * attachments on the failing path only.
         */
        const geometry = await page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('.village-life-canvas');
          const camera = window.fnt?.app.rendererCamera() ?? null;
          if (!canvas || !camera) return { camera, error: 'missing life layer' };
          const m = camera.groundTransform;
          const foot = {
            x: (m.a * 8.5 + m.c * 18.85) * 64 + m.tx,
            y: (m.b * 8.5 + m.d * 18.85) * 64 + m.ty,
          };
          const pixels = canvas
            .getContext('2d')
            ?.getImageData(0, 0, canvas.width, canvas.height).data;
          let inked = 0;
          let top = Infinity;
          let bottom = -Infinity;
          if (pixels) {
            for (let i = 3, p = 0; i < pixels.length; i += 4, p++) {
              if ((pixels[i] ?? 0) === 0) continue;
              inked += 1;
              const y = Math.floor(p / canvas.width);
              if (y < top) top = y;
              if (y > bottom) bottom = y;
            }
          }
          return {
            camera,
            store: `${canvas.width}x${canvas.height}`,
            box: `${canvas.clientWidth}x${canvas.clientHeight}`,
            dataset: { ...canvas.dataset },
            partyPositions: window.fnt?.app.partyPositions() ?? null,
            foot,
            ink: { inked, top, bottom },
          };
        });
        await test.info().attach(`tea-${backend}-blank-geometry`, {
          body: JSON.stringify(geometry, null, 2),
          contentType: 'application/json',
        });
        const layer = await page.evaluate(
          () =>
            document.querySelector<HTMLCanvasElement>('.village-life-canvas')?.toDataURL() ?? '',
        );
        await test.info().attach(`tea-${backend}-blank-layer`, {
          body: Buffer.from(layer.slice(layer.indexOf(',') + 1), 'base64'),
          contentType: 'image/png',
        });
      }
      expect(sample.inked, 'the tea region must contain the drawn figure').toBeGreaterThan(0);
      return sample.cel;
    };
    const still = await teaCel();
    // Reduced motion holds the seated cup pose, rather than reverting to idle.
    await page.waitForTimeout(300);
    expect(await teaCel()).toBe(still);
    await page.getByRole('button', { name: 'Water form', exact: true }).click();
    await expect(stage).toHaveAttribute('data-tea-actors', '0');
    await expect(page.getByRole('button', { name: 'Activities', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await expect(tea).toBeEnabled();
    await tea.click();
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    // A rules-driven walk also clears the hold when no pointer action runs.
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 10, y: 19 } }));
    await expect(stage).toHaveAttribute('data-tea-actors', '0');
    await waitForIdle(page);
    await tea.click();
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: false }));
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await test
      .info()
      .attach(`tea-${backend}-hold`, { body: await page.screenshot(), contentType: 'image/png' });
    const now = await page.evaluate(() => Date.now());
    // Leave room for the browser round trip before freezing the clock.
    await page.clock.pauseAt(now + 30_000);
    // Publish the held frame before measuring the four-second cel interval.
    await page.clock.runFor(17);
    const hold = await teaCel();
    // Attach the held region too: a crop that missed the figure is the one
    // failure this assertion cannot explain on its own.
    const png = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    await test
      .info()
      .attach(`tea-${backend}-cel-hold`, { body: png(hold), contentType: 'image/png' });
    // The authored tea clip has two cels at 0.25 fps: exactly four seconds
    // reaches the opposite cel without depending on wall-clock scheduling.
    // Jump the frozen clock rather than stepping 240 software-WebGL frames:
    // the clip is read from the app's own clock for this pose, so one drawn
    // frame after the jump is the same drawing the stepped run produced.
    const appClock = () => page.evaluate(() => performance.now());
    const before = await appClock();
    await page.clock.fastForward(4000);
    await page.clock.runFor(17);
    const after = await appClock();
    // Evidence either way: if the app's clock did not reach the interval, no
    // waiting for a frame would show the other cel.
    await test.info().attach(`tea-${backend}-advance`, {
      body: JSON.stringify({
        before,
        after,
        advanced: before !== null && after !== null ? after - before : null,
      }),
      contentType: 'application/json',
    });
    const sip = await teaCel();
    expect(sip).not.toBe(hold);
    // Two cels at 0.25 fps: one more interval returns the held cup drawing.
    await page.clock.fastForward(4000);
    await page.clock.runFor(17);
    expect(await teaCel()).toBe(hold);
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    await test.info().attach(`tea-${backend}-sip`, {
      body: png(sip),
      contentType: 'image/png',
    });
  });
}

test('tea only seats present supported characters on the porch', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Host'], ['bo', 'sura']);
  await enterNode(page, 'riverside_explore');
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await page.getByRole('button', { name: 'Tea break', exact: true }).click();
  await expect(page.locator('.village-life-canvas')).toHaveAttribute('data-tea-actors', '1');
  await expect(page.locator('.village-note')).toHaveText(
    'A quiet break on the veranda with jasmine tea. The river runs below the steps.',
  );
  expect(await page.evaluate(() => window.fnt!.app.state!.flags.riverside_tea)).toBe(true);
});
