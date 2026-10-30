import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT, RETURNEE_IDS } from '../src/content';
import { previewAiPlan } from '../src/core/rules/ai';
import { distance, reachable } from '../src/core/rules/grid';
import { contactEffects } from '../src/core/rules/surfaces';
import { RngCursor } from '../src/core/rng';
import { BattleDraft } from '../src/core/state/battleDraft';
import { appendDiagnosticToExistingError } from './diagnostic-error';
import {
  newStoryOperationReport,
  timeStoryOperation,
  type StoryOperationContext,
  type StoryOperationReport,
} from './story-operation-timing';
import {
  completeAuthoredPlayback,
  resetStorage,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';

interface PhaseRecord {
  readonly startedAt: number;
  readonly story: StoryOperationReport;
  current: { name: string; startedAt: number } | null;
  readonly completed: { name: string; elapsedMs: number }[];
}

const phases = new WeakMap<Page, PhaseRecord>();
test.beforeEach(({ page }) => {
  phases.set(page, {
    startedAt: Date.now(),
    story: newStoryOperationReport(),
    current: null,
    completed: [],
  });
});
test.afterEach(({ page }, testInfo) => {
  const record = phases.get(page);
  phases.delete(page);
  if (!record || testInfo.status === testInfo.expectedStatus || !testInfo.errors.length) return;
  const totals: Record<string, { count: number; elapsedMs: number }> = {};
  for (const phase of record.completed) {
    const category = phase.name.split(' ')[0] ?? phase.name;
    const total = (totals[category] ??= { count: 0, elapsedMs: 0 });
    total.count++;
    total.elapsedMs += phase.elapsedMs;
  }
  appendDiagnosticToExistingError(
    testInfo,
    'Quarry campaign timing',
    JSON.stringify({
      elapsedMs: Date.now() - record.startedAt,
      current: record.current && {
        name: record.current.name,
        elapsedMs: Date.now() - record.current.startedAt,
      },
      totals,
      last: record.completed.slice(-10),
      slowest: [...record.completed].sort((a, b) => b.elapsedMs - a.elapsedMs).slice(0, 5),
      storyOperations: record.story,
    }),
  );
});

function beginPhase(page: Page, name: string): void {
  const record = phases.get(page);
  if (record) record.current = { name, startedAt: Date.now() };
}

function endPhase(page: Page): void {
  const record = phases.get(page);
  if (!record?.current) return;
  record.completed.push({
    name: record.current.name,
    elapsedMs: Date.now() - record.current.startedAt,
  });
  record.current = null;
}

/** Drive real player commands while leaving the campaign state and outcome untouched. */
async function finishBattle(page: Page, encounterId: string): Promise<void> {
  beginPhase(page, `battle ${encounterId}`);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.battle?.encounterId))
    .toBe(encounterId);

  // This spec proves the route, not the fight's odds: the balance report and
  // runCombat.test.ts own those. Flatten the board before the autopilot runs so
  // the loop still resolves a real battle through the real rules and victory
  // flow — it just cannot stall into a loss when the AI has a good day.
  await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    if (!app || !state || !battle) return;
    const units = battle.units.map((unit) =>
      unit.faction === 'enemy' && unit.hp > 0 ? { ...unit, hp: 1 } : unit,
    );
    app.state = { ...state, battle: { ...battle, units } };
    app.resync();
  });

  for (let turn = 0; turn < 160; turn++) {
    const phase = await page.evaluate(() => window.fnt?.app.state?.battle?.phase);
    if (phase !== 'active') break;
    // This route proof dispatches legal actions from state; it never converts
    // camera pixels to targets, so it does not need a four-frame camera sample.
    if (!(await takeTurn(page, { settleCamera: false }))) break;

    for (let action = 0; action < 8; action++) {
      const state = await page.evaluate(() => window.fnt?.app.state);
      const battle = state?.battle;
      if (!state || !battle || battle.phase !== 'active') break;
      const unitId = battle.order[battle.turnIndex];
      const actor = battle.units.find((unit) => unit.id === unitId);
      if (!actor || actor.faction !== 'party') break;
      const draft = new BattleDraft(CONTENT, battle, new RngCursor(state.rng));
      const profile =
        actor.element === 'water'
          ? 'support'
          : actor.element === 'earth' || actor.element === 'air'
            ? 'cautious'
            : 'aggressive';
      draft.replace({ ...actor, ai: profile });
      const plan = previewAiPlan(draft, actor.id);

      if (plan) {
        const beforeAp = await page.evaluate(
          (id) => window.fnt?.app.state?.battle?.units.find((unit) => unit.id === id)?.ap,
          actor.id,
        );
        await page.evaluate(
          ({ id, abilityId, target }) =>
            window.fnt!.app.dispatch({ type: 'useAbility', unitId: id, abilityId, target }),
          { id: actor.id, abilityId: plan.ability.id, target: plan.target },
        );
        const afterAp = await page.evaluate(
          (id) => window.fnt?.app.state?.battle?.units.find((unit) => unit.id === id)?.ap,
          actor.id,
        );
        if (afterAp !== undefined && beforeAp !== undefined && afterAp < beforeAp) continue;
      }

      // If nothing is in reach yet, take a legal path toward the nearest enemy.
      //
      // A tile that burns you is never worth taking over one that does not —
      // no reasonable player advances through open fire when level ground is
      // just as close — so tiles with contact damage are only a last resort,
      // used exclusively when every path forward is one of them.
      const enemies = battle.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0);
      const nearest = (pos: typeof actor.pos) =>
        Math.min(...enemies.map((enemy) => distance(pos, enemy.pos)));
      const candidates = [
        ...reachable(draft.moveContext(actor), actor.pos, actor.move).values(),
      ].filter((cell) => cell.path.length > 0 && nearest(cell.pos) < nearest(actor.pos));
      const unharmed = candidates.filter(
        (cell) => contactEffects(CONTENT, draft.grid, cell.pos).damage <= 0,
      );
      const step = (unharmed.length > 0 ? unharmed : candidates).sort(
        (a, b) => nearest(a.pos) - nearest(b.pos) || a.cost - b.cost,
      )[0];
      if (step) {
        await page.evaluate(
          ({ id, path }) => window.fnt!.app.dispatch({ type: 'move', unitId: id, path }),
          { id: actor.id, path: step.path },
        );
        await waitForIdle(page);
        const moved = await page.evaluate(
          (id) => window.fnt?.app.state?.battle?.units.find((unit) => unit.id === id)?.pos,
          actor.id,
        );
        // Re-evaluate remaining AP only when the rules accepted the move.
        if (moved && (moved.x !== actor.pos.x || moved.y !== actor.pos.y)) continue;
      }
      break;
    }

    await page.evaluate(() => {
      const app = window.fnt!.app;
      const battle = app.state?.battle;
      if (!battle || battle.phase !== 'active') return;
      const unitId = battle.order[battle.turnIndex];
      const unit = battle.units.find((candidate) => candidate.id === unitId);
      if (unit?.faction === 'party') app.dispatch({ type: 'endTurn', unitId: unit.id });
    });
    await waitForIdle(page);
  }

  expect(await page.evaluate(() => window.fnt?.app.state?.battle?.phase), encounterId).toBe(
    'victory',
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  endPhase(page);
}

/** Use the visible story controls, including authored interludes and choices. */
async function continueStory(page: Page, custody: 'escort' | 'trade' = 'trade'): Promise<void> {
  beginPhase(page, 'story');
  const report = phases.get(page)?.story ?? null;
  let context: StoryOperationContext = { nodeId: null, lineIndex: null, branch: 'state' };
  const timed = <T>(branch: string, operation: string, action: () => Promise<T>) =>
    timeStoryOperation(report, operation, { ...context, branch }, action);
  for (let step = 0; step < 60; step++) {
    const state = await timeStoryOperation(
      report,
      'read',
      { ...context, branch: 'state' },
      () => page.evaluate(() => window.fnt?.app.state),
      (result) => ({
        nodeId: result?.story.nodeId ?? null,
        lineIndex: result?.story.lineIndex ?? null,
        branch: 'state',
      }),
    );
    context = {
      nodeId: state?.story.nodeId ?? null,
      lineIndex: state?.story.lineIndex ?? null,
      branch: 'state',
    };
    if (state?.pendingChoices.length) {
      await timed('learn', 'click', () =>
        page
          .getByRole('button', { name: /^Learn / })
          .first()
          .click(),
      );
      continue;
    }
    if (state?.screen !== 'dialogue') {
      endPhase(page);
      return;
    }
    if (await timed('interlude', 'count', () => page.locator('.interlude-stage').count())) {
      await timed('skip', 'click', () => page.getByRole('button', { name: 'Skip scene' }).click());
      continue;
    }
    if (state.story.nodeId === 'gate_parley') {
      // Bo speaks to the earthbender.
      await timed('gateParley', 'click', () => page.locator('.choice-option').nth(2).click());
      continue;
    }
    if (state.story.nodeId === 'gate_kinship') {
      await timed('gateKinship', 'assert', () =>
        expect(page.locator('.stage[data-kind="dialogue"]')).toHaveCount(1),
      );
    }
    if (state.story.nodeId === 'ruon_choice') {
      await timed('ruonChoice', 'assert', () =>
        expect(
          page.locator('.stage[data-kind="dialogue"], .stage[data-kind="choice"]'),
        ).toHaveCount(1),
      );
      await timed('ruonChoice', 'click', () =>
        page
          .locator('.choice-option')
          .nth(custody === 'trade' ? 1 : 0)
          .click(),
      );
      continue;
    }
    if (await timed('choice', 'count', () => page.locator('.choice-option').count())) {
      await timed('choice', 'click', () =>
        page.locator('.choice-option:not(.is-locked)').first().click(),
      );
      continue;
    }
    await timed('next', 'click', () => page.locator('.dialogue-panel button.btn-primary').click());
  }
  throw new Error('Story did not return to exploration');
}

async function walkTo(page: Page, x: number, y: number): Promise<void> {
  beginPhase(page, `walk ${x},${y}`);
  await page.evaluate((pos) => window.fnt!.app.dispatch({ type: 'walkTo', pos }), { x, y });
  await completeAuthoredPlayback(page);
  endPhase(page);
}

async function takeRoute(page: Page, label: string, mapId: string): Promise<void> {
  beginPhase(page, `route ${mapId}`);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId)).toBe(mapId);
  await completeAuthoredPlayback(page);
  endPhase(page);
}

async function expectJournalObjective(page: Page, text: string): Promise<void> {
  beginPhase(page, `journal ${text}`);
  await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Travel journal' })).toContainText(text);
  await page.getByRole('button', { name: 'Return to the path', exact: true }).click();
  endPhase(page);
}

async function checkpoint(page: Page) {
  return page.evaluate(() => {
    const state = window.fnt!.app.state!;
    return {
      party: state.party.map((unit) => ({
        id: unit.id,
        hp: unit.hp,
        level: unit.level,
        xp: unit.xp,
        abilities: unit.abilities,
      })),
      flags: state.flags,
      world: state.world,
      story: state.story,
      location: state.location,
    };
  });
}

async function saveAndReload(page: Page): Promise<void> {
  beginPhase(page, 'save');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /save here/i })
    .click();
  const saved = await checkpoint(page);
  await page.reload();
  await page.getByRole('button', { name: /load a save/i }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /^Load$/ })
    .click();
  expect(await checkpoint(page)).toEqual(saved);
  endPhase(page);
}

for (const custody of ['trade', 'escort'] as const) {
  test(`a new campaign takes the ${custody} route and walks home after reloading`, async ({
    page,
  }) => {
    test.setTimeout(600_000);
    // The route assertions inspect completed destinations, not intermediate
    // walking frames; install before boot so the real route timers can finish.
    await page.clock.install();
    await resetStorage(page, '?renderer=canvas');
    const names =
      custody === 'trade'
        ? ['Kaya', 'Nilak', 'Bo']
        : ['Kaya', 'Nilak', 'Bo', 'Tenzo', 'Lin Mei', 'Nima'];
    const characters =
      custody === 'trade'
        ? ['kaya', 'nilak', 'bo']
        : ['kaya', 'nilak', 'bo', 'tenzo', 'lin_mei', 'nima'];
    // The seed only pins the run (encounter variants and RNG order) so a
    // failure is reproducible; it no longer has to stage the win, because
    // finishBattle flattens every board it plays.
    await startGame(
      page,
      names,
      characters,
      custody === 'trade' ? 'quarry-return-trade-route' : 'quarry-return-escort',
    );
    await continueStory(page);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('village_explore');

    await walkTo(page, 11, 5); // Mira's invitation, reached by walking from a new game.
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('mira_intro');
    await continueStory(page);
    await takeRoute(page, 'East road → Forest Road', 'forest_road');
    await expectJournalObjective(page, 'quarry lies east');
    await walkTo(page, 19, 4);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('road_depart');
    await continueStory(page);
    await walkTo(page, 19, 4);
    await finishBattle(page, 'enc_forest_road');
    await continueStory(page);
    await expect(page.locator('.title-plate-objective')).toContainText('road is open');
    await takeRoute(page, 'East → Quarry Gate', 'quarry_gate');

    await walkTo(page, 19, 5);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('gate_parley');
    await continueStory(page, custody);
    expect(
      await page.evaluate(
        (flag) => window.fnt?.app.state?.flags[flag],
        custody === 'trade' ? 'ruon_traded' : 'ruon_spared',
      ),
    ).toBe(true);
    await takeRoute(page, 'East → The Cutting', 'ambush_road');
    if (custody === 'escort') {
      await walkTo(page, 19, 4);
      await continueStory(page);
      await finishBattle(page, 'enc_ambush');
      await continueStory(page);
    }
    await takeRoute(page, 'East → Quarry Floor', 'quarry_floor');
    await expectJournalObjective(page, 'driller waits');
    await walkTo(page, 17, 5);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('quarry_descent');
    await continueStory(page);
    await finishBattle(page, 'enc_grumbler');

    await expect(page.getByRole('button', { name: 'Read summary' })).toBeVisible();
    await page.getByRole('button', { name: 'Read summary' }).click();
    await expect(page.getByRole('button', { name: 'Continue exploring' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue exploring' }).click();
    expect(await page.evaluate(() => window.fnt?.app.state?.flags.act1_complete)).toBe(true);
    await expect(page.locator('.title-plate-objective')).toContainText('west');
    await expectJournalObjective(page, 'Take the west path');

    await saveAndReload(page);
    expect(await page.evaluate(() => window.fnt?.app.state?.flags.act1_complete)).toBe(true);
    expect(await page.evaluate(() => window.fnt?.app.state?.location.mapId)).toBe('quarry_floor');
    await expect(page.locator('.title-plate-objective')).toContainText('west');

    await takeRoute(page, 'West → The Cutting', 'ambush_road');
    await expectJournalObjective(page, 'Ba Dan lies west');
    await walkTo(page, 5, 9);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('sen_home');
    await expect(page.locator('.dialogue-line')).toContainText('They came through');
    await continueStory(page);
    await takeRoute(page, 'West → Quarry Gate', 'quarry_gate');
    await expectJournalObjective(page, 'gate is open');
    await takeRoute(page, 'West → Forest Road', 'forest_road');
    await expectJournalObjective(page, 'roadblock is gone');
    await walkTo(page, 3, 1);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('dema_home');
    await expect(page.locator('.dialogue-line')).toContainText('crews came past');
    await continueStory(page);
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.getByRole('button', { name: 'West → Ba Dan Village', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
      .toBe('forest_return_arrival');
    expect(await page.evaluate(() => window.fnt!.app.state?.location.mapId)).toBe('forest_road');
    expect(await page.evaluate(() => window.fnt!.app.state?.world.residentProfiles)).toEqual(
      Object.fromEntries(RETURNEE_IDS.map((id) => [id, 'returning'])),
    );
    await continueStory(page);
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId))
      .toBe('ba_dan_village');
    expect(await page.evaluate(() => window.fnt!.app.state?.world.residentProfiles)).toEqual(
      Object.fromEntries(RETURNEE_IDS.map((id) => [id, 'resting'])),
    );
    // Dorin and Hanru occupy adjacent handover tiles. From the east-road
    // return position, tapping Dorin must open and pin Dorin, not Hanru.
    const dorin = CONTENT.anchors.get('bd03.handover')?.site;
    if (dorin?.kind !== 'map') throw new Error('Missing canonical Dorin handover');
    await walkTo(page, dorin.pos.x, dorin.pos.y);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('dorin_home');
    expect(await page.evaluate(() => window.fnt?.app.state?.world.talk?.npcId)).toBe('guard_dorin');
    await continueStory(page);
    await walkTo(page, 11, 5);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('mira_epilogue');
    await expect(page.locator('.dialogue-line')).toContainText('Bo-shan');
    await page.locator('.dialogue-panel button.btn-primary').click();
    const custodyResponse =
      custody === 'trade' ? 'where Jin delivered him' : 'taking Ruon’s statement';
    await expect(page.locator('.dialogue-line')).toContainText(custodyResponse);
    await continueStory(page);
    // Gao is resident-bound (ADR 0047): his homecoming hold keeps him at his shopfront.
    const gao = CONTENT.anchors.get('bd02.shopfront')?.site;
    if (gao?.kind !== 'map') throw new Error('Missing canonical village merchant');
    await walkTo(page, gao.pos.x, gao.pos.y);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe(
      custody === 'trade' ? 'gao_home_cold' : 'gao_home',
    );
    await expect(page.locator('.dialogue-line')).toContainText(
      custody === 'trade' ? 'workers are home' : 'rice in the pot',
    );
    if (custody === 'trade') {
      await page.locator('.dialogue-panel button.btn-primary').click();
      await expect(page.locator('.dialogue-line')).toContainText('Ruon');
    }
    await continueStory(page);

    await saveAndReload(page);
    expect(await page.evaluate(() => window.fnt?.app.state?.location.mapId)).toBe('ba_dan_village');
    await walkTo(page, 11, 5);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('mira_epilogue');
    await page.locator('.dialogue-panel button.btn-primary').click();
    await expect(page.locator('.dialogue-line')).toContainText(custodyResponse);
    await continueStory(page);

    const xp = await page.evaluate(() => window.fnt?.app.state?.party.map((unit) => unit.xp));
    await takeRoute(page, 'East road → Forest Road', 'forest_road');
    await takeRoute(page, 'East → Quarry Gate', 'quarry_gate');
    await takeRoute(page, 'East → The Cutting', 'ambush_road');
    await takeRoute(page, 'East → Quarry Floor', 'quarry_floor');
    await walkTo(page, 17, 5); // The resolved driller trigger must stay quiet.
    expect(await page.evaluate(() => window.fnt?.app.state?.screen)).toBe('explore');
    expect(await page.evaluate(() => window.fnt?.app.state?.battle)).toBeNull();
    expect(await page.evaluate(() => window.fnt?.app.state?.party.map((unit) => unit.xp))).toEqual(
      xp,
    );
    await takeRoute(page, 'West → The Cutting', 'ambush_road');
    await takeRoute(page, 'West → Quarry Gate', 'quarry_gate');
    await takeRoute(page, 'West → Forest Road', 'forest_road');
    await takeRoute(page, 'West → Ba Dan Village', 'ba_dan_village');
    expect(await page.evaluate(() => window.fnt?.app.state?.world.cleared)).toContain(
      'enc_grumbler',
    );
  });
}
