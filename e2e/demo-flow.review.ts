/**
 * The demo played as one flow, recorded for review: the title, the real party
 * setup, the opening, Ba Dan, the bending practice, Elder Mira, the east road,
 * the forest walk and the ambush, a few turns including a fire bend that
 * breaks the oil flask, then through the quarry gate, custody choice, cutting,
 * Driller, outcome and homecoming in Ba Dan.
 *
 * Exploration and story use real mouse or touch input. Battle commands use
 * the visible controls and legal planner moves. If a review battle runs long,
 * the remaining enemies are staged at 1 HP after a recorded number of party
 * turns so the route can continue. That is progression evidence, not a balance
 * playthrough.
 *
 * For the project it runs as (playwright.demo-flow.config.ts), it writes under
 * FNT_FLOW_DIR (default .shots/demo-flow/<label>/<custody>/<project>):
 * - NN-<beat>.png: a full-page still at each beat;
 * - beats.json: UTC and elapsed clock times, the visible title build label,
 *   full source revision, route seed, page state, input trace, any staged
 *   shortcut, and page errors for every beat.
 * Playwright records the run as video; scripts/review/flow-mp4.sh turns the
 * webm into an mp4.
 *
 * Local review fixture only: not a CI check.
 *
 * FNT_FLOW_LABEL=review FNT_FLOW_CUSTODY=trade npx playwright test -c playwright.demo-flow.config.ts --project desktop-canvas
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { distance, reachable } from '../src/core/rules/grid';
import { previewAiPlan } from '../src/core/rules/ai';
import { contactEffects } from '../src/core/rules/surfaces';
import { BattleDraft } from '../src/core/state/battleDraft';
import { visibleNpcs } from '../src/core/story/world';
import type { BattleState, Unit, Vec2 } from '../src/core/types';
import { previewWalk } from '../src/app/world/walking';
import { paintedTileCentre } from './projection';
import { settleLayout, waitForIdle } from './helpers';

type Custody = 'trade' | 'escort';

const requestedCustody = process.env.FNT_FLOW_CUSTODY ?? 'trade';
if (requestedCustody !== 'trade' && requestedCustody !== 'escort') {
  throw new Error('FNT_FLOW_CUSTODY must be either trade or escort.');
}
const CUSTODY: Custody = requestedCustody;
const SEED =
  process.env.FNT_FLOW_SEED ??
  (CUSTODY === 'trade' ? 'quarry-return-trade-route' : 'quarry-return-escort');

const PARTY = [
  { player: 'Kaya', element: 'fire', name: 'Kaya' },
  { player: 'Nilak', element: 'water', name: 'Nilak' },
  { player: 'Bo', element: 'earth', name: 'Bo' },
] as const;

/** The oil flask on the forest road (src/content/maps/combat.ts). */
const FLASK = { x: 13, y: 6 } as const;

interface Beat {
  readonly index: number;
  readonly name: string;
  readonly atMs: number;
  readonly clockUtc: string;
  readonly still: string;
  readonly tilePx: number | null;
  readonly mapId: string | null;
  readonly storyNodeId: string | null;
  readonly encounterId: string | null;
  readonly encounterPhase: string | null;
  readonly round: number | null;
  readonly sourceCommit: string;
  readonly buildLabel: string | null;
  readonly note?: string;
}

interface TraceEntry {
  readonly atMs: number;
  readonly clockUtc: string;
  readonly kind: string;
  readonly target: string;
  readonly detail?: unknown;
}

interface Shortcut {
  readonly encounterId: string;
  readonly afterPartyActivations: number;
  readonly atMs: number;
  readonly clockUtc: string;
  readonly method: 'stage-living-enemies-to-1-hp';
  readonly reason: string;
}

test(`the demo, played through (${CUSTODY})`, async ({ page }, info) => {
  const t0 = Date.now();
  const startedAtUtc = new Date().toISOString();
  const renderer = String(info.project.metadata.renderer ?? 'canvas');
  const label = process.env.FNT_FLOW_LABEL ?? 'current';
  const folder = `${process.env.FNT_FLOW_DIR ?? '.shots/demo-flow'}/${label}/${CUSTODY}/${info.project.name}`;
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const packageVersion = (
    JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], { encoding: 'utf8' })) as {
      version: string;
    }
  ).version;
  const trackedChanges = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    encoding: 'utf8',
  }).trim();
  const sourceBranch = execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
  }).trim();
  const sourceDirtyPaths = execFileSync('git', ['status', '--short', '--untracked-files=all'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text());
  });
  const beats: Beat[] = [];
  const trace: TraceEntry[] = [];
  const shortcuts: Shortcut[] = [];
  const slow = renderer === 'webgl';
  let titleBuildLabel: string | null = null;
  let titleBuildText: string | null = null;

  const elapsedMs = () => Date.now() - t0;
  const recordInput = (kind: string, target: string, detail?: unknown) => {
    trace.push({
      atMs: elapsedMs(),
      clockUtc: new Date().toISOString(),
      kind,
      target,
      ...(detail === undefined ? {} : { detail }),
    });
    save();
  };

  const save = () =>
    writeFileSync(
      `${folder}/beats.json`,
      JSON.stringify(
        {
          schemaVersion: 2,
          label,
          custody: CUSTODY,
          seed: SEED,
          project: info.project.name,
          renderer,
          startedAtUtc,
          source: {
            commit: sourceCommit,
            branch: sourceBranch,
            dirtyPaths: sourceDirtyPaths,
            titleBuildLabel,
            titleBuildText,
          },
          viewport: page.viewportSize(),
          dpr: info.project.use.deviceScaleFactor ?? 1,
          beats,
          trace,
          shortcuts,
          errors,
        },
        null,
        2,
      ),
    );

  /** Marks a beat: timestamp it on the recording and take a full-page still. */
  const beat = async (name: string, note?: string) => {
    if (name === 'title') {
      const title = page.locator('.title-fineprint [aria-label^="Game version"]');
      titleBuildLabel = await title.getAttribute('aria-label');
      titleBuildText = (await title.textContent())?.trim() ?? null;
      if (!titleBuildLabel || !titleBuildText) {
        throw new Error('The title screen is missing its visible game build label.');
      }
      const expectedBuild = `${sourceCommit.slice(0, 7)}${trackedChanges ? '-modified' : ''}`;
      const expectedLabel = `Game version ${packageVersion}, build ${expectedBuild}`;
      const expectedText = `v${packageVersion} · build ${expectedBuild}`;
      if (titleBuildLabel !== expectedLabel || titleBuildText !== expectedText) {
        throw new Error(
          `The title build does not match this source: expected ${JSON.stringify({ expectedLabel, expectedText })}; received ${JSON.stringify({ titleBuildLabel, titleBuildText })}.`,
        );
      }
    }
    const atMs = elapsedMs();
    const clockUtc = new Date().toISOString();
    const index = beats.length + 1;
    const still = `${String(index).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: `${folder}/${still}` });
    const frame = await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      return {
        tilePx: app?.rendererCamera()?.tilePx ?? null,
        mapId: state?.location.mapId ?? null,
        storyNodeId: state?.story.nodeId ?? null,
        encounterId: state?.battle?.encounterId ?? null,
        encounterPhase: state?.battle?.phase ?? null,
        round: state?.battle?.round ?? null,
      };
    });
    beats.push({
      index,
      name,
      atMs,
      clockUtc,
      still,
      ...frame,
      sourceCommit,
      buildLabel: titleBuildLabel,
      ...(note ? { note } : {}),
    });
    save();
  };

  /** Waits until the swapped scene is visible before taking a review still. */
  const settleCurtain = async () => {
    await page.waitForFunction(
      () => {
        const curtain = document.querySelector<HTMLElement>('.curtain');
        return (
          curtain !== null &&
          !curtain.classList.contains('is-down') &&
          !curtain.classList.contains('is-lifting') &&
          Number.parseFloat(getComputedStyle(curtain).opacity) === 0
        );
      },
      undefined,
      { timeout: slow ? 120_000 : 30_000, polling: 250 },
    );
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
  };

  /** A visible control is activated by a mouse click or a touch tap. */
  const tapButton = async (target: Locator) => {
    const viewport = page.viewportSize();
    let box = await target.boundingBox();
    const outsideViewport =
      !box ||
      !viewport ||
      box.x < 0 ||
      box.y < 0 ||
      box.x + box.width > viewport.width ||
      box.y + box.height > viewport.height;
    if (outsideViewport) {
      await target.scrollIntoViewIfNeeded({ timeout: 5_000 });
      box = await target.boundingBox();
    }
    if (!box) throw new Error(`Could not find a visible tap target: ${target}`);
    const text = (await target.getAttribute('aria-label')) ?? (await target.innerText()).trim();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const hitTest = await target.evaluate((element, tapPoint) => {
      const hit = document.elementFromPoint(tapPoint.x, tapPoint.y);
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        inViewport:
          rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          Number(style.opacity) > 0,
        receivesTap: Boolean(hit && (hit === element || element.contains(hit))),
        hitTag: hit?.tagName ?? null,
        hitLabel: hit?.getAttribute('aria-label') ?? hit?.textContent?.trim().slice(0, 80) ?? null,
      };
    }, point);
    if (!hitTest.inViewport || !hitTest.visible || !hitTest.receivesTap) {
      throw new Error(
        `Tap target is not visible and hit-testable at its center: ${JSON.stringify({ text, point, hitTest })}`,
      );
    }
    const kind = info.project.use.hasTouch ? 'touch-tap' : 'mouse-click';
    recordInput(kind, text || target.toString(), { ...point, hitTest });
    if (info.project.use.hasTouch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  };

  /** Opens a compact view menu only when the requested control is folded. */
  const ensureViewControlVisible = async (target: Locator) => {
    if (await target.isVisible().catch(() => false)) return;
    const more = page.getByRole('button', { name: 'More', exact: true });
    await expect(more).toBeVisible({ timeout: slow ? 60_000 : 15_000 });
    await tapButton(more);
    await expect(target).toBeVisible({ timeout: slow ? 60_000 : 15_000 });
  };

  /** A tap where a player would put a finger: the tile's painted centre. */
  const tapTile = async (pos: Vec2) => {
    const canvas = page.locator('.map-canvas');
    let point = await paintedTileCentre(page, pos);
    if (!point) throw new Error('no camera');
    // Portrait combat can fit the acting unit while a legal target sits beyond
    // the canvas. Zoom out with the ordinary wheel gesture, then reproject the
    // tile: a coordinate computed before the zoom is no longer its screen tap.
    for (let zoom = 0; zoom < 8; zoom++) {
      await settleLayout(page, slow ? 120_000 : 30_000);
      point = await paintedTileCentre(page, pos);
      const box = await canvas.boundingBox();
      const viewport = page.viewportSize();
      if (!point || !box || !viewport) throw new Error('The map camera is unavailable.');
      const left = Math.max(box.x + 36, 36);
      const right = Math.min(box.x + box.width - 36, viewport.width - 36);
      const top = Math.max(box.y + 36, 36);
      const bottom = Math.min(box.y + box.height - 36, viewport.height - 36);
      if (left >= right || top >= bottom) throw new Error('The map has no tappable viewport.');
      const receivesTap = await canvas.evaluate((element, target) => {
        return document.elementFromPoint(target.x, target.y) === element;
      }, point);
      if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom && receivesTap)
        break;
      const centre = { x: (left + right) / 2, y: (top + bottom) / 2 };
      const wheelHitsCanvas = await canvas.evaluate(
        (element, at) => document.elementFromPoint(at.x, at.y) === element,
        centre,
      );
      if (!wheelHitsCanvas) {
        throw new Error(
          `The visible canvas is blocked before zooming toward ${JSON.stringify(pos)}.`,
        );
      }
      recordInput('mouse-wheel-zoom-out', 'map-canvas', { tile: pos, at: centre, deltaY: 160 });
      await page.mouse.move(centre.x, centre.y);
      await page.mouse.wheel(0, 160);
    }
    await settleLayout(page, slow ? 120_000 : 30_000);
    point = await paintedTileCentre(page, pos);
    if (!point) throw new Error('no camera');
    const hitTest = await canvas.evaluate((canvas, tapPoint) => {
      const rect = canvas.getBoundingClientRect();
      const hit = document.elementFromPoint(tapPoint.x, tapPoint.y);
      return {
        inCanvas:
          tapPoint.x >= rect.left &&
          tapPoint.x <= rect.right &&
          tapPoint.y >= rect.top &&
          tapPoint.y <= rect.bottom,
        inViewport:
          tapPoint.x >= 0 &&
          tapPoint.x <= innerWidth &&
          tapPoint.y >= 0 &&
          tapPoint.y <= innerHeight,
        receivesTap: hit === canvas,
        hitTag: hit?.tagName ?? null,
        hitClass: hit instanceof HTMLElement ? hit.className : null,
      };
    }, point);
    if (!hitTest.inCanvas || !hitTest.inViewport || !hitTest.receivesTap) {
      throw new Error(
        `Map tile tap is not visible and hit-testable: ${JSON.stringify({ tile: pos, point, hitTest })}`,
      );
    }
    recordInput(info.project.use.hasTouch ? 'touch-tile' : 'mouse-tile', 'map-canvas', {
      tile: pos,
      point,
      hitTest,
    });
    if (info.project.use.hasTouch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  };

  const nodeId = () => page.evaluate(() => window.fnt?.app.state?.story.nodeId ?? null);

  /** Walks by tapping, one leg at a time, and waits for the party to stop. */
  const walk = async (to: Vec2) => {
    const initialMapId = await page.evaluate(() => window.fnt!.app.state!.location.mapId);
    for (let leg = 0; leg < 24; leg++) {
      await settleCurtain();
      const before = await page.evaluate(() => window.fnt!.app.state!);
      if (before.screen !== 'explore') return;
      const from = before.location.pos;
      if (from.x === to.x && from.y === to.y) break;
      const plan = previewWalk(CONTENT, before, to);
      if (plan.refusal) {
        throw new Error(`The legal walk to ${JSON.stringify(to)} was refused: ${plan.refusal}`);
      }
      if (!plan.path.length) {
        const map = CONTENT.maps.get(before.location.mapId);
        const npc = map
          ? visibleNpcs(CONTENT, map, before).find(
              (candidate) => candidate.pos.x === to.x && candidate.pos.y === to.y,
            )
          : undefined;
        if (!npc) {
          throw new Error(
            `The legal walk from ${JSON.stringify(from)} to ${JSON.stringify(to)} has no path.`,
          );
        }
        recordInput('visible-npc-tile', npc.id, { name: npc.name, tile: to });
        await tapTile(to);
        await waitForIdle(page, slow ? 240_000 : 30_000);
        const after = await page.evaluate(() => window.fnt!.app.state!);
        if (after.screen !== 'explore' || after.story.nodeId !== before.story.nodeId) return;
        throw new Error(
          `Tapping ${npc.name} at ${JSON.stringify(to)} did not open the conversation.`,
        );
      }

      // Tap the furthest visible tile in the reducer's legal walk path.
      await settleLayout(page, slow ? 120_000 : 30_000);
      let pick = plan.path.at(-1);
      for (let k = plan.path.length - 1; k >= 0; k--) {
        const p = plan.path[k];
        if (!p) continue;
        const pt = await paintedTileCentre(page, p);
        const box = await page.locator('.map-canvas').boundingBox();
        if (
          pt &&
          box &&
          pt.x > box.x + 60 &&
          pt.x < box.x + box.width - 60 &&
          pt.y > box.y + 60 &&
          pt.y < box.y + box.height - 60
        ) {
          pick = p;
          break;
        }
      }
      if (!pick) throw new Error(`No visible tile in the legal path to ${JSON.stringify(to)}.`);
      recordInput('walk-plan', 'walkTo', {
        from,
        destination: to,
        visibleTarget: pick,
        path: plan.path,
        label: plan.label,
      });
      await tapTile(pick);
      await waitForIdle(page, slow ? 240_000 : 30_000);
      // The animator can be idle one frame before ExploreScene clears its
      // visible “Following the path” status. Wait for that scene update before
      // sending the next real tile tap.
      await expect(page.locator('.walk-feedback')).toBeHidden({
        timeout: slow ? 120_000 : 30_000,
      });
      const after = await page.evaluate(() => window.fnt!.app.state!);
      if (after.screen !== 'explore' || after.location.mapId !== before.location.mapId) return;
      if (
        after.location.pos.x === from.x &&
        after.location.pos.y === from.y &&
        after.story.nodeId === before.story.nodeId
      ) {
        throw new Error(
          `A legal tile tap toward ${JSON.stringify(to)} did not move the party from ${JSON.stringify(from)}.`,
        );
      }
    }
    const after = await page.evaluate(() => window.fnt!.app.state!);
    if (after.screen === 'explore' && after.location.mapId === initialMapId) {
      expect(after.location.pos).toEqual(to);
    }
  };

  /** Reads a conversation through at a reading pace, one tap a line. */
  const readThrough = async (beatName?: string, captureEveryLine = false) => {
    const next = page
      .locator('[data-conversation-control="next"], [data-interlude-control="next"]')
      .or(page.getByRole('button', { name: /^(Next|Continue|Done)$/ }))
      .first();
    await next.waitFor({ timeout: 30_000 });
    await settleCurtain();
    let first = true;
    let interludeFrame = 0;
    const startingNode = await nodeId();
    for (let i = 0; i < 12; i++) {
      if (!(await next.isVisible().catch(() => false))) break;
      await page.waitForTimeout(1200);
      const frame = await page.evaluate(() => ({
        nodeId: window.fnt?.app.state?.story.nodeId ?? 'story',
        lineIndex: window.fnt?.app.state?.story.lineIndex ?? 0,
      }));
      const interludeId = await page.evaluate(
        () => document.querySelector('.interlude-stage')?.getAttribute('data-interlude') ?? null,
      );
      if (first && beatName) await beat(beatName);
      else if (interludeId) await beat(`${frame.nodeId}-frame-${++interludeFrame}`);
      else if (captureEveryLine) {
        await beat(`${beatName ?? frame.nodeId}-line-${frame.lineIndex + 1}`);
      }
      first = false;
      await tapButton(next);
      await page.waitForTimeout(300);
      if ((await nodeId()) !== startingNode) break;
    }
  };

  /** Resolve authored story through visible choices and one tap per line. */
  const continueStory = async () => {
    for (let step = 0; step < 100; step++) {
      const state = await page.evaluate(() => window.fnt?.app.state);
      if (!state) throw new Error('Story state disappeared during the review flow.');

      if (state.pendingChoices.length) {
        const learn = page.getByRole('button', { name: /^Learn / }).first();
        await expect(learn).toBeVisible();
        if (!beats.some((item) => item.name === 'level-up-choice')) {
          await beat('level-up-choice');
        }
        await tapButton(learn);
        continue;
      }
      const continueExploring = page.getByRole('button', {
        name: 'Continue exploring',
        exact: true,
      });
      if (await continueExploring.isVisible().catch(() => false)) {
        await beat('driller-ending-summary');
        await tapButton(continueExploring);
        continue;
      }
      if (state.screen === 'ended') {
        const interlude = page.locator('.interlude-stage');
        if (await interlude.isVisible().catch(() => false)) {
          // The canonical ending keeps `screen === 'ended'` while its five
          // authored outcome frames play. Finish those visible beats before
          // checking for the westward exploration objective.
          await readThrough(
            state.story.nodeId === 'act1_epilogue' ? 'driller-outcome' : undefined,
            true,
          );
          continue;
        }
        return;
      }
      if (state.screen !== 'dialogue') {
        if (state.screen === 'explore') await settleCurtain();
        return;
      }

      if (state.story.nodeId === 'gate_parley') {
        await beat('quarry-gate-parley');
        // Bo knows the galleries from the inside, so Ruon lowers the slings.
        await tapButton(page.locator('.choice-option').nth(2));
        continue;
      }
      if (state.story.nodeId === 'ruon_choice') {
        await beat('ruon-custody-choice', `Recorded route: ${CUSTODY}.`);
        await tapButton(page.locator('.choice-option').nth(CUSTODY === 'trade' ? 1 : 0));
        continue;
      }

      const options = page.locator('.choice-option');
      if (await options.count()) {
        const node = state.story.nodeId;
        await beat(`story-choice-${node}`);
        await tapButton(page.locator('.choice-option:not(.is-locked)').first());
        continue;
      }

      const storyNodeId = state.story.nodeId;
      const beatName = storyNodeId
        ? {
            act1_open: 'opening',
            mira_intro: 'mira-conversation',
            gate_kinship: 'ruon-opens-the-gate',
            ruon_surrender: 'ruon-surrenders',
            escort_chosen: 'escort-branch',
            trade_chosen: 'trade-branch',
            after_ambush: 'cutting-after-ambush',
            quarry_descent: 'driller-descent',
            quarry_assessment: 'driller-threat',
            act1_epilogue: 'driller-outcome',
            forest_return_arrival: 'west-road-return',
            dorin_home: 'dorin-homecoming',
            mira_epilogue: 'mira-homecoming',
            gao_home: 'gao-homecoming',
            gao_home_cold: 'gao-trade-consequence',
          }[storyNodeId]
        : undefined;
      const captureEveryLine = new Set([
        'ruon_surrender',
        'escort_chosen',
        'trade_chosen',
        'quarry_descent',
        'quarry_assessment',
        'forest_return_arrival',
        'dorin_home',
        'mira_epilogue',
        'gao_home',
        'gao_home_cold',
      ]).has(storyNodeId ?? '');
      await readThrough(beatName, captureEveryLine);
    }
    throw new Error('Story did not return to exploration after 100 legal taps.');
  };

  /** Travels by opening the visible route map and selecting its authored exit. */
  const takeRoute = async (label: string, mapId: string, beatName: string) => {
    await tapButton(page.getByRole('button', { name: 'Map', exact: true }));
    const exit = page.getByRole('button', { name: label, exact: true });
    await expect(exit).toBeVisible();
    await tapButton(exit);
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId), {
        timeout: slow ? 120_000 : 60_000,
      })
      .toBe(mapId);
    await waitForIdle(page, slow ? 240_000 : 30_000);
    await settleCurtain();
    await beat(beatName);
  };

  // --------------------------------------------------------- Title and setup
  await page.goto(`/?renderer=${renderer}`);
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* nothing to clear */
    }
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fnt?.app));
  await page.evaluate((seed) => {
    const app = window.fnt!.app;
    const newGame = app.newGame.bind(app);
    app.newGame = (players, slots) => newGame(players, slots, seed);
  }, SEED);
  recordInput('seed-injection', 'app.newGame', SEED);
  await page.waitForTimeout(1500);
  await beat('title');

  await tapButton(page.getByRole('button', { name: /new game/i }));
  await page.waitForTimeout(600);
  await tapButton(page.getByRole('button', { name: '3 players' }));
  await beat('setup-players');
  await tapButton(page.getByRole('button', { name: /^Continue$/ }));
  for (const [i, member] of PARTY.entries()) {
    const ready = page.getByRole('button', { name: /I've got it/i });
    if (await ready.count()) {
      if (i === 0) await beat('setup-handoff');
      await tapButton(ready);
    }
    const nameInput = page.locator('input[type=text]');
    await nameInput.fill(member.player);
    recordInput('fill-player-name', 'player-name-input', member.player);
    await tapButton(page.getByRole('button', { name: /^Next$/ }));
    await tapButton(page.locator(`.pick-card.element-${member.element}`).first());
    if (i === 0) await beat('setup-element');
    await tapButton(page.getByRole('button', { name: /^Next$/ }));
    await tapButton(page.locator('.character-card').filter({ hasText: member.name }).first());
    if (i === 0) await beat('setup-character');
    await tapButton(page.getByRole('button', { name: /^Confirm$/ }));
  }
  await expect(page.getByRole('heading', { name: /the party/i })).toBeVisible();
  await beat('setup-party');
  await tapButton(page.getByRole('button', { name: /^Begin$/ }));

  // ------------------------------------------------------------- The opening
  await continueStory();
  await expect.poll(nodeId, { timeout: 30_000 }).toBe('village_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(page, slow ? 120_000 : 30_000);
  expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
  await page.waitForTimeout(1500);
  await beat('ba-dan-arrival');

  // ---------------------------------------------------- The bending practice
  await walk({ x: 7, y: 8 });
  await beat('ba-dan-road');
  await walk({ x: 10, y: 8 });
  const practise = page.getByRole('button', { name: /^Practice/ });
  await expect(practise).toBeEnabled({ timeout: slow ? 240_000 : 60_000 });
  await beat('practice-ready');
  await tapButton(practise);
  await page.waitForTimeout(slow ? 3000 : 900);
  await beat('practice-bending');
  await waitForIdle(page, slow ? 240_000 : 30_000);
  await page.waitForTimeout(600);
  await beat('practice-done');

  // ---------------------------------------------------------- Elder Mira
  await walk({ x: 11, y: 7 });
  const talk = page.getByRole('button', { name: /^Talk/ });
  await expect(talk).toBeEnabled({ timeout: 30_000 });
  await beat('mira-talk-cue');
  await tapButton(talk);
  await expect.poll(nodeId, { timeout: 60_000 }).toBe('mira_intro');
  await readThrough('mira-conversation');
  await expect.poll(nodeId, { timeout: 30_000 }).toBe('village_explore');
  await waitForIdle(page, slow ? 240_000 : 30_000);
  await beat('after-mira');

  // ------------------------------------------------------------ The east road
  await walk({ x: 15, y: 7 });
  await walk({ x: 19, y: 7 });
  await walk({ x: 22, y: 7 });
  await beat('east-gate');
  await tapTile({ x: 23, y: 7 });
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId), { timeout: 60_000 })
    .toBe('forest_road');
  await page.waitForTimeout(400);
  await beat('forest-transition');
  // Preserve the immediate transition frame above; resume map taps only after
  // the new road's first frame and camera fit are visible.
  await settleCurtain();

  // The pine road: a crossing at (4,4) tells the road, the ambush at (8,4).
  for (const leg of [
    { x: 3, y: 5 },
    { x: 5, y: 4 },
  ]) {
    await tapTile(leg);
    await page.waitForTimeout(800);
    if ((await nodeId()) === 'road_depart') {
      await readThrough('road-depart');
    }
    await waitForIdle(page, slow ? 240_000 : 30_000);
  }
  await beat('forest-road');
  // The ambush fires on the crossing at x 8, a few tiles on.
  await walk({ x: 8, y: 4 });
  await expect
    .poll(() => page.evaluate(() => Boolean(window.fnt?.app.state?.battle)), {
      timeout: 60_000,
    })
    .toBe(true);
  await page.waitForTimeout(300);
  await beat('ambush-opening');

  // ------------------------------------------------------------- The fight
  const battle = () =>
    page.evaluate(() => ({
      battle: window.fnt?.app.state?.battle ?? null,
      rng: window.fnt?.app.state?.rng ?? 0,
    })) as Promise<{ battle: BattleState | null; rng: number }>;

  /** Waits for a party turn, clears its hand-off; false once the fight is over. */
  const partyTurn = async (): Promise<Unit | null> => {
    const result = await page.waitForFunction(
      () => {
        const b = window.fnt?.app.state?.battle;
        if (!b || b.phase !== 'active') return 'over';
        const unit = b.units.find((u) => u.id === b.order[b.turnIndex]);
        return unit?.faction === 'party' ? 'ready' : false;
      },
      undefined,
      { timeout: slow ? 300_000 : 60_000, polling: 200 },
    );
    if ((await result.jsonValue()) === 'over') return null;
    await page.waitForFunction(
      () => !document.querySelector('.combat-scene[data-battle-opening]'),
      undefined,
      { timeout: slow ? 300_000 : 60_000 },
    );
    const ready = page.getByRole('button', { name: /I'm ready/i });
    const requiresHandoff = await page.evaluate(() => window.fnt?.app.session.solo === false);
    if (requiresHandoff) {
      // The opening marker clears one frame before the hand-off banner is
      // rebuilt. Wait for the real control instead of racing a synchronous
      // count against the next HUD render.
      await expect(ready).toBeVisible({ timeout: slow ? 120_000 : 30_000 });
      if (!beats.some((b) => b.name === 'combat-handoff')) await beat('combat-handoff');
      await tapButton(ready);
      await expect(ready).toBeHidden({ timeout: slow ? 30_000 : 10_000 });
    }
    await waitForIdle(page, slow ? 300_000 : 30_000);
    const { battle: b } = await battle();
    return b?.units.find((u) => u.id === b.order[b.turnIndex]) ?? null;
  };

  /** Confirms; `midStill` names a still taken while the action plays. */
  const confirm = async (midStill?: string) => {
    const button = page.locator('.confirm-bar').getByRole('button', { name: /^Confirm$/ });
    await expect(button).toBeEnabled({ timeout: 15_000 });
    await tapButton(button);
    if (midStill) {
      await page.waitForTimeout(slow ? 2500 : 700);
      await beat(midStill);
    }
    await waitForIdle(page, slow ? 300_000 : 30_000);
  };

  const showingEnemiesView = () =>
    page.evaluate(() => {
      const scene = (window.fnt!.app as unknown as { scene?: { showingEnemiesView?: boolean } })
        .scene;
      return scene?.showingEnemiesView ?? false;
    });

  /** Show the Driller and both living targets through the normal view controls. */
  const captureDrillerEnemyView = async () => {
    const showEnemies = page.getByRole('button', { name: 'Show enemies', exact: true });
    await ensureViewControlVisible(showEnemies);
    await tapButton(showEnemies);
    await expect.poll(showingEnemiesView, { timeout: slow ? 120_000 : 30_000 }).toBe(true);
    await settleLayout(page, slow ? 120_000 : 30_000);
    await beat(
      'driller-enemy-view',
      'Show enemies frames the live Driller; the next UI action restores the acting-unit view.',
    );

    const recentre = page.getByRole('button', { name: 'Recentre', exact: true });
    await ensureViewControlVisible(recentre);
    await tapButton(recentre);
    await expect.poll(showingEnemiesView, { timeout: slow ? 120_000 : 30_000 }).toBe(false);
    await waitForIdle(page, slow ? 300_000 : 30_000);
  };

  const dist = (a: Vec2, b: Vec2) => distance(a, b);

  /** Moves the acting unit to the reachable tile nearest `goal`, if it gets closer. */
  const moveToward = async (unit: Unit, goal: Vec2): Promise<boolean> => {
    const { battle: b, rng } = await battle();
    if (!b) return false;
    const draft = new BattleDraft(CONTENT, b, new RngCursor(rng));
    const self = draft.unit(unit.id);
    if (!self || self.ap < 1) return false;
    const cells = [...reachable(draft.moveContext(self), self.pos, self.move).values()].filter(
      (c) => !b.units.some((u) => u.hp > 0 && u.pos.x === c.pos.x && u.pos.y === c.pos.y),
    );
    const move = page.getByRole('button', { name: /^Move/ });
    if (!(await move.isEnabled({ timeout: 2_000 }))) return false;
    await tapButton(move);
    await settleLayout(page, slow ? 120_000 : 30_000);
    // The nearest tile to the goal that is on screen: a tap can only land there.
    const box = await page.locator('.map-canvas').boundingBox();
    let best: Vec2 | null = null;
    for (const cell of cells.sort((p, q) => dist(p.pos, goal) - dist(q.pos, goal))) {
      if (dist(cell.pos, goal) >= dist(self.pos, goal)) break;
      const pt = await paintedTileCentre(page, cell.pos);
      if (
        pt &&
        box &&
        pt.x > box.x + 30 &&
        pt.x < box.x + box.width - 30 &&
        pt.y > box.y + 30 &&
        pt.y < box.y + box.height - 30
      ) {
        best = cell.pos;
        break;
      }
    }
    const confirmButton = page.locator('.confirm-bar').getByRole('button', { name: /^Confirm$/ });
    if (best) await tapTile(best);
    if (
      !best ||
      !(await confirmButton
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => true)
        .catch(() => false))
    ) {
      const cancel = page.getByRole('button', { name: /Cancel$/ }).first();
      if (await cancel.isVisible().catch(() => false)) await tapButton(cancel);
      return false;
    }
    await confirm();
    return true;
  };

  /** Aims the named ability at a tile and confirms, if the button is live. */
  const useAt = async (ability: RegExp, target: Vec2, still?: string): Promise<boolean> => {
    recordInput('ability-intent', ability.source, target);
    const button = page.getByRole('button', { name: ability }).first();
    if (!(await button.count()) || !(await button.isEnabled({ timeout: 2_000 }))) return false;
    await tapButton(button);
    await tapTile(target);
    const bar = page.locator('.confirm-bar').getByRole('button', { name: /^Confirm$/ });
    await page.waitForTimeout(300);
    if (
      !(await bar.isVisible().catch(() => false)) ||
      !(await bar.isEnabled({ timeout: 2_000 }).catch(() => false))
    ) {
      const cancel = page.getByRole('button', { name: /Cancel$/ }).first();
      if (await cancel.isVisible().catch(() => false)) await tapButton(cancel);
      return false;
    }
    if (still) await beat(still);
    await confirm(still ? `${still.replace(/-aim$/, '')}-bend` : undefined);
    return true;
  };

  const nearestEnemy = async (from: Vec2): Promise<Unit | null> => {
    const { battle: b } = await battle();
    return (
      b?.units
        .filter((u) => u.faction === 'enemy' && u.hp > 0)
        .sort((p, q) => dist(p.pos, from) - dist(q.pos, from))[0] ?? null
    );
  };

  /**
   * Drive a route encounter with commands selected by the real planner and
   * dispatched through the reducer. Only a still-active fight is staged,
   * after at least three party activations have played.
   */
  const finishPlannedBattle = async (encounterId: string, beatPrefix: string) => {
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.battle?.encounterId), {
        timeout: slow ? 240_000 : 60_000,
      })
      .toBe(encounterId);
    await beat(`${beatPrefix}-opening`);

    let partyActivations = 0;
    let firstTurn = true;
    let shortcut = false;
    for (let guard = 0; guard < 240; guard++) {
      const unit = await partyTurn();
      if (!unit) break;
      if (firstTurn) {
        await beat(`${beatPrefix}-first-turn`);
        if (encounterId === 'enc_grumbler') await captureDrillerEnemyView();
        firstTurn = false;
      }

      const initial = (await battle()).battle;
      if (!initial) break;
      if (!shortcut && partyActivations >= 3) {
        const hasLivingEnemy = initial.units.some(
          (candidate) => candidate.faction === 'enemy' && candidate.hp > 0,
        );
        if (hasLivingEnemy) {
          const atMs = elapsedMs();
          const clockUtc = new Date().toISOString();
          const reason =
            'Three party activations completed; remaining enemy HP is staged to 1 for route continuity, then the real reducer resolves the fight.';
          shortcuts.push({
            encounterId,
            afterPartyActivations: partyActivations,
            atMs,
            clockUtc,
            method: 'stage-living-enemies-to-1-hp',
            reason,
          });
          recordInput('review-shortcut', encounterId, {
            afterPartyActivations: partyActivations,
            method: 'stage-living-enemies-to-1-hp',
            reason,
          });
          await page.evaluate(() => {
            const app = window.fnt!.app;
            const state = app.state!;
            const current = state.battle!;
            app.state = {
              ...state,
              battle: {
                ...current,
                units: current.units.map((candidate) =>
                  candidate.faction === 'enemy' && candidate.hp > 0
                    ? { ...candidate, hp: 1 }
                    : candidate,
                ),
              },
            };
            app.resync();
          });
          shortcut = true;
          await settleLayout(page, slow ? 120_000 : 30_000);
          await beat(`${beatPrefix}-shortcut`, reason);
        }
      }

      for (let action = 0; action < 8; action++) {
        const state = await page.evaluate(() => window.fnt?.app.state);
        const current = state?.battle;
        if (!state || !current || current.phase !== 'active') break;
        const unitId = current.order[current.turnIndex];
        const actor = current.units.find((candidate) => candidate.id === unitId);
        if (!actor || actor.faction !== 'party') break;

        const draft = new BattleDraft(CONTENT, current, new RngCursor(state.rng));
        const profile =
          actor.element === 'water'
            ? 'support'
            : actor.element === 'earth' || actor.element === 'air'
              ? 'cautious'
              : 'aggressive';
        draft.replace({ ...actor, ai: profile });
        const plan = previewAiPlan(draft, actor.id);

        if (plan) {
          const beforeAp = actor.ap;
          recordInput('planner-command', 'useAbility', {
            unitId: actor.id,
            abilityId: plan.ability.id,
            target: plan.target,
          });
          await page.evaluate(
            ({ id, abilityId, target }) =>
              window.fnt!.app.dispatch({ type: 'useAbility', unitId: id, abilityId, target }),
            { id: actor.id, abilityId: plan.ability.id, target: plan.target },
          );
          await waitForIdle(page, slow ? 240_000 : 30_000);
          const afterAp = await page.evaluate(
            (id) =>
              window.fnt?.app.state?.battle?.units.find((candidate) => candidate.id === id)?.ap,
            actor.id,
          );
          if (afterAp !== undefined && afterAp < beforeAp) continue;
        }

        const enemies = current.units.filter(
          (candidate) => candidate.faction === 'enemy' && candidate.hp > 0,
        );
        if (!enemies.length) break;
        const nearest = (pos: Vec2) =>
          Math.min(...enemies.map((enemy) => distance(pos, enemy.pos)));
        const candidates = [
          ...reachable(draft.moveContext(actor), actor.pos, actor.move).values(),
        ].filter((cell) => cell.path.length > 0 && nearest(cell.pos) < nearest(actor.pos));
        const safe = candidates.filter(
          (cell) => contactEffects(CONTENT, draft.grid, cell.pos).damage <= 0,
        );
        const step = (safe.length ? safe : candidates).sort(
          (a, b) => nearest(a.pos) - nearest(b.pos) || a.cost - b.cost,
        )[0];
        if (!step) break;

        recordInput('planner-command', 'move', {
          unitId: actor.id,
          path: step.path,
          destination: step.pos,
        });
        await page.evaluate(
          ({ id, path }) => window.fnt!.app.dispatch({ type: 'move', unitId: id, path }),
          { id: actor.id, path: step.path },
        );
        await waitForIdle(page, slow ? 240_000 : 30_000);
        const moved = await page.evaluate(
          (id) =>
            window.fnt?.app.state?.battle?.units.find((candidate) => candidate.id === id)?.pos,
          actor.id,
        );
        if (moved && (moved.x !== actor.pos.x || moved.y !== actor.pos.y)) continue;
        break;
      }

      await page.evaluate(() => {
        const app = window.fnt!.app;
        const current = app.state?.battle;
        if (!current || current.phase !== 'active') return;
        const unitId = current.order[current.turnIndex];
        const actor = current.units.find((candidate) => candidate.id === unitId);
        if (actor?.faction === 'party') {
          app.dispatch({ type: 'endTurn', unitId: actor.id });
        }
      });
      recordInput('planner-command', 'endTurn', { unitId: unit.id });
      partyActivations++;
      await waitForIdle(page, slow ? 240_000 : 30_000);
    }

    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.battle?.phase), {
        timeout: slow ? 240_000 : 60_000,
      })
      .toBe('victory');
    await page.waitForTimeout(900);
    await beat(
      `${beatPrefix}-victory`,
      shortcut ? 'The route fixture staged enemy HP after three party activations.' : undefined,
    );
    await tapButton(page.getByRole('button', { name: 'Continue', exact: true }));
  };

  const endTurn = async () => {
    recordInput('end-turn-intent', 'End turn');
    const end = page.getByRole('button', { name: /^End turn/ }).first();
    // With AP left the first tap only warns; a second tap ends the turn.
    for (let tap = 0; tap < 2; tap++) {
      const b = (await battle()).battle;
      const acting = b?.units.find((u) => u.id === b.order[b.turnIndex]);
      if (!b || b.phase !== 'active' || acting?.faction !== 'party') break;
      if (!(await end.isEnabled({ timeout: 2_000 }).catch(() => false))) break;
      if (tap === 1 && acting.id !== lastActing) break;
      lastActing = acting.id;
      await tapButton(end);
      await page.waitForTimeout(300);
    }
    await waitForIdle(page, slow ? 300_000 : 30_000);
  };
  let lastActing = '';

  let flaskBroken = false;
  let shortcut = false;
  let firstTurn = true;
  for (let turn = 0; turn < 40; turn++) {
    const unit = await partyTurn();
    if (!unit) break;
    if (firstTurn) {
      await beat('combat-first-turn');
      firstTurn = false;
    }
    recordInput('party-turn', unit.characterId ?? unit.id, { turn, pos: unit.pos });
    save();
    const isKaya = unit.characterId === 'kaya';
    if (!shortcut && ((flaskBroken && turn >= 3) || turn >= 12)) {
      // Keep several real party turns in the recording, then only shorten a
      // fight that is still active. The following attacks remain legal UI play.
      const current = (await battle()).battle;
      if (current) {
        const atMs = elapsedMs();
        const clockUtc = new Date().toISOString();
        const afterPartyActivations = turn;
        const reason = flaskBroken
          ? 'Three party activations followed the visible fire-on-oil turn; staged the remaining enemies to keep the route moving.'
          : 'Twelve party activations passed without reaching the oil-flask beat; staged the remaining enemies to keep the route moving.';
        shortcuts.push({
          encounterId: current.encounterId,
          afterPartyActivations,
          atMs,
          clockUtc,
          method: 'stage-living-enemies-to-1-hp',
          reason,
        });
        recordInput('review-shortcut', current.encounterId, {
          afterPartyActivations,
          method: 'stage-living-enemies-to-1-hp',
          reason,
        });
        shortcut = true;
        await page.evaluate(() => {
          const app = window.fnt!.app;
          const s = app.state!;
          const b = s.battle!;
          app.state = {
            ...s,
            battle: {
              ...b,
              units: b.units.map((u) => (u.faction === 'enemy' && u.hp > 0 ? { ...u, hp: 1 } : u)),
            },
          };
          app.resync();
        });
        await settleLayout(page, slow ? 120_000 : 30_000);
        await beat('forest-battle-shortcut', reason);
      }
    }
    if (isKaya && !flaskBroken) {
      flaskBroken = await useAt(/^Fire Jab/, FLASK, 'flask-aim');
      if (!flaskBroken) {
        for (let m = 0; m < 2 && !flaskBroken; m++) {
          const self = (await battle()).battle?.units.find((u) => u.id === unit.id);
          if (!self || !(await moveToward(self, FLASK))) break;
          flaskBroken = await useAt(/^Fire Jab/, FLASK, 'flask-aim');
        }
      }
      if (flaskBroken) {
        await page.waitForTimeout(500);
        await beat('flask-burning', 'Kaya walked into legal range before firing at the oil flask.');
      }
      await endTurn();
      continue;
    }
    // Everyone else throws their first bend at the nearest enemy, closing in first if need be.
    const first = CONTENT.abilities.get(unit.abilities[0] ?? '');
    const target = await nearestEnemy(unit.pos);
    if (first && target) {
      const name = new RegExp(`^${first.name}`);
      const still = beats.some((b) => b.name === 'attack-aim') ? undefined : 'attack-aim';
      if (dist(unit.pos, target.pos) > first.range) await moveToward(unit, target.pos);
      const hit = await useAt(name, target.pos, still);
      if (!hit && !beats.some((b) => b.name === 'combat-midfight')) await beat('combat-midfight');
    }
    if ((await battle()).battle?.phase === 'active') await endTurn();
  }

  await page.waitForTimeout(1200);
  await beat(
    'forest-battle-victory',
    shortcut
      ? 'The shortcut is recorded in beats.json; victory still used legal party attacks.'
      : undefined,
  );
  await tapButton(page.getByRole('button', { name: 'Continue', exact: true }));
  await continueStory();
  await page.waitForTimeout(900);
  await beat('after-the-road');

  // ------------------------------------------------------- The quarry gate
  await takeRoute('East → Quarry Gate', 'quarry_gate', 'quarry-gate-arrival');
  await beat('quarry-gate-approach');
  await walk({ x: 8, y: 5 });
  await expect.poll(nodeId, { timeout: 60_000 }).toBe('gate_parley');
  await continueStory();
  expect(await nodeId()).toMatch(/^gate_(?:escort|trade)_explore$/);
  await beat('quarry-gate-open', `Ruon opens the gate; custody outcome is ${CUSTODY}.`);

  // ------------------------------------------------------------- The cutting
  await takeRoute('East → The Cutting', 'ambush_road', 'cutting-arrival');
  if (CUSTODY === 'escort') {
    await walk({ x: 8, y: 4 });
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.battle?.encounterId), {
        timeout: 60_000,
      })
      .toBe('enc_ambush');
    await finishPlannedBattle('enc_ambush', 'cutting-escort-ambush');
    await continueStory();
  } else {
    await beat(
      'cutting-trade-passage',
      'Trading Ruon avoids the authored escort ambush on this leg.',
    );
  }

  // ------------------------------------------------------ The quarry floor
  await takeRoute('East → Quarry Floor', 'quarry_floor', 'quarry-floor-arrival');
  await beat('driller-approach');
  await walk({ x: 17, y: 5 });
  await expect.poll(nodeId, { timeout: 60_000 }).toBe('quarry_descent');
  await continueStory();
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.battle?.encounterId), {
      timeout: 60_000,
    })
    .toBe('enc_grumbler');
  await finishPlannedBattle('enc_grumbler', 'driller');
  await continueStory();
  expect(await page.evaluate(() => window.fnt?.app.state?.flags.act1_complete)).toBe(true);
  await expect(page.locator('.title-plate-objective')).toContainText('west');
  await beat('westward-homecoming-objective');

  // ----------------------------------------------------------- The return
  await takeRoute('West → The Cutting', 'ambush_road', 'cutting-return');
  await takeRoute('West → Quarry Gate', 'quarry_gate', 'quarry-gate-return');
  await takeRoute('West → Forest Road', 'forest_road', 'forest-road-return');
  await tapButton(page.getByRole('button', { name: 'Map', exact: true }));
  await tapButton(page.getByRole('button', { name: 'West → Ba Dan Village', exact: true }));
  await expect.poll(nodeId, { timeout: 60_000 }).toBe('forest_return_arrival');
  await continueStory();
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId), {
      timeout: 60_000,
    })
    .toBe('ba_dan_village');
  await beat('ba-dan-return', 'The group reaches Ba Dan; returnee profiles are now resting.');

  const dorin = CONTENT.anchors.get('bd03.handover')?.site;
  if (dorin?.kind !== 'map') throw new Error('Missing canonical Dorin handover anchor.');
  await walk(dorin.pos);
  await expect.poll(nodeId, { timeout: 60_000 }).toBe('dorin_home');
  await continueStory();

  await walk({ x: 11, y: 5 });
  await expect.poll(nodeId, { timeout: 60_000 }).toBe('mira_epilogue');
  await expect(page.locator('.dialogue-line')).toContainText('Bo-shan');
  await continueStory();

  const gao = CONTENT.anchors.get('bd02.shopfront')?.site;
  if (gao?.kind !== 'map') throw new Error('Missing canonical Gao shopfront anchor.');
  await walk(gao.pos);
  await expect
    .poll(nodeId, { timeout: 60_000 })
    .toBe(CUSTODY === 'trade' ? 'gao_home_cold' : 'gao_home');
  await continueStory();
  expect(
    await page.evaluate(
      (flag) => window.fnt?.app.state?.flags[flag],
      CUSTODY === 'trade' ? 'ruon_traded' : 'ruon_spared',
    ),
  ).toBe(true);
  expect(await page.evaluate(() => window.fnt?.app.state?.world.cleared)).toContain('enc_grumbler');
  await beat('ba-dan-custody-response', `Completed ${CUSTODY} return with the Driller cleared.`);
  save();
});
