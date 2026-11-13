import { expect, test, type Locator, type Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';

// Declared before RED: half a CSS pixel for layout/scroll rounding only.
// Tap minima and the applicable 40dvh board floor have NO tolerance.
const ROUNDING = 0.5;
const profiles = [
  { name: 'iPad landscape', width: 1180, height: 820, dpr: 2 },
  { name: 'phone portrait', width: 390, height: 844, dpr: 3 },
  { name: 'phone landscape', width: 844, height: 390, dpr: 3 },
] as const;

async function domain(page: Page) {
  return page.evaluate(() => ({
    state: window.fnt!.app.state,
    session: window.fnt!.app.session.toMeta(),
  }));
}

async function geometry(page: Page, label: string) {
  const reading = await page.locator('.combat-scene .combat-bar').evaluate((bar) => {
    const box = (node: Element) => {
      const r = node.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    const root = getComputedStyle(document.documentElement);
    const token = root.getPropertyValue('--tap').trim();
    const tap = parseFloat(token) * (token.endsWith('rem') ? parseFloat(root.fontSize) : 1);
    const buttons = [...bar.querySelectorAll<HTMLButtonElement>('button')]
      .filter(
        (button) =>
          button.getClientRects().length && getComputedStyle(button).visibility === 'visible',
      )
      .map((button) => ({
        key: button.dataset.key,
        name: button.textContent?.trim(),
        disabled: button.disabled,
        ...box(button),
      }));
    const title = bar.querySelector<HTMLElement>('.title-plate-name');
    if (!title) throw new Error('Missing actual encounter title');
    const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    let opacity = 1;
    for (let node: HTMLElement | null = title; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      opacity *= Number(style.opacity);
      const r = node.getBoundingClientRect();
      if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) {
        clip.left = Math.max(clip.left, r.left);
        clip.right = Math.min(clip.right, r.right);
      }
      if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) {
        clip.top = Math.max(clip.top, r.top);
        clip.bottom = Math.min(clip.bottom, r.bottom);
      }
    }
    const style = getComputedStyle(title);
    const ink = document.createElement('canvas').getContext('2d');
    if (!ink) throw new Error('No text measurement context');
    ink.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const glyphs: {
      char: string;
      inkWidth: number;
      baseline: number;
      range: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
      };
      metrics: {
        width: number;
        fontBoundingBoxAscent: number;
        fontBoundingBoxDescent: number;
        actualBoundingBoxAscent: number;
        actualBoundingBoxDescent: number;
        actualBoundingBoxLeft: number;
        actualBoundingBoxRight: number;
      };
      left: number;
      top: number;
      right: number;
      bottom: number;
    }[] = [];
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node && glyphs.length < 4; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      for (let i = 0; i < text.length && glyphs.length < 4; i++) {
        const char = text[i]!;
        if (/\s/.test(char)) continue;
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect(),
          metrics = ink.measureText(char);
        // A Range includes the font's em extents, not just painted ink.
        // The preserved native font probe established its alphabetic baseline
        // at Range.top + fontBoundingBoxAscent; check that mapping below.
        const baseline = r.top + metrics.fontBoundingBoxAscent;
        glyphs.push({
          char,
          inkWidth: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
          baseline,
          range: {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          },
          metrics: {
            width: metrics.width,
            fontBoundingBoxAscent: metrics.fontBoundingBoxAscent,
            fontBoundingBoxDescent: metrics.fontBoundingBoxDescent,
            actualBoundingBoxAscent: metrics.actualBoundingBoxAscent,
            actualBoundingBoxDescent: metrics.actualBoundingBoxDescent,
            actualBoundingBoxLeft: metrics.actualBoundingBoxLeft,
            actualBoundingBoxRight: metrics.actualBoundingBoxRight,
          },
          left: r.left - metrics.actualBoundingBoxLeft,
          top: baseline - metrics.actualBoundingBoxAscent,
          right: r.left + metrics.actualBoundingBoxRight,
          bottom: baseline + metrics.actualBoundingBoxDescent,
        });
      }
    }
    const app = window.fnt!.app,
      state = app.state;
    const encounter = state?.battle && app.content.encounters.get(state.battle.encounterId);
    const canvas = document.querySelector('.combat-scene .map-canvas');
    if (!canvas) throw new Error('Missing actual combat canvas');
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      tap,
      token,
      font: root.fontSize,
      largeText: app.settings.largeText,
      bar: { ...box(bar), scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth },
      pageWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      title: {
        ...box(title),
        text: title.textContent?.trim(),
        expected: encounter?.name,
        opacity,
        visibility: style.visibility,
        clip,
        glyphs,
      },
      buttons,
      board: box(canvas),
      backend: app.rendererBackend(),
      camera: app.rendererCamera(),
    };
  });
  return { label, ...reading };
}

function checkGeometry(g: Awaited<ReturnType<typeof geometry>>, boardFloor = false) {
  expect(g.backend).toMatch(/^(canvas|webgl)$/);
  expect(g.camera?.projection).toBe('topdown');
  expect(Number.isFinite(g.tap)).toBe(true);
  expect(g.tap).toBeGreaterThan(0);
  expect(g.buttons.some((button) => button.key === 'pause')).toBe(true);
  for (const b of g.buttons) {
    const note = `${g.label}: ${b.key ?? b.name}`;
    expect.soft(b.width, `${note} strict tap width`).toBeGreaterThanOrEqual(g.tap);
    expect.soft(b.height, `${note} strict tap height`).toBeGreaterThanOrEqual(g.tap);
    expect.soft(b.left, note).toBeGreaterThanOrEqual(-ROUNDING);
    expect.soft(b.top, note).toBeGreaterThanOrEqual(-ROUNDING);
    expect.soft(b.right, note).toBeLessThanOrEqual(g.viewport.width + ROUNDING);
    expect.soft(b.bottom, note).toBeLessThanOrEqual(g.viewport.height + ROUNDING);
  }
  expect
    .soft(g.bar.scrollWidth - g.bar.clientWidth, `${g.label}: header horizontal overflow`)
    .toBeLessThanOrEqual(ROUNDING);
  expect
    .soft(
      Math.max(g.pageWidth, g.bodyWidth) - g.viewport.width,
      `${g.label}: page horizontal overflow`,
    )
    .toBeLessThanOrEqual(ROUNDING);
  expect(g.title.text).toBe(g.title.expected);
  expect.soft(g.title.width, `${g.label}: encounter title has a real box`).toBeGreaterThan(0);
  expect.soft(g.title.opacity).toBeGreaterThanOrEqual(0.99);
  expect.soft(g.title.visibility).toBe('visible');
  expect(g.title.glyphs).toHaveLength(4);
  for (const glyph of g.title.glyphs) {
    const note = `${g.label}: visible encounter prefix ${glyph.char}`;
    // Harness prerequisites: never silently substitute unavailable metrics or
    // widen the clipping allowance when a font's baseline mapping differs.
    expect(
      Object.values(glyph.metrics).every(Number.isFinite),
      `${note}: finite font/ink metrics`,
    ).toBe(true);
    expect(Number.isFinite(glyph.baseline), `${note}: finite baseline`).toBe(true);
    expect(
      Math.abs(
        glyph.range.height -
          glyph.metrics.fontBoundingBoxAscent -
          glyph.metrics.fontBoundingBoxDescent,
      ),
      `${note}: Range height agrees with font extents`,
    ).toBeLessThanOrEqual(ROUNDING);
    expect.soft(glyph.inkWidth, note).toBeGreaterThan(0);
    expect.soft(glyph.right - glyph.left, note).toBeGreaterThan(0);
    expect.soft(glyph.bottom - glyph.top, note).toBeGreaterThan(0);
    expect.soft(glyph.left, note).toBeGreaterThanOrEqual(g.title.clip.left - ROUNDING);
    expect.soft(glyph.right, note).toBeLessThanOrEqual(g.title.clip.right + ROUNDING);
    expect.soft(glyph.top, note).toBeGreaterThanOrEqual(g.title.clip.top - ROUNDING);
    expect.soft(glyph.bottom, note).toBeLessThanOrEqual(g.title.clip.bottom + ROUNDING);
  }
  if (boardFloor)
    expect
      .soft(g.board.height, 'existing Largest landscape 40dvh floor')
      .toBeGreaterThanOrEqual(g.viewport.height * 0.4);
}

/** Real input even on the RED's partly clipped Pause; its full-target check still fails above. */
async function tapVisible(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  const point = await control.evaluate((element) => {
    const r = element.getBoundingClientRect();
    const left = Math.max(0, r.left),
      right = Math.min(innerWidth, r.right);
    const top = Math.max(0, r.top),
      bottom = Math.min(innerHeight, r.bottom);
    if (right <= left || bottom <= top)
      throw new Error('Control has no visible input intersection');
    const x = (left + right) / 2,
      y = (top + bottom) / 2;
    const hit = document.elementFromPoint(x, y);
    if (!hit || !element.contains(hit))
      throw new Error('Another element intercepts the actual control');
    return { x, y };
  });
  await page.touchscreen.tap(point.x, point.y);
  return point;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const profile of profiles) {
    test.describe(`${renderer} ${profile.name}`, () => {
      test.use({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.dpr,
      });
      test('Largest combat header keeps its title and full targets, with live Pause and More', async ({
        page,
      }, info) => {
        allowSoftwareWebgl(test, renderer);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await resetStorage(page, `?style=topdown&renderer=${renderer}`);
        await startGame(page, ['Reader'], ['kaya'], 'combat-topbar-largest');
        await enterNode(page, 'battle_forest_road');
        expect(await takeTurn(page, { settleCamera: false })).toBe(true);
        await waitForIdle(page);
        await settleLayout(page);
        const initial = await domain(page);
        const readings: Awaited<ReturnType<typeof geometry>>[] = [];
        const controls: unknown[] = [];
        try {
          readings.push(await geometry(page, 'normal'));
          checkGeometry(readings[0]!);
          await setLargeText(page, 'on');
          await waitForIdle(page);
          await settleLayout(page);
          const large = await geometry(page, 'Large');
          readings.push(large);
          expect(large.largeText).toBe('on');
          expect(parseFloat(large.font)).toBeGreaterThan(parseFloat(readings[0]!.font));
          checkGeometry(large);
          expect(await domain(page)).toEqual(initial);
          await setLargeText(page, 'huge');
          await waitForIdle(page);
          await settleLayout(page);
          const largest = await geometry(page, 'Largest');
          readings.push(largest);
          expect(largest.largeText).toBe('huge');
          expect(parseFloat(largest.font)).toBeGreaterThan(parseFloat(large.font));
          expect(largest.viewport.dpr).toBe(profile.dpr);
          expect(largest.backend).toBe(renderer);
          checkGeometry(largest, profile.width === 1180);
          expect(await domain(page)).toEqual(initial);
          if (profile.width !== 1180) {
            await page.setViewportSize({ width: profile.height, height: profile.width });
            await settleLayout(page);
            const rotated = await geometry(page, 'Largest rotated');
            readings.push(rotated);
            checkGeometry(rotated);
            await page.setViewportSize({ width: profile.width, height: profile.height });
            await settleLayout(page);
            const restored = await geometry(page, 'Largest restored');
            readings.push(restored);
            checkGeometry(restored);
            expect(await domain(page)).toEqual(initial);
            const more = page.getByRole('button', { name: 'More', exact: true });
            const group = page.getByRole('group', { name: 'View and help', exact: true });
            const point = await tapVisible(page, more);
            await expect(more).toHaveAttribute('aria-expanded', 'true');
            await expect(group).toBeVisible();
            expect(
              await group.evaluate((element) => element.contains(document.activeElement)),
            ).toBe(true);
            controls.push({ event: 'More pointer', point, domain: await domain(page) });
            await page.keyboard.press('Escape');
            await expect(more).toHaveAttribute('aria-expanded', 'false');
            await expect(more).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(more).toHaveAttribute('aria-expanded', 'true');
            expect(
              await group.evaluate((element) => element.contains(document.activeElement)),
            ).toBe(true);
            await page.keyboard.press('Escape');
            await expect(more).toBeFocused();
            await expect(more).toHaveAttribute('aria-expanded', 'false');
            expect(await domain(page)).toEqual(initial);
            controls.push({ event: 'More keyboard/Escape', domain: await domain(page) });
          }
          const beforePause = await domain(page);
          const point = await tapVisible(
            page,
            page.getByRole('button', { name: 'Pause', exact: true }),
          );
          const pause = page.getByRole('dialog', { name: 'Paused', exact: true });
          await expect(pause).toBeVisible();
          const paused = await domain(page);
          expect(paused).toEqual(beforePause);
          await tapVisible(page, pause.getByRole('button', { name: 'Resume', exact: true }));
          await expect(pause).toHaveCount(0);
          const resumed = await domain(page);
          expect(resumed).toEqual(beforePause);
          expect(resumed).toEqual(initial);
          controls.push({ event: 'Pause/Resume', point, beforePause, paused, resumed });
          await settleLayout(page);
          const final = await geometry(page, 'Largest after controls');
          readings.push(final);
          checkGeometry(final, profile.width === 1180);
          expect(errors).toEqual([]);
        } finally {
          await info.attach('combat-topbar-final', {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
          });
          await info.attach('combat-topbar-observations', {
            body: JSON.stringify(
              {
                renderer,
                profile,
                initial,
                final: await domain(page),
                readings,
                controls,
                errors,
                limits:
                  'Supported public entry/reduced-motion fixture, not an earned campaign. Half-CSS-pixel layout allowance only; tap and applicable board floor strict. Four non-space actual glyph-ink boxes mapped from audited Range/font metrics must fit their effective clip; wrapping/ellipsis allowed. Trusted visible-intersection input completes the clipped baseline control without waiving its full-target failure. More menu scrolling is not a claim that every folded item is simultaneously visible. Software native evidence is not physical iPad/WebKit/PWA/device-performance acceptance.',
              },
              null,
              2,
            ),
            contentType: 'application/json',
          });
        }
      });
    });
  }
}
