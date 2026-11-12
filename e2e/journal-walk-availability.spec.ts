import { expect, test, type Locator, type Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import {
  enterNode,
  pauseClock,
  resetStorage,
  settleLayout,
  startGame,
  waitForIdle,
} from './helpers';

const JOURNAL = /\bjournal\b/i;
const TEMPORARY = /\b(?:wait|finish(?:ed|ing)?|ready|moment)\b/i;

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    const now = performance.now();
    const journal = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Travel journal',
    );
    if (!app.state || !journal) throw new Error('Missing live game or actual journal control');
    return {
      now,
      state: app.state,
      session: app.session.toMeta(),
      camera: app.rendererCamera(),
      backend: app.rendererBackend(),
      reduceMotion: app.settings.reduceMotion,
      busy: app.animator.busy(now),
      finishesAt: app.animator.finishesAt,
      journal: {
        disabled: journal.disabled,
        ariaDisabled: journal.getAttribute('aria-disabled'),
        focused: document.activeElement === journal,
      },
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(
        (node) => node.getAttribute('aria-label') ?? '',
      ),
      politeToasts: [...document.querySelectorAll('.toasts[aria-live="polite"] > .toast')].map(
        (node) => node.textContent?.trim() ?? '',
      ),
      statuses: [...document.querySelectorAll('[role="status"], [role="alert"]')].map(
        (node) => node.textContent?.trim() ?? '',
      ),
    };
  });
}

type Snapshot = Awaited<ReturnType<typeof snapshot>>;

function expectRequestPreservesGame(before: Snapshot, after: Snapshot): void {
  // These samples share a frozen application clock. Natural camera/animation
  // progress after resuming the walk is deliberately observed separately.
  expect(after.now).toBe(before.now);
  expect(after.state).toEqual(before.state);
  expect(after.state.rng).toBe(before.state.rng);
  expect(after.session).toEqual(before.session);
  expect(after.camera).toEqual(before.camera);
  expect(after.finishesAt).toBe(before.finishesAt);
  expect(after.backend).toBe(before.backend);
  expect(after.reduceMotion).toBe(false);
  expect(after.journal.disabled).toBe(false);
  expect(after.journal.ariaDisabled).not.toBe('true');
}

async function buttonGeometry(button: Locator) {
  const geometry = await button.evaluate((node) => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;width:var(--tap);height:var(--tap)';
    node.append(probe);
    const tap = probe.getBoundingClientRect().height;
    probe.remove();
    const box = node.getBoundingClientRect();
    return {
      tap,
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
      viewport: { width: innerWidth, height: innerHeight },
      receivesCentre: node.contains(
        document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2),
      ),
    };
  });
  expect(Number.isFinite(geometry.tap) && geometry.tap > 0).toBe(true);
  // The existing tap minimum is strict, without a size tolerance.
  expect(geometry.width).toBeGreaterThanOrEqual(geometry.tap);
  expect(geometry.height).toBeGreaterThanOrEqual(geometry.tap);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewport.width);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport.height);
  expect(geometry.receivesCentre).toBe(true);
  return geometry;
}

async function focusByTab(page: Page, journal: Locator): Promise<number> {
  // Actual Tab/Enter input, rather than dispatching a click or assigning focus
  // in the page. The bound exceeds this scene's existing finite tab order.
  for (let tabs = 0; tabs <= 32; tabs++) {
    if (await journal.evaluate((node) => document.activeElement === node)) return tabs;
    if (tabs < 32) await page.keyboard.press('Tab');
  }
  throw new Error('Travel journal was not reachable through the actual Tab order');
}

async function feedbackGeometry(toast: Locator) {
  const reading = await toast.evaluate((node) => {
    const rect = (box: DOMRect) => ({
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
    });
    const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    let opacity = 1;
    let visible = true;
    for (let parent: Element | null = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const box = parent.getBoundingClientRect();
      opacity *= Number.parseFloat(style.opacity);
      visible &&=
        style.display !== 'none' &&
        style.visibility === 'visible' &&
        !parent.hasAttribute('hidden');
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
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let part = walker.nextNode(); part; part = walker.nextNode()) {
      for (let index = 0; index < (part.textContent?.length ?? 0); index++) {
        const glyph = part.textContent?.[index] ?? '';
        if (/\s/.test(glyph)) continue;
        const range = document.createRange();
        range.setStart(part, index);
        range.setEnd(part, index + 1);
        glyphs.push({ glyph, boxes: [...range.getClientRects()].map(rect) });
      }
    }
    return {
      text: node.textContent?.trim() ?? '',
      box: rect(node.getBoundingClientRect()),
      clip,
      glyphs,
      opacity,
      visible,
      live: node.closest('[aria-live]')?.getAttribute('aria-live'),
      pointerEvents: getComputedStyle(node).pointerEvents,
    };
  });
  expect(reading.live).toBe('polite');
  expect(reading.visible).toBe(true);
  expect(reading.opacity).toBe(1);
  expect(reading.pointerEvents).toBe('none');
  expect(reading.box.width).toBeGreaterThan(0);
  expect(reading.box.height).toBeGreaterThan(0);
  expect(reading.glyphs.length).toBeGreaterThan(0);
  expect(reading.glyphs.map((glyph) => glyph.glyph).join('')).toBe(reading.text.replace(/\s/g, ''));
  // Fixed 1 CSS-pixel rounding allowance, declared before RED. Every glyph
  // must have a positive box wholly inside its viewport/clipping ancestors.
  // Toasts intentionally ignore pointer events; centre-hit is not a text oracle.
  expect(
    reading.glyphs.every(
      (glyph) =>
        glyph.boxes.length > 0 &&
        glyph.boxes.every(
          (box) =>
            box.width > 0 &&
            box.height > 0 &&
            box.left >= reading.clip.left - 1 &&
            box.right <= reading.clip.right + 1 &&
            box.top >= reading.clip.top - 1 &&
            box.bottom <= reading.clip.bottom + 1,
        ),
    ),
  ).toBe(true);
  return reading;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const input of ['pointer', 'Enter'] as const) {
    test(`busy journal gives temporary feedback and opens after the same walk: ${renderer}, ${input}`, async ({
      page,
    }, info) => {
      allowSoftwareWebgl(test, renderer);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width: 1180, height: 820 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await resetStorage(page, `?style=topdown&renderer=${renderer}`);
      await startGame(page, ['Walker', 'Companion'], ['kaya', 'sura'], 'journal-busy-discovery', {
        reduceMotion: false,
      });
      await enterNode(page, 'village_explore');
      await page.evaluate(() => window.fnt!.app.updateSettings({ volume: 0 }));
      await waitForIdle(page);
      await settleLayout(page);
      const initial = await snapshot(page);
      expect(initial.state.screen).toBe('explore');
      expect(initial.state.location.mapId).toBe('ba_dan_village');
      expect(initial.backend).toBe(renderer);
      expect(initial.camera?.projection).toBe('topdown');
      expect(initial.reduceMotion).toBe(false);
      expect(initial.busy).toBe(false);

      // Supported public walk command is fixture preparation, as in the
      // original #547 probe. Activations below use actual browser input.
      // No campaign, route-input, physical-device or performance acceptance.
      await pauseClock(page);
      try {
        const walk = await page.evaluate(() => {
          const app = window.fnt!.app;
          const from = app.state!.location.pos;
          const target = { x: from.x + 4, y: from.y };
          app.dispatch({ type: 'walkTo', pos: target });
          return { from, target, now: performance.now(), finishesAt: app.animator.finishesAt };
        });
        // Publish live normal-motion frames before freezing each request's
        // before/after boundary; no frames advance across that boundary.
        await page.clock.runFor(64);
        const journal = page.getByRole('button', { name: 'Travel journal', exact: true });
        await expect(journal).toBeEnabled();
        const busyButton = await buttonGeometry(journal);
        const busyTabs = input === 'Enter' ? await focusByTab(page, journal) : null;
        const before = await snapshot(page);
        expect(before.busy).toBe(true);
        expect(before.finishesAt).toBeGreaterThan(before.now);
        expect(before.state.location.pos).toEqual(walk.target);
        expect(before.state.story.nodeId).toBe(initial.state.story.nodeId);
        expect(before.dialogs).toEqual([]);
        expect(
          before.politeToasts.filter((text) => JOURNAL.test(text) && TEMPORARY.test(text)),
        ).toEqual([]);
        if (input === 'Enter') expect(before.journal.focused).toBe(true);

        if (input === 'pointer') await journal.click();
        else await page.keyboard.press('Enter');
        const afterRequest = await snapshot(page);
        expectRequestPreservesGame(before, afterRequest);
        expect(afterRequest.busy).toBe(true);
        expect(afterRequest.dialogs).toEqual([]);
        if (input === 'Enter') expect(afterRequest.journal.focused).toBe(true);
        const newToasts = afterRequest.politeToasts.filter(
          (text) => !before.politeToasts.includes(text),
        );
        const newFeedback = newToasts.filter((text) => JOURNAL.test(text) && TEMPORARY.test(text));
        // Intended original RED only. A pre-existing movement role=status
        // cannot satisfy an activation's NEW polite journal refusal.
        expect
          .soft(newFeedback.length, 'busy activation must give new temporary journal feedback')
          .toBeGreaterThan(0);

        // Finish only finite CSS entry animations for a stable visual capture.
        // The application's normal-motion setting and frozen walk clock remain
        // untouched; the subsequent snapshot checks time and deadline equality.
        const busyPng = await page.screenshot({ animations: 'disabled' });
        await info.attach('busy-journal-feedback', { body: busyPng, contentType: 'image/png' });
        const toast = page
          .locator('.toasts[aria-live="polite"] > .toast')
          .filter({ hasText: JOURNAL })
          .filter({ hasText: TEMPORARY })
          .last();
        const feedback = newFeedback.length ? await feedbackGeometry(toast) : null;
        const afterCapture = await snapshot(page);
        expectRequestPreservesGame(before, afterCapture);
        expect(afterCapture.busy).toBe(true);
        expect(afterCapture.dialogs).toEqual([]);

        // Resume this SAME authored walk through its ordinary completion. Use
        // the unchanged helper's existing idle deadline, without a fixed old
        // walk duration, synthetic animation completion or extra command.
        await page.clock.resume();
        await waitForIdle(page);
        await settleLayout(page);
        await pauseClock(page);
        const arrived = await snapshot(page);
        expect(arrived.busy).toBe(false);
        expect(arrived.state).toEqual(before.state);
        expect(arrived.session).toEqual(before.session);
        expect(arrived.state.location.pos).toEqual(walk.target);
        const idleButton = await buttonGeometry(journal);
        const idleTabs = input === 'Enter' ? await focusByTab(page, journal) : null;
        const beforeIdleRequest = await snapshot(page);
        if (input === 'pointer') await journal.click();
        else await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Travel journal', exact: true });
        await expect(dialog).toBeVisible();
        const opened = await snapshot(page);
        expectRequestPreservesGame(beforeIdleRequest, opened);
        expect(opened.dialogs).toEqual(['Travel journal']);
        expect(opened.busy).toBe(false);
        await info.attach('journal-after-same-walk', {
          body: await page.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        });
        await dialog.getByRole('button', { name: 'Close journal', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        const closed = await snapshot(page);
        expectRequestPreservesGame(beforeIdleRequest, closed);
        expect(closed.dialogs).toEqual([]);
        await info.attach('journal-walk-request-and-state', {
          body: JSON.stringify(
            {
              renderer,
              input,
              initial,
              walk,
              busyButton,
              busyTabs,
              before,
              afterRequest,
              newToasts,
              newFeedback,
              feedback,
              afterCapture,
              arrived,
              idleButton,
              idleTabs,
              beforeIdleRequest,
              opened,
              closed,
              errors,
              fixtureLimits:
                'Public supported setup/world-entry/walk fixture; real pointer or Tab/Enter requests. Not an earned campaign or physical/browser-floor/performance acceptance.',
              visualCapture:
                'Finite CSS animations finished for screenshots only; normal-motion application clock frozen for each request invariant boundary.',
            },
            null,
            2,
          ),
          contentType: 'application/json',
        });
        expect(errors).toEqual([]);
      } finally {
        await page.clock.resume();
      }
    });
  }
}
