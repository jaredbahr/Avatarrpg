import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, settleDialog, settleLayout, startGame } from './helpers';

const profiles = [
  { name: 'tablet', viewport: { width: 1194, height: 834 } },
  { name: 'compact', viewport: { width: 390, height: 844 } },
] as const;
const sizes = [
  { name: 'Normal', value: 'off' },
  { name: 'Large', value: 'on' },
  { name: 'Largest', value: 'huge' },
] as const;

async function game(page: Page) {
  return page.evaluate(() => ({
    state: window.fnt!.app.state,
    session: window.fnt!.app.session.toMeta(),
    camera: window.fnt!.app.rendererCamera(),
  }));
}

async function exposeByWheel(page: Page, dialog: Locator, target: Locator) {
  const body = dialog.locator(':scope > .stack');
  for (let step = 0; step < 12; step++) {
    const ready = await target.evaluate((node) => {
      const panel = node.closest('[role="dialog"]');
      const body = panel?.querySelector(':scope > .stack');
      if (!body) return false;
      const box = node.getBoundingClientRect();
      const port = body.getBoundingClientRect();
      return (
        box.width > 0 &&
        box.height > 0 &&
        box.top >= port.top &&
        box.bottom <= port.bottom &&
        box.left >= 0 &&
        box.right <= innerWidth &&
        node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
      );
    });
    if (ready) return;
    const port = await body.boundingBox();
    if (!port) throw new Error('Missing map scrollport');
    const previous = await body.evaluate((node) => node.scrollTop);
    await page.mouse.move(port.x + port.width / 2, port.y + Math.min(port.height / 2, 100));
    await page.mouse.wheel(0, port.height * 0.65);
    await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(previous);
  }
  throw new Error('Actual wheel input did not expose the complete map control');
}

for (const profile of profiles) {
  test.describe(profile.name, () => {
    test.use({ viewport: profile.viewport });
    for (const size of sizes) {
      test(`${size.name}: NPC glyphs fit map cells and the painted SVG bounds`, async ({
        page,
      }, info) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await resetStorage(page, '?renderer=canvas&titleArt=a&titleArtHold=0');
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
        await settleDialog(settings);
        await settings
          .getByRole('radiogroup', { name: 'Text size', exact: true })
          .getByRole('radio', { name: size.name, exact: true })
          .click();
        expect(await page.evaluate(() => window.fnt!.app.settings.largeText)).toBe(size.value);
        await settings.getByRole('button', { name: 'Done', exact: true }).click();
        await startGame(page, ['Map reader'], ['kaya'], 'local-map-labels-608');
        await enterNode(page, 'village_explore');
        await settleLayout(page);
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe('canvas');
        const before = await game(page);
        await page.getByRole('button', { name: 'Map', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Local map', exact: true });
        await settleDialog(dialog);
        await expect(
          dialog.locator('.local-npc-label').filter({ hasText: 'Elder Mira' }),
        ).toHaveCount(1);
        const labels = await dialog.locator('.local-npc-label').evaluateAll((nodes) =>
          nodes.map((element) => {
            const label = element as SVGTextElement;
            const svg = label.ownerSVGElement;
            if (!svg) throw new Error('Missing local map SVG');
            const viewBox = svg.viewBox.baseVal;
            const box = label.getBBox();
            const style = getComputedStyle(label);
            const stroke = Number.parseFloat(style.strokeWidth);
            const matrix = label.getScreenCTM();
            if (!matrix || !Number.isFinite(stroke)) throw new Error('Missing map geometry');
            const rawToken = getComputedStyle(document.documentElement)
              .getPropertyValue('--local-map-label-size')
              .trim();
            return {
              text: label.textContent,
              rawToken,
              validFontLength: CSS.supports('font-size', rawToken),
              computedFontSize: style.fontSize,
              width: box.width,
              height: box.height,
              painted: {
                left: box.x - stroke / 2,
                top: box.y - stroke / 2,
                right: box.x + box.width + stroke / 2,
                bottom: box.y + box.height + stroke / 2,
              },
              map: {
                left: viewBox.x,
                top: viewBox.y,
                right: viewBox.x + viewBox.width,
                bottom: viewBox.y + viewBox.height,
              },
              screenCellHeight: Math.hypot(matrix.c, matrix.d),
              screenGlyphHeight: box.height * Math.hypot(matrix.c, matrix.d),
            };
          }),
        );
        const mapGeometry = await dialog.locator('svg.local-map').evaluate((svg: SVGSVGElement) => {
          const rect = svg.getBoundingClientRect();
          const style = getComputedStyle(svg);
          const horizontal =
            Number.parseFloat(style.paddingLeft) +
            Number.parseFloat(style.paddingRight) +
            Number.parseFloat(style.borderLeftWidth) +
            Number.parseFloat(style.borderRightWidth);
          const width = rect.width - horizontal;
          const maxHeight = Number.parseFloat(style.maxHeight);
          const natural = Math.min(
            maxHeight,
            (width * svg.viewBox.baseVal.height) / svg.viewBox.baseVal.width,
          );
          return {
            height: rect.height,
            width,
            maxHeight,
            natural,
            rounding: 1 / devicePixelRatio,
            scrollHeight: svg.parentElement!.scrollHeight,
            clientHeight: svg.parentElement!.clientHeight,
          };
        });
        expect(labels.length).toBeGreaterThan(0);
        await info.attach('actual-label-geometry', {
          body: JSON.stringify({
            profile,
            size,
            labels,
            mapGeometry,
            before,
            during: await game(page),
          }),
          contentType: 'application/json',
        });
        await page.screenshot({ path: info.outputPath('local-map-labels.png') });
        // Independent relationships: text must have area, stay cell-scale and
        // keep its painted stroke inside the map. No copied pixel/font golden.
        expect
          .soft(
            labels.every((label) => label.validFontLength),
            'the root font-size token is valid CSS',
          )
          .toBe(true);
        expect
          .soft(
            labels.every((label) => label.width > 0 && label.height > 0.3 && label.height <= 1),
            'readable glyph height fits one map cell',
          )
          .toBe(true);
        expect
          .soft(
            labels.every(
              (label) =>
                label.painted.left >= label.map.left &&
                label.painted.top >= label.map.top &&
                label.painted.right <= label.map.right &&
                label.painted.bottom <= label.map.bottom,
            ),
            'painted labels fit all four viewBox edges',
          )
          .toBe(true);
        expect(
          labels.every((label) => label.screenCellHeight > 0 && label.screenGlyphHeight > 0),
        ).toBe(true);
        expect
          .soft(
            Number.isFinite(mapGeometry.natural) &&
              mapGeometry.natural > 0 &&
              Math.abs(mapGeometry.height - mapGeometry.natural) <= mapGeometry.rounding,
            'map retains its intrinsic height capped by the existing maximum, within one device pixel',
          )
          .toBe(true);
        expect(await game(page)).toEqual(before);
        for (const control of await dialog.getByRole('button').all())
          await exposeByWheel(page, dialog, control);
        await page.screenshot({ path: info.outputPath('map-controls-after-real-scroll.png') });
        expect(await game(page)).toEqual(before);
        await dialog.getByRole('button', { name: 'Close map', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect(await game(page)).toEqual(before);
        expect(errors).toEqual([]);
      });
    }
  });
}

test('the unchanged objective route remains usable after reading the map', async ({
  page,
}, info) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Map reader'], ['kaya'], 'local-map-route-608');
  await enterNode(page, 'village_explore');
  await settleLayout(page);
  const before = await game(page);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Local map', exact: true });
  await expect(dialog.locator('.local-npc-label').filter({ hasText: 'Elder Mira' })).toBeVisible();
  expect(await game(page)).toEqual(before);
  await dialog.getByRole('button', { name: 'Walk to Elder Mira', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state?.story.nodeId))
    .toBe('mira_intro');
  await expect(page.locator('.line-count')).toHaveText('1 of 4');
  await page.locator('[data-conversation-control="next"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.line-count')).toHaveText('2 of 4');
  await info.attach('actual-route-positive-control', {
    body: JSON.stringify({ before, after: await game(page) }),
    contentType: 'application/json',
  });
});
