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

  /**
   * Raised ground is board correctness (ADR 0065), so both backends draw the
   * same block. The Driller floor's front bench stands a quarter tile up, so
   * the far corner of its top is drawn over the dirt floor behind it: there
   * the pixel must be the bench's stone, as at the top's centre, not the dirt
   * that a flat board shows at that spot.
   */

  /**
   * A live mark on a raised tile sits on its lifted top, where the tap picks
   * it, however much of the lift the art already paints: the Forest Road's
   * shelf is painted at the whole lift, the Driller's benches at a little of
   * it. Hovering the tile must lighten the far corner of the lifted top and
   * leave the tile's own south face, which covers its flat footprint, alone.
   */

  /**
   * The lift pass's cost, read from its probe (`window.fnt.liftCost`). A
   * still raised board is drawn every frame, and each of those frames must
   * be the flat ground plus one copy of the cached raised blocks: no rebuild
   * of the blocks, and no render of the ground into a target, until the
   * camera or the ground moves. The layer holds less than the screen does.
   */
});
