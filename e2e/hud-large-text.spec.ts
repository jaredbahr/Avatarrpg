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

/**
 * The battle HUD at Largest text on an iPad in landscape.
 *
 * Two things ate the board there, and both are height the chrome took rather
 * than earned. `Ambush on the Forest Road` is wider than the header has room
 * for at 1.5x type, and because a flex line wraps before its items shrink the
 * whole of Pause dropped onto a second header row. Under it the initiative
 * strip stacked a portrait over a name in every chip and stood about 120 px
 * tall. Between them the map was left a band. The strip's compact row chip
 * already existed for a short landscape at normal text; Large text asks for
 * the same thing, and the plate's name ellipses instead of pushing the header.
 */
const PARTY = ['nima', 'kaya', 'sura'];

test('the battle header and initiative strip leave the board its screen at Largest text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], PARTY, 'hud-large-text');
  // The longest encounter name in Act 1 is what overflowed the header.
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);
  await setLargeText(page, 'huge');
  await settleLayout(page);

  const hud = await page.evaluate(() => {
    const box = (selector: string): DOMRect | null =>
      document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const pause = [...document.querySelectorAll('.combat-bar button')].find(
      (button) => button.textContent?.trim() === 'Pause',
    );
    // `--tap` is authored in rem, so resolve it against the root size the
    // Large-text setting scales; the point of the token is that it grows.
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const tap =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap')) * rem;
    return {
      plateTop: box('.combat-bar .title-plate')?.top ?? null,
      plateRight: box('.combat-bar .title-plate')?.right ?? null,
      pauseTop: pause?.getBoundingClientRect().top ?? null,
      pauseRight: pause?.getBoundingClientRect().right ?? null,
      canvasHeight: box('.map-canvas')?.height ?? 0,
      stripHeight: box('.turn-strip')?.height ?? 0,
      tap,
      chips: [...document.querySelectorAll('.turn-chip')].map((chip) => ({
        height: chip.getBoundingClientRect().height,
        direction: getComputedStyle(chip).flexDirection,
      })),
    };
  });

  // Pause sits on the header's first row, beside the plate rather than under it.
  expect(hud.plateTop).not.toBeNull();
  expect(hud.pauseTop).not.toBeNull();
  expect(hud.pauseTop ?? 0).toBeCloseTo(hud.plateTop ?? -1, 0);
  expect(hud.pauseRight ?? 0).toBeGreaterThan(hud.plateRight ?? 0);
  expect(hud.pauseRight ?? 0).toBeLessThanOrEqual(1194 + 1);

  // The strip is one row of chips, each still a full touch target.
  expect(hud.chips.length).toBeGreaterThan(0);
  for (const chip of hud.chips) {
    expect(chip.direction).toBe('row');
    expect(chip.height).toBeGreaterThanOrEqual(hud.tap);
  }

  // What the chrome gives up, the board keeps.
  expect(hud.canvasHeight).toBeGreaterThanOrEqual(834 * 0.4);
});

/**
 * A phone held upright. The board used to get about a third of the screen:
 * the header scrolled its own title off at Largest text, every initiative
 * chip stacked a face over a truncated name, and the acting card and actions
 * took the bottom half. Now the header folds its view buttons behind More,
 * the waiting chips are faces with their full names on the chip, and the
 * dock is compact — so the world gets at least half the screen at default.
 */
test('a phone battle gives the board half the screen and keeps its header on one row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Riko', 'Tal'], ['nima', 'kaya', 'sura', 'bo'], 'hud-phone');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);
  await settleLayout(page);

  // More than half: the old layout already scraped 0.52 here at default text,
  // with the title scrolled off and the chips truncated. This one gives 0.58.
  const canvas = await page.locator('.map-canvas').boundingBox();
  expect(canvas?.height ?? 0).toBeGreaterThanOrEqual(844 * 0.55);

  // Every chip names its unit in full, whatever it shows; only the acting
  // chip still shows a label.
  const { names, chips } = await page.evaluate(() => ({
    names: window.fnt!.app.state!.battle!.units.map((unit) => unit.name),
    chips: [...document.querySelectorAll<HTMLElement>('.turn-chip')].map((chip) => ({
      label: chip.getAttribute('aria-label') ?? '',
      title: chip.title,
      active: chip.classList.contains('active'),
      labelShown: (chip.querySelector('span')?.getBoundingClientRect().width ?? 0) > 0,
    })),
  }));
  expect(chips.length).toBeGreaterThan(4);
  expect(chips.some((chip) => chip.label === 'Focus Fire Nation Deserter')).toBe(true);
  for (const chip of chips) {
    const name = chip.label.replace(/^Focus /, '');
    expect(names).toContain(name);
    expect(chip.title.startsWith(name)).toBe(true);
    expect(chip.labelShown).toBe(chip.active);
  }

  for (const size of ['off', 'huge'] as const) {
    await setLargeText(page, size);
    await settleLayout(page);
    const header = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('.combat-bar');
      const plate = document.querySelector('.combat-bar .title-plate')?.getBoundingClientRect();
      const pause = document.querySelector('.combat-bar .combat-pause')?.getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const tap =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap')) * rem;
      return {
        scroll: bar ? bar.scrollWidth - bar.clientWidth : -1,
        page: document.documentElement.scrollWidth,
        plateLeft: plate?.left ?? -1,
        pauseRight: pause?.right ?? Infinity,
        pauseSize: Math.min(pause?.width ?? 0, pause?.height ?? 0),
        tap,
      };
    });
    // No sideways scroll in the header: the title stays where it starts.
    expect(header.scroll).toBe(0);
    expect(header.page).toBeLessThanOrEqual(390);
    expect(header.plateLeft).toBeGreaterThanOrEqual(0);
    expect(header.pauseRight).toBeLessThanOrEqual(390);
    expect(header.pauseSize).toBeGreaterThanOrEqual(header.tap - 0.5);
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  }

  // More is a disclosure: it names itself, opens with focus on its first
  // button, and Escape closes it and hands focus back.
  const more = page.getByRole('button', { name: 'More', exact: true });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Log', exact: true })).toBeHidden();
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  const log = page.getByRole('button', { name: 'Log', exact: true });
  await expect(log).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.closest('#combat-more') !== null)).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(more).toBeFocused();
  await expect(log).toBeHidden();

  // A folded button still does its job, and closes the list behind it.
  await more.tap();
  await log.tap();
  await expect(page.getByRole('button', { name: 'Hide log', exact: true })).toBeHidden();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.log-panel')).toBeVisible();
});

/**
 * The frame-time readout is debug chrome and sits over the board, not over
 * the header. Pinned to the top-left corner it covered the encounter plate on
 * the quarry floor gallery beat — a dark rounded blob behind `Grumbler` — and
 * the beat that turns the readout on is the same one reviewing that header.
 */
test('the frame-time readout keeps off the encounter plate', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await resetStorage(page, '?renderer=canvas&stats=1');
  await startGame(page, ['Explorer'], ['kaya', 'bo', 'wen'], 'hud-stats');
  await enterNode(page, 'battle_grumbler');
  await takeTurn(page);
  await waitForIdle(page);
  await settleLayout(page);

  const overlap = await page.evaluate(() => {
    const stats = document.querySelector('.stats')?.getBoundingClientRect();
    const bar = document.querySelector('.combat-bar')?.getBoundingClientRect();
    const plate = document.querySelector('.combat-bar .title-plate')?.getBoundingClientRect();
    if (!stats || !bar || !plate) return null;
    const hits = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return {
      shown: stats.width > 0 && stats.height > 0,
      bar: hits(stats, bar),
      plate: hits(stats, plate),
    };
  });

  expect(overlap).not.toBeNull();
  // It is still on screen — the readout is the point of `?stats=1`.
  expect(overlap?.shown).toBe(true);
  expect(overlap?.plate).toBe(false);
  expect(overlap?.bar).toBe(false);
});
