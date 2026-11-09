import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Browser, Page, TestInfo } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { canUseAbility, isValidTarget } from '../src/core/rules/abilities';
import { distance, reachable } from '../src/core/rules/grid';
import { BattleDraft } from '../src/core/state/battleDraft';
import { apply } from '../src/core/state/reducer';
import type { Command, GameState } from '../src/core/types';
import type { SaveBlob, SessionMeta } from '../src/core/save/serialize';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

// These are automated browser checks, not physical Surface/iPad acceptance.
test.use({ serviceWorkers: 'block' });

interface SavedGame {
  state: GameState;
  session: SessionMeta;
}

async function currentGame(page: Page): Promise<SavedGame> {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app?.state) throw new Error('Expected a running game');
    return { state: app.state, session: app.session.toMeta() };
  });
}

async function rawSlots(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      ['slot1', 'slot2', 'slot3', 'auto'].map((slot) => [
        slot,
        localStorage.getItem(`fnt.save.${slot}`),
      ]),
    ),
  );
}

async function attachEvidence(page: Page, testInfo: TestInfo, name: string, evidence: unknown) {
  await testInfo.attach(`${name}.json`, {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json',
  });
  await testInfo.attach(`${name}.png`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}

/** Setup skips dialogue; the subsequent ground click performs a real walk. */
async function explorationFixture(page: Page, seed: string) {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Keeper', 'Scout', 'Anchor'], ['nilak', 'nima', 'bo'], seed);
  await enterNode(page, 'village_explore');
  await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
  await settleLayout(page);
  const before = await currentGame(page);
  // The compact camera shows less of the same clear road. Prefer the four-tile
  // walk, then its visible one-tile neighbour; never click outside the canvas.
  const candidates = await Promise.all(
    [4, 1].map(async (steps) => {
      const target = { x: before.state.location.pos.x + steps, y: before.state.location.pos.y };
      const point = await paintedTileCentre(page, target);
      const probe = point
        ? await page.evaluate((point) => {
            const canvas = document.querySelector<HTMLCanvasElement>('.explore-scene .map-canvas');
            if (!canvas) throw new Error('The exploration canvas is missing');
            const box = canvas.getBoundingClientRect();
            return {
              canvas: { x: box.x, y: box.y, width: box.width, height: box.height },
              insideCanvas:
                point.x >= box.left &&
                point.x < box.right &&
                point.y >= box.top &&
                point.y < box.bottom,
              topIsCanvas: document.elementFromPoint(point.x, point.y) === canvas,
            };
          }, point)
        : null;
      return { target, point, probe };
    }),
  );
  const chosen = candidates.find(
    (candidate) => candidate.probe?.insideCanvas && candidate.probe.topIsCanvas,
  );
  if (!chosen?.point || !chosen.probe) {
    throw new Error(`No visible exploration walk target: ${JSON.stringify(candidates)}`);
  }
  expect(chosen.probe.insideCanvas).toBe(true);
  expect(chosen.probe.topIsCanvas).toBe(true);
  await test.info().attach('exploration-walk-target.json', {
    body: Buffer.from(JSON.stringify({ from: before.state.location, chosen, candidates }, null, 2)),
    contentType: 'application/json',
  });
  await page.mouse.click(chosen.point.x, chosen.point.y);
  await expect
    .poll(async () => (await currentGame(page)).state.location.pos)
    .toEqual(chosen.target);
  await waitForIdle(page);
  expect((await currentGame(page)).state.location).not.toEqual(before.state.location);
}

/** The UI creates the file; neither serialization nor the download is substituted. */
async function exportDownload(page: Page, testInfo: TestInfo) {
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Paused', exact: true })
    .getByRole('button', { name: 'Save game', exact: true })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Save game', exact: true });
  const game = await currentGame(page);
  const pending = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Export to file', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(
    /^four-nations-tactics-lv\d+-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const path = testInfo.outputPath('downloaded-save.json');
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  const bytes = await readFile(path);
  expect(bytes.length).toBeGreaterThan(0);
  const blob = JSON.parse(bytes.toString('utf8')) as SaveBlob;
  expect({ state: blob.state, session: blob.session }).toEqual(game);
  expect(await currentGame(page)).toEqual(game);
  await testInfo.attach('actual-downloaded-save', { path, contentType: 'application/json' });
  await expect(page.locator('.toast').filter({ hasText: 'Save file downloaded.' })).toBeVisible();
  return { path, bytes, blob, game };
}

async function resumeAfterExport(page: Page) {
  await page
    .getByRole('dialog', { name: 'Save game', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Paused', exact: true })
    .getByRole('button', { name: 'Resume', exact: true })
    .click();
}

async function chooseFile(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
) {
  const pending = page.waitForEvent('filechooser');
  await page
    .getByRole('dialog', { name: 'Load game', exact: true })
    .getByRole('button', { name: 'Import from file', exact: true })
    .click();
  await (await pending).setFiles(file);
}

/** Every option comes from the current project; no storage is copied across. */
async function importInFreshContext(browser: Browser, testInfo: TestInfo, path: string) {
  const use = testInfo.project.use;
  const context = await browser.newContext({
    baseURL: use.baseURL,
    viewport: use.viewport,
    hasTouch: use.hasTouch,
    isMobile: use.isMobile,
    deviceScaleFactor: use.deviceScaleFactor,
    userAgent: use.userAgent,
    serviceWorkers: 'block',
    storageState: { cookies: [], origins: [] },
  });
  try {
    const page = await context.newPage();
    await page.goto('/?renderer=canvas');
    await page.waitForFunction(() => Boolean(window.fnt?.app));
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    expect(await page.evaluate(() => window.fnt?.app.state)).toBeNull();
    expect(await rawSlots(page)).toEqual({ slot1: null, slot2: null, slot3: null, auto: null });
    await page.getByRole('button', { name: 'Load a save', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Load game', exact: true })).toBeVisible();
    await chooseFile(page, path);
    await expect(page.getByRole('dialog', { name: 'Load game', exact: true })).toHaveCount(0);
    await expect(page.locator('.toast').filter({ hasText: 'Game loaded.' })).toBeVisible();
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

type Attack = Extract<Command, { type: 'useAbility' }>;

/** Pure rules plan legal commands; all accepted commands run through the real App. */
function rngAttacks(state: GameState): Attack[] {
  const battle = state.battle;
  if (!battle || battle.phase !== 'active') return [];
  const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
  if (actor?.faction !== 'party') return [];
  const commands: Attack[] = [];
  for (const abilityId of actor.abilities) {
    const ability = CONTENT.abilities.get(abilityId);
    if (!ability?.effects.some((effect) => effect.kind === 'damage')) continue;
    if (!canUseAbility(CONTENT, actor, ability).ok) continue;
    for (const target of battle.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0)) {
      if (!isValidTarget(CONTENT, battle, actor, ability, target.pos).ok) continue;
      const command: Attack = {
        type: 'useAbility',
        unitId: actor.id,
        abilityId,
        target: target.pos,
      };
      const result = apply(CONTENT, state, command);
      if (
        result.state.rng !== state.rng &&
        result.events.some((event) => event.type === 'abilityUsed')
      ) {
        commands.push(command);
      }
    }
  }
  return commands;
}

async function dispatchObserved(page: Page, command: Command) {
  return page.evaluate((command) => {
    const app = window.fnt?.app;
    if (!app?.state) throw new Error('Expected a running game');
    const events = app.dispatch(command);
    return { events, state: app.state, session: app.session.toMeta() };
  }, command);
}

/**
 * Programmatic fixture: real movement, turns and attacks, with no state/HP/status
 * edits. Stop after actual damage and a status, while a second attack is legal.
 */
async function battleFixture(page: Page) {
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['Keeper', 'Scout', 'Anchor'],
    ['nilak', 'nima', 'bo'],
    'export-import-battle-522',
  );
  await enterNode(page, 'battle_forest_road');
  for (let step = 0; step < 40; step++) {
    if (!(await takeTurn(page, { settleCamera: false }))) break;
    await waitForIdle(page);
    const before = await currentGame(page);
    const battle = before.state.battle;
    const actor = battle?.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
    if (!battle || !actor) throw new Error('The battle fixture lost its active unit');
    const attacks = actor.characterId === 'nilak' ? rngAttacks(before.state) : [];
    for (const command of attacks) {
      const predicted = apply(CONTENT, before.state, command);
      const next = rngAttacks(predicted.state)[0];
      if (
        !next ||
        !predicted.events.some((event) => event.type === 'damaged' && event.amount > 0) ||
        !predicted.events.some((event) => event.type === 'statusApplied')
      )
        continue;
      const actual = await dispatchObserved(page, command);
      expect(actual.events).toEqual(predicted.events);
      expect(actual.state).toEqual(predicted.state);
      expect(actual.state.rng).not.toBe(before.state.rng);
      expect(actual.state.battle?.units.some((unit) => unit.hp < unit.base.maxHp)).toBe(true);
      expect(actual.state.battle?.units.some((unit) => unit.statuses.length > 0)).toBe(true);
      expect(actual.state.battle?.order[actual.state.battle.turnIndex]).toBe(actor.id);
      await waitForIdle(page);
      return { prior: { command, before, actual }, next };
    }
    // Nilak closes the range; the other characters pass, leaving enemies alive.
    if (actor.characterId === 'nilak' && attacks[0]) {
      await dispatchObserved(page, attacks[0]);
    } else if (actor.characterId === 'nilak' && actor.move > 0) {
      const enemies = battle.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0);
      const nearest = (pos: typeof actor.pos) =>
        Math.min(...enemies.map((enemy) => distance(pos, enemy.pos)));
      const draft = new BattleDraft(CONTENT, battle, new RngCursor(before.state.rng));
      const move = [...reachable(draft.moveContext(actor), actor.pos, actor.move).values()]
        .filter((cell) => cell.path.length > 0 && nearest(cell.pos) < nearest(actor.pos))
        .sort((a, b) => nearest(a.pos) - nearest(b.pos) || a.cost - b.cost)[0];
      if (move) {
        const actual = await dispatchObserved(page, {
          type: 'move',
          unitId: actor.id,
          path: move.path,
        });
        expect(actual.events.some((event) => event.type === 'unitMoved')).toBe(true);
      } else {
        await dispatchObserved(page, { type: 'endTurn', unitId: actor.id });
      }
    } else {
      await dispatchObserved(page, { type: 'endTurn', unitId: actor.id });
    }
    await waitForIdle(page);
  }
  throw new Error(
    'Legal battle fixture never reached damage + status + a second RNG-consuming attack',
  );
}

test('an actual exploration download imports into an empty browser context', async ({
  page,
  browser,
}, testInfo) => {
  await explorationFixture(page, 'export-import-explore-522');
  const exported = await exportDownload(page, testInfo);
  expect(exported.game.state.screen).toBe('explore');
  expect(exported.game.state.story.visited.length).toBeGreaterThan(0);
  expect(exported.game.session.players.map((player) => player.name)).toEqual([
    'Keeper',
    'Scout',
    'Anchor',
  ]);
  const imported = await importInFreshContext(browser, testInfo, exported.path);
  try {
    const game = await currentGame(imported.page);
    expect(game).toEqual(exported.game);
    await expect(imported.page.locator('.explore-scene .map-canvas')).toBeVisible();
    await attachEvidence(imported.page, testInfo, 'exploration-imported', {
      downloaded: exported.blob,
      imported: game,
      sourceSlots: await rawSlots(page),
      freshSlots: await rawSlots(imported.page),
    });
  } finally {
    await imported.context.close();
  }
});

test('a battle download preserves HP, statuses, turn and the next RNG-consuming action', async ({
  page,
  browser,
}, testInfo) => {
  const fixture = await battleFixture(page);
  const exported = await exportDownload(page, testInfo);
  expect(exported.game.state.screen).toBe('combat');
  expect(rngAttacks(exported.game.state)).toContainEqual(fixture.next);
  const imported = await importInFreshContext(browser, testInfo, exported.path);
  try {
    const game = await currentGame(imported.page);
    expect(game).toEqual(exported.game);
    await expect(imported.page.locator('.combat-scene .map-canvas')).toBeVisible();
    await attachEvidence(imported.page, testInfo, 'battle-imported', {
      fixture,
      downloaded: exported.blob,
      imported: game,
    });
    await resumeAfterExport(page);
    const sourceAction = await dispatchObserved(page, fixture.next);
    const importedAction = await dispatchObserved(imported.page, fixture.next);
    expect(sourceAction.state.rng).not.toBe(exported.game.state.rng);
    expect(sourceAction.events.some((event) => event.type === 'abilityUsed')).toBe(true);
    expect(importedAction).toEqual(sourceAction);
    await testInfo.attach('same-action-results.json', {
      body: Buffer.from(
        JSON.stringify({ command: fixture.next, sourceAction, importedAction }, null, 2),
      ),
      contentType: 'application/json',
    });
  } finally {
    await imported.context.close();
  }
});

const invalidCases = [
  { id: 'empty', warning: 'That file is not valid JSON.' },
  { id: 'truncated', warning: 'That file is not valid JSON.' },
  { id: 'png', warning: 'That file is not valid JSON.' },
  { id: 'wrong-shape', warning: 'This save looks damaged. Try another save file.' },
  {
    id: 'future-version',
    warning: 'This save was made by a newer version of the game. Update, then try again.',
  },
] as const;

for (const invalid of invalidCases) {
  test(`rejects ${invalid.id} imports without changing game, session or any save slot`, async ({
    page,
  }, testInfo) => {
    await explorationFixture(page, `invalid-export-import-${invalid.id}-522`);
    // Programmatic storage fixture, using the App's real slot writer. Each raw
    // value must survive byte-for-byte, including the autosave and its metadata.
    await page.evaluate(() => {
      const app = window.fnt?.app;
      if (!app) throw new Error('Expected an App');
      for (const slot of ['slot1', 'slot2', 'slot3', 'auto'] as const) {
        if (!app.saveTo(slot, `Keep ${slot}`)) throw new Error(`Could not seed ${slot}`);
      }
    });
    const exported = await exportDownload(page, testInfo);
    await page
      .getByRole('dialog', { name: 'Save game', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Paused', exact: true })
      .getByRole('button', { name: 'Load game', exact: true })
      .click();
    const menu = page.getByRole('dialog', { name: 'Load game', exact: true });
    const before = { game: await currentGame(page), slots: await rawSlots(page) };
    for (const raw of Object.values(before.slots)) expect(raw).not.toBeNull();
    expect(await page.locator('.toast.toast-warn').count()).toBe(0);
    let buffer: Buffer;
    let name = `${invalid.id}.json`;
    if (invalid.id === 'empty') buffer = Buffer.alloc(0);
    else if (invalid.id === 'truncated')
      buffer = exported.bytes.subarray(0, Math.floor(exported.bytes.length / 2));
    else if (invalid.id === 'png') {
      buffer = await readFile(resolve('public/icons/icon-192.png'));
      expect(buffer.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      name = 'icon-192.png';
    } else if (invalid.id === 'wrong-shape') {
      buffer = Buffer.from(
        JSON.stringify({
          ...exported.blob,
          state: {
            ...exported.blob.state,
            party: exported.blob.state.party.map((unit, index) =>
              index === 0 ? { ...unit, hp: 'not-a-number' } : unit,
            ),
          },
        }),
      );
    } else {
      buffer = Buffer.from(JSON.stringify({ ...exported.blob, format: exported.blob.format + 1 }));
    }
    await chooseFile(page, {
      name,
      mimeType: invalid.id === 'png' ? 'image/png' : 'application/json',
      buffer,
    });
    const warning = page.locator('.toast.toast-warn');
    await expect(warning).toHaveCount(1);
    await expect(warning).toHaveText(invalid.warning);
    await expect(warning).toBeVisible();
    if (invalid.id === 'wrong-shape') {
      await attachEvidence(page, testInfo, 'damaged-save-warning', {
        actual: await warning.textContent(),
        expected: invalid.warning,
      });
    }
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Import from file', exact: true })).toBeEnabled();
    const after = { game: await currentGame(page), slots: await rawSlots(page) };
    expect(after).toEqual(before);
    await attachEvidence(page, testInfo, `rejected-${invalid.id}`, {
      name,
      bytes: buffer.length,
      warning: invalid.warning,
      before,
      after,
    });
  });
}

test('damaged local slots show a plain warning while future and valid saves keep their behavior', async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await resetStorage(page, '?renderer=canvas');
  // Public game/route fixtures skip unrelated setup only. The App's real slot
  // writer produces every save; Load, parsing and adoption remain untouched.
  await startGame(page, ['Keeper', 'Scout'], ['bo', 'nilak'], 'slot-warning-522');
  await enterNode(page, 'village_explore');
  await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
  await settleLayout(page);
  const expectedGame = await currentGame(page);
  const seeded = await page.evaluate(() => {
    const app = window.fnt!.app;
    for (const slot of ['slot1', 'slot2', 'slot3', 'auto'] as const) {
      if (!app.saveTo(slot, `Keep ${slot}`)) throw new Error(`Could not seed ${slot}`);
    }
    const read = () =>
      Object.fromEntries(
        ['slot1', 'slot2', 'slot3', 'auto'].map((slot) => [
          slot,
          localStorage.getItem(`fnt.save.${slot}`),
        ]),
      );
    const good = read();
    if (Object.values(good).some((value) => value === null))
      throw new Error('A seeded slot is empty');
    // Labelled persisted-byte fixtures: only slot1's nested HP is malformed;
    // only slot2's format header is newer. Slot3 and autosave remain intact.
    const damaged = JSON.parse(good.slot1!) as { state: { party: { hp: unknown }[] } };
    if (!damaged.state.party[0]) throw new Error('No party member in saved slot1');
    damaged.state.party[0].hp = 'not-a-number';
    localStorage.setItem('fnt.save.slot1', JSON.stringify(damaged));
    const future = JSON.parse(good.slot2!) as { format: number };
    future.format += 1;
    localStorage.setItem('fnt.save.slot2', JSON.stringify(future));
    return { good, fixture: read() };
  });
  expect(seeded.fixture.slot3).toBe(seeded.good.slot3);
  expect(seeded.fixture.auto).toBe(seeded.good.auto);
  const damagedBlob = JSON.parse(seeded.good.slot1!);
  damagedBlob.state.party[0].hp = 'not-a-number';
  expect(JSON.parse(seeded.fixture.slot1!)).toEqual(damagedBlob);
  const futureBlob = JSON.parse(seeded.good.slot2!);
  futureBlob.format += 1;
  expect(JSON.parse(seeded.fixture.slot2!)).toEqual(futureBlob);

  await page.reload();
  await page.waitForFunction(() => Boolean(window.fnt?.app));
  await expect(page.locator('.title-card')).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.state)).toBeNull();
  expect(await rawSlots(page)).toEqual(seeded.fixture);
  await page.getByRole('button', { name: 'Load a save', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Load game', exact: true });
  await expect(menu).toBeVisible();
  const row = (name: string) =>
    menu.locator('.slot').filter({ has: page.getByText(name, { exact: true }) });
  const damaged = row('Slot 1');
  const future = row('Slot 2');
  const valid = row('Slot 3');
  for (const slot of [damaged, future, valid]) await expect(slot).toHaveCount(1);
  const damagedSummary = damaged.locator('.slot-text > span.muted.tiny').first();
  const futureSummary = future.locator('.slot-text > span.muted.tiny').first();
  const observed = {
    damaged: await damagedSummary.innerText(),
    future: await futureSummary.innerText(),
    damagedLoadDisabled: await damaged
      .getByRole('button', { name: 'Load', exact: true })
      .isDisabled(),
    damagedEraseEnabled: await damaged
      .getByRole('button', { name: 'Erase', exact: true })
      .isEnabled(),
    futureLoadDisabled: await future
      .getByRole('button', { name: 'Load', exact: true })
      .isDisabled(),
    validLoadEnabled: await valid.getByRole('button', { name: 'Load', exact: true }).isEnabled(),
    rawAfterOpen: await rawSlots(page),
    stateAfterOpen: await page.evaluate(() => window.fnt!.app.state),
  };
  await attachEvidence(page, testInfo, 'local-slot-warning', { observed, seeded });
  expect(observed.rawAfterOpen).toEqual(seeded.fixture);
  expect(observed.stateAfterOpen).toBeNull();
  await expect(damagedSummary).toHaveText(
    'This save looks damaged. Try another slot or import a save file.',
  );
  await expect(damaged).not.toContainText('state.party');
  await expect(damaged.getByRole('button', { name: 'Load', exact: true })).toBeDisabled();
  await expect(damaged.getByRole('button', { name: 'Erase', exact: true })).toBeEnabled();
  await expect(futureSummary).toHaveText(
    invalidCases.find((invalid) => invalid.id === 'future-version')!.warning,
  );
  await expect(future.getByRole('button', { name: 'Load', exact: true })).toBeDisabled();
  await expect(valid.getByRole('button', { name: 'Load', exact: true })).toBeEnabled();
  await valid.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
  const adopted = await currentGame(page);
  await attachEvidence(page, testInfo, 'local-slot-valid-load', {
    adopted,
    expectedGame,
    rawSlots: await rawSlots(page),
    pageErrors,
  });
  expect(adopted).toEqual(expectedGame);
  expect(pageErrors).toEqual([]);
});
