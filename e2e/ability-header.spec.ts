import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';

test('combat ability header keeps two lines and a steady board for short and long copy', async ({
  page,
}) => {
  // Each viewport/text-size pair is followed by the camera's measured refit.
  test.setTimeout(120_000);
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Explorer'], ['kaya'], 'ability-header-layout');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);

  const viewports = [
    { name: 'desktop', width: 1368, height: 912 },
    { name: 'ipad-portrait', width: 834, height: 1194 },
  ] as const;
  const readGeometry = () =>
    page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('.ability-header');
      const description = header?.querySelector<HTMLElement>('.header-desc');
      const abilityName = header?.querySelector<HTMLElement>('strong');
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const longButton = [...document.querySelectorAll<HTMLButtonElement>('.action-button')].find(
        (button) => button.textContent?.includes('Fire Jab'),
      );
      if (!header || !description || !abilityName || !canvas || !longButton)
        throw new Error('Combat header fixture is incomplete.');
      const headerRect = header.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const descriptionStyle = getComputedStyle(description);
      const descriptionRect = description.getBoundingClientRect();
      return {
        headerHeight: headerRect.height,
        canvasTop: canvasRect.top,
        canvasHeight: canvasRect.height,
        descriptionHeight: descriptionRect.height,
        descriptionLineClamp: descriptionStyle.webkitLineClamp,
        descriptionText: description.textContent,
        abilityName: abilityName.textContent,
        abilityNameWidth: abilityName.clientWidth,
        abilityNameScrollWidth: abilityName.scrollWidth,
        longButtonHeight: longButton.getBoundingClientRect().height,
      };
    });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await settleLayout(page);

    for (const largeText of ['off', 'huge'] as const) {
      await setLargeText(page, largeText);
      await settleLayout(page);

      await page.getByRole('button', { name: /^Fire Jab/ }).click();
      await settleLayout(page);
      const originalDescription = await page.evaluate(() => {
        const ability = window.fnt?.app.content.abilities.get('fire_jab');
        if (!ability) throw new Error('Fire Jab description is missing.');
        return ability.description;
      });
      await page.evaluate((description) => {
        const app = window.fnt?.app;
        const abilities = app?.content.abilities as
          Map<string, { description: string }> | undefined;
        const ability = abilities?.get('fire_jab');
        if (!app || !abilities || !ability)
          throw new Error('Fire Jab is missing from the fixture.');
        abilities.set('fire_jab', { ...ability, description });
        app.resync();
      }, 'A quick flame strike.');
      await settleLayout(page);
      const short = await readGeometry();

      await page.evaluate((description) => {
        const app = window.fnt?.app;
        const abilities = app?.content.abilities as
          Map<string, { description: string }> | undefined;
        const ability = abilities?.get('fire_jab');
        if (!app || !abilities || !ability)
          throw new Error('Fire Jab is missing from the fixture.');
        abilities.set('fire_jab', { ...ability, description });
        app.resync();
      }, originalDescription);
      await settleLayout(page);
      const long = await readGeometry();

      expect(short.descriptionLineClamp, `${viewport.name}/${largeText}`).toBe('2');
      expect(long.descriptionLineClamp, `${viewport.name}/${largeText}`).toBe('2');
      expect(short.descriptionText).toBe('A quick flame strike.');
      expect(long.descriptionText).toContain('lights any oil the target stands in');
      expect(long.abilityName).toBe('Fire Jab');
      expect(long.abilityNameWidth).toBeGreaterThanOrEqual(long.abilityNameScrollWidth);
      expect(long.descriptionHeight).toBeLessThanOrEqual(long.headerHeight);
      expect(short.descriptionHeight).toBeLessThan(short.headerHeight);
      expect(long.headerHeight).toBeCloseTo(short.headerHeight, 1);
      expect(long.canvasTop).toBeCloseTo(short.canvasTop, 1);
      expect(long.canvasHeight).toBeCloseTo(short.canvasHeight, 1);
      expect(long.longButtonHeight).toBeGreaterThanOrEqual(48);

      if (viewport.name === 'ipad-portrait') {
        const reviewDir = '.shots/ability-header-331';
        mkdirSync(reviewDir, { recursive: true });
        await page.screenshot({
          path: `${reviewDir}/ipad-portrait-${largeText}.png`,
        });
        expect(Math.abs(long.descriptionHeight - long.headerHeight), largeText).toBeLessThan(1);
      }

      await page.getByRole('button', { name: /^Cancel$/ }).click();
      await settleLayout(page);
    }
  }
});
