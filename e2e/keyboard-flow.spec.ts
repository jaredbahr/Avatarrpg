import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { resetStorage, waitForIdle } from './helpers';
import { fightToTheEnd, keyboardDriver, playToFirstFight } from './input-play';

async function expectVisibleFocus(target: Locator): Promise<void> {
  await expect(target).toBeFocused();
  const [outline] = await Promise.all([
    target.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        focusVisible: element.matches(':focus-visible'),
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    }),
    expect(target).toBeVisible(),
    expect(target).toBeInViewport(),
    expect(target).toBeEnabled(),
  ]);
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

function linesOf(nodeId: string): number {
  const node = CONTENT.story.get(nodeId);
  if (node?.kind !== 'dialogue') throw new Error(`${nodeId} is not a dialogue`);
  return node.lines.length;
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
  // The campaign opens on the prologue (#763), then Ba Dan's opening lines.
  await expectNode(page, 'prologue_storm');
  expect(await page.evaluate(() => window.fnt?.app.session.participants[0]?.name)).toBe('Alex');
  expect(
    await page.evaluate(() => window.fnt?.app.state?.party.map((hero) => hero.characterId)),
  ).toEqual(['kaya', 'nilak', 'bo']);

  const opening = page.locator('[data-interlude-control="next"]');
  await advanceLines(page, opening, linesOf('prologue_storm'));
  await expectNode(page, 'act1_open');
  await advanceLines(page, opening, linesOf('act1_open'));
  await expectNode(page, 'village_explore');
  const map = button(page, 'Map');
  // The party arrives within reach of Mira's table (the Ba Dan blockout, #875), so the
  // HUD's contextual action, Talk, takes the first focus and one Enter opens her scene.
  await expectVisibleFocus(button(page, 'Talk Elder Mira'));
  await page.keyboard.press('Enter');
  await expectNode(page, 'mira_intro');
  const next = page.locator('[data-conversation-control="next"]');
  await advanceLines(page, next, linesOf('mira_intro'));
  // The rest of Mira's table (DLG-01) by keyboard: each turn, then one question.
  for (let step = 0; step < 40; step++) {
    const nodeId = await page.evaluate(() => window.fnt?.app.state?.story.nodeId ?? '');
    if (nodeId === 'village_explore') break;
    if (CONTENT.story.get(nodeId)?.kind === 'choice')
      await pressControl(page, page.locator('.choice-option:not([disabled])').first());
    else await pressControl(page, next);
  }
  await expectNode(page, 'village_explore');

  // Mira's table seats the party two cells from where her scene ends, so walk there by
  // keyboard the way a player would: Look around offers the seat.
  await pressControl(page, button(page, 'Look around'));
  await pressControl(page, button(page, /Sit and wait/));
  await waitForIdle(page);
  await pressControl(page, button(page, /^Wait/));
  await pressControl(page, button(page, /Afternoon/));
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.world.clock.phase))
    .toBe('afternoon');
  await expectVisibleFocus(button(page, /^Wait/));
  // Gao keeps his shop across the square: walk over by direction, east along the square's
  // south side and then north to his shop front, until his Talk is offered.
  const gao = button(page, 'Talk Gao the Shopkeeper');
  for (let step = 0; step < 16 && !(await gao.isVisible()); step++) {
    const x = await page.evaluate(() => window.fnt?.app.state?.location.pos.x ?? 0);
    await page.locator('canvas.map-canvas').focus();
    await page.keyboard.press(x < 19 ? 'ArrowRight' : 'ArrowUp');
    await waitForIdle(page);
  }
  // Focus is on the map after the walk; the HUD's Talk comes after it in tab order.
  await pressControl(page, gao);
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
  // can name the next map while the animated village exit is still playing:
  // from Gao to the east road that walk is about nine seconds of playback
  // (measured), so wait for the playback to end rather than racing it with
  // the 10 s assertion default, which CI's WebKit lost.
  await waitForIdle(page);
  await expect(page.locator('.title-plate-name')).toHaveText('The Forest Road');
  await expect(page.locator('canvas.map-canvas')).toHaveAttribute(
    'aria-label',
    'The Forest Road map',
  );
  await pressControl(page, button(page, 'Talk Lanfen, road keeper'), 'Enter', 'Shift+Tab');
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

test('arrow keys, Enter and Escape alone play from the title to the end of the first fight', async ({
  page,
}) => {
  test.setTimeout(360_000);
  await resetStorage(page, '?renderer=canvas&titleArtHold=0');
  const keys = keyboardDriver(page);
  await playToFirstFight(page, keys);

  // The action bar's number keys are the keyboard's own shortcut: 1 is Move.
  await expect.poll(() => page.evaluate(() => window.fnt?.app.boardBusy() === false)).toBe(true);
  await expect(page.locator('.combat-scene .hud .action-row > button').first()).toBeFocused();
  await page.keyboard.press('Digit1');
  await expect(page.locator('.combat-scene .hud [data-slot="move"]')).toHaveClass(/selected/);
  await expect(page.locator('.combat-scene canvas.map-canvas')).toBeFocused();
  await expect(page.locator('.input-legend')).toContainText('Choose a tile');
  await page.keyboard.press('Escape');
  await expect(page.locator('.combat-scene .hud [data-slot="move"]')).toBeFocused();
  await expect(page.locator('.combat-scene .hud [data-slot="move"]')).not.toHaveClass(/selected/);

  const outcome = await fightToTheEnd(page, keys);
  test.info().annotations.push({ type: 'fight outcome', description: outcome });
  expect(await page.evaluate(() => window.fnt?.app.state?.battle ?? null)).toBeNull();
  expect(await page.evaluate(() => window.fnt?.app.state?.story.visited)).toContain(
    'battle_forest_road',
  );
});
