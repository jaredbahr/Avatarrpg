/** Scoped local pixel proof, not part of the full browser/gallery suite. */
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { enterNode, resetStorage, startGame } from './helpers';

for (const expression of ['angry', 'worried', 'warm', 'failed-load'] as const) {
  test(`Kaya ${expression} uses the selected bitmap`, async ({ page }, info) => {
    if (expression === 'failed-load')
      await page.route('**/art/portraits/expressions/**', (route) => route.abort());
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/art/portraits/expressions/')) requests.push(request.url());
    });
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Jared'], ['kaya'], 'portrait-expression-review');
    expect(requests).toHaveLength(0);
    await page.evaluate(
      (angry) =>
        window.fnt!.app.dispatch({
          type: 'setFlags',
          flags: { lost_forest_road: angry },
        }),
      expression === 'angry',
    );
    await enterNode(page, expression === 'warm' ? 'defeat_gate' : 'after_forest');
    const mood = expression === 'failed-load' ? 'worried' : expression;
    const key = `portrait.kaya.${mood}`;
    const portrait = page.locator(`canvas[data-asset="${key}"]:visible`).first();
    await expect(portrait).toBeVisible();
    // Verify rendered bitmap pixels, not only a dataset label or successful request.
    await expect
      .poll(async () =>
        portrait.evaluate(
          async (element, expected) => {
            const canvas = element as HTMLCanvasElement;
            const image = new Image();
            image.src = expected;
            await image.decode();
            const reference = document.createElement('canvas');
            reference.width = canvas.width;
            reference.height = canvas.height;
            reference.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
            const a = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
            const b = reference
              .getContext('2d')!
              .getImageData(0, 0, canvas.width, canvas.height).data;
            return a.every((value, i) => value === b[i]);
          },
          expression === 'failed-load'
            ? '/art/portraits/kaya.png'
            : `/art/portraits/expressions/${mood}/kaya.png`,
        ),
      )
      .toBe(true);
    expect(requests.some((url) => url.endsWith(`/expressions/${mood}/kaya.png`))).toBe(true);
    const folder = 'art/source/portraits-variants/review/in-game';
    mkdirSync(folder, { recursive: true });
    await page.screenshot({ path: `${folder}/${info.project.name}-${expression}.png` });
  });
}
