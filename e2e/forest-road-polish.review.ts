/**
 * Audit fixture for #379. Run only with the external review-379 config.
 * Reuses demo-flow's route/beat protocol and real projection/idle helpers.
 * Setup uses seeded newGame; story and exploration use visible controls/taps.
 * Combat uses the existing previewAiPlan driver from quarry-return.spec.ts,
 * WITHOUT that spec's HP shortcut. Commands go through App.dispatch and play
 * at native speed. No state/terrain/HP staging, clock control or zoom override.
 * This records Chromium viewport evidence, not physical iPad/Safari acceptance.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { previewAiPlan } from '../src/core/rules/ai';
import { distance, reachable } from '../src/core/rules/grid';
import { contactEffects } from '../src/core/rules/surfaces';
import { BattleDraft } from '../src/core/state/battleDraft';
import type { Command, Vec2 } from '../src/core/types';
import { resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

const SEED = 'forest-road-polish-379';
const MAX_STILL_BYTES = 8_000_000;

test('Forest Road native audit from Ba Dan to quarry gate', async ({ page }, info) => {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const renderer = String(info.project.metadata.renderer);
  if (!info.config.configFile) throw new Error('The external review config is required');
  const harness = dirname(info.config.configFile);
  const sourceRoot = dirname(dirname(info.file));
  const folder = info.outputPath('audit');
  mkdirSync(folder, { recursive: true });
  const receiptPath = process.env.FNT_REVIEW379_RECEIPT ?? `${harness}/build-receipt.json`;
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  const fingerprint = () =>
    JSON.parse(
      execFileSync('node', [`${harness}/provenance.mjs`, sourceRoot], { encoding: 'utf8' }),
    ) as {
      revision: string;
      headTree: string;
      sourceSha256: string;
      helpersSha256: string;
      harnessSha256: string;
      buildSha256: string;
      dirty: string;
    };
  const initial = fingerprint();
  const errors: string[] = [];
  const beats: unknown[] = [];
  const commands: unknown[] = [];
  let finalProvenance: ReturnType<typeof fingerprint> | null = null;
  let stage = 'provenance';
  let outcome = 'running';
  let failure: string | null = null;
  let displayedBuild: string | null = null;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon/i.test(message.text())) errors.push(message.text());
  });

  const state = () => page.evaluate(() => window.fnt?.app.state ?? null);
  const save = () =>
    writeFileSync(
      `${folder}/beats.json`,
      JSON.stringify(
        {
          issue: 379,
          startedAt,
          elapsedMs: Date.now() - t0,
          project: info.project.name,
          browser: 'Chromium; iPad-sized projects are emulation, not WebKit or hardware',
          viewport: page.viewportSize(),
          dpr: info.project.use.deviceScaleFactor ?? 1,
          renderer,
          seed: SEED,
          provenance: initial,
          finalProvenance,
          buildReceipt: receipt,
          displayedBuild,
          shortcuts: ['Seeded newGame helper skips party setup only'],
          driver:
            'UI story/walking; previewAiPlan and real reachable/contactEffects; App.dispatch combat',
          clock: 'native, no clock installation, pause, stepping or playback completion helper',
          budgets: { settleMs: 30_000, idleMs: 20_000, takeTurnMs: 25_000, maxPartyTurns: 160 },
          stage,
          outcome,
          failure,
          beats,
          commands,
          errors,
        },
        null,
        2,
      ),
    );

  const beat = async (name: string, note?: string) => {
    stage = name;
    const before = await page.evaluate(() => ({
      at: new Date().toISOString(),
      performanceMs: performance.now(),
      state: window.fnt?.app.state ?? null,
      camera: window.fnt?.app.rendererCamera() ?? null,
      actualRenderer: window.fnt?.app.rendererBackend() ?? null,
      canvas: document.querySelector('.map-canvas')?.getBoundingClientRect().toJSON() ?? null,
      busy: window.fnt?.app.animator.busy(performance.now()) ?? null,
      battleOpening:
        document.querySelector('.combat-scene')?.getAttribute('data-battle-opening') ?? null,
    }));
    const still = `${String(beats.length + 1).padStart(2, '0')}-${name}.png`;
    const atMs = Date.now() - t0;
    await page.screenshot({ path: `${folder}/${still}` });
    const bytes = statSync(`${folder}/${still}`).size;
    beats.push({ name, atMs, capturedAt: new Date().toISOString(), still, bytes, note, ...before });
    save();
    expect(bytes, `${still} must remain under 8 MB`).toBeLessThan(MAX_STILL_BYTES);
  };

  const tapTile = async (pos: Vec2) => {
    await settleLayout(page);
    const point = await paintedTileCentre(page, pos);
    const box = await page.locator('.map-canvas').boundingBox();
    if (
      !point ||
      !box ||
      point.x < box.x ||
      point.x > box.x + box.width ||
      point.y < box.y ||
      point.y > box.y + box.height
    ) {
      throw new Error(
        `Tile is outside the current game camera: ${JSON.stringify({ pos, point, box })}`,
      );
    }
    if (info.project.use.hasTouch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  };

  const walk = async (to: Vec2, expectedMap?: string, expectedNode?: string, during?: string) => {
    const original = await state();
    if (!original) throw new Error('No state before walk');
    for (let leg = 0; leg < 16; leg++) {
      const current = await state();
      if (!current) throw new Error('State disappeared while walking');
      if (expectedMap && current.location.mapId === expectedMap) return;
      if (expectedNode && current.story.nodeId === expectedNode) return;
      if (current.location.pos.x === to.x && current.location.pos.y === to.y) return;
      await settleLayout(page);
      const from = current.location.pos;
      const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      let pick: Vec2 | null = null;
      const box = await page.locator('.map-canvas').boundingBox();
      for (let k = steps; k >= 1; k--) {
        const candidate = {
          x: Math.round(from.x + ((to.x - from.x) * k) / steps),
          y: Math.round(from.y + ((to.y - from.y) * k) / steps),
        };
        const point = await paintedTileCentre(page, candidate);
        if (
          point &&
          box &&
          point.x > box.x + 40 &&
          point.x < box.x + box.width - 40 &&
          point.y > box.y + 40 &&
          point.y < box.y + box.height - 40
        ) {
          pick = candidate;
          break;
        }
      }
      if (!pick) throw new Error(`No visible walking leg toward ${JSON.stringify(to)}`);
      await tapTile(pick);
      if (during && leg === 0) await beat(during, 'Sampled during native walking playback');
      await waitForIdle(page);
      await expect
        .poll(async () => {
          const next = await state();
          return Boolean(
            next &&
            ((next.location.pos.x === pick.x && next.location.pos.y === pick.y) ||
              next.story.nodeId !== current.story.nodeId ||
              next.location.mapId !== current.location.mapId),
          );
        })
        .toBe(true);
    }
    throw new Error(`Walking leg limit reached toward ${JSON.stringify(to)}`);
  };

  const readThrough = async (targetNode: string) => {
    for (let line = 0; line < 40; line++) {
      const current = await state();
      if (current?.pendingChoices.length) {
        await page
          .getByRole('button', { name: /^Learn / })
          .first()
          .click();
        continue;
      }
      if (current?.story.nodeId === targetNode) return;
      const next = page
        .locator('[data-conversation-control="next"]')
        .or(page.getByRole('button', { name: /^(Next|Continue|Done)$/ }))
        .first();
      await next.waitFor();
      await page.waitForTimeout(900);
      await next.click();
    }
    throw new Error(`Story control limit reached before ${targetNode}`);
  };

  const dispatch = async (command: Command) => {
    const result = await page.evaluate((command) => {
      const app = window.fnt!.app;
      const before = app.state;
      const events = app.dispatch(command);
      return { accepted: app.state !== before, events, rng: app.state?.rng };
    }, command);
    commands.push({ atMs: Date.now() - t0, command, ...result });
    save();
    expect(result.accepted, `Command refused: ${JSON.stringify(command)}`).toBe(true);
    await waitForIdle(page);
  };

  try {
    expect(initial.revision).toBe(receipt.revision);
    expect(initial.headTree).toBe(receipt.headTree);
    expect(initial.sourceSha256, 'Review build must match current source bytes').toBe(
      receipt.sourceSha256,
    );
    expect(initial.buildSha256, 'Review build bytes must match receipt').toBe(receipt.buildSha256);
    expect(initial.helpersSha256).toBe(receipt.helpersSha256);
    expect(initial.harnessSha256).toBe(receipt.harnessSha256);
    await resetStorage(page, `?renderer=${renderer}`);
    const buildLabel = page.locator('[aria-label^="Game version"]');
    await expect(buildLabel).toHaveText(new RegExp(`build ${initial.revision.slice(0, 7)}$`));
    displayedBuild = await buildLabel.textContent();
    await startGame(page, ['Elias', 'Lorelai', 'Frehley'], ['kaya', 'sura', 'bo'], SEED, {
      reduceMotion: false,
    });
    stage = 'opening';
    await readThrough('village_explore');
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
    await beat('ba-dan-arrival');
    for (const pos of [
      { x: 7, y: 8 },
      { x: 11, y: 7 },
      { x: 15, y: 7 },
      { x: 19, y: 7 },
      { x: 22, y: 7 },
    ])
      await walk(pos);
    await beat('east-gate');
    await walk({ x: 23, y: 7 }, 'forest_road');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await settleLayout(page);
    await beat('forest-transition');
    await walk({ x: 3, y: 4 });
    await beat('forest-walk-west');
    await walk({ x: 5, y: 4 }, undefined, 'road_depart');
    await beat('road-depart');
    await readThrough('forest_explore');
    await walk({ x: 6, y: 4 }, undefined, undefined, 'forest-walking-east');
    await beat('forest-road');
    // A native continuous crop may use forest-road through ambush-opening.
    await walk({ x: 8, y: 4 }, undefined, 'battle_forest_road');
    await page.locator('.combat-scene').waitFor();
    await beat('ambush-opening');

    for (let turn = 0; turn < 160; turn++) {
      stage = `combat-party-turn-${turn + 1}`;
      if (!(await takeTurn(page))) break;
      await waitForIdle(page);
      if (turn < 3) await beat(`combat-turn-${turn + 1}-start`);
      for (let action = 0; action < 8; action++) {
        const current = await state();
        const battle = current?.battle;
        if (!current || !battle || battle.phase !== 'active') break;
        const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
        if (!actor || actor.faction !== 'party') break;
        const draft = new BattleDraft(CONTENT, battle, new RngCursor(current.rng));
        // This profile affects the throwaway recommendation only, never live state.
        draft.replace({
          ...actor,
          ai:
            actor.element === 'water'
              ? 'support'
              : actor.element === 'earth' || actor.element === 'air'
                ? 'cautious'
                : 'aggressive',
        });
        const plan = previewAiPlan(draft, actor.id);
        if (plan) {
          await dispatch({
            type: 'useAbility',
            unitId: actor.id,
            abilityId: plan.ability.id,
            target: plan.target,
          });
          continue;
        }
        const enemies = battle.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0);
        const nearest = (pos: Vec2) =>
          Math.min(...enemies.map((enemy) => distance(pos, enemy.pos)));
        const candidates = [
          ...reachable(draft.moveContext(actor), actor.pos, actor.move).values(),
        ].filter((cell) => cell.path.length > 0 && nearest(cell.pos) < nearest(actor.pos));
        const unharmed = candidates.filter(
          (cell) => contactEffects(CONTENT, draft.grid, cell.pos).damage <= 0,
        );
        const step = (unharmed.length ? unharmed : candidates).sort(
          (a, b) => nearest(a.pos) - nearest(b.pos) || a.cost - b.cost,
        )[0];
        if (!step) break;
        await dispatch({ type: 'move', unitId: actor.id, path: step.path });
      }
      if (turn < 3) await beat(`combat-turn-${turn + 1}-acted`);
      const battle = (await state())?.battle;
      const actor = battle?.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
      if (battle?.phase === 'active' && actor?.faction === 'party') {
        await dispatch({ type: 'endTurn', unitId: actor.id });
      }
    }
    expect((await state())?.battle?.phase, 'Unstaged encounter must actually be won').toBe(
      'victory',
    );
    await beat('fight-end');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await readThrough('forest_after_explore');
    await waitForIdle(page);
    await beat('after-the-road');
    for (const pos of [
      { x: 10, y: 4 },
      { x: 14, y: 4 },
      { x: 18, y: 4 },
    ])
      await walk(pos);
    await beat('quarry-gate-approach');
    await walk({ x: 19, y: 4 }, 'quarry_gate');
    await settleLayout(page);
    await beat('quarry-gate-arrival');
    finalProvenance = fingerprint();
    expect(finalProvenance.sourceSha256).toBe(initial.sourceSha256);
    expect(finalProvenance.buildSha256).toBe(initial.buildSha256);
    expect(finalProvenance.headTree).toBe(initial.headTree);
    expect(finalProvenance.helpersSha256).toBe(initial.helpersSha256);
    expect(finalProvenance.harnessSha256).toBe(initial.harnessSha256);
    expect(errors, 'Runtime page/console errors').toEqual([]);
    outcome = 'passed';
  } catch (error) {
    outcome = 'failed';
    failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
    throw error;
  } finally {
    save();
    await info.attach('forest-road-audit', {
      path: `${folder}/beats.json`,
      contentType: 'application/json',
    });
  }
});
