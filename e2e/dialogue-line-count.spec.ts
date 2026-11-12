import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  waitForIdle,
} from './helpers';

test.describe.configure({ retries: 0, timeout: 60_000 });
test.use({ deviceScaleFactor: 2 });

const PEOPLE = [
  { id: 'kid_pella', name: 'Pella' },
  { id: 'shopkeeper_gao', name: 'Gao the Shopkeeper' },
] as const;
const SIZES = [
  { setting: 'off', rem: 16 },
  { setting: 'on', rem: 20 },
  { setting: 'huge', rem: 24 },
] as const;

async function snapshot(page: Page) {
  return page.evaluate(() => ({
    state: structuredClone(window.fnt!.app.state!),
    session: window.fnt!.app.session.toMeta(),
  }));
}

/** Supported adjacent placement; Talk itself uses the canonical resident and real controls. */
async function talk(page: Page, person: (typeof PEOPLE)[number]) {
  await resetStorage(page, '?style=topdown&renderer=canvas');
  await startGame(page, ['Ava', 'Ben', 'Cy'], ['kaya', 'sura', 'bo'], 'layout627-current', {
    reduceMotion: false,
  });
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await settleLayout(page);
  const setup = await page.evaluate((id) => {
    const app = window.fnt!.app;
    const state = app.state!;
    const map = app.content.maps.get(state.location.mapId);
    const figures = app.residents.figures();
    const resident = figures.find((figure) => figure.npcId === id);
    if (!map || !resident?.pos) throw new Error(`No canonical resident ${id}`);
    const target = resident.pos;
    const offsets = [
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    const pos = offsets
      .map((offset) => ({ x: target.x + offset.x, y: target.y + offset.y }))
      .find((candidate) => {
        const symbol = map.rows[candidate.y]?.[candidate.x];
        const tile = symbol === undefined ? undefined : map.legend[symbol];
        return (
          tile !== undefined &&
          !tile.blocked &&
          !figures.some((figure) => figure.pos?.x === candidate.x && figure.pos.y === candidate.y)
        );
      });
    if (!pos) throw new Error('No legal adjacent approach');
    app.adoptSave({ ...state, location: { ...state.location, pos } }, app.session.toMeta());
    return { target, pos };
  }, person.id);
  await waitForIdle(page);
  await page.waitForFunction(
    (id) => {
      const resident = window.fnt!.app.residents.figures().find((figure) => figure.npcId === id);
      return (
        resident?.pos &&
        !resident.walking &&
        resident.alpha === 1 &&
        resident.drawPos.x === resident.pos.x &&
        resident.drawPos.y === resident.pos.y
      );
    },
    person.id,
    { timeout: 10_000 },
  );
  await settleLayout(page);
  await page.getByRole('button', { name: 'Look around', exact: true }).tap();
  await page
    .getByRole('dialog', { name: 'Look around', exact: true })
    .getByRole('button', { name: `Visit ${person.name}`, exact: true })
    .tap();
  const panel = page.locator('.explore-conversation .dialogue-panel:not(.choice-panel)');
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.state!.world.talk?.npcId)).toBe(person.id);
  return { panel, setup, beforeSettings: await snapshot(page) };
}

async function reading(panel: Locator) {
  return panel.evaluate((element) => {
    const rect = (node: Element) => {
      const bounds = node.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const item = (selector: string) => {
      const node = element.querySelector<HTMLElement>(selector);
      if (!node) throw new Error(`Missing conversation element ${selector}`);
      const range = document.createRange();
      range.selectNodeContents(node);
      return {
        ...rect(node),
        text: node.textContent,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        textRects: [...range.getClientRects()].map((bounds) => ({
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
        })),
      };
    };
    const panelStyle = getComputedStyle(element);
    const head = element.querySelector('.conversation-compact-head');
    const next = element.querySelector('[data-conversation-control="next"]');
    if (!head || !next) throw new Error('Missing conversation header or Next');
    return {
      panel: rect(element),
      head: rect(head),
      portrait: item('.conversation-compact-portrait .painter'),
      name: item('.conversation-compact-speaker strong'),
      count: item('.line-count'),
      line: item('.dialogue-line'),
      next: rect(next),
      nextMinHeight: parseFloat(getComputedStyle(next).minHeight),
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      padding: {
        top: parseFloat(panelStyle.paddingTop),
        right: parseFloat(panelStyle.paddingRight),
        bottom: parseFloat(panelStyle.paddingBottom),
        left: parseFloat(panelStyle.paddingLeft),
      },
      headGap: parseFloat(getComputedStyle(head).gap),
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      dpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
}

type Bounds = { left: number; top: number; right: number; bottom: number };

function insidePanel(bounds: Bounds, panel: Bounds): void {
  expect(bounds.left).toBeGreaterThanOrEqual(panel.left + 1);
  expect(bounds.right).toBeLessThanOrEqual(panel.right - 1);
  expect(bounds.top).toBeGreaterThanOrEqual(panel.top + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(panel.bottom - 1);
}

/** Boundary layouts may scroll. Check each piece after normal browser scroll-into-view. */
async function reachable(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const result = await target.evaluate((node) => {
    const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        clip.left = Math.max(clip.left, bounds.left + parent.clientLeft);
        clip.right = Math.min(clip.right, bounds.left + parent.clientLeft + parent.clientWidth);
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        clip.top = Math.max(clip.top, bounds.top + parent.clientTop);
        clip.bottom = Math.min(clip.bottom, bounds.top + parent.clientTop + parent.clientHeight);
      }
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    const boxes = node.matches('button')
      ? [node.getBoundingClientRect()]
      : [...range.getClientRects()];
    return {
      clip,
      boxes: boxes.map((bounds) => ({
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
      })),
    };
  });
  expect(result.boxes.length).toBeGreaterThan(0);
  for (const box of result.boxes) {
    expect(box.left).toBeGreaterThanOrEqual(result.clip.left);
    expect(box.right).toBeLessThanOrEqual(result.clip.right);
    expect(box.top).toBeGreaterThanOrEqual(result.clip.top);
    expect(box.bottom).toBeLessThanOrEqual(result.clip.bottom);
  }
}

async function nextLine(page: Page, panel: Locator): Promise<void> {
  const before = await snapshot(page);
  await panel.locator('[data-conversation-control="next"]').tap();
  await expect(panel).toBeVisible();
  expect(await snapshot(page)).toEqual({
    state: apply(CONTENT, before.state, { type: 'advanceDialogue' }).state,
    session: before.session,
  });
}

for (const viewport of [
  { width: 1180, height: 820 },
  { width: 1366, height: 1024 },
]) {
  for (const person of PEOPLE) {
    test(`short ${person.name} dialogue stays visible at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const { panel, setup, beforeSettings } = await talk(page, person);
      for (const size of SIZES) {
        await setLargeText(page, size.setting);
        await settleLayout(page);
        const measured = await reading(panel);
        await info.attach(`layout-${size.setting}`, {
          body: Buffer.from(JSON.stringify({ viewport, person, size, setup, measured })),
          contentType: 'application/json',
        });
        if (size.setting === 'huge') {
          await page.screenshot({ path: info.outputPath('natural-talk-huge.png') });
        }
        expect(measured.dpr).toBe(2);
        expect(measured.rem).toBe(size.rem);
        expect(measured.portrait.width).toBe(15 * size.rem);
        expect(measured.portrait.height).toBe(15 * size.rem);
        expect(measured.name.text).toBe(person.name);
        expect(measured.name.scrollWidth).toBeLessThanOrEqual(measured.name.clientWidth + 1);
        for (const bounds of measured.name.textRects) {
          expect(bounds.left).toBeGreaterThanOrEqual(measured.head.left - 1);
          expect(bounds.right).toBeLessThanOrEqual(measured.head.right + 1);
          insidePanel(bounds, measured.panel);
        }
        expect(measured.count.text).toMatch(/^1 of (?:[2-9]|[1-9]\d+)$/);
        expect(measured.line.text?.length).toBeGreaterThan(0);
        for (const item of [measured.count, measured.line]) {
          insidePanel(item, measured.panel);
          for (const bounds of item.textRects) insidePanel(bounds, measured.panel);
        }
        // Preserve the independently reproduced RED oracle, including its border-safe bound.
        expect(
          measured.count.bottom,
          'current line count must be visible without scrolling a short dialogue',
        ).toBeLessThanOrEqual(measured.panel.bottom - 1);
        insidePanel(measured.next, measured.panel);
        expect(measured.nextMinHeight).toBe(3.5 * size.rem);
        expect(measured.next.height).toBeGreaterThanOrEqual(3.5 * size.rem);
        expect(measured.next.width).toBeGreaterThanOrEqual(3 * size.rem);
        expect(measured.scrollTop).toBe(0);
        expect(measured.scrollHeight).toBeLessThanOrEqual(measured.clientHeight + 1);
        expect(measured.panel.top).toBeGreaterThanOrEqual(0);
        expect(measured.panel.bottom).toBeLessThanOrEqual(viewport.height);
        // The taller control is outside max-height:55rem and keeps its established spacing.
        const compact = viewport.height <= 55 * 16;
        expect(measured.padding).toEqual({
          top: (compact ? 0.25 : 1) * size.rem,
          right: size.rem,
          bottom: (compact ? 0.25 : 1) * size.rem,
          left: size.rem,
        });
        expect(measured.headGap).toBe((compact ? 0.25 : 0.75) * size.rem);
        expect(await snapshot(page)).toEqual(beforeSettings);
      }
      await nextLine(page, panel);
      expect(errors).toEqual([]);
    });
  }
}

for (const boundary of [
  { viewport: { width: 667, height: 375 }, portraitRem: 5, paddingRem: 0.75 },
  { viewport: { width: 768, height: 1024 }, portraitRem: 6, paddingRem: 1 },
]) {
  test(`Pella preserves responsive sizing and scroll access at ${boundary.viewport.width}x${boundary.viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(boundary.viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const { panel, setup, beforeSettings } = await talk(page, PEOPLE[0]);
    for (const size of SIZES) {
      await setLargeText(page, size.setting);
      await settleLayout(page);
      const measured = await reading(panel);
      await info.attach(`boundary-${size.setting}`, {
        body: Buffer.from(JSON.stringify({ boundary, size, setup, measured })),
        contentType: 'application/json',
      });
      expect(measured.dpr).toBe(2);
      expect(measured.rem).toBe(size.rem);
      expect(measured.portrait.width).toBe(boundary.portraitRem * size.rem);
      expect(measured.portrait.height).toBe(boundary.portraitRem * size.rem);
      expect(measured.padding).toEqual({
        top: boundary.paddingRem * size.rem,
        right: boundary.paddingRem * size.rem,
        bottom: boundary.paddingRem * size.rem,
        left: boundary.paddingRem * size.rem,
      });
      expect(measured.headGap).toBe(0.75 * size.rem);
      expect(measured.nextMinHeight).toBe(3.5 * size.rem);
      expect(measured.next.height).toBeGreaterThanOrEqual(3.5 * size.rem);
      expect(measured.next.width).toBeGreaterThanOrEqual(3 * size.rem);
      for (const selector of [
        '.conversation-compact-speaker strong',
        '.line-count',
        '.dialogue-line',
        '[data-conversation-control="next"]',
      ]) {
        await reachable(panel.locator(selector));
      }
      expect(await snapshot(page)).toEqual(beforeSettings);
    }
    await page.screenshot({ path: info.outputPath('responsive-scroll-control.png') });
    await nextLine(page, panel);
    expect(errors).toEqual([]);
  });
}
