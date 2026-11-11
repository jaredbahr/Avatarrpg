import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, settleDialog, settleLayout, startGame } from './helpers';

// Fixed before the source repair: #492 permits one CSS pixel of layout/glyph
// rounding. This is not a tolerance for missing words or inaccessible controls.
const ROUNDING_PX = 1;
const HINT = 'Tap a path to move';
const expectedSize = { Normal: 'off', Large: 'on', Largest: 'huge' } as const;
const WHEEL_STEPS = [-120, 50, 50, 50, 120, -300, 50, 50] as const;
const profiles = [
  { size: 'Largest', width: 832, height: 390, renderer: 'canvas' },
  { size: 'Largest', width: 833, height: 390, renderer: 'canvas' },
  { size: 'Largest', width: 844, height: 390, renderer: 'canvas' },
  { size: 'Largest', width: 848, height: 390, renderer: 'canvas' },
  { size: 'Largest', width: 849, height: 390, renderer: 'canvas' },
  { size: 'Largest', width: 1194, height: 390, renderer: 'canvas' },
  { size: 'Large', width: 844, height: 390, renderer: 'canvas' },
  { size: 'Normal', width: 844, height: 390, renderer: 'canvas' },
  { size: 'Largest', width: 390, height: 844, renderer: 'canvas' },
  { size: 'Largest', width: 1194, height: 834, renderer: 'canvas' },
  { size: 'Largest', width: 848, height: 390, renderer: 'webgl' },
] as const;

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    return { state: app.state!, session: app.session.toMeta(), camera: app.rendererCamera() };
  });
}

/** Observe native layout, including every ancestor that can clip either axis. */
async function read(target: Locator) {
  return target.evaluate((node, allowance) => {
    const rect = (box: DOMRect) => ({
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
    });
    const dock = node.closest('.explore-dock');
    if (!dock) throw new Error('The observed control is outside the exploration dock');
    let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const ancestors = [];
    const clipped = (value: string) => /^(auto|scroll|hidden|clip|overlay)$/.test(value);
    for (let parent: Element | null = node; parent; parent = parent.parentElement) {
      const box = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      const x = parent === dock || clipped(style.overflowX);
      const y = parent === dock || clipped(style.overflowY);
      if (x || y) {
        // client dimensions exclude borders and scrollbar gutters.
        const left = box.left + parent.clientLeft;
        const top = box.top + parent.clientTop;
        clip = {
          left: x ? Math.max(clip.left, left) : clip.left,
          right: x ? Math.min(clip.right, left + parent.clientWidth) : clip.right,
          top: y ? Math.max(clip.top, top) : clip.top,
          bottom: y ? Math.min(clip.bottom, top + parent.clientHeight) : clip.bottom,
        };
      }
      ancestors.push({
        tag: parent.tagName,
        class: parent.className,
        box: rect(box),
        clientWidth: parent.clientWidth,
        clientHeight: parent.clientHeight,
        scrollWidth: parent.scrollWidth,
        scrollHeight: parent.scrollHeight,
        scrollLeft: parent.scrollLeft,
        scrollTop: parent.scrollTop,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        clipsX: x,
        clipsY: y,
        clip: { ...clip },
      });
    }
    const contains = (box: DOMRect) =>
      box.width > 0 &&
      box.height > 0 &&
      box.left >= clip.left - allowance &&
      box.right <= clip.right + allowance &&
      box.top >= clip.top - allowance &&
      box.bottom <= clip.bottom + allowance;
    const box = node.getBoundingClientRect();
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const fragments = [];
    let index = 0;
    while (walker.nextNode()) {
      const text = walker.currentNode;
      for (let offset = 0; offset < (text.textContent?.length ?? 0); offset++, index++) {
        const glyph = text.textContent?.[offset];
        if (!glyph?.trim()) continue;
        const range = document.createRange();
        range.setStart(text, offset);
        range.setEnd(text, offset + 1);
        const boxes = [...range.getClientRects()];
        fragments.push({
          index,
          text: glyph,
          boxes: boxes.map(rect),
          visible: boxes.length > 0 && boxes.every(contains),
        });
      }
    }
    const style = getComputedStyle(node);
    const root = getComputedStyle(document.documentElement);
    const tap = root.getPropertyValue('--tap').trim();
    if (!tap.endsWith('rem')) throw new Error(`Unexpected tap token: ${tap}`);
    return {
      text: node.textContent,
      box: rect(box),
      clip,
      ancestors,
      fragments,
      whollyVisible: contains(box),
      receivesCentre: node.contains(
        document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2),
      ),
      tap: Number.parseFloat(tap) * Number.parseFloat(root.fontSize),
      style: {
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      },
      ellipsized:
        style.textOverflow === 'ellipsis' && node.scrollWidth > node.clientWidth + allowance,
    };
  }, ROUNDING_PX);
}

/** Wheel over the visible part of the target, or its nearest visible ancestor. */
async function wheelAt(page: Page, target: Locator, delta: number) {
  const point = await target.evaluate((node) => {
    const dock = node.closest('.explore-dock')!;
    const d = dock.getBoundingClientRect();
    for (let element: Element | null = node; element; element = element.parentElement) {
      const box = element.getBoundingClientRect();
      let left = Math.max(0, d.left, box.left);
      let top = Math.max(0, d.top, box.top);
      let right = Math.min(innerWidth, d.right, box.right);
      let bottom = Math.min(innerHeight, d.bottom, box.bottom);
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const bounds = parent.getBoundingClientRect();
        const style = getComputedStyle(parent);
        if (/^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowX)) {
          left = Math.max(left, bounds.left + parent.clientLeft);
          right = Math.min(right, bounds.left + parent.clientLeft + parent.clientWidth);
        }
        if (/^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowY)) {
          top = Math.max(top, bounds.top + parent.clientTop);
          bottom = Math.min(bottom, bounds.top + parent.clientTop + parent.clientHeight);
        }
      }
      if (right - left > 2 && bottom - top > 2) {
        const x = (left + right) / 2;
        const y = (top + bottom) / 2;
        if (element.contains(document.elementFromPoint(x, y))) return { x, y };
      }
    }
    throw new Error('No exposed target or dock ancestor receives ordinary wheel input');
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, delta);
  // Allow the real asynchronous wheel to paint; no clock or scroll mutation.
  await page.waitForTimeout(120);
  return { point, delta };
}

async function exposeControl(page: Page, target: Locator) {
  const samples = [];
  const wheel = [];
  for (let attempt = 0; attempt < 14; attempt++) {
    const sample = await read(target);
    samples.push(sample);
    if (sample.whollyVisible && sample.receivesCentre) {
      expect(sample.box.width).toBeGreaterThanOrEqual(sample.tap);
      expect(sample.box.height).toBeGreaterThanOrEqual(sample.tap);
      return { samples, wheel };
    }
    // Follow the observed edge rather than overshooting a small scroll range.
    // Keep the complete-target oracle and ordinary wheel input unchanged.
    const delta =
      sample.box.top < sample.clip.top - ROUNDING_PX
        ? sample.box.top - sample.clip.top + ROUNDING_PX
        : sample.box.bottom - sample.clip.bottom - ROUNDING_PX;
    wheel.push(await wheelAt(page, target, delta));
  }
  throw new Error(
    `Real wheel cannot expose complete target: ${JSON.stringify({ samples, wheel })}`,
  );
}

for (const profile of profiles) {
  test(`${profile.size} ${profile.width}x${profile.height} ${profile.renderer}: all movement-hint text is reachable`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await resetStorage(
      page,
      `?style=topdown&renderer=${profile.renderer}&titleArt=a&titleArtHold=0`,
    );
    await startGame(page, ['Hint explorer'], ['kaya'], 'explore-hint-scroll-614');
    await enterNode(page, 'village_explore');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const pause = page.getByRole('dialog', { name: 'Paused', exact: true });
    await pause.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settleDialog(settings);
    await settings
      .getByRole('radiogroup', { name: 'Text size', exact: true })
      .getByRole('radio', { name: profile.size, exact: true })
      .click();
    await settings.getByRole('button', { name: 'Done', exact: true }).click();
    await pause.getByRole('button', { name: 'Resume', exact: true }).click();
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.app.settings.largeText)).toBe(
      expectedSize[profile.size],
    );
    expect(await page.evaluate(() => document.documentElement.dataset.largeText)).toBe(
      expectedSize[profile.size],
    );
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(profile.renderer);
    const before = await snapshot(page);
    const hint = page.locator('.explore-context > strong');
    await expect(hint).toHaveText(HINT);
    const initial = await read(hint);
    expect(initial.fragments.map((fragment) => fragment.text).join('')).toBe(
      HINT.replace(/\s/g, ''),
    );
    expect(initial.fragments.length).toBeGreaterThan(0);
    const seen = initial.fragments.map((fragment) => fragment.visible);
    const samples = [initial];
    const wheel = [];
    await page.screenshot({ path: info.outputPath('initial-hint.png') });
    for (const delta of WHEEL_STEPS) {
      if (seen.every(Boolean)) break;
      wheel.push(await wheelAt(page, hint, delta));
      const sample = await read(hint);
      samples.push(sample);
      expect(sample.text).toBe(HINT);
      expect(sample.fragments.map((fragment) => fragment.index)).toEqual(
        initial.fragments.map((fragment) => fragment.index),
      );
      sample.fragments.forEach((fragment, index) => {
        if (fragment.visible) seen[index] = true;
      });
    }
    await info.attach('hint-scroll-fragments', {
      body: JSON.stringify({
        profile,
        allowance: ROUNDING_PX,
        initial,
        samples,
        wheel,
        seen,
        before,
      }),
      contentType: 'application/json',
    });
    await page.screenshot({ path: info.outputPath('after-real-wheel.png') });
    expect
      .soft(
        seen.every(Boolean),
        'Every actual hint glyph is wholly readable through ordinary wheel input',
      )
      .toBe(true);
    expect
      .soft(
        samples.some((sample) => sample.ellipsized),
        'No ellipsis substitutes for the intended hint text',
      )
      .toBe(false);
    expect(await snapshot(page)).toEqual(before);

    const outcomes = [];
    for (const action of [
      { name: 'Map', dialog: 'Local map' },
      { name: 'Look around', dialog: 'Look around' },
      { name: /^Party/, dialog: 'Kaya (Hint explorer)' },
    ]) {
      const control = page.getByRole('button', {
        name: action.name,
        exact: typeof action.name === 'string',
      });
      const exposure = await exposeControl(page, control);
      await expect(control).toBeEnabled();
      await control.click();
      const dialog = page.getByRole('dialog', { name: action.dialog, exact: true });
      await expect(dialog).toBeVisible();
      await settleDialog(dialog);
      if (action.dialog === 'Local map') await expect(dialog.locator('svg')).toBeVisible();
      expect(await snapshot(page)).toEqual(before);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      expect(await snapshot(page)).toEqual(before);
      outcomes.push({ action: String(action.name), exposure });
    }

    const keyboardFocus = [];
    if (
      profile.size !== 'Normal' &&
      profile.width >= 832 &&
      profile.width <= 848 &&
      profile.height <= 416
    ) {
      for (const name of ['Map', 'Look around', /^Party/]) {
        const control = page.getByRole('button', { name, exact: typeof name === 'string' });
        for (let step = 0; step < 30; step++) {
          if (
            await control.evaluate(
              (node) => node === document.activeElement && node.matches(':focus-visible'),
            )
          )
            break;
          await page.keyboard.press('Tab');
        }
        const sample = await read(control);
        const focus = await control.evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            active: node === document.activeElement,
            visible: node.matches(':focus-visible'),
            width: Number.parseFloat(style.outlineWidth),
            offset: Number.parseFloat(style.outlineOffset),
            color: style.outlineColor,
          };
        });
        expect(focus.active && focus.visible).toBe(true);
        expect(focus.width).toBe(3);
        const outset = Math.max(0, focus.width + focus.offset);
        const complete =
          sample.box.left - outset >= sample.clip.left - ROUNDING_PX &&
          sample.box.right + outset <= sample.clip.right + ROUNDING_PX &&
          sample.box.top - outset >= sample.clip.top - ROUNDING_PX &&
          sample.box.bottom + outset <= sample.clip.bottom + ROUNDING_PX;
        expect.soft(complete, `The complete keyboard focus outline for ${String(name)}`).toBe(true);
        expect(await snapshot(page)).toEqual(before);
        keyboardFocus.push({ action: String(name), sample, focus, complete });
        await page.screenshot({ path: info.outputPath(`keyboard-${keyboardFocus.length}.png`) });
      }
    }
    await info.attach('actual-dock-controls', {
      body: JSON.stringify({ outcomes, keyboardFocus, after: await snapshot(page) }),
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
  });
}
