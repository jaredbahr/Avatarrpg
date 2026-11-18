/**
 * Drives one whole session for the long-session soak (#525): a new game from the title, every
 * map of the demo route, every fight (with a loss and a retry on the first), the walk home, the
 * ending card, back to the title, a saved fight loaded and quit, and the riverside preview.
 *
 * Story, dialogs, results and the title go through the page's own controls, because the DOM they
 * mount and the listeners they add are what is being measured. Walking is dispatched as the
 * `walkTo` command a tap produces, and a fight is shortened by ending it in the state (the same
 * adapter `scripts/saves/make-golden.ts` uses) after a few real turns have played.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import { distance } from '../../src/core/rules/grid';
import { evaluate } from '../../src/core/story/conditions';
import { exitCells } from '../../src/core/story/world';
import type { GameState, Vec2 } from '../../src/core/types';

export interface RouteOptions {
  /** Reduce motion for the whole cycle; off plays every walk, cast and beat in real time. */
  readonly reduceMotion: boolean;
  /** Real turns played in each fight before it is ended in the state. */
  readonly turnsPerFight: number;
  /**
   * Pointer positions in one sweep of the board (28 when left out). Each is a frame redrawn, which
   * a software WebGL rasteriser takes seconds over.
   */
  readonly sweepSteps?: number;
  /** Says what the driver is doing, for a run that has to be diagnosed. */
  readonly log?: (line: string) => void;
  /**
   * Called once a cycle in the middle of the game: on the quarry floor after the last fight, with
   * every map visited and nothing yet released by a quit, which is where a cache that only
   * empties at the title would show its growth.
   */
  readonly midGame?: () => Promise<void>;
}

interface Peek {
  readonly scene: string;
  readonly screen: GameState['screen'] | 'none';
  readonly node: string | null;
  readonly mapId: string | null;
  readonly pos: Vec2 | null;
  readonly phase: string | null;
  readonly encounterId: string | null;
  readonly activeId: string | null;
  readonly activeFaction: string | null;
  readonly round: number | null;
  readonly busy: boolean;
  readonly dialog: boolean;
  readonly result: boolean;
  readonly handoff: boolean;
  readonly endCard: boolean;
  readonly storyControl: boolean;
  readonly preview: boolean;
}

async function peek(page: Page): Promise<Peek> {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state ?? null;
    const battle = state?.battle ?? null;
    const activeId = battle ? (battle.order[battle.turnIndex] ?? null) : null;
    const active = battle?.units.find((unit) => unit.id === activeId) ?? null;
    const q = (selector: string): boolean => document.querySelector(selector) !== null;
    return {
      scene: document.getElementById('app')?.dataset.scene ?? 'none',
      screen: state?.screen ?? 'none',
      node: state?.story.nodeId ?? null,
      mapId: state?.location.mapId ?? null,
      pos: state?.location.pos ?? null,
      phase: battle?.phase ?? null,
      encounterId: battle?.encounterId ?? null,
      activeId,
      activeFaction: active?.faction ?? null,
      round: battle?.round ?? null,
      busy: Boolean(app?.boardBusy()) || Boolean(app?.curtainBusy),
      dialog: q('.overlay [role="dialog"]'),
      result: q('.result-panel'),
      handoff: q('.handoff-banner:not(.result-banner)'),
      endCard: q('.end-panel'),
      storyControl: q(
        '[data-conversation-control="next"], [data-interlude-control="next"], .choice-option:not(:disabled), .dialogue-panel button.btn-primary',
      ),
      preview: Boolean(app?.previewActive),
    } satisfies Peek;
  });
}

/** Clicks one control by selector from inside the page, so a re-render between frames cannot race it. */
async function click(
  page: Page,
  selector: string,
  text?: string,
  match: 'exact' | 'prefix' = 'exact',
): Promise<boolean> {
  return page.evaluate(
    ({ selector, text, match }) => {
      const nodes = [...document.querySelectorAll<HTMLElement>(selector)];
      const node = nodes.find((candidate) => {
        if ((candidate as HTMLButtonElement).disabled) return false;
        if (text === undefined) return true;
        const label = candidate.textContent?.trim() ?? '';
        return match === 'prefix' ? label.startsWith(text) : label === text;
      });
      if (!node) return false;
      node.click();
      return true;
    },
    { selector, text, match },
  );
}

const pause = (page: Page, ms: number): Promise<void> => page.waitForTimeout(ms);

async function settle(page: Page, timeout = 60_000): Promise<Peek> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const now = await peek(page);
    if (!now.busy) return now;
    if (Date.now() > deadline) throw new Error(`The board stayed busy for ${timeout} ms`);
    await pause(page, 40);
  }
}

async function state(page: Page): Promise<GameState> {
  const value = await page.evaluate(() => window.fnt?.app.state ?? null);
  if (!value) throw new Error('No game is running');
  return value;
}

/** Answers whatever modal is up: a level-up or discipline pick takes its first open choice. */
async function answerDialog(page: Page): Promise<void> {
  const picked =
    (await click(page, '.overlay [role="dialog"] .choice-cards .btn-primary')) ||
    (await click(page, '.overlay [role="dialog"] .btn-primary')) ||
    (await click(page, '.overlay [role="dialog"] .dialog-close'));
  if (!picked) await page.keyboard.press('Escape');
  await pause(page, 30);
}

/** One step of story: the next line, the first open choice, or the ending's way on. */
async function advanceStory(page: Page): Promise<boolean> {
  return (
    (await click(page, '.end-panel button', 'Keep exploring')) ||
    (await click(page, '[data-conversation-control="next"]')) ||
    (await click(page, '[data-interlude-control="next"]')) ||
    (await click(page, '.choice-option:not(.is-locked)')) ||
    (await click(page, '.dialogue-panel button.btn-primary'))
  );
}

async function forceOutcome(page: Page, outcome: 'victory' | 'defeat'): Promise<void> {
  await page.evaluate((outcome) => {
    const app = window.fnt?.app;
    const game = app?.state;
    const battle = game?.battle;
    if (!app || !game || !battle) throw new Error('No fight to end');
    const loser = outcome === 'victory' ? 'enemy' : 'party';
    app.state = {
      ...game,
      battle: {
        ...battle,
        phase: outcome,
        units: battle.units.map((unit) => (unit.faction === loser ? { ...unit, hp: 0 } : unit)),
      },
    };
    app.resync();
  }, outcome);
}

/** Lets the rules' own AI play the party's turns, as the balance simulator does. */
async function autopilotParty(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt?.app;
    const game = app?.state;
    const battle = game?.battle;
    if (!app || !game || !battle) return;
    app.state = {
      ...game,
      battle: {
        ...battle,
        units: battle.units.map((unit) =>
          unit.faction === 'party' && unit.ai === 'none'
            ? { ...unit, ai: unit.element === 'water' ? 'support' : 'aggressive' }
            : unit,
        ),
      },
    };
  });
}

/**
 * Moves a pointer across the map, as a hand hovering over the board does: each tile it crosses
 * changes the hover highlight, and with an action picked, the range and path overlays with it.
 */
async function sweepPointer(page: Page, steps = 28): Promise<void> {
  const box = await page.locator('.map-canvas').first().boundingBox();
  if (!box) return;
  for (let step = 0; step <= steps; step++) {
    const across = 0.12 + (0.76 * step) / steps;
    const down = 0.3 + 0.4 * ((step % 7) / 6);
    await page.mouse.move(box.x + box.width * across, box.y + box.height * down);
  }
  await page.mouse.move(box.x + 2, box.y + 2);
}

/** Opens and closes the panels a table opens all evening. */
async function visitPanels(page: Page): Promise<void> {
  if (await click(page, 'button', 'Pause')) {
    await pause(page, 30);
    if (await click(page, '.overlay [role="dialog"] button', 'Settings')) {
      await pause(page, 30);
      await page.keyboard.press('Escape');
    }
    if (await click(page, '.overlay [role="dialog"] button', 'How the elements react')) {
      await pause(page, 30);
      await page.keyboard.press('Escape');
    }
    await pause(page, 30);
    await click(page, '.overlay [role="dialog"] button', 'Resume');
    await pause(page, 30);
  }
  for (const name of ['Map', 'Journal', 'Party']) {
    if (await click(page, 'button', name)) {
      await pause(page, 30);
      if ((await peek(page)).dialog) await page.keyboard.press('Escape');
      await pause(page, 30);
    }
  }
  // Anything a panel left open is closed before the route goes on.
  for (let guard = 0; guard < 4 && (await peek(page)).dialog; guard++) {
    await page.keyboard.press('Escape');
    await pause(page, 30);
  }
}

async function saveToSlotOne(page: Page): Promise<void> {
  const saved = await page.evaluate(() => window.fnt?.app.saveTo('slot1', 'Soak') ?? false);
  if (!saved) throw new Error('The soak save was refused');
}

/**
 * Plays one fight: a few real turns, then (once per cycle) a loss and "Try again", then a win
 * and "Continue". Returns when the fight's result has been taken.
 */
async function fight(page: Page, options: RouteOptions, lose: boolean): Promise<void> {
  const log = options.log ?? (() => {});
  const turns = async (): Promise<void> => {
    await autopilotParty(page);
    let played = 0;
    const deadline = Date.now() + 120_000;
    while (played < options.turnsPerFight && Date.now() < deadline) {
      const now = await settle(page);
      if (now.screen !== 'combat' || now.phase !== 'active') return;
      if (now.dialog) await answerDialog(page);
      else if (now.handoff) await click(page, '.handoff-banner button');
      else if (now.activeFaction === 'party') {
        // Pick Move and hover the board before acting, so the overlays are drawn and redrawn.
        if (await click(page, 'button.action-button', 'Move', 'prefix')) {
          await sweepPointer(page, options.sweepSteps);
          await page.keyboard.press('Escape');
          await settle(page);
        }
        await page.evaluate(() => window.fnt?.app.dispatch({ type: 'runAiTurn' }));
        played += 1;
      }
      await pause(page, 40);
    }
  };

  const takeResult = async (label: string): Promise<void> => {
    const deadline = Date.now() + 60_000;
    for (;;) {
      const now = await peek(page);
      if (now.dialog) await answerDialog(page);
      else if (await click(page, '.result-panel button', label)) return;
      else await click(page, 'button', 'Show result');
      if (Date.now() > deadline) throw new Error(`No "${label}" on the result panel`);
      await pause(page, 40);
    }
  };

  const encounter = (await peek(page)).encounterId;
  log(`fight ${encounter}`);
  await turns();
  if (lose) {
    await visitPanels(page);
    await saveToSlotOne(page);
    if ((await peek(page)).phase === 'active') await forceOutcome(page, 'defeat');
    if ((await peek(page)).phase === 'defeat') {
      await takeResult('Try again');
      await page.waitForFunction(() => window.fnt?.app.state?.battle?.phase === 'active');
      await turns();
    }
  }
  if ((await peek(page)).phase === 'active') await forceOutcome(page, 'victory');
  if ((await peek(page)).phase === 'victory') await takeResult('Continue');
  else if ((await peek(page)).phase === 'defeat') await takeResult('Carry on');
  await page.waitForFunction(() => window.fnt?.app.state?.screen !== 'combat');
}

type Goal =
  | { readonly kind: 'explore' }
  | { readonly kind: 'travel'; readonly to: string }
  | { readonly kind: 'reach'; readonly node: string; readonly toward: Vec2 }
  | { readonly kind: 'cleared'; readonly encounter: string }
  | { readonly kind: 'end' };

/** The demo route, as `scripts/saves/make-golden.ts` walks it. */
const ROUTE: readonly Goal[] = [
  { kind: 'explore' },
  { kind: 'travel', to: 'forest_road' },
  { kind: 'reach', node: 'battle_forest_road', toward: { x: 19, y: 4 } },
  { kind: 'cleared', encounter: 'enc_forest_road' },
  { kind: 'travel', to: 'quarry_gate' },
  { kind: 'reach', node: 'gate_parley', toward: { x: 19, y: 5 } },
  { kind: 'cleared', encounter: 'enc_quarry_gate' },
  { kind: 'travel', to: 'ambush_road' },
  { kind: 'reach', node: 'battle_ambush', toward: { x: 19, y: 4 } },
  { kind: 'cleared', encounter: 'enc_ambush' },
  { kind: 'travel', to: 'quarry_floor' },
  { kind: 'reach', node: 'quarry_descent', toward: { x: 17, y: 5 } },
  { kind: 'cleared', encounter: 'enc_grumbler' },
  { kind: 'travel', to: 'ambush_road' },
  { kind: 'travel', to: 'quarry_gate' },
  { kind: 'travel', to: 'forest_road' },
  { kind: 'travel', to: 'ba_dan_village' },
  { kind: 'end' },
];

function reached(goal: Goal, game: GameState, now: Peek, seen: ReadonlySet<string>): boolean {
  switch (goal.kind) {
    case 'explore':
      return game.screen === 'explore';
    case 'travel':
      return game.screen === 'explore' && game.location.mapId === goal.to;
    case 'reach':
      return seen.has(goal.node);
    case 'cleared':
      return game.battle === null && game.world.cleared.includes(goal.encounter);
    case 'end':
      return now.endCard && game.screen === 'ended' && game.flags.act1_complete === true;
  }
}

/** Where a walk toward the goal goes next, or null when the goal is not a walk. */
function walkTarget(goal: Goal, game: GameState): Vec2 | null {
  if (goal.kind === 'reach') return goal.toward;
  if (goal.kind === 'end') {
    // The first step in from the east road starts the welcome home.
    return { x: Math.min(game.location.pos.x - 2, 19), y: 7 };
  }
  if (goal.kind !== 'travel') return null;
  const map = CONTENT.maps.get(game.location.mapId);
  const exit = map?.exits?.find((candidate) => candidate.toMapId === goal.to);
  if (!exit) throw new Error(`${game.location.mapId}: no exit to ${goal.to}`);
  if (!evaluate(game, exit.requires)) throw new Error(`${game.location.mapId}: exit locked`);
  const cell = [...exitCells(exit)].sort(
    (a, b) =>
      distance(game.location.pos, a) - distance(game.location.pos, b) || a.y - b.y || a.x - b.x,
  )[0];
  if (!cell) throw new Error(`${game.location.mapId}: empty exit to ${goal.to}`);
  return cell;
}

/** Plays the route from a running new game to the ending card. */
export async function playRoute(page: Page, options: RouteOptions): Promise<void> {
  const log = options.log ?? (() => {});
  const seen = new Set<string>();
  let lost = false;
  let visited = false;
  let swept = '';
  for (const goal of ROUTE) {
    log(`goal ${JSON.stringify(goal)}`);
    const deadline = Date.now() + 300_000;
    let stuck = 0;
    for (;;) {
      if (Date.now() > deadline) throw new Error(`Goal timed out: ${JSON.stringify(goal)}`);
      const now = await settle(page);
      const game = await state(page);
      if (game.story.nodeId) seen.add(game.story.nodeId);
      if (now.dialog) {
        await answerDialog(page);
        continue;
      }
      if (reached(goal, game, now, seen)) {
        if (
          goal.kind === 'cleared' &&
          goal.encounter === 'enc_grumbler' &&
          game.screen === 'explore'
        )
          await options.midGame?.();
        else if (goal.kind === 'cleared' && goal.encounter === 'enc_grumbler') {
          // The epilogue is still talking: read it through to the quarry floor first.
          if (!(await advanceStory(page))) await pause(page, 60);
          await pause(page, 20);
          continue;
        }
        break;
      }
      if (game.screen === 'combat') {
        await fight(page, options, !lost);
        lost = true;
        continue;
      }
      if (now.storyControl || game.screen === 'dialogue' || game.screen === 'ended') {
        if (!(await advanceStory(page))) await pause(page, 60);
        await pause(page, 20);
        continue;
      }
      if (game.screen === 'explore') {
        if (!visited) {
          visited = true;
          await visitPanels(page);
          continue;
        }
        if (swept !== game.location.mapId) {
          swept = game.location.mapId;
          await sweepPointer(page, options.sweepSteps);
        }
        const target = walkTarget(goal, game);
        if (!target) throw new Error(`Exploring with nothing to walk to: ${JSON.stringify(goal)}`);
        const before = JSON.stringify([game.location, game.story.nodeId, game.screen]);
        await page.evaluate((pos) => window.fnt?.app.dispatch({ type: 'walkTo', pos }), target);
        const after = await state(page);
        if (JSON.stringify([after.location, after.story.nodeId, after.screen]) === before) {
          stuck += 1;
          if (stuck > 5) throw new Error(`Walking makes no progress: ${JSON.stringify(goal)}`);
        } else stuck = 0;
        continue;
      }
      await pause(page, 60);
    }
  }
}

/** A new game from the title, as a family starts one: New game, the suggested party. */
export async function newGameFromTitle(page: Page, options: RouteOptions): Promise<void> {
  await page.evaluate(
    (reduceMotion) => window.fnt?.app.updateSettings({ reduceMotion, storyChoices: 'turns' }),
    options.reduceMotion,
  );
  await page.getByRole('button', { name: /new game/i }).click();
  await page.getByRole('button', { name: 'Start with the suggested party', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.fnt?.app.state));
}

/** From the ending card: back to the title, load the saved fight, play a turn of it, and quit. */
export async function titleLoadAndQuit(page: Page, options: RouteOptions): Promise<void> {
  if (!(await click(page, '.end-panel button', 'Back to the title')))
    throw new Error('No way back to the title on the ending card');
  await page.waitForFunction(() => document.getElementById('app')?.dataset.scene === 'title');

  // The riverside preview: its own map, state swapped in and out under the title.
  await page.evaluate(() => window.fnt?.app.startVillagePreview());
  await page.waitForFunction(() => window.fnt?.app.previewActive === true);
  await settle(page);
  for (let step = 0; step < 6; step++) {
    const now = await settle(page);
    if (now.dialog) await answerDialog(page);
    else if (now.storyControl) await advanceStory(page);
    else break;
    await pause(page, 20);
  }
  await page.evaluate(() => window.fnt?.app.endVillagePreview());
  await page.waitForFunction(() => document.getElementById('app')?.dataset.scene === 'title');

  await page.getByRole('button', { name: /load a save/i }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /^Load$/ })
    .click();
  await page.waitForFunction(() => window.fnt?.app.state?.screen === 'combat');
  await settle(page);
  await fight(page, { ...options, turnsPerFight: 1 }, false);
  await settle(page);

  for (let guard = 0; guard < 6 && (await peek(page)).dialog; guard++) await answerDialog(page);
  await page.evaluate(() => window.fnt?.app.openPause());
  if (!(await click(page, '.overlay [role="dialog"] button', 'Quit to title')))
    throw new Error('No Quit to title in the pause menu');
  await pause(page, 30);
  if (!(await click(page, '.overlay [role="dialog"] button', 'Quit')))
    throw new Error('No Quit confirmation in the pause menu');
  await page.waitForFunction(() => document.getElementById('app')?.dataset.scene === 'title');
}
