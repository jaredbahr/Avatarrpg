import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Plays the game through the action layer (ADR 0112) with one device only.
 *
 * A `Driver` is a keyboard or a synthetic gamepad: the route below never
 * clicks, taps, or edits state. It reads `window.fnt.app` to decide what to do
 * next and to assert, as a person reads the screen, and everything it does is
 * a key or a pad button. Both specs run the same route, so a screen that works
 * for one device and not the other fails here.
 */

export type Way = 'up' | 'down' | 'left' | 'right';
export type Press = Way | 'confirm' | 'cancel' | 'endTurn' | 'map' | 'menu' | 'next';

export interface Driver {
  readonly name: 'keyboard' | 'gamepad';
  press(action: Press): Promise<void>;
  hold(way: Way, down: boolean): Promise<void>;
}

const KEYS: Readonly<Record<Press, string>> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  confirm: 'Enter',
  cancel: 'Escape',
  endTurn: 'KeyT',
  map: 'KeyM',
  menu: 'KeyP',
  next: 'KeyE',
};

export function keyboardDriver(page: Page): Driver {
  return {
    name: 'keyboard',
    press: (action) => page.keyboard.press(KEYS[action]),
    hold: (way, down) => (down ? page.keyboard.down(KEYS[way]) : page.keyboard.up(KEYS[way])),
  };
}

/** Standard-mapping button indices (W3C Gamepad), by position. */
const BUTTONS: Readonly<Record<Press, number>> = {
  confirm: 0,
  cancel: 1,
  endTurn: 3,
  next: 5,
  map: 8,
  menu: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

declare global {
  interface Window {
    fntPad?: {
      id: string;
      index: number;
      connected: boolean;
      mapping: string;
      timestamp: number;
      axes: number[];
      buttons: { pressed: boolean; touched: boolean; value: number }[];
    };
  }
}

/**
 * Installs one synthetic pad before the game boots. The game polls
 * `navigator.getGamepads()` every frame, so setting a button on this object is
 * a button press as far as the page can tell. Call before the first `goto`.
 */
export async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pad = {
      id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    window.fntPad = pad;
    navigator.getGamepads = () => [pad as unknown as Gamepad, null, null, null];
  });
}

export function gamepadDriver(page: Page): Driver {
  // Two frames, so the poll sees the button in one state before it changes again.
  const set = (index: number, down: boolean) =>
    page.evaluate(
      ([button, pressed]) =>
        new Promise<void>((resolve) => {
          const target = window.fntPad?.buttons[button as number];
          if (!target) throw new Error('No synthetic gamepad is installed');
          target.pressed = pressed as boolean;
          target.value = pressed ? 1 : 0;
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
      [index, down] as const,
    );
  return {
    name: 'gamepad',
    press: async (action) => {
      await set(BUTTONS[action], true);
      await set(BUTTONS[action], false);
    },
    hold: (way, down) => set(BUTTONS[way], down),
  };
}

/** Focus is on a real, visible control and never on the page behind the game. */
export async function expectFocusHeld(page: Page): Promise<void> {
  const focus = await page.evaluate(() => {
    const active = document.activeElement;
    return {
      lost: !active || active === document.body,
      shown: active instanceof HTMLElement && active.getClientRects().length > 0,
      ring:
        active instanceof HTMLElement &&
        getComputedStyle(active).outlineStyle !== 'none' &&
        Number.parseFloat(getComputedStyle(active).outlineWidth) > 0,
    };
  });
  expect(focus, 'focus must stay on a visible control with a focus ring').toEqual({
    lost: false,
    shown: true,
    ring: true,
  });
}

/**
 * Moves focus to a control with directions alone, by where it lies on screen,
 * the way a person works down a form: up or down to its row, then along the
 * row. Fails if the control cannot be reached.
 */
export async function steerTo(page: Page, driver: Driver, target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  let stuck = false;
  for (let step = 0; step < 40; step++) {
    // Asked afresh each step: a sheet that rebuilds itself replaces its controls.
    const seen: { way: Way | 'there'; at: string } = await target.evaluate((element, sideways) => {
      const active = document.activeElement;
      const at = active instanceof HTMLElement ? active.outerHTML.slice(0, 120) : '';
      if (active === element) return { way: 'there', at };
      if (!(active instanceof HTMLElement) || active === document.body) return { way: 'down', at };
      const to = element.getBoundingClientRect();
      const from = active.getBoundingClientRect();
      const dx = (to.left + to.right - from.left - from.right) / 2;
      const dy = (to.top + to.bottom - from.top - from.bottom) / 2;
      const sameRow = to.bottom > from.top && to.top < from.bottom;
      // A press that moved nothing means that way is closed: try the other axis once.
      const vertical = sameRow === sideways;
      return { way: vertical ? (dy > 0 ? 'down' : 'up') : dx > 0 ? 'right' : 'left', at };
    }, stuck);
    if (seen.way === 'there') return;
    await driver.press(seen.way);
    const now = await page.evaluate(() =>
      document.activeElement instanceof HTMLElement
        ? document.activeElement.outerHTML.slice(0, 120)
        : '',
    );
    stuck = now === seen.at ? !stuck : false;
  }
  throw new Error(`steerTo: directions never reached "${await target.textContent()}"`);
}

interface Glance {
  screen: string;
  node: string | null;
  mapId: string | null;
  busy: boolean;
  dialog: boolean;
  battle: null | {
    phase: string;
    opening: boolean;
    victoryBeat: boolean;
    turn: 'party' | 'other';
    unitId: string | null;
    unit: { x: number; y: number; ap: number; move: number } | null;
    enemies: { x: number; y: number }[];
  };
}

/** What a player would see at a glance; read-only. */
export async function glance(page: Page): Promise<Glance> {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state ?? null;
    const battle = state?.battle ?? null;
    const unit = battle?.units.find((u) => u.id === battle.order[battle.turnIndex]) ?? null;
    const scene = document.querySelector<HTMLElement>('.combat-scene');
    return {
      screen: state?.screen ?? 'none',
      node: state?.story.nodeId ?? null,
      mapId: state?.location.mapId ?? null,
      busy: app?.boardBusy() !== false,
      dialog: document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
      battle: battle
        ? {
            phase: battle.phase,
            opening: scene?.dataset.battleOpening !== undefined,
            victoryBeat: scene?.dataset.victoryBeat !== undefined,
            turn: unit?.faction === 'party' ? 'party' : 'other',
            unitId: unit?.id ?? null,
            unit: unit ? { x: unit.pos.x, y: unit.pos.y, ap: unit.ap, move: unit.move } : null,
            enemies: battle.units
              .filter((u) => u.faction === 'enemy' && u.hp > 0)
              .map((u) => ({ x: u.pos.x, y: u.pos.y })),
          }
        : null,
    };
  });
}

async function until(
  page: Page,
  what: string,
  done: (seen: Glance) => boolean,
  nudge?: (seen: Glance) => Promise<void>,
  timeout = 45_000,
): Promise<Glance> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const seen = await glance(page);
    if (done(seen)) return seen;
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting until ${what}: ${JSON.stringify(seen)}`);
    if (nudge) await nudge(seen);
    await page.waitForTimeout(120);
  }
}

/** Confirm through every line of the conversation or interlude on screen. */
async function talkThrough(page: Page, driver: Driver, leaves: (seen: Glance) => boolean) {
  await until(page, 'the conversation ends', leaves, async (seen) => {
    const next = page.locator(
      '[data-conversation-control="next"], [data-interlude-control="next"]',
    );
    if (seen.busy || (await next.count()) === 0) return;
    await driver.press('confirm');
  });
}

/**
 * Title to the Forest Road roadblock: settings, party setup, the prologue,
 * Ba Dan, the local map, a conversation, travel, and a walk by direction onto
 * the encounter's trigger tiles (#753).
 */
export async function playToFirstFight(page: Page, driver: Driver): Promise<void> {
  const button = (name: string | RegExp) =>
    page.getByRole('button', { name, exact: typeof name === 'string' });

  // Title: the first press only shows where focus is; nothing is chosen by it.
  await driver.press('confirm');
  await expect(button('New game')).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-input', driver.name);
  await expectFocusHeld(page);

  // Settings, with directions and confirm alone: Reduce motion on, then back.
  await steerTo(page, driver, button('Settings'));
  await driver.press('confirm');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  const reduce = settings.getByRole('switch', { name: 'Reduce motion' });
  await driver.press('down');
  await steerTo(page, driver, reduce);
  await driver.press('confirm');
  await expect(settings.getByRole('switch', { name: 'Reduce motion' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(await page.evaluate(() => window.fnt?.app.settings.reduceMotion)).toBe(true);
  await driver.press('cancel');
  await expect(settings).toHaveCount(0);
  await expect(button('Settings')).toBeFocused();

  // Party setup: the one-step suggested party.
  await steerTo(page, driver, button('New game'));
  await driver.press('confirm');
  await steerTo(
    page,
    driver,
    page.locator('button', { hasText: 'Start with the suggested party' }),
  );
  await expectFocusHeld(page);
  await driver.press('confirm');
  await until(page, 'the prologue opens', (seen) => seen.node === 'prologue_storm');
  expect(
    await page.evaluate(() => window.fnt?.app.state?.party.map((hero) => hero.characterId)),
  ).toEqual(['kaya', 'sura', 'bo']);

  // The prologue and Ba Dan's opening: one button all the way.
  await talkThrough(page, driver, (seen) => seen.screen === 'explore');
  await until(page, 'the village is still', (seen) => !seen.busy);
  await expectFocusHeld(page);

  // Walk by direction: one press is one tile.
  const start = await page.evaluate(() => window.fnt?.app.state?.location.pos);
  await driver.press('right');
  await until(page, 'the step lands', (seen) => !seen.busy);
  const stepped = await page.evaluate(() => window.fnt?.app.state?.location.pos);
  expect(stepped).toEqual({ x: (start?.x ?? 0) + 1, y: start?.y });
  await expect(page.locator('canvas.map-canvas')).toBeFocused();
  await expectFocusHeld(page);

  // The local map by its own button, a destination, and Mira's conversation.
  await driver.press('map');
  const localMap = page.getByRole('dialog', { name: 'Local map', exact: true });
  await expect(localMap).toBeVisible();
  await steerTo(page, driver, localMap.getByRole('button', { name: 'Walk to Elder Mira' }));
  await driver.press('confirm');
  await until(page, 'Mira speaks', (seen) => seen.node === 'mira_intro');
  await talkThrough(page, driver, (seen) => seen.node === 'village_explore');
  await until(page, 'the village is still', (seen) => !seen.busy);

  // Pause and back, without touching the menu's contents.
  await driver.press('menu');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await driver.press('cancel');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toHaveCount(0);

  // Travel to the Forest Road.
  await driver.press('map');
  await steerTo(page, driver, localMap.getByRole('button', { name: 'East road → Forest Road' }));
  await driver.press('confirm');
  await until(page, 'the party is on the Forest Road', (seen) => seen.mapId === 'forest_road');
  await until(page, 'the road is still', (seen) => seen.screen === 'explore' && !seen.busy);

  // East along the road with the direction held: across the trigger tiles no
  // button reaches (#753), through the roadside scene, into the roadblock.
  await driver.hold('right', true);
  await until(
    page,
    'the roadblock fight starts',
    (seen) => seen.screen === 'combat' && seen.battle !== null,
    async (seen) => {
      if (seen.screen !== 'dialogue' || seen.busy) return;
      await driver.hold('right', false);
      await talkThrough(page, driver, (now) => now.screen !== 'dialogue');
      await driver.hold('right', true);
    },
    90_000,
  );
  await driver.hold('right', false);
  expect((await glance(page)).node).toBe('battle_forest_road');
}

/** The acting hero's action buttons, read off the bar as a player reads them. */
async function actionBar(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLButtonElement>('.combat-scene .hud .action-row > button'),
    ].map((node) => ({ slot: node.dataset.slot ?? '', enabled: !node.disabled })),
  );
}

/**
 * Fights the battle on screen to its result card and past it. A plain player:
 * attack whatever an ability can reach, otherwise walk toward the nearest
 * enemy, otherwise end the turn. Every choice is made on the bar and the board
 * with directions, confirm and cancel.
 */
export async function fightToTheEnd(page: Page, driver: Driver): Promise<'victory' | 'defeat'> {
  const slotButton = (slot: string) =>
    page.locator(`.combat-scene .hud .action-row > button[data-slot="${slot}"]`);
  const ready = (seen: Glance) =>
    seen.battle === null ||
    seen.battle.phase !== 'active' ||
    (seen.battle.turn === 'party' && !seen.battle.opening && !seen.busy && !seen.dialog);
  // While others act, confirm skips ahead: the same thing a tap on the board does.
  const wait = () =>
    until(
      page,
      'a hero can act',
      ready,
      async (seen) => {
        if (seen.busy) await driver.press('confirm');
      },
      120_000,
    );
  const chosen = page.locator('.combat-scene .hud .action-button.selected');

  let committed = 0;
  for (let action = 0; action < 400; action++) {
    const seen = await wait();
    const battle = seen.battle;
    if (!battle || battle.phase !== 'active') break;
    // A skip pressed as the turn arrived may have picked an action: back out to the bar.
    for (let back = 0; back < 3 && (await chosen.count()) > 0; back++) await driver.press('cancel');
    await expect(chosen).toHaveCount(0);
    await expectFocusHeld(page);
    const unit = battle.unit;
    if (!unit) throw new Error('No acting unit on a party turn');

    let acted = false;
    for (const entry of await actionBar(page)) {
      if (!entry.slot.startsWith('ability:') || !entry.enabled) continue;
      await steerTo(page, driver, slotButton(entry.slot));
      await driver.press('confirm');
      // Aiming puts focus on the board and the cursor on the nearest enemy in reach.
      await expect(page.locator('.combat-scene canvas.map-canvas')).toBeFocused();
      const hostile = page.locator('.confirm-dialog .chip-hostile');
      const confirm = page.locator('.confirm-dialog .btn-ok:not(:disabled)');
      if ((await hostile.count()) > 0 && (await confirm.count()) > 0) {
        const before = await page.evaluate(() => window.fnt?.app.state?.log.length ?? 0);
        await driver.press('confirm');
        await expect
          .poll(() => page.evaluate(() => window.fnt?.app.state?.log.length ?? 0))
          .toBeGreaterThan(before);
        committed += 1;
        acted = true;
        break;
      }
      await driver.press('cancel');
      await expect(slotButton(entry.slot)).toBeFocused();
    }
    if (acted) continue;

    const move = (await actionBar(page)).find((entry) => entry.slot === 'move');
    const nearest = [...battle.enemies].sort(
      (a, b) =>
        Math.abs(a.x - unit.x) +
        Math.abs(a.y - unit.y) -
        Math.abs(b.x - unit.x) -
        Math.abs(b.y - unit.y),
    )[0];
    if (move?.enabled && nearest && unit.move > 0) {
      await steerTo(page, driver, slotButton('move'));
      await driver.press('confirm');
      await expect(page.locator('.combat-scene canvas.map-canvas')).toBeFocused();
      const dx = nearest.x - unit.x;
      const dy = nearest.y - unit.y;
      const first: Way =
        Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      const second: Way =
        Math.abs(dx) >= Math.abs(dy) ? (dy > 0 ? 'down' : 'up') : dx > 0 ? 'right' : 'left';
      for (let step = 0; step < unit.move; step++) await driver.press(first);
      const confirm = page.locator('.confirm-dialog .btn-ok:not(:disabled)');
      if ((await confirm.count()) === 0)
        for (let step = 0; step < 2; step++) await driver.press(second);
      if ((await confirm.count()) > 0) {
        await driver.press('confirm');
        await expect
          .poll(() =>
            page.evaluate(() => {
              const b = window.fnt?.app.state?.battle;
              const u = b?.units.find((candidate) => candidate.id === b.order[b.turnIndex]);
              return u ? `${u.pos.x},${u.pos.y}` : '';
            }),
          )
          .not.toBe(`${unit.x},${unit.y}`);
        committed += 1;
        continue;
      }
      await driver.press('cancel');
    }

    // Nothing left to do: end the turn. Spare AP asks for a second press.
    await driver.press('endTurn');
    await page.waitForTimeout(150);
    const after = await glance(page);
    if (after.battle?.phase === 'active' && after.battle.unitId === battle.unitId && !after.busy)
      await driver.press('endTurn');
    await until(
      page,
      'the turn passes',
      (now) => now.battle?.unitId !== battle.unitId || now.battle?.phase !== 'active',
    );
  }

  const ended = await glance(page);
  const outcome = ended.battle?.phase === 'victory' ? 'victory' : 'defeat';
  expect(ended.battle?.phase, 'the fight reached a result').not.toBe('active');
  expect(committed, 'the fight was fought, not skipped').toBeGreaterThan(0);

  // Past the result card: Continue on a win is the way on; a loss offers a choice.
  const carryOn = page.getByRole('button', {
    name: outcome === 'victory' ? 'Continue' : 'Carry on',
    exact: true,
  });
  // The last blow may still be playing, and a win holds on the party first: confirm skips both.
  for (let press = 0; press < 200; press++) {
    if ((await glance(page)).battle === null || (await carryOn.isVisible())) break;
    await driver.press('confirm');
    await page.waitForTimeout(150);
  }
  if ((await glance(page)).battle !== null) {
    await steerTo(page, driver, carryOn);
    await expectFocusHeld(page);
    await driver.press('confirm');
  }
  await until(page, 'the fight is over', (seen) => seen.battle === null);
  return outcome;
}
