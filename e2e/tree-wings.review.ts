/** Local composition review: real map taps after the standard seeded setup fixture. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

async function zoom(page: Page, target: number): Promise<void> {
  const current = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!current || !box) throw new Error('Missing visible camera');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, Math.log(current / target) / 0.002);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx))
    .toBeCloseTo(target, 1);
  await page.getByRole('button', { name: 'Follow party', exact: true }).click();
  await settleLayout(page);
}

async function walk(page: Page, x: number, y: number): Promise<void> {
  await waitForIdle(page);
  const point = await page.evaluate(
    ({ x, y }) => {
      const m = window.fnt!.app.rendererCamera()!.groundTransform;
      return {
        x: m.a * (x + 0.5) * 64 + m.c * (y + 0.5) * 64 + m.tx,
        y: m.b * (x + 0.5) * 64 + m.d * (y + 0.5) * 64 + m.ty,
      };
    },
    { x, y },
  );
  const canvas = page.locator('.map-canvas');
  await canvas.click({ position: point });
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos))
    .toEqual({ x, y });
  await waitForIdle(page);
  await page.getByRole('button', { name: 'Follow party', exact: true }).click();
  await settleLayout(page);
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} market court tree wings`, async ({ page }) => {
    test.setTimeout(180_000);
    const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const folder = `${process.env.FNT_TREE_REVIEW_DIR ?? '.shots/tree-wings'}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    const build = page.locator('[aria-label^="Game version"]');
    await expect(build).toHaveText(new RegExp(`build ${revision}$`));
    const stamp = await build.innerText();
    await page.screenshot({ path: `${folder}/source-build.png` });
    await startGame(
      page,
      ['Nima', 'Kaya', 'Sura', 'Bo', 'Wen'],
      ['nima', 'kaya', 'sura', 'bo', 'wen'],
      'tree-wings-review',
      { reduceMotion: false },
    );
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
    await zoom(page, 64);
    const views = [];
    for (const [name, x, y] of [
      ['approach', 10, 7],
      ['court', 10, 4],
      ['west-door', 9, 3],
      ['north-door', 11, 3],
      ['east-garden', 16, 5],
      ['return', 10, 7],
    ] as const) {
      await walk(page, x, y);
      for (const size of name === 'court' || name === 'east-garden' ? [64, 96] : [64]) {
        await zoom(page, size);
        await page.screenshot({ path: `${folder}/${name}-${size}.png` });
        views.push({
          name,
          size,
          camera: await page.evaluate(() => window.fnt!.app.rendererCamera()),
        });
      }
      await zoom(page, 64);
    }
    expect(errors).toEqual([]);
    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          revision,
          stamp,
          renderer,
          seed: 'tree-wings-review',
          reduced: false,
          setup:
            'Standard newGame/enterNode fixture, then normal map clicks, wheel and Follow party.',
          diff: execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }),
          views,
          errors,
        },
        null,
        2,
      ),
    );
  });
}
