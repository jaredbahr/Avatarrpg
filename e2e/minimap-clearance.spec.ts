import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  settleDialog,
  settleLayout,
  startGame,
  waitForIdle,
} from './helpers';

const sizes = [
  { name: 'Normal', setting: 'off', cutoff: 416 },
  { name: 'Large', setting: 'on', cutoff: 512 },
  { name: 'Largest', setting: 'huge', cutoff: 640 },
] as const;
const profiles = [
  ...sizes.map((size) => ({ size, width: 844, height: 390, renderer: 'canvas' })),
  { size: sizes[2], width: 844, height: 390, renderer: 'webgl' },
  ...sizes.map((size) => ({ size, width: 390, height: 844, renderer: 'canvas' })),
  ...[sizes[0], sizes[2]].map((size) => ({
    size,
    width: 1194,
    height: 834,
    renderer: 'canvas',
  })),
];

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    return { state: app.state!, session: app.session.toMeta(), camera: app.rendererCamera() };
  });
}

/** Scroll the real sheet, without scrollIntoView or a forced click. */
async function expose(page: Page, dialog: Locator, control: Locator) {
  const body = dialog.locator(':scope > .stack');
  for (let attempt = 0; attempt < 12; attempt++) {
    const ready = await control.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const region = node.closest('[role="dialog"]')!.querySelector(':scope > .stack')!;
      const clip = region.getBoundingClientRect();
      return (
        box.width > 0 &&
        box.height > 0 &&
        box.top >= clip.top &&
        box.bottom <= clip.bottom &&
        box.left >= 0 &&
        box.right <= innerWidth &&
        node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
      );
    });
    if (ready) return;
    const box = await body.boundingBox();
    if (!box) throw new Error('No visible dialog scroll region');
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(80, box.height / 2));
    const before = await body.evaluate((node) => node.scrollTop);
    await page.mouse.wheel(0, box.height * 0.65);
    await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(before);
  }
  throw new Error('Real wheel could not expose the complete control');
}

async function cornerGeometry(page: Page, retained: boolean) {
  const result = await page.locator('.explore-map-corner').evaluate((corner) => {
    const widget = corner.querySelector('button')!;
    const box = widget.getBoundingClientRect();
    const body = document.querySelector('.explore-body')!.getBoundingClientRect();
    return {
      visible: box.width > 0 && box.height > 0 && getComputedStyle(corner).display !== 'none',
      fits:
        box.left >= body.left &&
        box.top >= body.top &&
        box.right <= body.right &&
        box.bottom <= body.bottom,
      widget: { x: box.x, y: box.y, width: box.width, height: box.height },
      body: { x: body.x, y: body.y, width: body.width, height: body.height },
    };
  });
  // Soft geometry checks preserve the real unforced control outcome on the baseline.
  expect.soft(result.visible, JSON.stringify(result)).toBe(retained);
  if (retained) expect.soft(result.fits, JSON.stringify(result)).toBe(true);
  return result;
}

async function dockClearance(page: Page) {
  const controls = await page.locator('.explore-dock button').evaluateAll((buttons) => {
    const root = getComputedStyle(document.documentElement);
    const tap = root.getPropertyValue('--tap').trim();
    if (!tap.endsWith('rem')) throw new Error(`Unexpected tap token: ${tap}`);
    const minimum = Number.parseFloat(tap) * Number.parseFloat(root.fontSize);
    return buttons.flatMap((button) => {
      const box = button.getBoundingClientRect();
      if (
        (button as HTMLButtonElement).disabled ||
        box.width === 0 ||
        box.height === 0 ||
        getComputedStyle(button).visibility === 'hidden'
      )
        return [];
      const dock = button.closest('.explore-dock')!.getBoundingClientRect();
      return [
        {
          name: button.textContent,
          width: box.width,
          height: box.height,
          minimum,
          bounds: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
          clip: {
            left: Math.max(0, dock.left),
            top: Math.max(0, dock.top),
            right: Math.min(innerWidth, dock.right),
            bottom: Math.min(innerHeight, dock.bottom),
          },
          whollyExposed:
            box.left >= Math.max(0, dock.left) &&
            box.top >= Math.max(0, dock.top) &&
            box.right <= Math.min(innerWidth, dock.right) &&
            box.bottom <= Math.min(innerHeight, dock.bottom),
          receivesCentre: button.contains(
            document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
          ),
        },
      ];
    });
  });
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) {
    expect.soft(control.width, JSON.stringify(control)).toBeGreaterThanOrEqual(control.minimum);
    expect.soft(control.height, JSON.stringify(control)).toBeGreaterThanOrEqual(control.minimum);
    expect.soft(control.whollyExposed, JSON.stringify(control)).toBe(true);
    expect.soft(control.receivesCentre, JSON.stringify(control)).toBe(true);
  }
  return controls;
}

async function hiddenCornerHasNoTabStop(page: Page) {
  expect(await page.getByRole('button', { name: 'Follow party', exact: true }).count()).toBe(0);
  // The restored dock Map has focus after closing its dialog. Traverse a whole
  // real Tab cycle; no programmatic focus or tabindex mutation hides a failure.
  const start = await page.evaluateHandle(() => document.activeElement);
  let returned = false;
  for (let step = 0; step < 30; step++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(
      (initial) => ({
        corner: Boolean(document.activeElement?.closest('.explore-map-corner')),
        returned: document.activeElement === initial,
      }),
      start,
    );
    expect(focus.corner).toBe(false);
    if (focus.returned) {
      returned = true;
      break;
    }
  }
  await start.dispose();
  expect(returned, 'Tab returns to the starting control without entering the hidden corner').toBe(
    true,
  );
}

for (const profile of profiles) {
  const { size, width, height, renderer } = profile;
  test(`${size.name} ${width}x${height} ${renderer}: dock stays usable and Map can recenter`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await resetStorage(page, `?style=topdown&renderer=${renderer}&titleArt=a&titleArtHold=0`);
    await startGame(page, ['Minimap explorer'], ['kaya'], 'minimap-clearance-612');
    await enterNode(page, 'village_explore');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const pause = page.getByRole('dialog', { name: 'Paused', exact: true });
    await pause.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settleDialog(settings);
    await settings
      .getByRole('radiogroup', { name: 'Text size', exact: true })
      .getByRole('radio', { name: size.name, exact: true })
      .click();
    await settings.getByRole('button', { name: 'Done', exact: true }).click();
    await pause.getByRole('button', { name: 'Resume', exact: true }).click();
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.app.settings.largeText)).toBe(size.setting);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
    // Establish the real manually centred view after Settings/viewport reflow.
    // Startup framing may differ by one rounded pixel; do not weaken the exact
    // later restoration oracle or substitute a camera hook/tolerance.
    const preparationBefore = await snapshot(page);
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    const preparationMap = page.getByRole('dialog', { name: 'Local map', exact: true });
    await settleDialog(preparationMap);
    await expect(preparationMap.locator('svg')).toBeVisible();
    const preparationFollow = preparationMap.getByRole('button', {
      name: 'Follow party',
      exact: true,
    });
    await expose(page, preparationMap, preparationFollow);
    expect(await snapshot(page)).toEqual(preparationBefore);
    await preparationFollow.click();
    await expect(preparationMap).toHaveCount(0);
    await settleLayout(page);
    const initial = await snapshot(page);
    expect(initial.state).toEqual(preparationBefore.state);
    expect(initial.session).toEqual(preparationBefore.session);
    await info.attach('real-recenter-preparation', {
      body: JSON.stringify({ before: preparationBefore, after: initial }),
      contentType: 'application/json',
    });
    const hidden = width === 844;
    const geometry = await cornerGeometry(page, !hidden);
    const dock = await dockClearance(page);
    await page.screenshot({ path: info.outputPath('dock-clearance.png') });

    await page.getByRole('button', { name: 'Look around', exact: true }).click();
    const nearby = page.getByRole('dialog', { name: 'Look around', exact: true });
    await settleDialog(nearby);
    await expect(
      nearby.getByRole('button', { name: "Mira's table · Sit and wait", exact: true }),
    ).toBeEnabled();
    expect(await snapshot(page)).toEqual(initial);
    const back = nearby.getByRole('button', { name: 'Back to the path', exact: true });
    await expose(page, nearby, back);
    await back.click();
    await expect(nearby).toHaveCount(0);
    await settleLayout(page);
    expect(await snapshot(page)).toEqual(initial);

    const canvas = page.locator('.explore-scene .map-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Missing actual exploration canvas');
    const origin = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.5 };
    expect(
      await canvas.evaluate(
        (node, point) => document.elementFromPoint(point.x, point.y) === node,
        origin,
      ),
    ).toBe(true);
    await page.mouse.move(origin.x, origin.y);
    await page.mouse.down();
    await page.mouse.move(origin.x - 80, origin.y, { steps: 4 });
    await page.mouse.up();
    await settleLayout(page);
    const dragged = await snapshot(page);
    expect(dragged.state).toEqual(initial.state);
    expect(dragged.session).toEqual(initial.session);
    expect(dragged.camera).not.toEqual(initial.camera);
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    const map = page.getByRole('dialog', { name: 'Local map', exact: true });
    await settleDialog(map);
    await expect(map.locator('svg')).toBeVisible();
    const follow = map.getByRole('button', { name: 'Follow party', exact: true });
    await expose(page, map, follow);
    expect(await snapshot(page)).toEqual(dragged);
    await follow.click();
    await expect(map).toHaveCount(0);
    await settleLayout(page);
    expect(await snapshot(page)).toEqual(initial);

    if (hidden) await hiddenCornerHasNoTabStop(page);
    if (hidden && renderer === 'canvas') {
      for (const [resizedHeight, retained] of [
        [size.cutoff, false],
        [size.cutoff + 1, true],
        [height, false],
      ] as const) {
        await page.setViewportSize({ width, height: resizedHeight });
        await settleLayout(page);
        await cornerGeometry(page, retained);
        await dockClearance(page);
        const resized = await snapshot(page);
        expect(resized.state).toEqual(initial.state);
        expect(resized.session).toEqual(initial.session);
      }
    }

    // A real existing path remains usable; this does not assert #608's label typography.
    if (width === 390 && size.setting === 'huge') {
      await page.getByRole('button', { name: 'Look around', exact: true }).click();
      await settleDialog(nearby);
      const seat = nearby.getByRole('button', { name: "Mira's table · Sit and wait", exact: true });
      await expose(page, nearby, seat);
      await seat.click();
      await waitForIdle(page);
      await settleLayout(page);
      const seated = await snapshot(page);
      expect(seated.state.location.pos).toEqual({ x: 10, y: 5 });
      await page.locator('.action-button').filter({ hasText: "Mira's table" }).click();
      const wait = page.getByRole('dialog', { name: 'Wait until…', exact: true });
      await settleDialog(wait);
      const dawn = wait.getByRole('button', { name: 'Dawn Tomorrow', exact: true });
      await expose(page, wait, dawn);
      expect(await snapshot(page)).toEqual(seated);
      await dawn.click();
      await settleLayout(page);
      const waited = await snapshot(page);
      expect(waited.state.world.clock).toEqual({ day: 2, phase: 'dawn' });
      expect(waited.state.rng).toEqual(seated.state.rng);
      expect(waited.session).toEqual(seated.session);
      await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
      const journal = page.getByRole('dialog', { name: 'Travel journal', exact: true });
      await settleDialog(journal);
      await expect(journal.locator('.explore-phase')).toHaveText('Dawn');
      expect(await snapshot(page)).toEqual(waited);
      const close = journal.getByRole('button', { name: 'Close journal', exact: true });
      await expose(page, journal, close);
      await close.click();
      await settleLayout(page);
      expect(await snapshot(page)).toEqual(waited);
    }
    expect(errors).toEqual([]);
    await info.attach('clearance-and-state-controls', {
      body: JSON.stringify({ profile, geometry, dock, initial, dragged }),
      contentType: 'application/json',
    });
  });
}
