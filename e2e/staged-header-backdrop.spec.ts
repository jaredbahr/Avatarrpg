import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import { visibleNpcs } from '../src/core/story/world';
import type { Command, Vec2 } from '../src/core/types';
import { resetStorage, setLargeText, startGame } from './helpers';

// #698: a staged dialogue owns one header while retaining its real exploration
// backdrop. These public node-entry fixtures skip the campaign, never edit it.
test.describe.configure({ timeout: 60_000, retries: 0 });
const pageErrors = new WeakMap<Page, string[]>();
const ROUNDING = 0.5;
const profiles = [
  { label: 'Normal', size: 'off' },
  { label: 'Largest', size: 'huge' },
] as const;

declare global {
  interface Window {
    __header698Clicks: { text: string; trusted: boolean }[];
    __header698Wheels: { trusted: boolean; deltaY: number }[];
    __header698Backdrop?: Element;
    __header698Canvas?: Element;
  }
}

async function domain(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    if (!app.state) throw new Error('Missing full game state');
    return { state: app.state, session: app.session.toMeta() };
  });
}

async function settled(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.fnt!.app.boardBusy())).toBe(false);
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          animation.effect?.getComputedTiming().iterations !== Infinity,
      );
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await expect(page.locator('.curtain.is-down, .curtain.is-lifting')).toHaveCount(0);
}

async function geometry(page: Page, phase: string) {
  return page.evaluate((phase) => {
    const rect = (element: Element) => {
      const r = element.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    // Paint eligibility is independent of ARIA/inert/pointer-events: none of
    // those suppresses the ghosted letters. Record them only as diagnostics.
    const reading = (element: Element | null) => {
      if (!element) return null;
      const text: {
        value: string;
        display: boolean;
        visibility: string;
        opacity: number;
        color: string;
        clip: { left: number; top: number; right: number; bottom: number };
        fragments: ReturnType<typeof rect>[];
        paintedFragments: ReturnType<typeof rect>[];
      }[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const value = node.textContent?.replace(/\s+/g, ' ').trim();
        const owner = node.parentElement;
        if (!value || !owner) continue;
        const style = getComputedStyle(owner);
        let opacity = 1;
        let display = true;
        const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
        for (let ancestor: Element | null = owner; ancestor; ancestor = ancestor.parentElement) {
          const css = getComputedStyle(ancestor);
          opacity *= Number(css.opacity);
          display &&= css.display !== 'none';
          if (!(ancestor instanceof HTMLElement)) continue;
          const r = ancestor.getBoundingClientRect();
          if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) {
            clip.left = Math.max(clip.left, r.left + ancestor.clientLeft);
            clip.right = Math.min(clip.right, r.left + ancestor.clientLeft + ancestor.clientWidth);
          }
          if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) {
            clip.top = Math.max(clip.top, r.top + ancestor.clientTop);
            clip.bottom = Math.min(clip.bottom, r.top + ancestor.clientTop + ancestor.clientHeight);
          }
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        const fragments = [...range.getClientRects()].map((r) => ({
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        }));
        const transparent =
          style.color === 'transparent' || /rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(style.color);
        const paintedFragments =
          display && style.visibility === 'visible' && opacity > 0 && !transparent
            ? fragments.filter(
                (r) =>
                  r.width > 0 &&
                  r.height > 0 &&
                  Math.min(r.right, clip.right) > Math.max(r.left, clip.left) &&
                  Math.min(r.bottom, clip.bottom) > Math.max(r.top, clip.top),
              )
            : [];
        text.push({
          value,
          display,
          visibility: style.visibility,
          opacity,
          color: style.color,
          clip,
          fragments,
          paintedFragments,
        });
      }
      let elementOpacity = 1;
      let elementDisplay = true;
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const css = getComputedStyle(ancestor);
        elementOpacity *= Number(css.opacity);
        elementDisplay &&= css.display !== 'none';
      }
      return {
        box: rect(element),
        paintStyle: {
          display: elementDisplay,
          opacity: elementOpacity,
          visibility: getComputedStyle(element).visibility,
        },
        text,
        paintedText: text
          .filter((entry) => entry.paintedFragments.length > 0)
          .map((entry) => entry.value),
        ariaHidden: element.getAttribute('aria-hidden'),
        inert: element instanceof HTMLElement && element.inert,
        pointerEvents: getComputedStyle(element).pointerEvents,
      };
    };
    const background = document.querySelector('.scene-host > .explore-scene');
    const header = background?.querySelector('.explore-bar') ?? null;
    const canvas = background?.querySelector('canvas.map-canvas') ?? null;
    const liveHeader = document.querySelector('.dialogue-layer .dialogue-scene > .top-bar');
    return {
      phase,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      backdrop: document.querySelector('.scene-host')?.classList.contains('has-dialogue-backdrop'),
      background: reading(background),
      oldHeader: reading(header),
      oldTitle: reading(header?.querySelector('.title-plate-name') ?? null),
      objective: reading(header?.querySelector('.explore-objective') ?? null),
      canvas: canvas ? rect(canvas) : null,
      canvasPaint: reading(canvas)?.paintStyle ?? null,
      canvasConnected: canvas?.isConnected ?? false,
      sameBackground: background === window.__header698Backdrop,
      sameCanvas: canvas === window.__header698Canvas,
      activeHeader: reading(liveHeader),
      activeHeaderCount: document.querySelectorAll('.dialogue-layer .dialogue-scene > .top-bar')
        .length,
      compactConversation: Boolean(
        document.querySelector('.explore-conversation .conversation-panel-compact'),
      ),
      state: window.fnt!.app.state,
      session: window.fnt!.app.session.toMeta(),
      camera: window.fnt!.app.rendererCamera(),
    };
  }, phase);
}
type Reading = Awaited<ReturnType<typeof geometry>>;

function sameBox(actual: Reading['canvas'], expected: Reading['canvas'], note: string): void {
  expect(actual, note).not.toBeNull();
  expect(expected, note).not.toBeNull();
  if (!actual || !expected) throw new Error(note);
  for (const key of ['left', 'right', 'top', 'bottom', 'width', 'height'] as const)
    expect
      .soft(Math.abs(actual[key] - expected[key]), `${note}: ${key}`)
      .toBeLessThanOrEqual(ROUNDING);
}

async function rememberBackdrop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__header698Backdrop =
      document.querySelector('.scene-host > .explore-scene') ?? undefined;
    window.__header698Canvas =
      document.querySelector('.explore-scene canvas.map-canvas') ?? undefined;
    if (!window.__header698Backdrop || !window.__header698Canvas)
      throw new Error('Missing actual exploration backdrop');
  });
}

async function trustedTap(
  page: Page,
  selector: string,
  actions: unknown[],
  text?: string,
): Promise<void> {
  const point = await page.evaluate(
    ({ selector, text }) => {
      const matches = [...document.querySelectorAll<HTMLElement>(selector)].filter(
        (element) =>
          text === undefined ||
          element.textContent?.replace(/\s+/g, ' ').trim() === text ||
          element.querySelector('strong')?.textContent?.trim() === text,
      );
      if (matches.length !== 1)
        throw new Error(`Expected one real control: ${selector} (${matches.length})`);
      const element = matches[0];
      if (!element || !element.isConnected || element.matches(':disabled'))
        throw new Error('Disconnected or disabled control');
      const css = getComputedStyle(element);
      const r = element.getBoundingClientRect();
      const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      for (
        let parent: Element | null = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (!(parent instanceof HTMLElement)) continue;
        const style = getComputedStyle(parent);
        const box = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          clip.left = Math.max(clip.left, box.left + parent.clientLeft);
          clip.right = Math.min(clip.right, box.left + parent.clientLeft + parent.clientWidth);
        }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
          clip.top = Math.max(clip.top, box.top + parent.clientTop);
          clip.bottom = Math.min(clip.bottom, box.top + parent.clientTop + parent.clientHeight);
        }
      }
      if (
        r.left < clip.left - 0.5 ||
        r.top < clip.top - 0.5 ||
        r.right > clip.right + 0.5 ||
        r.bottom > clip.bottom + 0.5
      )
        throw new Error(`Control is clipped by an ancestor: ${selector}`);
      if (css.display === 'none' || css.visibility !== 'visible' || Number(css.opacity) <= 0)
        throw new Error('Control is not painted');
      if (
        r.width <= 0 ||
        r.height <= 0 ||
        r.left < 0 ||
        r.top < 0 ||
        r.right > innerWidth ||
        r.bottom > innerHeight
      )
        throw new Error(`Control requires scrolling or is outside the viewport: ${selector}`);
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (!element.contains(document.elementFromPoint(x, y)))
        throw new Error('Control is occluded');
      return {
        x,
        y,
        text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        clicks: window.__header698Clicks.length,
      };
    },
    { selector, text },
  );
  await page.touchscreen.tap(point.x, point.y);
  const received = await page.evaluate(
    (count) => window.__header698Clicks.slice(count),
    point.clicks,
  );
  expect(received).toEqual([{ text: point.text, trusted: true }]);
  actions.push({ selector, point, received });
}

/** The ending deliberately scrolls on its stage; use actual input before the strict tap. */
async function scrollEnding(page: Page, actions: unknown[]): Promise<void> {
  const before = await domain(page);
  const scroll = await page.evaluate(() => {
    const stages = document.querySelectorAll<HTMLElement>(
      '.dialogue-layer .stage[data-kind="end"]',
    );
    if (stages.length !== 1) throw new Error('Expected one real ending stage');
    const stage = stages[0];
    if (!stage) throw new Error('Missing ending stage');
    const buttons = [...stage.querySelectorAll<HTMLElement>('.end-panel button')].filter(
      (button) => button.textContent?.trim() === 'Keep exploring',
    );
    if (buttons.length !== 1) throw new Error('Expected one Keep exploring action');
    const button = buttons[0];
    if (!button) throw new Error('Missing ending return action');
    const box = stage.getBoundingClientRect();
    const target = button.getBoundingClientRect();
    const bottom = Math.min(innerHeight, box.top + stage.clientTop + stage.clientHeight);
    const needed = Math.max(0, target.bottom - bottom);
    const remaining = stage.scrollHeight - stage.clientHeight - stage.scrollTop;
    if (needed > 0 && (getComputedStyle(stage).overflowY !== 'auto' || remaining < needed - 0.5))
      throw new Error('Ending return action has no documented scroll access');
    const x = box.left + box.width / 2;
    const y = Math.max(0, box.top) + Math.min(box.height, innerHeight - Math.max(0, box.top)) / 2;
    if (needed > 0 && !stage.contains(document.elementFromPoint(x, y)))
      throw new Error('Ending scroll target is occluded');
    return {
      needed,
      remaining,
      top: stage.scrollTop,
      x,
      y,
      wheels: window.__header698Wheels.length,
    };
  });
  if (scroll.needed > 0) {
    await page.mouse.move(scroll.x, scroll.y);
    await page.mouse.wheel(0, scroll.remaining);
    await expect
      .poll(() =>
        page
          .locator('.dialogue-layer .stage[data-kind="end"]')
          .evaluate((stage) => stage.scrollTop),
      )
      .toBeGreaterThan(scroll.top);
    const wheels = await page.evaluate(
      (count) => window.__header698Wheels.slice(count),
      scroll.wheels,
    );
    expect(wheels).toEqual([{ trusted: true, deltaY: scroll.remaining }]);
    await settled(page);
    expect(await domain(page)).toEqual(before);
    actions.push({ userEndStageScroll: scroll, wheels, unchangedDomain: await domain(page) });
  }
}

async function commandTap(
  page: Page,
  selector: string,
  command: Command,
  actions: unknown[],
  states: unknown[],
  text?: string,
): Promise<void> {
  const before = await domain(page);
  const expected = apply(CONTENT, before.state, command);
  expect(expected.state).not.toEqual(before.state);
  await trustedTap(page, selector, actions, text);
  await expect.poll(async () => (await domain(page)).state).toEqual(expected.state);
  const after = await domain(page);
  expect(after.session).toEqual(before.session);
  states.push({ command, before, expected, after });
  await settled(page);
}

async function publicSetupCommand(page: Page, command: Command, states: unknown[]): Promise<void> {
  const before = await domain(page);
  const expected = apply(CONTENT, before.state, command);
  await page.evaluate((command) => window.fnt!.app.dispatch(command), command);
  await expect.poll(async () => (await domain(page)).state).toEqual(expected.state);
  const after = await domain(page);
  expect(after.session).toEqual(before.session);
  states.push({ setupCommand: command, before, expected, after });
  await settled(page);
}

function staged(reading: Reading, before: Reading, speaker: string): void {
  expect(reading.backdrop).toBe(true);
  expect(reading.compactConversation).toBe(false);
  expect(reading.sameBackground).toBe(true);
  expect(reading.sameCanvas).toBe(true);
  expect(reading.canvasConnected).toBe(true);
  expect(reading.canvas?.height ?? 0).toBeGreaterThan(0);
  expect(reading.canvasPaint).toEqual(before.canvasPaint);
  expect(reading.canvasPaint?.visibility).toBe('visible');
  expect(reading.canvasPaint?.display).toBe(true);
  expect(reading.canvasPaint?.opacity ?? 0).toBeGreaterThan(0);
  sameBox(reading.canvas, before.canvas, 'retained canvas geometry');
  sameBox(
    reading.oldHeader?.box ?? null,
    before.oldHeader?.box ?? null,
    'retained header allocation',
  );
  expect(reading.activeHeaderCount).toBe(1);
  expect(reading.activeHeader?.paintedText.join(' ')).toContain(speaker);
  const speakerText = reading.activeHeader?.text.find((entry) => entry.value.includes(speaker));
  expect(speakerText).toBeDefined();
  if (!speakerText) throw new Error('Missing the actual speaker text');
  expect(speakerText.paintedFragments.length).toBeGreaterThan(0);
  for (const fragment of speakerText.fragments) {
    expect.soft(fragment.left).toBeGreaterThanOrEqual(speakerText.clip.left - ROUNDING);
    expect.soft(fragment.right).toBeLessThanOrEqual(speakerText.clip.right + ROUNDING);
    expect.soft(fragment.top).toBeGreaterThanOrEqual(speakerText.clip.top - ROUNDING);
    expect.soft(fragment.bottom).toBeLessThanOrEqual(speakerText.clip.bottom + ROUNDING);
  }
  // Soft only to preserve the complete positive controls and restoration proof
  // in baseline RED. The case still fails on any painted outgoing text.
  expect
    .soft(
      reading.oldHeader?.paintedText ?? ['MISSING HEADER'],
      'outgoing exploration header must not paint',
    )
    .toEqual([]);
  expect
    .soft(reading.objective?.paintedText ?? [], 'outgoing objective must not paint')
    .toEqual([]);
}

async function capture(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

for (const profile of profiles) {
  test.describe(profile.label, () => {
    test.use({
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 1,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    test.beforeEach(async ({ page }) => {
      const errors: string[] = [];
      pageErrors.set(page, errors);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.__header698Clicks = [];
        window.__header698Wheels = [];
        document.addEventListener(
          'wheel',
          (event) => {
            window.__header698Wheels.push({ trusted: event.isTrusted, deltaY: event.deltaY });
          },
          { capture: true, passive: true },
        );
        document.addEventListener(
          'click',
          (event) => {
            const button = event.target instanceof Element ? event.target.closest('button') : null;
            if (button)
              window.__header698Clicks.push({
                text: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
                trusted: event.isTrusted,
              });
          },
          { capture: true, passive: true },
        );
      });
      await resetStorage(page, '?style=topdown&renderer=canvas');
      await startGame(page, ['Ava'], ['sura'], 'staged-header-698', {
        reduceMotion: false,
        storyChoices: 'turns',
      });
      await setLargeText(page, profile.size);
    });

    for (const fixture of [
      {
        name: 'Ruon surrender',
        map: 'quarry_gate',
        explore: 'gate_escort_explore',
        node: 'ruon_surrender',
        speaker: 'Captain Ruon',
      },
      {
        name: 'Mira welcome home',
        map: 'ba_dan_village',
        explore: 'village_return_explore',
        node: 'welcome_home_mira',
        speaker: 'Elder Mira',
      },
    ] as const) {
      test(`${fixture.name} owns the staged header and restores exploration`, async ({
        page,
      }, info) => {
        const errors = pageErrors.get(page);
        if (!errors) throw new Error('Missing page error observer');
        const readings: Reading[] = [];
        const states: unknown[] = [];
        const actions: unknown[] = [];
        try {
          await publicSetupCommand(page, { type: 'enterNode', nodeId: fixture.explore }, states);
          expect((await domain(page)).state.location.mapId).toBe(fixture.map);
          await rememberBackdrop(page);
          const before = await geometry(page, 'exploration before staged entry');
          readings.push(before);
          expect(before.backdrop).toBe(false);
          expect(before.oldTitle?.paintedText.join(' ')).toContain(
            CONTENT.maps.get(fixture.map)?.name ?? 'MISSING MAP',
          );
          await publicSetupCommand(page, { type: 'enterNode', nodeId: fixture.node }, states);
          const opening = await geometry(page, 'staged opening');
          readings.push(opening);
          await capture(page, info, 'staged-opening');
          staged(opening, before, fixture.speaker);

          // Follow every authored line and choice with actual input, including
          // the demo card's real return action. No forced route or state patch.
          for (let step = 0; step < 16; step++) {
            const now = await domain(page);
            if (now.state.screen === 'explore') break;
            const nodeId = now.state.story.nodeId;
            if (!nodeId) throw new Error('Missing current authored node ID');
            const node = CONTENT.story.get(nodeId);
            if (!node) throw new Error('Missing current authored node');
            if (node.kind === 'dialogue') {
              await commandTap(
                page,
                '.dialogue-layer [data-conversation-control="next"]',
                { type: 'advanceDialogue' },
                actions,
                states,
              );
            } else if (node.kind === 'choice' && node.id === 'ruon_choice') {
              const choice = await geometry(page, 'staged Ruon choice');
              readings.push(choice);
              await capture(page, info, 'staged-choice');
              staged(choice, before, 'Captain Ruon');
              const optionIndex = node.options.findIndex(
                (option) => option.label === 'Escort him back to Ba Dan for trial',
              );
              expect(optionIndex).toBe(0);
              await commandTap(
                page,
                '.dialogue-layer .choice-option',
                { type: 'chooseOption', optionIndex },
                actions,
                states,
                'Escort him back to Ba Dan for trial',
              );
            } else if (node.kind === 'end' && node.id === 'demo_complete') {
              await scrollEnding(page, actions);
              await commandTap(
                page,
                '.dialogue-layer .end-panel button',
                { type: 'enterNode', nodeId: 'village_return_explore' },
                actions,
                states,
                'Keep exploring',
              );
            } else throw new Error(`Unexpected authored route ${node.id}/${node.kind}`);
          }
          const final = await domain(page);
          expect(final.state.screen).toBe('explore');
          expect(final.state.story.nodeId).toBe(fixture.explore);
          expect(final.state.location.mapId).toBe(fixture.map);
          const restored = await geometry(page, 'restored exploration');
          readings.push(restored);
          expect(restored.backdrop).toBe(false);
          expect(restored.activeHeaderCount).toBe(0);
          expect(restored.sameCanvas).toBe(true);
          expect(restored.sameBackground).toBe(true);
          expect(restored.oldTitle?.paintedText.join(' ')).toContain(
            CONTENT.maps.get(fixture.map)?.name ?? 'MISSING MAP',
          );
          sameBox(restored.canvas, before.canvas, 'restored canvas geometry');
          await capture(page, info, 'restored-exploration');
          expect(errors).toEqual([]);
        } finally {
          await info.attach('staged-header-full-state-geometry-input', {
            body: JSON.stringify({
              fixture,
              profile,
              readings,
              states,
              actions,
              errors,
              final: await domain(page),
              clicks: await page.evaluate(() => window.__header698Clicks),
            }),
            contentType: 'application/json',
          });
        }
      });
    }

    test('ordinary Mira Talk keeps its exploration header', async ({ page }, info) => {
      const errors = pageErrors.get(page);
      if (!errors) throw new Error('Missing page error observer');
      const readings: Reading[] = [];
      const states: unknown[] = [];
      const actions: unknown[] = [];
      try {
        await publicSetupCommand(page, { type: 'enterNode', nodeId: 'village_explore' }, states);
        const current = await domain(page);
        const map = CONTENT.maps.get(current.state.location.mapId);
        if (!map) throw new Error('Missing village map');
        const mira = visibleNpcs(CONTENT, map, current.state).find(
          (npc) => npc.id === 'elder_mira',
        );
        if (!mira) throw new Error('Mira is not present in the legal fixture');
        const positions: Vec2[] = [
          { x: mira.pos.x - 1, y: mira.pos.y },
          { x: mira.pos.x + 1, y: mira.pos.y },
          { x: mira.pos.x, y: mira.pos.y - 1 },
          { x: mira.pos.x, y: mira.pos.y + 1 },
        ];
        const approach = positions
          .map((pos) => ({ pos, result: apply(CONTENT, current.state, { type: 'walkTo', pos }) }))
          .find(
            ({ pos, result }) =>
              result.state.screen === 'explore' &&
              result.state.location.pos.x === pos.x &&
              result.state.location.pos.y === pos.y &&
              result.state !== current.state,
          );
        if (!approach) throw new Error('No legal adjacent approach to Mira');
        await publicSetupCommand(page, { type: 'walkTo', pos: approach.pos }, states);
        await rememberBackdrop(page);
        const before = await geometry(page, 'before ordinary Talk');
        readings.push(before);
        await commandTap(
          page,
          '.explore-hud button[title="Walk over and talk to Elder Mira"]',
          { type: 'walkTo', pos: mira.pos },
          actions,
          states,
        );
        expect((await domain(page)).state.story.nodeId).toBe('mira_intro');
        const talk = await geometry(page, 'ordinary world Talk');
        readings.push(talk);
        expect(talk.backdrop).toBe(false);
        expect(talk.activeHeaderCount).toBe(0);
        expect(talk.compactConversation).toBe(true);
        expect(talk.oldTitle?.paintedText.join(' ')).toContain(
          CONTENT.maps.get('ba_dan_village')?.name ?? 'MISSING MAP',
        );
        expect(talk.oldHeader?.paintedText.join(' ')).toContain('Conversation');
        await capture(page, info, 'ordinary-talk');
        for (let step = 0; step < 4; step++)
          await commandTap(
            page,
            '.explore-conversation [data-conversation-control="next"]',
            { type: 'advanceDialogue' },
            actions,
            states,
          );
        expect((await domain(page)).state.screen).toBe('explore');
        const restored = await geometry(page, 'ordinary Talk return');
        readings.push(restored);
        expect(restored.backdrop).toBe(false);
        expect(restored.oldTitle?.paintedText.join(' ')).toContain(
          CONTENT.maps.get('ba_dan_village')?.name ?? 'MISSING MAP',
        );
        await capture(page, info, 'ordinary-talk-return');
        expect(errors).toEqual([]);
      } finally {
        await info.attach('ordinary-talk-full-state-geometry-input', {
          body: JSON.stringify({
            profile,
            readings,
            states,
            actions,
            errors,
            final: await domain(page),
            clicks: await page.evaluate(() => window.__header698Clicks),
          }),
          contentType: 'application/json',
        });
      }
    });
  });
}
