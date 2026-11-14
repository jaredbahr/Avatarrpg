import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import { createGame } from '../src/core/state/createGame';
import { awardXp, levelUpOutcome, xpForLevel } from '../src/core/rules/leveling';
import { earnedRewardFixture } from './earnedRewardFixture';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleDialog,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import { paintedTileCentre } from './projection';

type RegisteredTargets = Window & { tapTargetHandlers?: WeakMap<Element, Set<string>> };

/** Observe the real app registrations before boot, including nonsemantic controls. */
async function observeTargets(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const handlers = new WeakMap<Element, Set<string>>();
    (window as RegisteredTargets).tapTargetHandlers = handlers;
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, callback, options) {
      // Pointer input also finds the playable canvas and long-press targets.
      if (this instanceof Element && /^(click|pointerdown|mousedown|touchstart)$/.test(type)) {
        const events = handlers.get(this) ?? new Set<string>();
        events.add(type);
        handlers.set(this, events);
      }
      return add.call(this, type, callback, options);
    };
  });
}

/**
 * Measure every rendered target, including disabled choices and controls below
 * a scroll fold. No size, viewport-intersection or semantic-only filtering can
 * silently remove a failing control. Inert scene backdrops are not interactive.
 */
async function audit(page: Page, screen: string, required: readonly string[]): Promise<void> {
  for (const selector of required)
    await expect(page.locator(selector).first(), screen).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const census = await page.evaluate(
    (required) => {
      const handlers = (window as RegisteredTargets).tapTargetHandlers;
      if (!handlers) throw new Error('Tap-target listener observation was not installed');
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;visibility:hidden;pointer-events:none;width:var(--tap);height:var(--tap)';
      document.body.append(probe);
      const tap = probe.getBoundingClientRect().width;
      probe.remove();
      if (!Number.isFinite(tap) || tap <= 0) throw new Error('--tap did not resolve to pixels');
      const semantic =
        'button,a[href],[role="button"],input,select,textarea,[tabindex]:not([tabindex="-1"])';
      const targets = [...document.querySelectorAll('*')].filter((node) => {
        if (node.closest('[inert]')) return false;
        const style = getComputedStyle(node);
        if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        if (node.getClientRects().length === 0) return false;
        return (
          node.matches(semantic) ||
          (handlers.get(node)?.size ?? 0) > 0 ||
          (node instanceof HTMLElement && node.onclick !== null)
        );
      });
      return {
        tap,
        reached: required.map((selector) => ({
          selector,
          count: targets.filter((node) => node.matches(selector)).length,
        })),
        targets: targets.map((node) => {
          const box = node.getBoundingClientRect();
          return {
            tag: node.tagName,
            classes: node.getAttribute('class'),
            label: (node.getAttribute('aria-label') ?? node.textContent ?? '').trim().slice(0, 120),
            width: box.width,
            height: box.height,
            events: [...(handlers.get(node) ?? [])],
          };
        }),
      };
    },
    [...required],
  );
  expect(census.targets.length, `${screen}: census is not empty`).toBeGreaterThan(0);
  for (const target of census.reached)
    expect(target.count, `${screen}: measured ${target.selector}`).toBeGreaterThan(0);
  const small = census.targets.filter(
    (target) => target.width < census.tap || target.height < census.tap,
  );
  await test.info().attach(screen, {
    body: JSON.stringify(census, null, 2),
    contentType: 'application/json',
  });
  expect.soft(small, `${screen}: every target must be at least ${census.tap}px`).toEqual([]);
}

async function auditDialog(page: Page, name: string, required: readonly string[]): Promise<void> {
  const dialog = page.getByRole('dialog', { name, exact: true });
  await expect(dialog).toBeVisible();
  await settleDialog(dialog);
  await audit(page, name, required);
}

/** The real tooltip must answer keyboard/touch once without issuing a game command. */
async function statusTooltip(page: Page): Promise<void> {
  const description = CONTENT.statuses.get('guarded')?.description;
  if (!description) throw new Error('Guarded has no tooltip description');
  const chip = page.locator('.chip-status').filter({ hasText: /^Guarded$/ });
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveAttribute('role', 'button');
  await expect(chip).toHaveAttribute('tabindex', '0');
  await expect(chip).toHaveAttribute('title', description);
  await chip.scrollIntoViewIfNeeded();
  await chip.focus();
  await expect(chip).toBeFocused();
  await settleLayout(page);
  const observe = () =>
    page.evaluate(() => {
      const app = window.fnt!.app;
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!canvas) throw new Error('The tooltip checkpoint lost its combat canvas');
      const rect = canvas.getBoundingClientRect();
      return {
        state: app.state,
        session: app.session.toMeta(),
        camera: app.rendererCamera(),
        canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        backing: {
          width: canvas.width,
          height: canvas.height,
          dpr: Math.min(3, window.devicePixelRatio || 1),
        },
      };
    });
  const before = await observe();
  expect(Math.abs(before.backing.width / before.backing.dpr - before.canvas.width)).toBeLessThan(1);
  expect(Math.abs(before.backing.height / before.backing.dpr - before.canvas.height)).toBeLessThan(
    1,
  );
  await test.info().attach('status-tooltip-before', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  // Count genuine clicks without replacing the app's existing tooltip handler.
  const observed = await chip.evaluateHandle((node: HTMLElement) => {
    const seen = { clicks: 0, repeatedKeys: [] as string[] };
    node.addEventListener('click', () => seen.clicks++);
    node.addEventListener('keydown', (event) => {
      if (event.repeat) seen.repeatedKeys.push(event.key);
    });
    return seen;
  });
  const clicks = () => observed.evaluate((seen) => seen.clicks);
  const toast = page.locator('.toast').filter({ hasText: description });
  await page.evaluate(() => window.fnt!.app.toasts.clear());
  await page.keyboard.press('Enter');
  expect(await clicks()).toBe(1);
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveText(description);
  await page.keyboard.press('Space');
  expect(await clicks()).toBe(2);
  for (const [key, expected] of [
    ['Enter', 3],
    ['Space', 4],
  ] as const) {
    await page.keyboard.down(key);
    expect(await clicks()).toBe(expected);
    await page.keyboard.down(key);
    expect(await clicks(), `held ${key} must not activate twice`).toBe(expected);
    await page.keyboard.up(key);
  }
  expect(await observed.evaluate((seen) => seen.repeatedKeys)).toEqual(['Enter', ' ']);
  expect(await observe()).toEqual(before);
  // Toasts intentionally deduplicate identical text for 900 ms. Wait on real
  // browser time before the independent touch check, without replacing its clock.
  const lastKeyAt = await page.evaluate(() => performance.now());
  await page.waitForFunction((at) => performance.now() - at >= 1000, lastKeyAt);
  await page.evaluate(() => window.fnt!.app.toasts.clear());
  await chip.tap();
  expect(await clicks()).toBe(5);
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveText(description);
  await settleLayout(page);
  const after = await observe();
  expect(after).toEqual(before);
  await test.info().attach('status-tooltip-after', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await test.info().attach('status-tooltip-state-and-layout', {
    body: JSON.stringify({ before, after }, null, 2),
    contentType: 'application/json',
  });
  await observed.dispose();
}

/** The existing capped HUD must reveal its complete actions through real scrolling. */
async function reachableCombatActions(page: Page, mobileWebKit: boolean): Promise<void> {
  const observe = () =>
    page.evaluate(() => {
      const app = window.fnt!.app;
      const hud = document.querySelector<HTMLElement>('.combat-scene .hud');
      const canvas = document.querySelector('.map-canvas');
      const end = hud?.querySelector<HTMLButtonElement>('.end-turn');
      const shove = [
        ...(hud?.querySelectorAll<HTMLButtonElement>('.action-row button') ?? []),
      ].find((button) => button.textContent?.trim().startsWith('Shove'));
      if (!hud || !canvas || !end || !shove)
        throw new Error('The combat reachability checkpoint lost its HUD or actions');
      const box = (node: Element) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      };
      const bounds = box(hud);
      const visibleBottom = Math.min(bounds.bottom, innerHeight);
      return {
        stable: {
          state: app.state,
          session: app.session.toMeta(),
          camera: app.rendererCamera(),
          canvas: box(canvas),
        },
        hud: {
          ...bounds,
          scrollTop: hud.scrollTop,
          scrollHeight: hud.scrollHeight,
          clientHeight: hud.clientHeight,
          visibleBottom,
        },
        targets: [shove, end].map((button) => {
          const rect = box(button);
          const hit = document.elementFromPoint(
            (rect.left + rect.right) / 2,
            (rect.top + rect.bottom) / 2,
          );
          return {
            name: button.textContent?.trim(),
            ...rect,
            inside:
              rect.left >= Math.max(bounds.left, 0) &&
              rect.right <= Math.min(bounds.right, innerWidth) &&
              rect.top >= Math.max(bounds.top, 0) &&
              rect.bottom <= visibleBottom,
            receivesPointer: hit?.closest('button') === button,
          };
        }),
      };
    });
  const before = await observe();
  const needsScroll = before.targets.some((target) => target.bottom > before.hud.visibleBottom);
  if (needsScroll) {
    if (mobileWebKit) {
      // Playwright cannot send wheel input to mobile WebKit.
      await page.locator('.combat-scene .hud').evaluate((hud) => hud.scrollTo(0, hud.scrollHeight));
    } else {
      await page.mouse.move(
        (before.hud.left + before.hud.right) / 2,
        (Math.max(before.hud.top, 0) + before.hud.visibleBottom) / 2,
      );
      await page.mouse.wheel(0, before.hud.scrollHeight);
    }
  }
  await expect
    .poll(async () =>
      (await observe()).targets.map((target) => target.inside && target.receivesPointer),
    )
    .toEqual([true, true]);
  const after = await observe();
  if (needsScroll) expect(after.hud.scrollTop).toBeGreaterThan(before.hud.scrollTop);
  expect(after.stable).toEqual(before.stable);
  await test.info().attach('combat-hud-scroll-reachability', {
    body: JSON.stringify({ before, after, needsScroll }, null, 2),
    contentType: 'application/json',
  });
  await test.info().attach('combat-hud-reachable-actions', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}

async function setup(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your party' })).toBeVisible();
  await audit(page, 'setup-count', ['.count-row button', '.setup-footer button']);
  await page.getByRole('button', { name: '2 players', exact: true }).click();
  await page.getByRole('button', { name: 'Choose your own', exact: true }).click();
  const names = ['Aster', 'River'];
  for (const [index, name] of names.entries()) {
    await expect(page.getByRole('heading', { name: 'Pass the tablet along' })).toBeVisible();
    await audit(page, `setup-handoff-${name}`, ['.handoff button']);
    await page.getByRole('button', { name: "I've got it", exact: true }).click();
    await audit(page, `setup-name-${name}`, ['input[aria-label="Your name"]']);
    await page.getByRole('textbox', { name: 'Your name' }).fill(name);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    if (index + 1 < names.length)
      await expect(page.getByRole('heading', { name: 'Pass the tablet along' })).toBeVisible();
  }
  const heroes = [
    { owner: 'Aster', element: 'fire' },
    { owner: 'River', element: 'water' },
    { owner: 'Aster', element: 'earth' },
  ];
  for (const [index, hero] of heroes.entries()) {
    await expect(page.getByRole('heading', { name: 'Pass the tablet along' })).toBeVisible();
    await audit(page, `setup-hero-handoff-${index + 1}`, ['.handoff button']);
    await page.getByRole('button', { name: "I've got it", exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pick your path' })).toBeVisible();
    await audit(page, `setup-element-${hero.owner}`, [
      '.pick-card',
      '.setup-footer button:disabled',
    ]);
    await page.locator(`.pick-card.element-${hero.element}`).click();
    await audit(page, `setup-selected-element-${hero.owner}`, ['.pick-card.selected']);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pick your character' })).toBeVisible();
    await audit(page, `setup-character-${hero.owner}`, [
      '.character-card',
      '.setup-footer button:disabled',
    ]);
    await page.locator('.character-card:not(:disabled)').first().click();
    await audit(page, `setup-selected-character-${hero.owner}`, ['.character-card.selected']);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'The party', exact: true })).toBeVisible();
  await audit(page, 'setup-summary', ['#begin-game']);
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
}

/** A deterministic level-5 layout checkpoint, not evidence of earning level 5 on this route. */
function disciplineCheckpoint() {
  let state = createGame(CONTENT, {
    seed: 'tap-targets-discipline',
    party: [{ characterId: 'kaya', level: 4 }],
    startNode: 'village_explore',
  });
  state = apply(CONTENT, state, { type: 'enterNode', nodeId: 'village_explore' }).state;
  const unit = state.party[0];
  const character = CONTENT.characters.get('kaya');
  if (!unit || !character) throw new Error('Discipline layout checkpoint has no Kaya');
  const gain = awardXp(CONTENT, { ...unit, xp: xpForLevel(unit.level) }, 250, character);
  const outcome = levelUpOutcome(unit.id, gain);
  if (gain.unit.level !== 5 || outcome.pendingChoices[0]?.kind !== 'discipline')
    throw new Error('The level-5 discipline boundary changed');
  return { ...state, party: [gain.unit], pendingChoices: outcome.pendingChoices };
}

for (const viewport of [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'iPad landscape', width: 1194, height: 834 },
]) {
  for (const largeText of ['off', 'on'] as const) {
    test(`all screens meet --tap: ${viewport.name}, ${largeText === 'on' ? 'Large' : 'Normal'} text`, async ({
      browserName,
      isMobile,
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await observeTargets(page);
      await resetStorage(page, '?renderer=canvas&titleArt=a&titleArtHold=0');
      await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true, volume: 0 }));
      await setLargeText(page, largeText);
      await audit(page, 'title', ['.title-actions button']);

      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await auditDialog(page, 'Settings', ['[role="radio"]', '[role="switch"]']);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Load a save', exact: true }).click();
      await auditDialog(page, 'Load game', ['.slot-actions button:disabled']);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await setup(page);

      // Public helpers skip campaign traversal; every measured action uses its rendered UI.
      await startGame(page, ['Census'], ['kaya'], 'tap-targets-screens');
      await enterNode(page, 'village_explore');
      await waitForIdle(page);
      await audit(page, 'exploration', [
        '.explore-dock .action-button',
        '.map-canvas',
        '.roster-row',
      ]);
      await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
      await auditDialog(page, 'Travel journal', ['.dialog button']);
      await page.getByRole('button', { name: 'Close journal', exact: true }).click();
      await page.getByRole('button', { name: 'Look around', exact: true }).click();
      await auditDialog(page, 'Look around', ['.dialog button']);
      await page.getByRole('button', { name: 'Back to the path', exact: true }).click();
      await page.getByRole('button', { name: 'Map', exact: true }).click();
      await auditDialog(page, 'Local map', ['.local-map + p + [role="navigation"] button']);
      await page.getByRole('button', { name: 'Close map', exact: true }).click();
      await page.locator('.roster-row').first().click();
      await auditDialog(page, 'Kaya (Census)', ['.dialog-close']);
      await page.getByRole('button', { name: 'Close', exact: true }).click();

      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await auditDialog(page, 'Paused', ['.dialog button']);
      for (const [name, close] of [
        ['How the elements react', 'Close'],
        ['Credits', 'Done'],
      ] as const) {
        await page.getByRole('button', { name, exact: true }).click();
        await auditDialog(page, name, [`[role="dialog"][aria-label="${name}"] button`]);
        await page
          .getByRole('dialog', { name, exact: true })
          .getByRole('button', { name: close, exact: true })
          .click();
      }
      await page.getByRole('button', { name: 'Save game', exact: true }).click();
      await auditDialog(page, 'Save game', ['.slot-actions button']);
      await page.getByRole('button', { name: 'Save here', exact: true }).first().click();
      await expect(page.getByRole('button', { name: 'Erase', exact: true })).toHaveCount(1);
      await auditDialog(page, 'Save game', ['.slot-full .slot-actions button']);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Load game', exact: true }).click();
      await auditDialog(page, 'Load game', ['.slot-full .slot-actions button']);
      await page
        .getByRole('dialog', { name: 'Load game', exact: true })
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      // Revisit the title through its public scene entry to include Continue.
      await page.evaluate(() => window.fnt!.app.start());
      await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
      await audit(page, 'title-with-save', ['.title-actions .btn-primary']);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();

      await enterNode(page, 'mira_intro');
      await audit(page, 'dialogue', ['.conversation-panel', '[data-conversation-control="next"]']);
      await enterNode(page, 'gate_parley');
      await expect(page.locator('.choice-option:disabled')).toHaveCount(1);
      await audit(page, 'dialogue-locked-choice', [
        '.choice-option:disabled',
        '.choice-option:not(:disabled)',
      ]);

      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page, { settleCamera: false })).toBe(true);
      await waitForIdle(page);
      // A new game's Forest Road is the guided first fight. On tablet docks at
      // Large text the coach takes the acting card's place while it speaks
      // (#695), hiding the status chips: census the coach, then skip it.
      await audit(page, 'combat-guidance', ['.combat-guidance button']);
      await page.getByRole('button', { name: 'Skip guidance', exact: true }).click();
      await expect(page.locator('.combat-guidance')).toHaveCount(0);
      // Layout fixture: guarantee a real clickable tip() status chip is present.
      await page.evaluate(() => {
        const app = window.fnt!.app;
        const state = app.state;
        const battle = state?.battle;
        if (!state || !battle) throw new Error('Combat layout checkpoint is missing');
        const id = battle.order[battle.turnIndex];
        app.state = {
          ...state,
          battle: {
            ...battle,
            units: battle.units.map((unit) =>
              unit.id === id
                ? {
                    ...unit,
                    statuses: [
                      ...unit.statuses,
                      { id: 'guarded', duration: 2, stacks: 1 },
                      { id: 'wet', duration: 2, stacks: 1 },
                    ],
                  }
                : unit,
            ),
          },
        };
        app.resync();
      });
      await settleLayout(page);
      await expect(page.locator('.chip-status').filter({ hasText: /^Wet$/ })).toHaveCount(1);
      await audit(page, 'combat-actions', [
        '.action-row button',
        '.turn-chip',
        '.chip-status',
        '.map-canvas',
      ]);
      await statusTooltip(page);
      if (viewport.width === 390 && largeText === 'on') {
        await reachableCombatActions(page, browserName === 'webkit' && isMobile);
      }
      // Only the phone has the disclosure; viewport choice is explicit, not a skipped census.
      if (viewport.width === 390) {
        await page.getByRole('button', { name: 'More', exact: true }).click();
        await audit(page, 'combat-more', ['#combat-more button[data-key="tip"]']);
        await page.keyboard.press('Escape');
      }
      await page.getByRole('button', { name: /^Shove/ }).click();
      await expect(page.locator('.ability-header')).toContainText('Shove');
      await audit(page, 'combat-selected-ability', ['.action-row button.selected']);
      await page.getByRole('button', { name: /^Shove/ }).click();
      const hero = await page.evaluate(() =>
        window.fnt!.app.state!.battle!.units.find((unit) => unit.faction === 'party'),
      );
      if (!hero) throw new Error('Combat inspector fixture has no party unit');
      await page
        .getByRole('button', { name: `Focus ${hero.name}`, exact: true })
        .first()
        .click();
      await settleLayout(page);
      const point = await paintedTileCentre(page, hero.pos);
      if (!point) throw new Error('Combat inspector target has no painted foot');
      await page.mouse.click(point.x, point.y);
      await auditDialog(page, 'Kaya (Census)', ['.dialog-close']);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: /^End turn/ }).click();
      await expect(page.locator('.toast').filter({ hasText: 'Tap End turn again' })).toBeVisible();
      await audit(page, 'combat-end-turn-confirmation', ['.end-turn']);

      // Result-card layout fixture, shared with victory-beat.spec: no victory claim.
      await page.evaluate(() => {
        const app = window.fnt!.app;
        const state = app.state!;
        const battle = state.battle!;
        const id = battle.order[battle.turnIndex];
        if (!id) throw new Error('Victory layout checkpoint has no active unit');
        app.state = {
          ...state,
          battle: {
            ...battle,
            units: battle.units.map((unit) =>
              unit.faction === 'enemy' ? { ...unit, hp: 0 } : unit,
            ),
          },
        };
        app.resync();
        app.dispatch({ type: 'endTurn', unitId: id });
      });
      await audit(page, 'victory-result', ['.result-panel button']);

      const reward = earnedRewardFixture();
      await page.evaluate(
        ({ state, session }) => window.fnt!.app.adoptSave(state, session),
        reward,
      );
      await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toContainText(
        'reached level 3',
      );
      await settleDialog(page.getByRole('dialog'));
      await audit(page, 'earned-level-up', ['.choice-cards button']);
      await page
        .getByRole('button', { name: /^Learn / })
        .first()
        .click();
      await expect
        .poll(() => page.evaluate(() => window.fnt!.app.state!.pendingChoices.length))
        .toBe(2);

      await page.evaluate(
        (state) => window.fnt!.app.adoptSave(state, undefined),
        disciplineCheckpoint(),
      );
      await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toContainText(
        'chooses a path',
      );
      await expect(page.locator('.discipline-card.is-locked button:disabled')).not.toHaveCount(0);
      await settleDialog(page.getByRole('dialog'));
      await audit(page, 'discipline-pick', [
        '.discipline-card button:not(:disabled)',
        '.discipline-card button:disabled',
      ]);
      await page
        .getByRole('button', { name: /^Take up / })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await enterNode(page, 'act1_epilogue');
      await audit(page, 'ending-interlude', ['.interlude-scene button']);
      await enterNode(page, 'demo_complete');
      await expect(page.locator('.end-panel')).toContainText('Home to Ba Dan');
      await audit(page, 'ending-summary', ['.end-panel button']);
    });
  }
}
