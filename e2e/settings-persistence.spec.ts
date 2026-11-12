import { expect, test } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';
import type { Settings } from '../src/app/storage/localSaves';
import type { MapView } from '../src/render/view';
import { enterNode, resetStorage } from './helpers';

// Independent expectations for the shipped UI, rather than importing the
// implementation's defaults or assuming any newly added control is covered.
const defaults: Settings = {
  largeText: 'off',
  volume: 0.7,
  music: 0.35,
  reduceMotion: false,
  hatchSurfaces: false,
  highContrast: false,
  showGrid: false,
  storyChoices: 'vote',
};
const inventory = [
  'Text size',
  'Sound',
  'Music',
  'Story choices',
  'Reduce motion',
  'Patterned ground',
  'Higher contrast',
  'Show grid',
];
const switches = [
  ['Reduce motion', 'reduceMotion'],
  ['Patterned ground', 'hatchSurfaces'],
  ['Higher contrast', 'highContrast'],
  ['Show grid', 'showGrid'],
] as const;
const changes: { label: string; values: Partial<Settings> }[] = [
  { label: 'Text size', values: { largeText: 'huge' } },
  { label: 'Sound', values: { volume: 0 } },
  { label: 'Music', values: { music: 0 } },
  { label: 'Story choices', values: { storyChoices: 'turns' } },
  { label: 'Reduce motion', values: { reduceMotion: true } },
  { label: 'Patterned ground', values: { hatchSurfaces: true } },
  { label: 'Higher contrast', values: { highContrast: true } },
  { label: 'Show grid', values: { showGrid: true } },
];

// Passive reads of the existing renderer's last genuinely drawn frame. This
// adds no production hook, replaces no draw function and fabricates no view.
type DrawnApp = { scene?: { renderer?: { lastView: MapView | null } } };

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(
    () => Boolean(window.fnt?.app) && !window.fnt?.app.curtainBusy,
    undefined,
    {
      timeout: 10_000,
    },
  );
}

async function openSettings(page: Page): Promise<Locator> {
  await ready(page);
  if (await page.locator('.title-card').count()) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Paused', exact: true })
      .getByRole('button', { name: 'Settings', exact: true })
      .click();
  }
  const panel = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

async function closeSettings(page: Page, panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: 'Done', exact: true }).click();
  const paused = page.getByRole('dialog', { name: 'Paused', exact: true });
  if (await paused.count())
    await paused.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function assertControlValues(panel: Locator, expected: Settings): Promise<void> {
  // Inventory the actual DOM, including extra input types/plain buttons, so
  // adding a ninth setting fails loudly instead of silently escaping tests.
  await expect(panel.locator('.setting-row .setting-text > strong')).toHaveText(inventory);
  await expect(panel.getByRole('radiogroup')).toHaveCount(4);
  await expect(panel.getByRole('switch')).toHaveCount(4);
  expect(
    await panel
      .getByRole('radiogroup')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label'))),
  ).toEqual(['Text size', 'Sound', 'Music', 'Story choices']);
  expect(
    await panel
      .getByRole('switch')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label'))),
  ).toEqual(switches.map(([label]) => label));
  await expect(
    panel.locator('input, select, textarea, [role="slider"], [role="combobox"]'),
  ).toHaveCount(0);
  await expect(panel.locator('button:not([role])')).toHaveText(['Done']);

  const text = panel.getByRole('radiogroup', { name: 'Text size', exact: true });
  const sound = panel.getByRole('radiogroup', { name: 'Sound', exact: true });
  await expect(text.getByRole('radio')).toHaveText(['Normal', 'Large', 'Largest']);
  const music = panel.getByRole('radiogroup', { name: 'Music', exact: true });
  await expect(sound.getByRole('radio')).toHaveText(['Off', 'Quiet', 'Normal', 'Loud']);
  await expect(music.getByRole('radio')).toHaveText(['Off', 'Quiet', 'Normal', 'Loud']);
  await expect(text.locator('[aria-checked="true"]')).toHaveText(
    expected.largeText === 'huge' ? 'Largest' : expected.largeText === 'on' ? 'Large' : 'Normal',
  );
  await expect(sound.locator('[aria-checked="true"]')).toHaveText(
    expected.volume === 0 ? 'Off' : 'Normal',
  );
  await expect(music.locator('[aria-checked="true"]')).toHaveText(
    expected.music === 0 ? 'Off' : 'Quiet',
  );
  const story = panel.getByRole('radiogroup', { name: 'Story choices', exact: true });
  await expect(story.getByRole('radio')).toHaveText(['Table vote', 'Take turns']);
  await expect(story.locator('[aria-checked="true"]')).toHaveText(
    expected.storyChoices === 'turns' ? 'Take turns' : 'Table vote',
  );
  for (const [label, key] of switches) {
    await expect(panel.getByRole('switch', { name: label, exact: true })).toHaveAttribute(
      'aria-checked',
      String(expected[key]),
    );
  }
}

async function setThroughUi(panel: Locator, values: Partial<Settings>): Promise<void> {
  if (values.largeText !== undefined) {
    const name =
      values.largeText === 'huge' ? 'Largest' : values.largeText === 'on' ? 'Large' : 'Normal';
    await panel
      .getByRole('radiogroup', { name: 'Text size', exact: true })
      .getByRole('radio', { name, exact: true })
      .click();
  }
  if (values.volume !== undefined) {
    await panel
      .getByRole('radiogroup', { name: 'Sound', exact: true })
      .getByRole('radio', { name: values.volume === 0 ? 'Off' : 'Normal', exact: true })
      .click();
  }
  if (values.music !== undefined) {
    await panel
      .getByRole('radiogroup', { name: 'Music', exact: true })
      .getByRole('radio', { name: values.music === 0 ? 'Off' : 'Quiet', exact: true })
      .click();
  }
  if (values.storyChoices !== undefined) {
    await panel
      .getByRole('radiogroup', { name: 'Story choices', exact: true })
      .getByRole('radio', {
        name: values.storyChoices === 'turns' ? 'Take turns' : 'Table vote',
        exact: true,
      })
      .click();
  }
  for (const [label, key] of switches) {
    if (values[key] === undefined) continue;
    const control = panel.getByRole('switch', { name: label, exact: true });
    if ((await control.getAttribute('aria-checked')) !== String(values[key])) await control.click();
  }
}

async function rootSnapshot(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app) throw new Error('Settings did not boot');
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const raw = localStorage.getItem('fnt.settings');
    return {
      settings: app.settings,
      raw,
      fontSize: parseFloat(style.fontSize),
      motionScale: parseFloat(style.getPropertyValue('--motion-scale')),
      hairline: parseFloat(style.getPropertyValue('--hairline')),
      root: {
        largeText: root.dataset.largeText,
        reduceMotion: root.dataset.reduceMotion,
        hatch: root.dataset.hatch,
        contrast: root.dataset.contrast,
        grid: root.dataset.grid,
      },
    };
  });
}

async function assertRoot(page: Page, expected: Settings, stored: boolean): Promise<void> {
  await ready(page);
  const actual = await rootSnapshot(page);
  expect(actual.settings).toEqual(expected);
  if (stored) {
    expect(actual.raw).not.toBeNull();
    expect(JSON.parse(actual.raw ?? '')).toEqual(expected);
  }
  expect(actual.root).toEqual({
    largeText: expected.largeText,
    reduceMotion: expected.reduceMotion ? 'on' : 'off',
    hatch: expected.hatchSurfaces ? 'on' : 'off',
    contrast: expected.highContrast ? 'high' : 'normal',
    grid: expected.showGrid || expected.highContrast ? 'on' : 'off',
  });
  expect(actual.fontSize).toBeCloseTo(
    expected.largeText === 'huge' ? 24 : expected.largeText === 'on' ? 20 : 16,
  );
  expect(actual.motionScale).toBe(expected.reduceMotion ? 0 : 1);
  expect(actual.hairline).toBe(expected.highContrast ? 2 : 1);
}

async function drawnFrame(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    const view = (app as unknown as DrawnApp)?.scene?.renderer?.lastView;
    if (!view) return null;
    return {
      time: view.time,
      hatch: view.hatch,
      gridLines: view.gridLines,
      crispOverlays: view.crispOverlays,
      reducedMotion: view.reducedMotion,
      emitters: view.emitters.map(({ def, from, to, elapsed, seed, palette, arc, still }) => ({
        def,
        from,
        to,
        elapsed,
        seed,
        palette,
        arc,
        still: Boolean(still),
      })),
    };
  });
}

async function assertLiveRendering(page: Page, expected: Settings) {
  // Public game/route entry skips unrelated setup and dialogue only. Unlike
  // startGame(), this fixture never calls updateSettings (which would mask a
  // failed loaded Reduce motion preference by setting it to true).
  if (!(await page.evaluate(() => Boolean(window.fnt?.app.state)))) {
    await page.evaluate(() => {
      const app = window.fnt?.app;
      if (!app) throw new Error('The app is unavailable');
      app.newGame(
        [{ name: 'Settings reviewer', unitId: '' }],
        [{ characterId: 'bo' }],
        'settings-persistence-521',
      );
    });
    await enterNode(page, 'village_explore');
  }
  await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
  await ready(page);
  await expect.poll(async () => (await drawnFrame(page))?.time ?? 0).toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const frame = await drawnFrame(page);
      return frame
        ? {
            hatch: frame.hatch,
            gridLines: frame.gridLines,
            crispOverlays: frame.crispOverlays,
            reducedMotion: frame.reducedMotion,
          }
        : null;
    })
    .toEqual({
      hatch: expected.hatchSurfaces,
      gridLines: expected.showGrid || expected.highContrast,
      crispOverlays: expected.highContrast,
      reducedMotion: expected.reduceMotion,
    });
  const first = await drawnFrame(page);
  if (!first) throw new Error('No actual renderer input was published');
  expect(first.hatch).toBe(expected.hatchSurfaces);
  expect(first.gridLines).toBe(expected.showGrid || expected.highContrast);
  expect(first.crispOverlays).toBe(expected.highContrast);
  expect(first.reducedMotion).toBe(expected.reduceMotion);
  // The authored village has persistent chimney smoke. Empty emitters or a
  // stalled draw loop must fail rather than vacuously proving frozen ambience.
  expect(first.emitters.length).toBeGreaterThan(0);
  await expect
    .poll(async () => (await drawnFrame(page))?.time ?? 0)
    .toBeGreaterThan(first.time + 250);
  const second = await drawnFrame(page);
  if (!second) throw new Error('The renderer lost its live frame');
  expect(second.emitters.length).toBeGreaterThan(0);
  if (expected.reduceMotion) {
    expect(first.emitters.every((emitter) => emitter.still)).toBe(true);
    expect(second.emitters).toEqual(first.emitters);
  } else {
    expect(second.emitters.some((emitter) => !emitter.still)).toBe(true);
    expect(second.emitters).not.toEqual(first.emitters);
  }
  return second;
}

async function checkBoot(page: Page, expected: Settings, stored: boolean): Promise<void> {
  // Read effects before opening Settings or starting gameplay: neither may
  // accidentally repair a preference that failed to apply during app boot.
  await assertRoot(page, expected, stored);
  const panel = await openSettings(page);
  await assertControlValues(panel, expected);
  await closeSettings(page, panel);
}

async function attachEvidence(page: Page, info: TestInfo, label: string): Promise<void> {
  await ready(page);
  await info.attach(`${label}.json`, {
    body: JSON.stringify(
      { root: await rootSnapshot(page), actualRendererInput: await drawnFrame(page) },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  await info.attach(`${label}.png`, { body: await page.screenshot(), contentType: 'image/png' });
}

function errorsFrom(page: Page, errors: string[]): void {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
}

for (const change of changes) {
  test(`${change.label} persists across reload and relaunch, applies live, and restores defaults`, async ({
    page,
    context,
  }, info) => {
    const errors: string[] = [];
    errorsFrom(page, errors);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await resetStorage(page, '?renderer=canvas');
    await checkBoot(page, defaults, false);
    await assertLiveRendering(page, defaults);

    const expected = { ...defaults, ...change.values };
    const panel = await openSettings(page);
    await setThroughUi(panel, change.values);
    await assertControlValues(panel, expected);
    await closeSettings(page, panel);
    await assertRoot(page, expected, true);
    await assertLiveRendering(page, expected);
    await attachEvidence(page, info, 'changed-through-ui');

    await page.reload();
    await checkBoot(page, expected, true);
    await assertLiveRendering(page, expected);
    await attachEvidence(page, info, 'reloaded-effects');

    const relaunched = await context.newPage();
    errorsFrom(relaunched, errors);
    await relaunched.emulateMedia({ reducedMotion: 'no-preference' });
    await relaunched.goto(page.url());
    // This is a fresh Page in the same browser context/origin, with no storage
    // seeding or live settings mutation between the old tab and the relaunch.
    await checkBoot(relaunched, expected, true);
    await assertLiveRendering(relaunched, expected);
    await attachEvidence(relaunched, info, 'fresh-page-effects');
    await page.close();

    // There is no Reset all button. Restore every shipped value through the
    // actual current controls and prove the reset survives both boot paths.
    const reset = await openSettings(relaunched);
    await setThroughUi(reset, defaults);
    await assertControlValues(reset, defaults);
    await closeSettings(relaunched, reset);
    await assertRoot(relaunched, defaults, true);
    await assertLiveRendering(relaunched, defaults);
    await relaunched.reload();
    await checkBoot(relaunched, defaults, true);
    await assertLiveRendering(relaunched, defaults);

    const resetRelaunch = await context.newPage();
    errorsFrom(resetRelaunch, errors);
    await resetRelaunch.emulateMedia({ reducedMotion: 'no-preference' });
    await resetRelaunch.goto(relaunched.url());
    await checkBoot(resetRelaunch, defaults, true);
    await assertLiveRendering(resetRelaunch, defaults);
    await attachEvidence(resetRelaunch, info, 'defaults-restored-and-relaunched');
    expect(errors).toEqual([]);
    await resetRelaunch.close();
    await relaunched.close();
  });
}

const corruptSettings = [
  { label: 'invalid JSON', raw: '{"largeText":' },
  {
    label: 'wrong types',
    raw: JSON.stringify({
      largeText: 24,
      volume: 'loud',
      reduceMotion: 'true',
      hatchSurfaces: 1,
      highContrast: [],
      showGrid: {},
    }),
  },
];

for (const fixture of corruptSettings) {
  test(`corrupt settings (${fixture.label}) silently boot to shipped defaults`, async ({
    page,
    context,
  }, info) => {
    const errors: string[] = [];
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Corrupt only persisted bytes before the app starts. No live preference
    // is assigned, and the corrupt record need not be rewritten during boot.
    // Settle the static document's incidental default favicon request before
    // the error boundary: every app boot/reload/relaunch remains observed.
    await page.goto('/robots.txt', { waitUntil: 'networkidle' });
    await page.evaluate((raw) => {
      localStorage.clear();
      localStorage.setItem('fnt.settings', raw);
    }, fixture.raw);
    expect(await page.evaluate(() => localStorage.getItem('fnt.settings'))).toBe(fixture.raw);
    errorsFrom(page, errors);
    await page.goto('/?renderer=canvas');
    await checkBoot(page, defaults, false);
    await assertLiveRendering(page, defaults);
    await page.reload();
    await checkBoot(page, defaults, false);
    const relaunched = await context.newPage();
    errorsFrom(relaunched, errors);
    await relaunched.emulateMedia({ reducedMotion: 'no-preference' });
    await relaunched.goto(page.url());
    await checkBoot(relaunched, defaults, false);
    await assertLiveRendering(relaunched, defaults);
    await attachEvidence(relaunched, info, 'corrupt-record-default-effects');
    expect(errors).toEqual([]);
    await relaunched.close();
  });
}
