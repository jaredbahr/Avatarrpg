import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SOFTWARE_WEBGL_BUDGET_MS, allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { average, screenshotClipPixels } from './pixels';

// The production service worker precaches art; the probe must intercept the
// network response instead of receiving the cached page.
test.use({ serviceWorkers: 'block' });

/**
 * A flat page: Kaya's knockout page (ADR 0059) is served blue and her hit page
 * (ADR 0063) green, so any of their cels reads plainly.
 */
function flatPage([r, g, b]: readonly [number, number, number]): Buffer {
  const png = new PNG({ width: 2048, height: 1024 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

/** Kaya's torso on the canvas, in CSS pixels: half a figure above her feet. */
async function torso(page: Page, id: string): Promise<{ x: number; y: number }> {
  return page.evaluate((unitId) => {
    const app = window.fnt!.app;
    const unit = app.state?.battle?.units.find((u) => u.id === unitId);
    const camera = app.rendererCamera();
    if (!unit || !camera) throw new Error('Missing the struck unit or the camera');
    const m = camera.groundTransform;
    const x = (unit.pos.x + 0.5) * 64,
      y = (unit.pos.y + 0.5) * 64;
    const lift = camera.projection === 'oblique' ? 0.86 - 0.325 : 0.5 - 0.325;
    return { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty - camera.tilePx * lift };
  }, id);
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`a struck G party member plays its G hit, and a downed one holds its knockout, on ${renderer}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    allowSoftwareWebgl(test, renderer);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const blueKo = flatPage([0, 0, 255]);
    const greenHit = flatPage([0, 255, 0]);
    await page.route('**/art/units/kaya-g-3.webp', (route) =>
      route.fulfill({ contentType: 'image/png', body: blueKo }),
    );
    await page.route('**/art/units/kaya-g-4.webp', (route) =>
      route.fulfill({ contentType: 'image/png', body: greenHit }),
    );
    await page.clock.install();
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer', 'Friend'], ['kaya', 'sura'], 'combat-reactions', {
      reduceMotion: false,
    });
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 30_000);

    const id = await page.evaluate(() => {
      const app = window.fnt!.app;
      const battle = app.state?.battle;
      const kaya = battle?.units.find((u) => u.sprite === 'unit.fire.kaya');
      const enemy = battle?.units.find((u) => u.faction === 'enemy');
      if (!battle || !kaya || !enemy) throw new Error('Expected Kaya and a bandit');
      app.animator.clear();
      app.animator.push(
        performance.now(),
        [
          {
            type: 'damaged',
            unitId: kaya.id,
            amount: 1,
            crit: false,
            damageType: 'fire',
            sourceId: enemy.id,
          },
        ],
        battle.units,
      );
      return kaya.id;
    });
    const at = await torso(page, id);
    const canvas = await page.locator('.map-canvas').boundingBox();
    if (!canvas) throw new Error('Missing the combat canvas');
    // Only the torso, so a software rasteriser's screenshot stays cheap.
    const radius = 6;
    const clip = {
      x: canvas.x + at.x - radius,
      y: canvas.y + at.y - radius,
      width: radius * 2,
      height: radius * 2,
    };
    // Blue through the fallen fade too, and never the red of the fallen cross.
    const blue = async () => {
      const c = average(await screenshotClipPixels(page, clip), radius, radius, 2);
      return c.b > c.r + 20 && c.b > c.g + 20;
    };
    const green = async () => {
      const c = average(await screenshotClipPixels(page, clip), radius, radius, 2);
      return c.g > c.r + 20 && c.g > c.b + 20;
    };
    const clipOf = () =>
      page.evaluate(
        (unitId) =>
          window.fnt!.app.animator.unitPose(performance.now(), unitId, 'unit.fire.kaya')?.clip,
        id,
      );
    const poll = { timeout: renderer === 'webgl' ? SOFTWARE_WEBGL_BUDGET_MS : 30_000 };

    // Mid-reaction, on her contact cel: her G hit for the heading she faces,
    // from the hit page and never the knockout page (ADR 0063).
    await page.clock.runFor(150);
    expect(await clipOf()).toMatch(
      /^hit(East|West|North|South|NorthEast|NorthWest|SouthEast|SouthWest)$/,
    );
    await expect.poll(green, { ...poll, message: 'the hit never drew from its page' }).toBe(true);

    // Played out: back in her stance, from the stance page.
    await page.clock.runFor(1500);
    expect(await clipOf()).toBeUndefined();
    await expect
      .poll(blue, { ...poll, message: 'the stance drew from the knockout page' })
      .toBe(false);
    await expect.poll(green, { ...poll, message: 'the stance drew from the hit page' }).toBe(false);

    // Downed: the knockout plays, and once it has she stays where she fell.
    await page.evaluate((unitId) => {
      const app = window.fnt!.app;
      const state = app.state!;
      const battle = state.battle!;
      const before = battle.units;
      app.state = {
        ...state,
        battle: { ...battle, units: before.map((u) => (u.id === unitId ? { ...u, hp: 0 } : u)) },
      };
      app.animator.push(performance.now(), [{ type: 'unitDied', unitId }], before);
    }, id);
    await page.clock.runFor(200);
    expect(await clipOf()).toMatch(/^ko(North|South)(East|West)$/);
    await expect.poll(blue, { ...poll, message: 'the knockout never drew' }).toBe(true);
    await page.clock.runFor(3000);
    expect(await clipOf()).toBeUndefined();
    await expect.poll(blue, { ...poll, message: 'the fallen body did not stay down' }).toBe(true);
    expect(errors).toEqual([]);
  });
}
