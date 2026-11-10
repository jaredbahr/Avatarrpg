import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, settleDialog, startGame } from './helpers';

const groups = [
  {
    name: 'Text size',
    labels: ['Normal', 'Large', 'Largest'],
    values: ['off', 'on', 'huge'],
    field: 'largeText',
    initial: 0,
  },
  {
    name: 'Sound',
    labels: ['Off', 'Quiet', 'Normal', 'Loud'],
    values: [0, 0.35, 0.7, 1],
    field: 'volume',
    initial: 2,
  },
] as const;
const contexts = ['title', 'Mira dialogue', 'conversation choice'] as const;

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
    expect(
      await target.evaluate((node) => {
        const dialog = node.closest('[role="dialog"]');
        return dialog === null || dialog.contains(document.activeElement);
      }),
      'every Tab step remains inside the target modal',
    ).toBe(true);
  }
  throw new Error('Settings radio is not reachable through the existing Tab order');
}

async function game(page: Page) {
  return page.evaluate(() => ({ state: window.fnt!.app.state, session: window.fnt!.app.session }));
}

async function open(page: Page, context: (typeof contexts)[number]): Promise<Locator> {
  await resetStorage(page, '?renderer=canvas&titleArt=a&titleArtHold=0');
  if (context !== 'title') {
    await startGame(page, ['Radio reviewer'], ['kaya'], 'settings-radio-604');
    await enterNode(page, 'village_explore');
    await enterNode(page, context === 'Mira dialogue' ? 'mira_intro' : 'plant_chair');
    await expect(page.locator('.explore-conversation')).toBeVisible();
    if (context === 'Mira dialogue') await expect(page.locator('.line-count')).toHaveText('1 of 4');
    else await expect(page.locator('.explore-conversation .choice-panel')).toBeVisible();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
  }
  const opener = page.getByRole('button', { name: 'Settings', exact: true });
  await tabTo(page, opener);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settleDialog(dialog);
  await expect(dialog.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
  return dialog;
}

async function visibleFocus(radio: Locator) {
  await expect(radio).toBeFocused();
  await expect(radio).toBeInViewport();
  const observed = await radio.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      live: node.isConnected,
      focusVisible: node.matches(':focus-visible'),
      outline: parseFloat(getComputedStyle(node).outlineWidth),
      hit: node.contains(
        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
      ),
    };
  });
  expect(observed).toMatchObject({ live: true, focusVisible: true, hit: true });
  expect(observed.outline).toBeGreaterThanOrEqual(3);
  return observed;
}

async function escapeLayers(page: Page, dialog: Locator, context: (typeof contexts)[number]) {
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  if (context === 'title') {
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  } else {
    const pause = page.getByRole('dialog', { name: 'Paused', exact: true });
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(pause).toHaveCount(0);
  }
}

for (const context of contexts) {
  for (const group of groups) {
    test(`${context}: ${group.name} arrows select, wrap and retain live modal focus`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const dialog = await open(page, context);
      const before = await game(page);
      const settingsBefore = await page.evaluate(() => window.fnt!.app.settings);
      const row = dialog.getByRole('radiogroup', { name: group.name, exact: true });
      await expect(row.getByRole('radio')).toHaveCount(group.labels.length);
      await tabTo(page, row.getByRole('radio', { name: group.labels[group.initial], exact: true }));
      let selected: number = group.initial;
      const observations = [];
      // A complete forward cycle proves wrapping. Both vertical and reverse
      // arrows then select independent expected neighbours without DOM mutation.
      const keys = [
        ...Array<string>(group.labels.length).fill('ArrowRight'),
        'ArrowDown',
        'ArrowLeft',
        'ArrowUp',
        'ArrowDown',
        'ArrowRight',
      ];
      for (const key of keys) {
        selected =
          (selected +
            (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1) +
            group.labels.length) %
          group.labels.length;
        await page.keyboard.press(key);
        const radio = row.getByRole('radio', { name: group.labels[selected], exact: true });
        await expect(radio).toHaveAttribute('aria-checked', 'true');
        await expect(row.getByRole('radio', { checked: true })).toHaveCount(1);
        const focus = await visibleFocus(radio);
        expect(await page.evaluate(() => window.fnt!.app.settings)).toEqual({
          ...settingsBefore,
          [group.field]: group.values[selected],
        });
        expect(await game(page)).toEqual(before);
        observations.push({ key, selected: group.labels[selected], focus });
      }
      await info.attach('real-arrow-observations', {
        body: JSON.stringify({
          context,
          group: group.name,
          observations,
          before,
          after: await game(page),
        }),
        contentType: 'application/json',
      });
      await page.screenshot({ path: info.outputPath('selected-live-radio.png') });
      await escapeLayers(page, dialog, context);
      expect(await game(page)).toEqual(before);
      await page.reload();
      await page.waitForFunction(() => Boolean(window.fnt?.app));
      expect(await page.evaluate(() => window.fnt!.app.settings)).toEqual({
        ...settingsBefore,
        [group.field]: group.values[selected],
      });
      expect(errors).toEqual([]);
    });
  }

  test(`${context}: all radio Tab stops and click, Enter, Space heading guards survive`, async ({
    page,
  }, info) => {
    const dialog = await open(page, context);
    const before = await game(page);
    for (const group of groups) {
      const row = dialog.getByRole('radiogroup', { name: group.name, exact: true });
      // Existing navigation intentionally exposes every radio to Tab.
      for (const label of group.labels) {
        await tabTo(page, row.getByRole('radio', { name: label, exact: true }));
        await visibleFocus(row.getByRole('radio', { name: label, exact: true }));
      }
      const last = group.labels.length - 1;
      for (const [index, key] of [
        [last, 'click'],
        [0, 'Enter'],
        [1, 'Space'],
      ] as const) {
        const radio = row.getByRole('radio', { name: group.labels[index], exact: true });
        if (key === 'click') await radio.click();
        else {
          await tabTo(page, radio);
          await page.keyboard.press(key);
        }
        await expect(dialog.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
        await expect(
          row.getByRole('radio', { name: group.labels[index], exact: true }),
        ).toHaveAttribute('aria-checked', 'true');
        expect((await page.evaluate(() => window.fnt!.app.settings))[group.field]).toBe(
          group.values[index],
        );
        await page.keyboard.press('Enter');
        await page.keyboard.press('Space');
        expect(await game(page)).toEqual(before);
        await expect(dialog).toBeVisible();
      }
    }
    const done = dialog.getByRole('button', { name: 'Done', exact: true });
    const first = dialog
      .getByRole('radiogroup', { name: 'Text size', exact: true })
      .getByRole('radio', { name: 'Normal', exact: true });
    await tabTo(page, done);
    await page.keyboard.press('Tab');
    await visibleFocus(first);
    await page.keyboard.press('Shift+Tab');
    await expect(done).toBeFocused();
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    expect(await game(page)).toEqual(before);
    await info.attach('activation-control-state', {
      body: JSON.stringify({
        before,
        after: await game(page),
        settings: await page.evaluate(() => window.fnt!.app.settings),
      }),
      contentType: 'application/json',
    });
    await page.screenshot({ path: info.outputPath('heading-focus-control.png') });
    await escapeLayers(page, dialog, context);
    expect(await game(page)).toEqual(before);
    if (context === 'Mira dialogue') {
      await page.locator('[data-conversation-control="next"]').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.line-count')).toHaveText('2 of 4');
    } else if (context === 'conversation choice') {
      await page.getByRole('button', { name: /Sit down.*Take a break at the shop/ }).focus();
      await page.keyboard.press('Space');
      await expect
        .poll(() => page.evaluate(() => window.fnt!.app.state?.story.nodeId))
        .toBe('plant_chair_seat');
    }
  });
}

for (const group of groups) {
  test(`title: ${group.name} arrow advances from an unchecked focused radio`, async ({
    page,
  }, info) => {
    const dialog = await open(page, 'title');
    const before = await game(page);
    const settingsBefore = await page.evaluate(() => window.fnt!.app.settings);
    const row = dialog.getByRole('radiogroup', { name: group.name, exact: true });
    const from = group.name === 'Text size' ? 1 : 0;
    const target = from + 1;
    const unchecked = row.getByRole('radio', { name: group.labels[from], exact: true });
    await expect(unchecked).toHaveAttribute('aria-checked', 'false');
    await tabTo(page, unchecked);
    await visibleFocus(unchecked);
    await page.keyboard.press('ArrowRight');
    const next = row.getByRole('radio', { name: group.labels[target], exact: true });
    await expect(next).toHaveAttribute('aria-checked', 'true');
    await expect(row.getByRole('radio', { checked: true })).toHaveCount(1);
    const focus = await visibleFocus(next);
    const settings = { ...settingsBefore, [group.field]: group.values[target] };
    expect(await page.evaluate(() => window.fnt!.app.settings)).toEqual(settings);
    expect(await game(page)).toEqual(before);
    await info.attach('unchecked-arrow-observation', {
      body: JSON.stringify({
        group: group.name,
        from: group.labels[from],
        target: group.labels[target],
        focus,
        before,
        after: await game(page),
        settings,
      }),
      contentType: 'application/json',
    });
    await page.screenshot({ path: info.outputPath('unchecked-arrow-focus.png') });
    await escapeLayers(page, dialog, 'title');
    expect(await game(page)).toEqual(before);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.fnt?.app));
    expect(await page.evaluate(() => window.fnt!.app.settings)).toEqual(settings);
  });
}
