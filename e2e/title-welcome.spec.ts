import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

// Partial #631 only: subtitle and riverside hierarchy. New game and all existing
// accessible names stay unchanged while the separate rename awaits its handoff.
// Fixtures use supported public setup/storage APIs, not an earned campaign.
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    return {
      state: app.state,
      session: app.session.toMeta(),
      preview: app.previewActive,
      backend: app.rendererBackend(),
      camera: app.rendererCamera(),
      storage: Object.fromEntries(
        Object.keys(localStorage)
          .sort()
          .map((key) => [key, localStorage.getItem(key)]),
      ),
    };
  });
}

async function openTitle(page: Page, renderer: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1180, height: 820 });
  await resetStorage(page, `?style=topdown&renderer=${renderer}&titleArt=a&titleArtHold=0`);
  await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true, volume: 0 }));
  await expect(page.locator('.title-scene')).toBeVisible();
  await settleLayout(page);
  // The title has no mounted map backend. Preview/Continue below prove the
  // requested backend after their actual world entry.
  expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBeNull();
  return errors;
}

async function readTitle(page: Page, primary: 'New game' | 'Continue') {
  const reading = await page.locator('.title-card').evaluate((card) => {
    const rect = (r: DOMRect) => ({
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    });
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;width:var(--tap);height:var(--tap)';
    card.append(probe);
    const tap = probe.getBoundingClientRect().height;
    probe.remove();
    const buttons = [...card.querySelectorAll<HTMLButtonElement>('.title-actions button')].map(
      (button) => {
        const box = button.getBoundingClientRect();
        return {
          text: button.textContent?.trim() ?? '',
          primary: button.classList.contains('btn-primary'),
          large: button.classList.contains('btn-large'),
          fontSize: Number.parseFloat(getComputedStyle(button).fontSize),
          box: rect(box),
          receivesCentre: button.contains(
            document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2),
          ),
        };
      },
    );
    const texts = [...card.querySelectorAll('h1, .tagline, .title-actions button')].map(
      (element) => {
        const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
        for (let parent: Element | null = element; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          const box = parent.getBoundingClientRect();
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
            clip.left = Math.max(clip.left, box.left);
            clip.right = Math.min(clip.right, box.right);
          }
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
            clip.top = Math.max(clip.top, box.top);
            clip.bottom = Math.min(clip.bottom, box.bottom);
          }
        }
        const glyphs = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let part = walker.nextNode(); part; part = walker.nextNode()) {
          for (let index = 0; index < (part.textContent?.length ?? 0); index++) {
            const glyph = part.textContent?.[index] ?? '';
            if (/\s/.test(glyph)) continue;
            const range = document.createRange();
            range.setStart(part, index);
            range.setEnd(part, index + 1);
            glyphs.push({
              glyph,
              boxes: [...range.getClientRects()].map((box) => ({
                ...rect(box),
                receivesCentre: element.contains(
                  document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2),
                ),
              })),
            });
          }
        }
        return { text: element.textContent?.trim() ?? '', clip, glyphs };
      },
    );
    return {
      tagline: card.querySelector('.tagline')?.textContent?.trim() ?? '',
      card: rect(card.getBoundingClientRect()),
      viewport: { width: innerWidth, height: innerHeight },
      buttons,
      texts,
      tap,
    };
  });
  expect(Number.isFinite(reading.tap) && reading.tap > 0).toBe(true);
  expect(reading.buttons.map((button) => button.text)).toEqual(
    primary === 'Continue'
      ? ['Continue', 'New game', 'Explore the riverside', 'Load a save', 'Settings']
      : ['New game', 'Explore the riverside', 'Load a save', 'Settings'],
  );
  expect(reading.buttons.filter((button) => button.primary).map((button) => button.text)).toEqual([
    primary,
  ]);
  const main = reading.buttons.find((button) => button.text === primary)!;
  const riverside = reading.buttons.find((button) => button.text === 'Explore the riverside')!;
  expect(main.large).toBe(true);
  expect(riverside.primary).toBe(false);
  // Only the owner's requested deltas are soft, so unchanged baseline runs
  // still complete real entry/return/restore controls and retain their evidence.
  expect.soft(reading.tagline).toMatch(/\b(?:alone|solo)\b/i);
  expect.soft(reading.tagline).toMatch(/\b(?:pass|share|together)\b/i);
  expect.soft(riverside.large).toBe(false);
  expect.soft(riverside.fontSize).toBeLessThan(main.fontSize);
  expect.soft(riverside.box.height).toBeLessThan(main.box.height);
  for (const button of reading.buttons) {
    // Tap minima are strict; only fractional text-box containment below gets
    // a fixed 1 CSS-pixel rounding allowance, declared before baseline capture.
    expect(button.box.width, button.text).toBeGreaterThanOrEqual(reading.tap);
    expect(button.box.height, button.text).toBeGreaterThanOrEqual(reading.tap);
    expect(button.receivesCentre, button.text).toBe(true);
    expect(button.box.left).toBeGreaterThanOrEqual(0);
    expect(button.box.top).toBeGreaterThanOrEqual(0);
    expect(button.box.right).toBeLessThanOrEqual(reading.viewport.width);
    expect(button.box.bottom).toBeLessThanOrEqual(reading.viewport.height);
  }
  for (const text of reading.texts) {
    expect(text.glyphs.length, text.text).toBeGreaterThan(0);
    expect(text.glyphs.map((glyph) => glyph.glyph).join('')).toBe(text.text.replace(/\s/g, ''));
    expect(
      text.glyphs.every(
        (glyph) =>
          glyph.boxes.length > 0 &&
          glyph.boxes.every(
            (box) =>
              box.width > 0 &&
              box.height > 0 &&
              box.receivesCentre &&
              box.left >= text.clip.left - 1 &&
              box.right <= text.clip.right + 1 &&
              box.top >= text.clip.top - 1 &&
              box.bottom <= text.clip.bottom + 1,
          ),
      ),
      text.text,
    ).toBe(true);
  }
  return reading;
}

async function prepareSavedGame(page: Page) {
  await startGame(page, ['Title guest'], ['bo'], 'title-welcome-631');
  // Supported world entry isolates title/preview/save behavior. This is not a
  // claim that the browser traversed the opening or earned a story outcome.
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await settleLayout(page);
  expect(await page.evaluate(() => window.fnt!.app.saveTo('auto'))).toBe(true);
  expect(await page.evaluate(() => window.fnt!.app.saveTo('slot1'))).toBe(true);
  const saved = await snapshot(page);
  expect(saved.state?.screen).toBe('explore');
  expect(saved.state?.location.mapId).toBe('ba_dan_village');
  expect(saved.session.players).toHaveLength(1);
  return saved;
}

async function attach(info: TestInfo, name: string, data: unknown): Promise<void> {
  await info.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`title welcomes solo/shared play and keeps New game primary: ${renderer}`, async ({
    page,
  }, info) => {
    allowSoftwareWebgl(test, renderer);
    const errors = await openTitle(page, renderer);
    const before = await snapshot(page);
    expect(before.state).toBeNull();
    const title = await readTitle(page, 'New game');
    await info.attach('fresh-title', { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: 'New game', exact: true }).click();
    await expect(page.locator('.setup-scene')).toBeVisible();
    await expect(page.locator('.title-scene')).toHaveCount(0);
    await settleLayout(page);
    const after = await snapshot(page);
    expect(after.state).toEqual(before.state);
    expect(after.session).toEqual(before.session);
    expect(after.preview).toBe(false);
    expect(errors).toEqual([]);
    await attach(info, 'fresh-title-control', { title, before, after, errors });
    await info.attach('new-game-setup', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test(`secondary riverside action enters and leaves the real preview without replacing a game: ${renderer}`, async ({
    page,
  }, info) => {
    allowSoftwareWebgl(test, renderer);
    const errors = await openTitle(page, renderer);
    const saved = await prepareSavedGame(page);
    await page.evaluate(() => window.fnt!.app.start());
    await expect(page.locator('.title-scene')).toBeVisible();
    await settleLayout(page);
    const title = await readTitle(page, 'Continue');
    const before = await snapshot(page);
    expect(before.state).toEqual(saved.state);
    expect(before.session).toEqual(saved.session);
    await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Water form', exact: true })).toBeVisible();
    await expect(page.locator('.village-life-canvas')).toHaveCount(1);
    await settleLayout(page);
    const preview = await snapshot(page);
    expect(preview.preview).toBe(true);
    expect(preview.state?.location.mapId).toBe('ba_dan_riverside');
    expect(preview.session.players).toEqual([]);
    expect(preview.storage).toEqual(before.storage);
    expect(preview.backend).toBe(renderer);
    await info.attach('riverside-preview', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    // Saving remains blocked by the existing preview contract.
    expect(await page.evaluate(() => window.fnt!.app.saveTo('slot1'))).toBe(false);
    await page.getByRole('button', { name: 'Leave preview', exact: true }).click();
    await expect(page.locator('.title-scene')).toBeVisible();
    await settleLayout(page);
    const after = await snapshot(page);
    expect(after.state).toEqual(before.state);
    expect(after.session).toEqual(before.session);
    expect(after.storage).toEqual(before.storage);
    expect(after.preview).toBe(false);
    await expect(page.locator('.title-actions .btn-primary')).toHaveText('Continue');
    expect(errors).toEqual([]);
    await attach(info, 'riverside-preservation', { title, before, preview, after, errors });
    await info.attach('returned-title', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test(`returning title keeps Continue first and restores its supported autosave: ${renderer}`, async ({
    page,
  }, info) => {
    allowSoftwareWebgl(test, renderer);
    const errors = await openTitle(page, renderer);
    const saved = await prepareSavedGame(page);
    // Reload clears in-memory state while retaining the real serialized save;
    // Continue therefore must load, rather than merely reveal an existing game.
    await page.reload();
    await page.waitForFunction(() => Boolean(window.fnt?.app));
    await expect(page.locator('.title-scene')).toBeVisible();
    await settleLayout(page);
    const before = await snapshot(page);
    expect(before.state).toBeNull();
    const title = await readTitle(page, 'Continue');
    await info.attach('returning-title', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('.explore-scene')).toBeVisible();
    await waitForIdle(page);
    await settleLayout(page);
    const after = await snapshot(page);
    expect(after.state).toEqual(saved.state);
    expect(after.session).toEqual(saved.session);
    expect(after.preview).toBe(false);
    expect(after.backend).toBe(renderer);
    expect(after.camera?.projection).toBe('topdown');
    expect(after.storage).toEqual(before.storage);
    expect(errors).toEqual([]);
    await attach(info, 'autosave-restore', { title, saved, before, after, errors });
    await info.attach('continued-game', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
}
