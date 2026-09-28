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
 * The phone's More list drops over the map, where toasts hang. A toast raised
 * while it is open moves its band clear of the list — under it upright,
 * beside it on its side — and the live region stays on screen, so a screen
 * reader still hears it. On its side at Largest text the list is taller than
 * the room under the header, so it scrolls and every button stays a full tap.
 * An AI turn rebuilds the header on every sync; focus in the list survives
 * that, and the list closes, focus on More, when the acting unit changes.
 */
test('the phone More list keeps clear of toasts, fits the screen and keeps focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Riko', 'Tal'], ['nima', 'kaya', 'sura', 'bo'], 'hud-phone-more');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);
  await settleLayout(page);

  const more = page.getByRole('button', { name: 'More', exact: true });
  const list = page.locator('#combat-more');
  const live = page.locator('.toasts[aria-live="polite"]');

  /** Raises a toast and reports the boxes once its band has settled. */
  const raise = async (text: string) => {
    await page.evaluate((line) => window.fnt!.app.toasts.show(line, 'info', 20_000), text);
    await expect(live).toBeVisible();
    await expect(live).toContainText(text);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const menu = document.querySelector('#combat-more')?.getBoundingClientRect();
          const toast = document
            .querySelector('.toasts .toast:last-child')
            ?.getBoundingClientRect();
          if (!menu || !toast || menu.height === 0 || toast.height === 0) return 'missing';
          const hits =
            menu.left < toast.right &&
            toast.left < menu.right &&
            menu.top < toast.bottom &&
            toast.top < menu.bottom;
          const onScreen =
            toast.left >= 0 &&
            toast.top >= 0 &&
            toast.right <= innerWidth &&
            toast.bottom <= innerHeight;
          return hits ? 'overlap' : onScreen ? 'clear' : 'off-screen';
        }),
      )
      .toBe('clear');
    await page.evaluate(() => window.fnt!.app.toasts.clear());
  };

  // Upright: the band drops under the open list.
  await more.tap();
  await expect(list).toBeVisible();
  await raise('Upright, under the list.');

  // Focus inside the list survives a sync. A sync that changes nothing the
  // header draws leaves it alone: the focused button is the same node and
  // focus is never set again, so a screen reader does not re-announce it
  // several times a second through an AI turn.
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  const tip = page.getByRole('button', { name: 'Tip', exact: true });
  await tip.focus();
  const synced = await page.evaluate(() => {
    const before = document.activeElement;
    let moves = 0;
    const count = () => moves++;
    document.addEventListener('focusin', count, true);
    document.addEventListener('focusout', count, true);
    for (let i = 0; i < 5; i++) window.fnt!.app.updateSettings({});
    document.removeEventListener('focusin', count, true);
    document.removeEventListener('focusout', count, true);
    return { moves, same: document.activeElement === before };
  });
  expect(synced).toEqual({ moves: 0, same: true });
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(tip).toBeFocused();

  // The next unit's turn finds the list closed, with focus on More, not the page.
  const handedOver = await page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state!.battle!;
    const unitId = battle.order[battle.turnIndex]!;
    app.dispatch({ type: 'endTurn', unitId });
    const active = document.activeElement;
    return {
      changed: app.state?.battle?.order[app.state.battle.turnIndex] !== unitId,
      expanded: document.querySelector('.combat-more-toggle')?.getAttribute('aria-expanded'),
      open: document.querySelector('#combat-more')?.classList.contains('open'),
      onToggle: active?.classList.contains('combat-more-toggle') ?? false,
    };
  });
  expect(handedOver).toEqual({ changed: true, expanded: 'false', open: false, onToggle: true });

  // On its side at Largest text: the list scrolls inside the room it has,
  // every button a full tap and the last one reachable, and a toast sits
  // beside it.
  await takeTurn(page);
  await waitForIdle(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await setLargeText(page, 'huge');
  await settleLayout(page);
  // The list is capped the moment it opens, not a frame or a restyle later.
  const opened = await page.evaluate(() => {
    document.querySelector<HTMLElement>('.combat-more-toggle')?.click();
    return document.querySelector('#combat-more')?.getBoundingClientRect().bottom ?? Infinity;
  });
  expect(opened).toBeLessThanOrEqual(390);
  await expect(list).toBeVisible();
  const fit = await page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>('#combat-more')!;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const tap =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap')) * rem;
    const buttons = [...menu.querySelectorAll<HTMLElement>('button')].filter(
      (button) => button.getClientRects().length > 0,
    );
    return {
      overflowY: getComputedStyle(menu).overflowY,
      scrolls: menu.scrollHeight > menu.clientHeight,
      tap,
      sizes: buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return Math.min(box.width, box.height);
      }),
    };
  });
  // The list is taller than the room here: that is the case being held.
  expect(fit.scrolls).toBe(true);
  expect(fit.overflowY).toBe('auto');
  expect(fit.sizes.length).toBeGreaterThanOrEqual(2);
  for (const size of fit.sizes) expect(size).toBeGreaterThanOrEqual(fit.tap - 0.5);
  const last = list.locator('button:visible').last();
  await last.scrollIntoViewIfNeeded();
  const lastBox = await last.boundingBox();
  const listBox = await list.boundingBox();
  expect(lastBox && listBox).toBeTruthy();
  expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(
    (listBox?.y ?? 0) + (listBox?.height ?? 0) + 0.5,
  );
  await raise('On its side, beside the list.');
});

/**
 * Where the band fits neither 16rem beside the open list nor under it, it
 * still stays on screen and off the list. A 667×375 phone on its side at
 * Largest text has 15rem left of the list and no room under it, so a long
 * line goes beside in the narrower width; a 360×640 phone upright has no
 * width beside and too little under, so the line takes the foot and the list
 * gives it the room. Either way every button left in the list is a full tap.
 */
const LONG_TOAST =
  'Hold the gate together: the deserters rush whoever stands alone, so keep everyone within a step of a friend and let the first charge break on the rocks.';

for (const [width, height, where] of [
  [667, 375, 'map-beside'],
  [360, 640, 'map-foot'],
] as const) {
  test(`a long toast stays on screen and clear of the More list at ${width}x${height}, Largest text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Riko', 'Tal'], ['nima', 'kaya', 'sura', 'bo'], 'hud-phone-crowded');
    await enterNode(page, 'battle_quarry_gate');
    await takeTurn(page);
    await waitForIdle(page);
    await page.setViewportSize({ width, height });
    await setLargeText(page, 'huge');
    await settleLayout(page);

    const more = page.getByRole('button', { name: 'More', exact: true });
    await more.tap();
    await expect(page.locator('#combat-more')).toBeVisible();
    await page.evaluate((line) => window.fnt!.app.toasts.show(line, 'info', 20_000), LONG_TOAST);
    await expect(page.locator('.toasts[aria-live="polite"]')).toContainText(LONG_TOAST);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const menu = document.querySelector('#combat-more')?.getBoundingClientRect();
          const toasts = [...document.querySelectorAll('.toasts .toast')]
            .map((toast) => toast.getBoundingClientRect())
            .filter((box) => box.height > 0);
          if (!menu || menu.height === 0 || toasts.length === 0) return 'missing';
          if (menu.bottom > innerHeight) return 'list off screen';
          for (const toast of toasts) {
            if (
              menu.left < toast.right &&
              toast.left < menu.right &&
              menu.top < toast.bottom &&
              toast.top < menu.bottom
            )
              return 'overlap';
            if (
              toast.left < 0 ||
              toast.top < 0 ||
              toast.right > innerWidth ||
              toast.bottom > innerHeight
            )
              return 'off screen';
          }
          return document.querySelector<HTMLElement>('.toasts')?.dataset.place;
        }),
      )
      .toBe(where);

    // The list still offers full-size buttons in whatever room it kept.
    const sizes = await page.evaluate(() => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const tap =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap')) * rem;
      const menu = document.querySelector('#combat-more')!;
      return {
        tap,
        clientHeight: menu.clientHeight,
        sizes: [...menu.querySelectorAll('button')]
          .filter((button) => button.getClientRects().length > 0)
          .map((button) => {
            const box = button.getBoundingClientRect();
            return Math.min(box.width, box.height);
          }),
      };
    });
    expect(sizes.clientHeight).toBeGreaterThanOrEqual(sizes.tap);
    for (const size of sizes.sizes) expect(size).toBeGreaterThanOrEqual(sizes.tap - 0.5);

    // Closing the list gives the band back to the map and the list its room.
    await page.keyboard.press('Escape');
    await expect(page.locator('.toasts')).toHaveAttribute('data-place', 'map');
    expect(
      await page.evaluate(() => document.documentElement.style.getPropertyValue('--toast-reserve')),
    ).toBe('');
  });
}

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
