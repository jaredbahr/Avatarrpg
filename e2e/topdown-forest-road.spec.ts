import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { deserialize, serialize, stateFromBlob } from '../src/core/save/serialize';
import { allowSoftwareWebgl } from './budget';
import { paintedGroundPoint, paintedTileCentre } from './projection';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * The Forest Road under `?style=topdown` (ADR 0104, T4) on both backends: the baked top-down scene
 * loads for the explore map and for the ambush, a tap where a tile is painted walks the party to that
 * tile, and in the fight a Move tapped on a painted tile lands the active unit there.
 */
type Renderer = 'canvas' | 'webgl';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function webglAvailable(page: Page): Promise<boolean> {
  await page.goto('/');
  return page.evaluate(() => {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  });
}

async function expectTopDownForest(page: Page, renderer: Renderer): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
  const camera = await page.evaluate(() => window.fnt?.app.rendererCamera());
  expect(camera?.projection).toBe('topdown');
  expect(camera?.tile).toBe(40);
  const ground = await page.evaluate(() => {
    const map = window.fnt?.app.state?.location.mapId;
    return map ? window.fnt?.app.content.maps.get(map)?.scene?.ground[0]?.url : undefined;
  });
  expect(ground).toBe('art/topdown/forest-road/ground.webp');
}

for (const renderer of ['canvas', 'webgl'] as const satisfies readonly Renderer[]) {
  test(`the Forest Road exit markers point along their routes on ${renderer}`, async ({ page }) => {
    allowSoftwareWebgl(test, renderer);
    if (renderer === 'webgl')
      test.skip(!(await webglAvailable(page)), 'WebGL is unavailable on this browser host.');
    const errors = collectErrors(page);

    await page.goto(`/?renderer=${renderer}&style=topdown`);
    await page.waitForFunction(() => Boolean(window.fnt?.app));
    await startGame(page, ['Elias'], ['kaya'], `forest-exit-direction-${renderer}`);
    await enterNode(page, 'forest_explore');
    const forest = await page.evaluate(() => window.fnt!.app.state!);
    expect(forest.location.mapId).toBe('forest_road');
    const session = { players: [{ name: 'Elias', unitId: 'p0' }], soloPlay: true };

    const canvas = page.locator('.explore-scene .map-canvas');
    const tile = 40;
    for (const [column, sign] of [
      [0, -1],
      [19, 1],
    ] as const) {
      // Enter through the normal save API beside each mouth so the game can
      // frame it without crossing the roadblock or depending on gesture pan.
      const nearby = {
        ...forest,
        location: { ...forest.location, pos: { x: column - sign, y: 4 } },
      };
      const saved = deserialize(
        serialize(nearby, {
          label: 'Forest exit marker',
          summary: 'A position near an authored road mouth',
          savedAt: 1_700_000_000_000,
          session,
        }),
      );
      if (!saved.ok) throw new Error(`Invalid exit fixture: ${saved.error}`);
      await page.evaluate(({ state, session }) => window.fnt!.app.adoptSave(state, session), {
        state: stateFromBlob(saved.blob),
        session: saved.blob.session,
      });
      await settleLayout(page);
      await expectTopDownForest(page, renderer);
      const centre = { x: column + 0.5, y: 4.5 };
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Missing exit marker canvas');

      const image = PNG.sync.read(await canvas.screenshot({ scale: 'css' }));
      for (const [side, visible] of [
        [sign, true],
        [-sign, false],
      ] as const) {
        const sample = await paintedGroundPoint(page, {
          x: centre.x + (side * 7) / tile,
          y: centre.y,
        });
        if (!sample) throw new Error('Missing painted arrow sample');
        const x = Math.round(sample.x - box.x);
        const y = Math.round(sample.y - box.y);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(image.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(image.height);
        const i = (y * image.width + x) * 4;
        const [red = 0, green = 0, blue = 0] = image.data.subarray(i, i + 3);
        // These are inside the arrow's head and rear notch, well inside the ring.
        const gold = red >= 210 && green >= 165 && red - green >= 22 && green - blue >= 39;
        expect(
          gold,
          `exit column ${column}, sample side ${side}, RGB ${red}/${green}/${blue}`,
        ).toBe(visible);
      }
    }
    expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
  });

  test(`the top-down Forest Road walks in exploration on ${renderer}`, async ({ page }) => {
    test.setTimeout(120_000);
    allowSoftwareWebgl(test, renderer);
    if (renderer === 'webgl')
      test.skip(!(await webglAvailable(page)), 'WebGL is unavailable on this Chromium host.');
    const errors = collectErrors(page);

    await resetStorage(page, `?renderer=${renderer}&style=topdown`);
    await startGame(page, ['Elias'], ['kaya'], `topdown-forest-${renderer}`, {
      reduceMotion: false,
    });
    await enterNode(page, 'forest_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await settleLayout(page);
    await expectTopDownForest(page, renderer);

    // Short hops west of the bend (column 4 holds the one-shot story crossing): over the road,
    // round the puddle's west shore and back onto the road, each tapped where the tile is painted.
    for (const to of [
      { x: 2, y: 5 },
      { x: 3, y: 7 },
      { x: 2, y: 8 },
      { x: 1, y: 6 },
    ]) {
      const point = await paintedTileCentre(page, to);
      expect(point, 'no camera to map the tile through').not.toBeNull();
      if (!point) return;
      await page.mouse.click(point.x, point.y);
      await waitForIdle(page);
      await expect
        .poll(async () => page.evaluate(() => window.fnt?.app.state?.location.pos))
        .toEqual(to);
    }
    expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
  });

  test(`the top-down Forest Road fight moves a unit on ${renderer}`, async ({ page }) => {
    test.setTimeout(120_000);
    allowSoftwareWebgl(test, renderer);
    if (renderer === 'webgl')
      test.skip(!(await webglAvailable(page)), 'WebGL is unavailable on this Chromium host.');
    const errors = collectErrors(page);

    await resetStorage(page, `?renderer=${renderer}&style=topdown`);
    await startGame(page, ['Elias'], ['kaya'], `topdown-forest-fight-${renderer}`);
    await enterNode(page, 'battle_forest_road');
    expect(await takeTurn(page)).toBe(true);
    await waitForIdle(page);
    await expectTopDownForest(page, renderer);

    const active = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      const id = battle?.order[battle.turnIndex];
      return battle?.units.find((u) => u.id === id) ?? null;
    });
    expect(active?.faction).toBe('party');
    if (!active) return;
    await page.getByRole('button', { name: /^Move\b/ }).click();
    // One step east along the spawn column's row: open grass or road on this board.
    const to = { x: active.pos.x + 1, y: active.pos.y };
    const point = await paintedTileCentre(page, to);
    expect(point).not.toBeNull();
    if (!point) return;
    await page.mouse.click(point.x, point.y);
    const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await waitForIdle(page);
    await expect
      .poll(async () =>
        page.evaluate(
          (id) => window.fnt?.app.state?.battle?.units.find((u) => u.id === id)?.pos ?? null,
          active.id,
        ),
      )
      .toEqual(to);
    expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
  });
}
