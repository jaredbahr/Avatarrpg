import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { resetStorage } from './helpers';

// #510 covers setup's focus contract. The complete dialogue/exploration/combat
// keyboard flow remains #491; these tests do not claim its downstream gates.
async function visibleFocus(target: Locator): Promise<void> {
  await expect(target).toBeFocused();
  await expect(target).toBeVisible();
  await expect(target).toBeInViewport();
  await expect(target).toBeEnabled();
  const actual = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      visible: element.matches(':focus-visible'),
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      color: style.outlineColor,
    };
  });
  expect(actual.visible).toBe(true);
  expect(actual.style).not.toBe('none');
  expect(actual.width).toBeGreaterThan(0);
  expect(actual.color).not.toMatch(/^(transparent|rgba\([^)]*, 0\))$/);
}

/** Real keyboard navigation only; never focus/click a target to hide a loss. */
async function tabTo(page: Page, target: Locator, reverse = false): Promise<void> {
  await expect(target).toHaveCount(1);
  for (let steps = 0; steps < 40; steps++) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await visibleFocus(target);
      return;
    }
    await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Keyboard could not reach ${await target.textContent()}`);
}

async function activate(page: Page, target: Locator, key = 'Enter', reverse = false) {
  await tabTo(page, target, reverse);
  await page.keyboard.press(key);
}

function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}
function character(page: Page, name: string): Locator {
  return page.locator('.character-card').filter({
    has: page.getByRole('heading', { name, exact: true }),
  });
}

for (const size of [1, 2]) {
  test(`${size}-player setup retains visible keyboard focus through selections and Back`, async ({
    page,
  }, info) => {
    await resetStorage(page, '?renderer=canvas');
    await activate(page, button(page, 'New game'));
    // Assert before the next Tab: a recovery tab must not mask a body focus loss.
    await visibleFocus(button(page, '2 players'));
    const count = button(page, size === 1 ? '1 player' : '2 players');
    await activate(page, count, 'Space', size === 1);
    await visibleFocus(count);
    await activate(page, button(page, 'Continue'));

    if (size === 1) {
      await visibleFocus(page.getByRole('textbox', { name: 'Your name', exact: true }));
      await activate(page, button(page, 'Back'));
      await visibleFocus(count);
      await activate(page, button(page, 'Continue'));
    } else {
      await visibleFocus(button(page, "I've got it"));
    }

    const players =
      size === 1
        ? [{ name: '', stored: 'Player 1', element: 'nonbender', character: 'Riko' }]
        : [
            { name: 'Jared', stored: 'Jared', element: 'fire', character: 'Kaya' },
            { name: 'Morgan', stored: 'Morgan', element: 'water', character: 'Nilak' },
          ];
    for (const player of players) {
      if (size > 1) {
        await visibleFocus(button(page, "I've got it"));
        await activate(page, button(page, "I've got it"));
      }
      const name = page.getByRole('textbox', { name: 'Your name', exact: true });
      await visibleFocus(name);
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      if (player.name) await page.keyboard.type(player.name);
      await page.keyboard.press('Enter');
      await visibleFocus(page.locator('.pick-card.element-fire'));
      const element = page.locator(`.pick-card.element-${player.element}`);
      await activate(page, element, 'Space');
      await visibleFocus(element);
      await expect(element).toHaveAttribute('aria-pressed', 'true');
      if (player.element === 'nonbender')
        await page.screenshot({ path: info.outputPath('last-path-focus.png') });
      await activate(page, button(page, 'Next'));
      const selected = character(page, player.character);
      await visibleFocus(page.locator('.character-card:not([disabled])').first());
      await activate(page, selected, 'Space');
      await visibleFocus(selected);
      await expect(selected).toHaveAttribute('aria-pressed', 'true');
      await activate(page, button(page, 'Back'));
      await visibleFocus(element);
      await activate(page, button(page, 'Next'));
      await visibleFocus(selected);
      await activate(page, button(page, 'Confirm'));
      await visibleFocus(button(page, player === players.at(-1) ? 'Begin' : "I've got it"));
    }
    await activate(page, button(page, 'Back'), 'Enter', true);
    const last = players.at(-1);
    if (!last) throw new Error('No setup player');
    await visibleFocus(character(page, last.character));
    await activate(page, button(page, 'Confirm'));
    await visibleFocus(button(page, 'Begin'));
    await page.screenshot({ path: info.outputPath('setup-summary-focus.png') });
    await page.keyboard.press('Enter');
    const actual = await page.evaluate(() => {
      const app = window.fnt?.app;
      return {
        names: app?.session.players.map((player) => player.name),
        characters: app?.state?.party.map((unit) => unit.characterId),
        screen: app?.state?.screen,
      };
    });
    expect(actual.names).toEqual(players.map((player) => player.stored));
    expect(actual.characters).toEqual(players.map((player) => player.character.toLowerCase()));
    expect(actual.screen).toBe('dialogue');
  });
}

test('pointer setup keeps selections usable without a forced keyboard ring', async ({
  page,
}, info) => {
  await resetStorage(page, '?renderer=canvas');
  const press = async (target: Locator) => {
    if (info.project.use.hasTouch) await target.tap();
    else await target.click();
  };
  await press(button(page, 'New game'));
  await press(button(page, '1 player'));
  await expect(button(page, '1 player')).toBeFocused();
  expect(
    await button(page, '1 player').evaluate((element) => element.matches(':focus-visible')),
  ).toBe(false);
  await press(button(page, 'Continue'));
  await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Pointer');
  await press(button(page, 'Next'));
  const element = page.locator('.pick-card.element-fire');
  await press(element);
  await expect(element).toBeFocused();
  expect(await element.evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  await press(button(page, 'Next'));
  await press(character(page, 'Kaya'));
  await press(button(page, 'Confirm'));
  await press(button(page, 'Begin'));
  expect(
    await page.evaluate(() => window.fnt?.app.session.players.map((player) => player.name)),
  ).toEqual(['Pointer']);
});
