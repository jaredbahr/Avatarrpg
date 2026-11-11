import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { resetStorage, setLargeText } from './helpers';
import type { LargeText } from './helpers';

// #492's bounded setup regression. Recovery Tabs intentionally accommodate
// main's separately tracked setup focus handoff (#510); this is not #491's
// complete title-to-first-turn acceptance and never injects DOM focus.
async function tabTo(page: Page, target: Locator) {
  await expect(target).toHaveCount(1);
  for (let step = 0; step < 60; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expect(target).toBeVisible();
      await expect(target).toBeEnabled();
      await expect(target).toBeInViewport();
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard could not reach ${await target.textContent()}`);
}
async function activate(page: Page, target: Locator) {
  await tabTo(page, target);
  await page.keyboard.press('Enter');
}
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function geometry(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.setup-panel');
    const card = panel?.querySelector<HTMLElement>('.pick-card.element-nonbender');
    const footer = panel?.querySelector<HTMLElement>('.setup-footer');
    if (!panel || !card || !footer) throw new Error('Missing setup geometry');
    const panelBox = panel.getBoundingClientRect();
    const footerBox = footer.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    return {
      focused: document.activeElement === card,
      focusVisible: card.matches(':focus-visible'),
      outlineWidth: Number.parseFloat(getComputedStyle(card).outlineWidth),
      footerPosition: getComputedStyle(footer).position,
      panelTop: panelBox.top,
      footerTop: footerBox.top,
      cardHeight: cardBox.height,
      scrollTop: panel.scrollTop,
      chips: [...card.querySelectorAll<HTMLElement>('.chip')].map((chip) => {
        const box = chip.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return {
          text: chip.textContent,
          top: box.top,
          bottom: box.bottom,
          cardHit: Boolean(hit && card.contains(hit)),
          footerHit: Boolean(hit && footer.contains(hit)),
        };
      }),
    };
  });
}
function readableStats(actual: Awaited<ReturnType<typeof geometry>>) {
  expect(actual.chips).toHaveLength(4);
  for (const chip of actual.chips) {
    expect(chip.top, `${chip.text} above panel`).toBeGreaterThanOrEqual(actual.panelTop);
    expect(chip.bottom, `${chip.text} behind footer`).toBeLessThanOrEqual(actual.footerTop);
    expect(chip.cardHit, `${chip.text} must hit its card`).toBe(true);
    expect(chip.footerHit, `${chip.text} must not hit the footer`).toBe(false);
  }
  expect(actual.footerPosition).toBe('sticky');
}

// Pin the reproducing viewport in the committed spec: ordinary CI must catch
// this regression without relying on an external diagnostic configuration.
for (const viewport of [
  { label: 'compact portrait', size: { width: 600, height: 900 } },
  { label: 'short landscape', size: { width: 900, height: 600 } },
  { label: 'tablet portrait', size: { width: 820, height: 1180 } },
]) {
  test.describe(viewport.label, () => {
    test.use({ viewport: viewport.size });
    for (const size of ['off', 'on', 'huge'] satisfies LargeText[]) {
      test(`focused final path keeps its stats clear of the footer at ${size} text`, async ({
        page,
      }, info) => {
        await resetStorage(page, '?renderer=canvas');
        await setLargeText(page, size);
        await activate(page, button(page, 'New game'));
        await activate(page, button(page, '1 player'));
        await activate(page, button(page, 'Choose your own'));
        const name = page.getByRole('textbox', { name: 'Your name', exact: true });
        await tabTo(page, name);
        await page.keyboard.press('ControlOrMeta+A');
        await page.keyboard.type('Tala');
        await page.keyboard.press('Enter');
        const card = page.locator('.pick-card.element-nonbender');
        await tabTo(page, card);
        const focused = await geometry(page);
        expect(focused.focused).toBe(true);
        expect(focused.focusVisible).toBe(true);
        expect(focused.outlineWidth).toBeGreaterThan(0);
        readableStats(focused);
        await page.keyboard.press('Space');
        await tabTo(page, card);
        await expect(card).toHaveAttribute('aria-pressed', 'true');
        const selected = await geometry(page);
        readableStats(selected);
        await page.screenshot({ path: info.outputPath('focused-selected-last-path.png') });

        // Keep ordinary manual scrolling functional, including the longer selected
        // description below the cards. Intersection alone would miss an overlay.
        const panel = page.locator('.setup-panel');
        await panel.hover();
        await page.mouse.wheel(0, 5000);
        await expect
          .poll(() =>
            panel.evaluate(
              (element) => element.scrollHeight - element.clientHeight - element.scrollTop,
            ),
          )
          .toBeLessThanOrEqual(1);
        const maximum = await geometry(page);
        expect(maximum.footerPosition).toBe('sticky');
        await expect(button(page, 'Next')).toBeInViewport();
        // Content may scroll above the viewport at the end of a long description.
        // Real reverse/forward Tab must bring the card's stats back into clear view.
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(card).toBeFocused();
        const refocused = await geometry(page);
        readableStats(refocused);
        await info.attach('setup-stat-geometry', {
          body: JSON.stringify({ size, focused, selected, maximum, refocused }),
          contentType: 'application/json',
        });

        await activate(page, button(page, 'Next'));
        const riko = page.locator('.character-card').filter({
          has: page.getByRole('heading', { name: 'Riko', exact: true }),
        });
        await activate(page, riko);
        await activate(page, button(page, 'Confirm'));
        // The draft always fills three hero slots, even for one player. Keep
        // navigating with real keyboard input after the measured first card.
        for (const [element, hero] of [
          ['fire', 'Kaya'],
          ['earth', 'Bo'],
        ] as const) {
          await activate(page, page.locator(`.pick-card.element-${element}`));
          await activate(page, button(page, 'Next'));
          const character = page.locator('.character-card').filter({
            has: page.getByRole('heading', { name: hero, exact: true }),
          });
          await activate(page, character);
          await activate(page, button(page, 'Confirm'));
        }
        await expect(button(page, 'Begin')).toBeVisible();
        await expect(button(page, 'Begin')).toBeInViewport();
        await expect(page.getByRole('heading', { name: 'The party', exact: true })).toBeVisible();
        await page.screenshot({ path: info.outputPath('summary-controls.png') });
      });
    }
  });
}
