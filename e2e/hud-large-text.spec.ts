import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

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
  await page.evaluate(() => window.fnt?.app.updateSettings({ largeText: 'huge' }));
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
