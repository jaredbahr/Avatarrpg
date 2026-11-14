import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { deserialize, serialize, stateFromBlob } from '../src/core/save/serialize';
import { createGame } from '../src/core/state/createGame';
import { apply } from '../src/core/state/reducer';
import { resetStorage, setLargeText, settleDialog, settleLayout, waitForIdle } from './helpers';

const PROGRESS_CASES = [
  { id: 'level-9-start', level: 9, xp: 2200, text: 'Level 9 — 0% to level 10 (500 XP to go)' },
  { id: 'level-9-halfway', level: 9, xp: 2450, text: 'Level 9 — 50% to level 10 (250 XP to go)' },
  { id: 'level-10-cap', level: 10, xp: 2700, text: 'Level 10 — Maximum level' },
  {
    id: 'level-3-near-threshold',
    level: 3,
    xp: 449,
    text: 'Level 3 — 99% to level 4 (1 XP to go)',
  },
] as const;

/**
 * Explicit supported-save fixtures, not levels earned in the Act 1 campaign.
 * createGame supplies learned choices and the default discipline; XP is then
 * set to a consistent XP value within its level band before normal save
 * validation. A high-level newGame starts at zero XP and is not this fixture.
 */
function supportedSave(level: number, xp: number) {
  const fresh = createGame(CONTENT, {
    seed: `inspector-level-cap-${level}-${xp}`,
    party: [{ characterId: 'bo', level, autoChoose: true }],
    startNode: 'village_explore',
  });
  const explored = apply(CONTENT, fresh, { type: 'enterNode', nodeId: 'village_explore' }).state;
  const canonical = {
    ...explored,
    party: explored.party.map((unit) => ({ ...unit, xp })),
  };
  const session = { players: [{ name: 'Inspector', unitId: 'p0' }], soloPlay: true };
  const json = serialize(canonical, {
    label: `Supported level ${level} inspector fixture`,
    summary: 'Explicit supported-save fixture, not an earned Act 1 campaign',
    savedAt: 1_700_000_000_000,
    session,
  });
  const parsed = deserialize(json);
  if (!parsed.ok) throw new Error(`Inspector fixture failed save validation: ${parsed.error}`);
  const state = stateFromBlob(parsed.blob);
  expect(state).toEqual(canonical);
  expect(state.party[0]).toMatchObject({ level, xp });
  expect(state.pendingChoices).toEqual([]);
  return { state, session: parsed.blob.session };
}

async function observe(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const camera = app.rendererCamera();
    if (!canvas || !camera) throw new Error('The inspector checkpoint lost its exploration view');
    const rect = canvas.getBoundingClientRect();
    return {
      state: app.state,
      session: app.session.toMeta(),
      camera,
      canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      backing: { width: canvas.width, height: canvas.height },
      renderer: app.rendererBackend(),
    };
  });
}

/** Measure painted text lines against the viewport, panel and clipping ancestors. */
async function expectUnclippedLabel(label: Locator): Promise<void> {
  const geometry = await label.evaluate((element) => {
    const panel = element.closest<HTMLElement>('[role="dialog"]');
    if (!panel) throw new Error('Progress text is outside its inspector panel');
    const panelRect = panel.getBoundingClientRect();
    const visible = {
      left: Math.max(0, panelRect.left),
      right: Math.min(window.innerWidth, panelRect.right),
      top: Math.max(0, panelRect.top),
      bottom: Math.min(window.innerHeight, panelRect.bottom),
    };
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const rect = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) {
        visible.left = Math.max(visible.left, rect.left);
        visible.right = Math.min(visible.right, rect.right);
      }
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) {
        visible.top = Math.max(visible.top, rect.top);
        visible.bottom = Math.min(visible.bottom, rect.bottom);
      }
      if (parent === panel) break;
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    return {
      visible,
      lines: [...range.getClientRects()].map((rect) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      })),
    };
  });
  expect(geometry.lines.length, 'the progress label must have painted text').toBeGreaterThan(0);
  for (const line of geometry.lines) {
    expect(line.left, 'progress text left edge').toBeGreaterThanOrEqual(geometry.visible.left - 1);
    expect(line.right, 'progress text right edge').toBeLessThanOrEqual(geometry.visible.right + 1);
    expect(line.top, 'progress text top edge').toBeGreaterThanOrEqual(geometry.visible.top - 1);
    expect(line.bottom, 'progress text bottom edge').toBeLessThanOrEqual(
      geometry.visible.bottom + 1,
    );
  }
}

for (const viewport of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'iPad landscape', width: 1194, height: 834 },
] as const) {
  for (const textSize of [
    { name: 'Normal', setting: 'off' },
    { name: 'Large', setting: 'on' },
  ] as const) {
    test(`${viewport.name} ${textSize.name}: inspector reports attainable progress and the level cap`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetStorage(page, '?renderer=canvas');
      await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true }));
      await setLargeText(page, textSize.setting);

      for (const progress of PROGRESS_CASES) {
        await test.step(progress.id, async () => {
          const fixture = supportedSave(progress.level, progress.xp);
          await page.evaluate(
            ({ state, session }) => window.fnt!.app.adoptSave(state, session),
            fixture,
          );
          await waitForIdle(page);
          await settleLayout(page);
          await expect(page.getByRole('dialog')).toHaveCount(0);
          const roster = page.locator('.roster-row').first();
          await roster.scrollIntoViewIfNeeded();
          await roster.focus();
          const before = await observe(page);
          expect(before.renderer).toBe('canvas');
          expect(before.state).toEqual(fixture.state);
          expect(before.session).toEqual(fixture.session);

          for (const closeWith of ['Escape', 'Close'] as const) {
            if (closeWith === 'Escape') await page.keyboard.press('Enter');
            else await roster.click();
            const dialog = page.getByRole('dialog');
            await expect(dialog).toHaveCount(1);
            await settleDialog(dialog);
            await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
            const label = dialog.getByText(progress.text, { exact: true });
            await expect(label).toBeVisible();
            await expectUnclippedLabel(label);
            if (progress.level === 10) await expect(label).not.toContainText(/level 11|%|XP/i);
            expect(await observe(page)).toEqual(before);

            if (closeWith === 'Escape') {
              await testInfo.attach(`${progress.id}-${viewport.name}-${textSize.name}`, {
                body: await page.screenshot(),
                contentType: 'image/png',
              });
              await page.keyboard.press('Escape');
            } else {
              const close = dialog.getByRole('button', { name: 'Close', exact: true });
              await close.scrollIntoViewIfNeeded();
              await close.click();
            }
            await expect(dialog).toHaveCount(0);
            await expect(roster).toBeFocused();
            await settleLayout(page);
            expect(await observe(page)).toEqual(before);
          }
        });
      }
      expect(errors).toEqual([]);
    });
  }
}
