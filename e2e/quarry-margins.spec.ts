import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { screenshotClipPixels } from './pixels';

test.use({ viewport: { width: 1280, height: 800 } });

async function fittedBoard(page: Page, node: string, renderer: 'canvas' | 'webgl') {
  await enterNode(page, node);
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  const recentre = page.getByRole('button', { name: 'Recentre', exact: true });
  if (!(await page.evaluate(() => window.fnt!.app.rendererCamera()?.fitted))) {
    await recentre.click();
  }
  await expect.poll(() => page.evaluate(() => window.fnt!.app.rendererCamera()?.fitted)).toBe(true);
  await settleLayout(page);
  const geometry = await page.evaluate(() => {
    const app = window.fnt!.app;
    const canvas = document.querySelector<HTMLCanvasElement>('.combat-scene .map-canvas');
    const camera = app.rendererCamera();
    const mapId = app.state?.battle?.mapId;
    const ground = mapId && app.content.maps.get(mapId)?.scene?.ground[0];
    if (!canvas || !camera || !ground) throw new Error('Missing drawn combat geometry');
    const { a, b, c, d, tx, ty } = camera.groundTransform;
    const rect = canvas.getBoundingClientRect();
    const scaleX = (rect.width * devicePixelRatio) / canvas.width;
    const scaleY = (rect.height * devicePixelRatio) / canvas.height;
    const left = rect.left + (a * ground.x + c * ground.y + tx) * scaleX;
    const top = rect.top + (b * ground.x + d * ground.y + ty) * scaleY;
    const right = left + a * ground.width * scaleX;
    const middle = Math.round(
      (Math.max(top, rect.top) + Math.min(top + d * ground.height * scaleY, rect.bottom)) / 2,
    );
    const points = [
      { x: Math.round((rect.left + left) / 2), y: middle },
      { x: Math.round((rect.right + right) / 2), y: middle },
      { x: Math.round((left + right) / 2), y: middle },
    ];
    const unobscured = points.every(({ x, y }) => document.elementFromPoint(x, y) === canvas);
    return {
      left,
      right,
      points,
      unobscured,
      mapId,
      backend: app.rendererBackend(),
      projection: camera.projection,
    };
  });
  expect(geometry.backend).toBe(renderer);
  expect(geometry.projection).toBe('topdown');
  expect(geometry.mapId).toBe(node === 'battle_forest_road' ? 'forest_road' : 'quarry_gate');
  expect(geometry.unobscured).toBe(true);
  expect(geometry.left).toBeGreaterThan(40);
  expect(geometry.right).toBeLessThan(1240);

  const y = geometry.points[0]!.y;
  const strip = await screenshotClipPixels(page, { x: 0, y: y - 2, width: 1280, height: 5 });
  return geometry.points.map((point) =>
    [-2, -1, 0, 1, 2].flatMap((dy) =>
      [-2, -1, 0, 1, 2].map((dx) => {
        const colour = strip.at(point.x + dx, 2 + dy);
        if (!colour) throw new Error('Missing screen pixel');
        return colour;
      }),
    ),
  );
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer}: Quarry Gate margins match the Forest Road backdrop`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const sample = async (node: string) => {
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Margin review'], ['kaya'], 'quarry-margins-598');
      await page.evaluate(() => window.fnt!.app.updateSettings({ combatGuidance: false }));
      const [left, right, interior] = await fittedBoard(page, node, renderer);
      expect(left).toHaveLength(25);
      expect(right).toHaveLength(25);
      expect(interior).toHaveLength(25);
      expect(interior).not.toEqual(left);
      expect(interior).not.toEqual(right);
      return { left, right };
    };

    const forest = await sample('battle_forest_road');
    const quarry = await sample('battle_quarry_gate');
    for (const side of ['left', 'right'] as const) {
      quarry[side]!.forEach((colour, index) => {
        const reference = forest[side]![index]!;
        // The same textured backdrop can receive an authored regional tint.
        expect(
          Math.max(
            Math.abs(colour.r - reference.r),
            Math.abs(colour.g - reference.g),
            Math.abs(colour.b - reference.b),
          ),
        ).toBeLessThanOrEqual(8);
        expect(Math.min(colour.r, colour.g, colour.b)).toBeLessThan(248);
      });
    }
    expect(errors).toEqual([]);
  });
}
