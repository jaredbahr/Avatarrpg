import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { resetStorage } from './helpers';

async function expectVisibleFocus(target: Locator): Promise<void> {
  await expect(target).toBeFocused();
  await expect(target).toBeVisible();
  await expect(target).toBeInViewport();
  await expect(target).toBeEnabled();
  const outline = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(':focus-visible'),
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(outline.focusVisible).toBe(true);
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThan(0);
}

async function pressControl(
  page: Page,
  control: Locator,
  key = 'Enter',
  tab = 'Tab',
): Promise<void> {
  await expect(control).toBeVisible();
  for (let step = 0; step < 40; step++) {
    if (await control.evaluate((element) => element === document.activeElement)) {
      await expectVisibleFocus(control);
      await page.keyboard.press(key);
      return;
    }
    await page.keyboard.press(tab);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  }
  throw new Error(`Keyboard could not reach ${await control.textContent()}`);
}

function button(page: Page, name: string | RegExp): Locator {
  return page.getByRole('button', { name, exact: typeof name === 'string' });
}

async function expectNode(page: Page, node: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe(node);
}

async function advanceLines(page: Page, control: Locator, count: number): Promise<void> {
  for (let line = 0; line < count; line++) {
    await expectVisibleFocus(control);
    await page.keyboard.press('Enter');
  }
}

test('the opening route uses the keyboard from title to a conversation on the Forest Road', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas&titleArtHold=0');
  await pressControl(page, button(page, 'New game'));
  await expectVisibleFocus(button(page, '1 player'));
  await pressControl(page, button(page, 'Choose your own'));
  const name = page.getByRole('textbox', { name: 'Your name', exact: true });
  await expectVisibleFocus(name);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Alex');
  await page.keyboard.press('Enter');

  for (const [element, character] of [
    ['fire', 'Kaya'],
    ['water', 'Nilak'],
    ['earth', 'Bo'],
  ]) {
    await expectVisibleFocus(page.locator('.pick-card.element-fire'));
    await pressControl(page, page.locator(`.pick-card.element-${element}`), 'Space');
    await pressControl(page, button(page, 'Next'));
    await expectVisibleFocus(page.locator('.character-card:not([disabled])').first());
    await pressControl(
      page,
      page.locator('.character-card').filter({
        has: page.getByRole('heading', { name: character, exact: true }),
      }),
      'Space',
    );
    await pressControl(page, button(page, 'Confirm'));
  }
  await expectVisibleFocus(button(page, 'Begin'));
  await page.keyboard.press('Enter');
  await expectNode(page, 'act1_open');
  expect(await page.evaluate(() => window.fnt?.app.session.participants[0]?.name)).toBe('Alex');
  expect(
    await page.evaluate(() => window.fnt?.app.state?.party.map((hero) => hero.characterId)),
  ).toEqual(['kaya', 'nilak', 'bo']);

  const opening = page.locator('[data-interlude-control="next"]');
  await advanceLines(page, opening, 3);
  await expectNode(page, 'village_explore');
  const map = button(page, 'Map');
  await expectVisibleFocus(map);
  await page.keyboard.press('Enter');
  await pressControl(page, button(page, 'Walk to Elder Mira'));
  await expectNode(page, 'mira_intro');
  const next = page.locator('[data-conversation-control="next"]');
  await advanceLines(page, next, 4);
  await expectNode(page, 'village_explore');

  await pressControl(page, button(page, /^Wait/));
  await pressControl(page, button(page, /Afternoon/));
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.world.clock.phase))
    .toBe('afternoon');
  await expectVisibleFocus(button(page, /^Wait/));
  const gao = button(page, 'Talk Gao the Shopkeeper');
  await pressControl(page, gao, 'Enter', 'Shift+Tab');
  await expectNode(page, 'plant_chair');
  await pressControl(page, button(page, /Another time/));
  await expectNode(page, 'gao_friendly');
  await expectVisibleFocus(next);
  await advanceLines(page, next, 4);
  await expectNode(page, 'village_explore');
  await pressControl(page, map);
  await pressControl(page, button(page, 'East road → Forest Road'));
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId))
    .toBe('forest_road');
  // Wait for the actual board arrival before asking to talk. Scene state
  // can name the next map while the animated village exit is still playing.
  await expect(page.locator('.title-plate-name')).toHaveText('The Forest Road');
  await expect(page.locator('canvas.map-canvas')).toHaveAttribute(
    'aria-label',
    'The Forest Road map',
  );
  await pressControl(page, button(page, 'Talk Dema, road keeper'), 'Enter', 'Shift+Tab');
  await expectNode(page, 'forest_dema');
  await advanceLines(page, next, 3);
  await expectNode(page, 'forest_explore');
  expect(await page.evaluate(() => window.fnt?.app.state?.flags['world.ducks_seen'])).toBe(true);

  // The supported keyboard route stops at the roadblock: the route control
  // stays locked until the party crosses a board trigger and resolves the fight.
  await pressControl(page, map);
  const localMap = page.getByRole('dialog', { name: 'Local map', exact: true });
  await expectVisibleFocus(localMap.getByRole('heading', { name: 'Local map' }));
  const east = localMap.getByRole('button', { name: 'East → Quarry Gate', exact: true });
  await expect(east).toBeDisabled();
  await expect(east).toHaveAttribute('title', /roadblock/);
  await page.keyboard.press('Escape');
  await expectVisibleFocus(map);
});
