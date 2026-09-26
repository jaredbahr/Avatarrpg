import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

/**
 * The time of day in the interface (ADR 0047 W7): the phase label in the
 * header and the journal, the wait control at Mira’s table and the
 * riverside porch, and a refused wait showing its reason. Night is a label
 * only (D1), so everything here reads text, not pixels.
 */

async function openActivities(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Activities', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

const clock = (page: Page) => page.evaluate(() => window.fnt!.app.state?.world.clock);

test('the title preview enters in the afternoon and says so', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await expect(page.locator('.explore-phase')).toHaveText('Afternoon');
  await expect(page.locator('.village-note')).toContainText('Afternoon by the river.');
  expect(await clock(page)).toEqual({ day: 1, phase: 'afternoon' });
  await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
  const journal = page.getByRole('dialog', { name: 'Travel journal', exact: true });
  await expect(journal.locator('.explore-phase')).toHaveText('Afternoon');
  await expect(journal).toContainText('Wait at the tea porch to pass the time.');
});

test('waiting at Mira’s table moves the day on and relabels it', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['kaya', 'sura'], 'wait-at-the-table');
  await enterNode(page, 'village_explore');
  await expect(page.locator('.explore-phase')).toHaveText('Midday');
  // The time of day stands where 'Exploring' did.
  await expect(page.locator('.explore-mode')).toHaveCount(0);
  // Away from the table the hotbar keeps Look around, which leads to the seat.
  const wait = page.locator('.action-button').filter({ hasText: "Mira's table" });
  await expect(wait).toHaveCount(0);
  await page.getByRole('button', { name: /^Look around/ }).click();
  await page.getByRole('button', { name: "Mira's table · Sit and wait", exact: true }).click();
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt!.app.state?.location.pos)).toEqual({ x: 10, y: 5 });
  await expect(page.getByRole('button', { name: /^Look around/ })).toHaveCount(0);
  await expect(wait).toContainText('Wait');
  await wait.click();
  const dialog = page.getByRole('dialog', { name: 'Wait until…', exact: true });
  const options = dialog.locator('.choice-option');
  // The next five phases, in clock order, the last two tomorrow.
  await expect(options).toHaveCount(5);
  await expect(options.locator('strong')).toHaveText([
    'Afternoon',
    'Evening',
    'Night',
    'Dawn',
    'Morning',
  ]);
  await expect(options.nth(3)).toContainText('Tomorrow');
  await expect(dialog.locator('.is-locked')).toHaveCount(0);
  await options.nth(1).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.explore-phase')).toHaveText('Evening');
  await expect(page.locator('.toast').filter({ hasText: 'Evening falls.' })).toBeVisible();
  expect(await clock(page)).toEqual({ day: 1, phase: 'evening' });

  // Past night the day turns over.
  await wait.click();
  await page.getByRole('dialog').locator('.choice-option').filter({ hasText: 'Morning' }).click();
  await expect(page.locator('.explore-phase')).toHaveText('Morning');
  expect(await clock(page)).toEqual({ day: 2, phase: 'morning' });
  await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
  const journal = page.getByRole('dialog', { name: 'Travel journal', exact: true });
  await expect(journal.locator('.explore-phase')).toHaveText('Morning');
  await expect(journal).toContainText("Wait at Mira's table to pass the time.");
});

test('the riverside wait walks to the porch before it asks when', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await openActivities(page);
  await page.getByRole('button', { name: 'Wait until…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Wait until…', exact: true });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => window.fnt!.app.state?.location.pos)).toEqual({ x: 8, y: 18 });
  await expect(dialog.locator('.choice-option:not(.is-locked)')).toHaveCount(5);
  await dialog.getByRole('button', { name: 'Return to the path', exact: true }).click();
  expect(await clock(page)).toEqual({ day: 1, phase: 'afternoon' });
});

test('a refused wait keeps its way back on a phone at Largest text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['kaya', 'sura'], 'refused-on-a-phone');
  await page.evaluate(() => {
    const app = window.fnt!.app;
    app.updateSettings({ largeText: 'huge' });
    app.dispatch({ type: 'enterNode', nodeId: 'riverside_explore' });
    const state = app.state!;
    // At the porch, with the story cursor off an explore node, so the rule
    // refuses every phase ("Not in the middle of a conversation.").
    app.adoptSave(
      {
        ...state,
        story: { ...state.story, nodeId: 'hanru_watch_leave' },
        location: { mapId: 'ba_dan_riverside', pos: { x: 8, y: 18 } },
      },
      undefined,
    );
  });
  await openActivities(page);
  await page.getByRole('button', { name: 'Wait until…', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.locked-hint').first()).toHaveText(
    'Not in the middle of a conversation.',
  );
  const back = dialog.getByRole('button', { name: /^(Return|Back) to the path$/ });
  // Wholly on screen and unclipped by the sheet. Not `toBeInViewport({ ratio: 1 })`:
  // the button's bottom edge sits exactly on the bottom of the dialog's scroll
  // region at a fractional y, and WebKit's IntersectionObserver snaps that clip
  // rect, reporting a ratio of 0.998 for a button whose box is fully inside it.
  // The settled sheet reads 0.998 every time; the old check passed only when a
  // poll happened to land on an earlier layout. Measure the box against the
  // viewport and the padding box of every clipping ancestor instead, with the
  // half-pixel allowance the save sheet's check uses. Let the entrance
  // animation finish first: mid-animation boxes are shifted and shrunk, which
  // hid a 1-3 px clip at the bottom.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await expect
    .poll(
      () =>
        back.evaluate((button) => {
          const box = button.getBoundingClientRect();
          const outside = (
            name: string,
            r: { left: number; top: number; right: number; bottom: number },
          ) =>
            box.left < r.left - 0.5 ||
            box.top < r.top - 0.5 ||
            box.right > r.right + 0.5 ||
            box.bottom > r.bottom + 0.5
              ? [name]
              : [];
          const clipped = outside('viewport', {
            left: 0,
            top: 0,
            right: window.innerWidth,
            bottom: window.innerHeight,
          });
          for (let node = button.parentElement; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
            const edge = node.getBoundingClientRect();
            const left = edge.left + node.clientLeft;
            const top = edge.top + node.clientTop;
            const name = `${node.tagName.toLowerCase()}.${node.className.replace(/ /g, '.')}`;
            clipped.push(
              ...outside(name, {
                left,
                top,
                right: left + node.clientWidth,
                bottom: top + node.clientHeight,
              }),
            );
          }
          return clipped;
        }),
      { message: 'The way back must sit wholly on screen and inside the sheet' },
    )
    .toEqual([]);
  await back.click();
  await expect(dialog).toHaveCount(0);
});

test('the handover bark is said once per watch, even after leaving the map', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['kaya', 'sura'], 'bark-once');
  await page.evaluate(() => {
    const app = window.fnt!.app;
    const said: string[] = [];
    (window as unknown as { said: string[] }).said = said;
    const show = app.toasts.show.bind(app.toasts);
    app.toasts.show = (text, ...rest) => {
      if (text.includes('Hanru: “')) said.push(text);
      show(text, ...rest);
    };
    app.dispatch({ type: 'enterNode', nodeId: 'village_explore' });
  });
  const said = () => page.evaluate(() => (window as unknown as { said: string[] }).said.length);
  const atGate = (day: number) =>
    page.evaluate((day) => {
      const app = window.fnt!.app;
      const state = app.state!;
      app.adoptSave(
        {
          ...state,
          screen: 'explore',
          flags: { ...state.flags, 'scene.bd03_handover': 'completed' },
          story: { ...state.story, nodeId: 'village_explore', visited: ['mira_intro'] },
          location: { mapId: 'ba_dan_village', pos: { x: 20, y: 7 } },
          world: { ...state.world, clock: { day, phase: 'evening' } },
        },
        undefined,
      );
    }, day);
  await atGate(1);
  await expect.poll(said).toBe(1);
  // Away to the riverside and back to the gate in the same watch: no repeat.
  await enterNode(page, 'riverside_explore');
  await expect(page.locator('.village-controls')).toBeVisible();
  await atGate(1);
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 21, y: 7 } }));
  await waitForIdle(page);
  expect(await said()).toBe(1);
  // The next evening's handover has its own.
  await atGate(2);
  await expect.poll(said).toBe(2);
});

test('waiting at the porch until midday brings Dorin and his drill to the riverside', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await openActivities(page);
  await expect(page.getByRole('button', { name: "Dorin's drill", exact: true })).toHaveCount(0);
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 8, y: 18 } }));
  await waitForIdle(page);
  await openActivities(page);
  await page.getByRole('button', { name: 'Wait until…', exact: true }).click();
  await page.getByRole('dialog').locator('.choice-option').filter({ hasText: 'Midday' }).click();
  await expect.poll(() => clock(page)).toEqual({ day: 2, phase: 'midday' });
  // The opening line follows the phase.
  await expect(page.locator('.village-note')).toContainText('Midday by the river.');
  await openActivities(page);
  await expect(page.getByRole('button', { name: "Dorin's drill", exact: true })).toBeVisible();
});
