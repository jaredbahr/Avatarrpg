import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { average, screenshotPixels } from './pixels';

/**
 * The renderer picks a backend at runtime, so both paths need covering.
 *
 * CI runners have no GPU, and against a software rasteriser WebGL runs about
 * ten times slower than Canvas 2D at this workload — which is why the auto
 * choice lands on Canvas 2D here and why the rest of the suite is quick. That
 * would leave the shader path shipped untested, so this spec forces it on with
 * `?renderer=webgl` and gives it the longer budget software GL needs.
 */
test.describe('renderer backends', () => {
  test('auto-selects Canvas 2D when WebGL is not accelerated', async ({ page }) => {
    await resetStorage(page);
    const backend = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      const name = info ? String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      return { name, software: /swiftshader|llvmpipe|softpipe|software/i.test(name) };
    });

    // Guard the premise: if a runner ever gets a real GPU this test is moot.
    test.skip(!backend.software, `this runner reports an accelerated GPU: ${backend.name}`);

    await startGame(page, ['Elias'], ['kaya'], 'renderer-spec');
    await enterNode(page, 'battle_forest_road');
    await waitForIdle(page);

    const chosen = await page.evaluate(() => window.fnt?.app.rendererBackend());
    expect(chosen, 'software WebGL should fall back to Canvas 2D').toBe('canvas');
  });

  test('renders the board through the WebGL backend when forced', async ({ page }) => {
    test.setTimeout(120_000);
    // This case forces the shader path on both engines, and both rasterise in
    // software on a runner with no GPU: SwiftShader in Chromium, Mesa in WebKit.
    allowSoftwareWebgl(test, 'webgl');

    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?renderer=webgl');
    await page.waitForFunction(() => Boolean(window.fnt?.app));
    await startGame(page, ['Elias', 'Lorelai'], ['kaya', 'bo'], 'renderer-spec');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);

    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe('webgl');

    // A failed shader link throws nothing in Pixi — it logs and draws nothing —
    // so assert on both the console and the pixels.
    expect(errors.filter((text) => /shader|webgl|glsl/i.test(text))).toEqual([]);

    const canvas = page.locator('.map-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Check the real authored scene, including its live water overlay. PNG
    // compression bytes are varied even when the canvas is completely blank.
    //
    // The water's ripple is animated, so one frame is not a fixed colour: six
    // samples on one host moved the blue-minus-red difference between 21.2 and
    // 23.2, and a runner whose screenshot lands on another phase measured 19.9
    // against the 20 this asserts (both heads, measured 20 September 2026).
    // A missing overlay never clears the bar on any frame, so read a few and
    // let the best one speak; the threshold is unchanged.
    const water = await tileCentre(page, { x: 5, y: 6 });
    let wet = { r: 0, g: 0, b: 0, bMinusR: -Infinity };
    for (let sample = 0; sample < 3 && wet.bMinusR <= 20; sample++) {
      if (sample) await page.waitForTimeout(400);
      const pixels = await screenshotPixels(canvas);
      const read = average(pixels, water.x, water.y, 3);
      wet = { ...read, bMinusR: read.b - read.r };
    }
    expect(wet.bMinusR, `authored scene water is absent: ${JSON.stringify(wet)}`).toBeGreaterThan(
      20,
    );
  });

  /*
   * The ground has to be painted where the tiles are, on both backends and at
   * every device pixel ratio. The WebGL ground is a full-screen filter whose
   * input texture Pixi pools at the next power of two, and a shader that took
   * its UVs to span the viewport drew the whole board wide and offset; nothing
   * else in the suite could see it, because every other spec maps a tile to a
   * pixel through the same camera the tap handler reads. This looks at the
   * pixels: a puddle must be blue where the camera says the puddle is, and
   * grass green where the grass is.
   */
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`paints the ground under the tiles on ${renderer}`, async ({ page }) => {
      test.setTimeout(120_000);
      allowSoftwareWebgl(test, renderer);

      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Elias'], ['kaya'], 'ground-spec');
      await enterNode(page, 'battle_forest_road');
      await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);

      // This is the procedural ground's test: every unpainted map and the
      // fallback draw it, so take any painting the forest road may carry away.
      await page.evaluate(() => {
        const app = window.fnt?.app;
        const map = app?.content.maps.get('forest_road');
        // Layered scenes supersede legacy backdrops. Remove both paintings to
        // exercise procedural fallback, retaining its original color contract.
        if (map) Object.defineProperty(map, 'scene', { value: undefined, configurable: true });
        return app?.overrideBackdrop('forest_road', null);
      });
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );

      // The forest road's puddle is authored at (5, 6); the top-left corner is grass.
      const water = await tileCentre(page, { x: 5, y: 6 });
      const grass = await tileCentre(page, { x: 3, y: 1 });
      const pixels = await screenshotPixels(page.locator('.map-canvas'));
      const wet = average(pixels, water.x, water.y, 3);
      const green = average(pixels, grass.x, grass.y, 3);

      expect(
        wet.b,
        `puddle at ${water.x},${water.y} is not blue: ${JSON.stringify(wet)}`,
      ).toBeGreaterThan(wet.r + 20);
      expect(
        green.g,
        `grass at ${grass.x},${grass.y} is not green: ${JSON.stringify(green)}`,
      ).toBeGreaterThan(green.b + 10);
      expect(green.g).toBeGreaterThan(green.r);
    });
  }
});

/** Screen point at a tile's centre, inside the canvas element, through the camera. */
async function tileCentre(
  page: Page,
  pos: { x: number; y: number },
): Promise<{ x: number; y: number }> {
  const point = await page.evaluate((p) => {
    const camera = window.fnt?.app.rendererCamera?.();
    if (!camera) return null;
    const m = camera.groundTransform;
    const x = (p.x + 0.5) * 64,
      y = (p.y + 0.5) * 64;
    return { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty };
  }, pos);
  if (!point) throw new Error('no map camera');
  return point;
}
