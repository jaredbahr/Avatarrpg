import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

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

  test('renders the board through the WebGL backend when forced', async ({ page, browserName }) => {
    test.setTimeout(120_000);
    // WebKit on a Linux runner drives WebGL through Mesa's software path,
    // which is slower again than SwiftShader; the budget above is for both.
    if (browserName === 'webkit') test.slow();

    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?renderer=webgl');
    await page.waitForFunction(() => Boolean(window.fnt?.app));
    await startGame(page, ['Elias', 'Lorelai'], ['kaya', 'bo'], 'renderer-spec');
    await enterNode(page, 'battle_forest_road');
    await waitForIdle(page);

    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe('webgl');

    // A failed shader link throws nothing in Pixi — it logs and draws nothing —
    // so assert on both the console and the pixels.
    expect(errors.filter((text) => /shader|webgl|glsl/i.test(text))).toEqual([]);

    const canvas = page.locator('.map-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const shot = await canvas.screenshot({ timeout: 60_000 });
    const distinctBytes = new Set(shot.slice(0, 20_000)).size;
    expect(distinctBytes, 'the board rendered as a flat fill').toBeGreaterThan(16);
  });
});
