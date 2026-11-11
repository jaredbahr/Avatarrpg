import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { EncounterDef, MapDef, Vec2 } from '../src/core/types';
import { TOPDOWN_FIXTURE } from '../src/render/topdown.fixture';
import { TOPDOWN_PROPS, topdownPropBox, topdownPropUrl } from '../src/render/topdown/props';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * A runtime prop stands on its own shadow on a top-down board (#459): on Canvas 2D, the drawn pixel
 * just under a water barrel's foot is the shadow's seam, clearly darker than the open ground beside
 * the barrel, and the barrel's own lowest pixel is drawn above it.
 */
const BARREL = { x: 4, y: 4 } as const;
const sprite = TOPDOWN_PROPS.water_barrel;
if (!sprite) throw new Error('No top-down barrel drawing.');
const box = topdownPropBox(BARREL, sprite);
const png = PNG.sync.read(readFileSync(`public/${topdownPropUrl(sprite)}`));
/** The foot column: the barrel's middle column, and its lowest opaque row. */
const column = Math.floor(sprite.w / 2);
let lowest = -1;
for (let y = png.height - 1; y >= 0 && lowest < 0; y--)
  if ((png.data[(y * png.width + column) * 4 + 3] ?? 0) >= 128) lowest = y;
const foot: Vec2 = { x: box.x + column, y: box.y + lowest };

test('a top-down barrel stands on its drawn seam on Canvas 2D', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'surface-touch',
    'One Chromium project reads the canvas; the drawing is backend-checked in unit tests.',
  );
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Prop'], ['kaya'], 'topdown-props');
  await page.evaluate(
    ({ fixture, barrel }) => {
      const app = window.fnt?.app;
      const encounter = app?.content.encounters.get('enc_forest_road');
      if (!app || !encounter) throw new Error('Forest road encounter unavailable.');
      const maps = app.content.maps as Map<string, MapDef>;
      const encounters = app.content.encounters as Map<string, EncounterDef>;
      maps.set(encounter.mapId, {
        ...fixture,
        id: encounter.mapId,
        props: [{ propId: 'water_barrel', pos: barrel }],
      });
      encounters.set(encounter.id, {
        ...encounter,
        enemies: [{ enemyId: 'bandit_thug', pos: { x: 8, y: 5 } }],
        allies: [],
        conditionalEnemies: [],
        reinforcements: [],
        variants: [],
      });
    },
    { fixture: TOPDOWN_FIXTURE, barrel: BARREL },
  );
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.rendererCamera()?.projection))
    .toBe('topdown');

  /** The drawn colour of world pixel (wx, wy), read from the backing store. */
  const sample = (points: readonly Vec2[]) =>
    page.evaluate((pts) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const camera = window.fnt?.app.rendererCamera();
      const ctx = canvas?.getContext('2d');
      if (!canvas || !camera || !ctx) return null;
      const m = camera.groundTransform;
      const k = canvas.width / canvas.getBoundingClientRect().width;
      return pts.map((p) => {
        const x = p.x + 0.5,
          y = p.y + 0.5;
        const px = Math.floor((m.a * x + m.c * y + m.tx) * k);
        const py = Math.floor((m.b * x + m.d * y + m.ty) * k);
        const [r = 0, g = 0, b = 0] = ctx.getImageData(px, py, 1, 1).data;
        return 0.299 * r + 0.587 * g + 0.114 * b;
      });
    }, points);

  const seam = { x: foot.x, y: foot.y + 1 };
  // Open ground in the same cell row, left of the barrel: the cast falls to the lower right.
  const ground = [-14, -12, -10].map((dx) => ({ x: box.x + dx, y: foot.y + 1 }));
  await expect
    .poll(
      async () => {
        const lum = await sample([seam, ...ground]);
        if (!lum) return null;
        const [s = 0, ...g] = lum;
        const open = g.reduce((a, v) => a + v, 0) / g.length;
        return s / open;
      },
      { message: 'the seam under the barrel is drawn darker than the ground beside it' },
    )
    .toBeLessThan(0.75);
});
