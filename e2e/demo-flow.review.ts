/**
 * The demo played as one flow, recorded for review: the title, the real party
 * setup, the opening, Ba Dan, the bending practice, Elder Mira, the east road,
 * the forest walk and the ambush, a few turns including a fire bend that
 * breaks the oil flask, to the end of the fight and its aftermath.
 *
 * Every step is a real tap or button press on the page; the one shortcut is at
 * the end: after the flask turn, the remaining enemies are set to 1 HP so the
 * party finishes them with real attacks and the recording reaches the victory
 * without a dozen rounds. The provenance says when that happened.
 *
 * For the project it runs as (playwright.demo-flow.config.ts), it writes under
 * FNT_FLOW_DIR (default .shots/demo-flow/<label>/<project>):
 * - NN-<beat>.png: a full-page still at each beat;
 * - beats.json: each beat's time from the start of the recording (ms), the
 *   revision, the backend, the camera's tile size, and page errors.
 * Playwright records the run as video; scripts/review/flow-mp4.sh turns the
 * webm into an mp4.
 *
 * Local review fixture only: not a CI check.
 *
 * FNT_FLOW_LABEL=before npx playwright test -c playwright.demo-flow.config.ts --project desktop-canvas
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { reachable } from '../src/core/rules/grid';
import { BattleDraft } from '../src/core/state/battleDraft';
import type { BattleState, Unit, Vec2 } from '../src/core/types';
import { paintedTileCentre } from './projection';
import { settleLayout, waitForIdle } from './helpers';

const PARTY = [
  { player: 'Elias', element: 'fire', name: 'Kaya' },
  { player: 'Lorelai', element: 'water', name: 'Sura' },
  { player: 'Frehley', element: 'earth', name: 'Bo' },
] as const;

/** The oil flask on the forest road (src/content/maps/combat.ts). */
const FLASK = { x: 13, y: 6 } as const;

interface Beat {
  readonly index: number;
  readonly name: string;
  readonly atMs: number;
  readonly still: string;
  readonly tilePx: number | null;
  readonly note?: string;
}

test('the demo, played through', async ({ page }, info) => {
  const t0 = Date.now();
  const renderer = String(info.project.metadata.renderer ?? 'canvas');
  const label = process.env.FNT_FLOW_LABEL ?? 'current';
  const folder = `${process.env.FNT_FLOW_DIR ?? '.shots/demo-flow'}/${label}/${info.project.name}`;
  mkdirSync(folder, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text());
  });
  const beats: Beat[] = [];
  const trace: string[] = [];
  const slow = renderer === 'webgl';

  const save = () =>
    writeFileSync(
      `${folder}/beats.json`,
      JSON.stringify(
        {
          label,
          project: info.project.name,
          renderer,
          revision: execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
            encoding: 'utf8',
          }).trim(),
          viewport: page.viewportSize(),
          dpr: info.project.use.deviceScaleFactor ?? 1,
          beats,
          trace,
          errors,
        },
        null,
        2,
      ),
    );

  /** Marks a beat: timestamp it on the recording and take a full-page still. */
  const beat = async (name: string, note?: string) => {
    const atMs = Date.now() - t0;
    const index = beats.length + 1;
    const still = `${String(index).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: `${folder}/${still}` });
    const tilePx = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx ?? null);
    beats.push({ index, name, atMs, still, tilePx, ...(note ? { note } : {}) });
    save();
  };

  /** A tap where a player would put a finger: the tile's painted centre. */
  const tapTile = async (pos: Vec2) => {
    await settleLayout(page, slow ? 120_000 : 30_000);
    const point = await paintedTileCentre(page, pos);
    if (!point) throw new Error('no camera');
    if (info.project.use.hasTouch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  };

  const at = () => page.evaluate(() => window.fnt!.app.state!.location.pos);
  const nodeId = () => page.evaluate(() => window.fnt?.app.state?.story.nodeId ?? null);

  /** Walks by tapping, one leg at a time, and waits for the party to stop. */
  const walk = async (to: Vec2) => {
    for (let leg = 0; leg < 8; leg++) {
      const from = await at();
      if (from.x === to.x && from.y === to.y) break;
      // The furthest tile on the straight line that is on screen with a margin.
      await settleLayout(page, slow ? 120_000 : 30_000);
      const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      let pick: Vec2 = to;
      for (let k = steps; k >= 1; k--) {
        const p = {
          x: Math.round(from.x + ((to.x - from.x) * k) / steps),
          y: Math.round(from.y + ((to.y - from.y) * k) / steps),
        };
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
      await tapTile(pick);
      await expect.poll(at, { timeout: slow ? 240_000 : 60_000 }).toEqual(pick);
      await waitForIdle(page, slow ? 240_000 : 30_000);
    }
    expect(await at()).toEqual(to);
  };

  /** Reads a conversation through at a reading pace, one tap a line. */
  const readThrough = async (beatName?: string) => {
    const next = page
      .locator('[data-conversation-control="next"]')
      .or(page.getByRole('button', { name: /^(Next|Continue|Done)$/ }))
      .first();
    await next.waitFor({ timeout: 30_000 });
    let first = true;
    for (let i = 0; i < 12; i++) {
      if (!(await next.isVisible().catch(() => false))) break;
      await page.waitForTimeout(1200);
      if (first && beatName) await beat(beatName);
      first = false;
      await next.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(300);
    }
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
  await page.waitForTimeout(1500);
  await beat('title');

  await page.getByRole('button', { name: /new game/i }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '3 players' }).click();
  await beat('setup-players');
  await page.getByRole('button', { name: /^Continue$/ }).click();
  for (const [i, member] of PARTY.entries()) {
    const ready = page.getByRole('button', { name: /I've got it/i });
    if (await ready.count()) {
      if (i === 0) await beat('setup-handoff');
      await ready.click();
    }
    await page.locator('input[type=text]').fill(member.player);
    await page.getByRole('button', { name: /^Next$/ }).click();
    await page.locator(`.pick-card.element-${member.element}`).first().click();
    if (i === 0) await beat('setup-element');
    await page.getByRole('button', { name: /^Next$/ }).click();
    await page.locator('.character-card').filter({ hasText: member.name }).first().click();
    if (i === 0) await beat('setup-character');
    await page.getByRole('button', { name: /^Confirm$/ }).click();
  }
  await expect(page.getByRole('heading', { name: /the party/i })).toBeVisible();
  await beat('setup-party');
  await page.getByRole('button', { name: /^Begin$/ }).click();

  // ------------------------------------------------------------- The opening
  await readThrough('opening');
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
  await practise.click();
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
  await talk.click();
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
  await walk({ x: 8, y: 4 }).catch(() => undefined);
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
    if (await ready.count()) {
      if (!beats.some((b) => b.name === 'combat-handoff')) await beat('combat-handoff');
      await ready.click();
    }
    await waitForIdle(page, slow ? 300_000 : 30_000);
    const { battle: b } = await battle();
    return b?.units.find((u) => u.id === b.order[b.turnIndex]) ?? null;
  };

  /** Confirms; `midStill` names a still taken while the action plays. */
  const confirm = async (midStill?: string) => {
    const button = page.locator('.confirm-bar').getByRole('button', { name: /^Confirm$/ });
    await expect(button).toBeEnabled({ timeout: 15_000 });
    await button.click();
    if (midStill) {
      await page.waitForTimeout(slow ? 2500 : 700);
      await beat(midStill);
    }
    await waitForIdle(page, slow ? 300_000 : 30_000);
  };

  const dist = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

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
    const best = cells.sort((p, q) => dist(p.pos, goal) - dist(q.pos, goal))[0];
    if (!best || dist(best.pos, goal) >= dist(self.pos, goal)) return false;
    const move = page.getByRole('button', { name: /^Move/ });
    if (!(await move.isEnabled({ timeout: 2_000 }))) return false;
    await move.click();
    await tapTile(best.pos);
    await confirm();
    return true;
  };

  /** Aims the named ability at a tile and confirms, if the button is live. */
  const useAt = async (ability: RegExp, target: Vec2, still?: string): Promise<boolean> => {
    trace.push(`${Date.now() - t0} use ${ability.source} at ${JSON.stringify(target)}`);
    const button = page.getByRole('button', { name: ability }).first();
    if (!(await button.count()) || !(await button.isEnabled({ timeout: 2_000 }))) return false;
    await button.click();
    await tapTile(target);
    const bar = page.locator('.confirm-bar').getByRole('button', { name: /^Confirm$/ });
    await page.waitForTimeout(300);
    if (
      !(await bar.isVisible().catch(() => false)) ||
      !(await bar.isEnabled({ timeout: 2_000 }).catch(() => false))
    ) {
      const cancel = page.getByRole('button', { name: /Cancel$/ }).first();
      if (await cancel.isVisible().catch(() => false)) await cancel.click();
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

  const endTurn = async () => {
    trace.push(`${Date.now() - t0} end turn`);
    const end = page.getByRole('button', { name: /^End turn/ }).first();
    // With AP left the first tap only warns; a second tap ends the turn.
    for (let tap = 0; tap < 2; tap++) {
      const b = (await battle()).battle;
      const acting = b?.units.find((u) => u.id === b.order[b.turnIndex]);
      if (!b || b.phase !== 'active' || acting?.faction !== 'party') break;
      if (!(await end.isEnabled({ timeout: 2_000 }).catch(() => false))) break;
      if (tap === 1 && acting.id !== lastActing) break;
      lastActing = acting.id;
      await end.click();
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
    trace.push(
      `${Date.now() - t0} turn ${turn}: ${unit.characterId} at ${JSON.stringify(unit.pos)}`,
    );
    save();
    const isKaya = unit.characterId === 'kaya';
    if (isKaya && !flaskBroken && dist(unit.pos, FLASK) > 5) {
      // Review shortcut: stand her within range so the flask beat happens on turn one.
      const spot = await page.evaluate((flask) => {
        const app = window.fnt!.app;
        const s = app.state!;
        const b = s.battle!;
        const acting = b.order[b.turnIndex];
        for (const [dx, dy] of [
          [-5, 0],
          [-4, 0],
          [-4, -1],
          [-4, 1],
          [-3, 0],
        ]) {
          const pos = { x: flask.x + dx!, y: flask.y + dy! };
          const tile = b.grid.tiles[pos.y * b.grid.width + pos.x];
          if (!tile || tile.blocked || tile.surface) continue;
          if (b.units.some((u) => u.hp > 0 && u.pos.x === pos.x && u.pos.y === pos.y)) continue;
          app.state = {
            ...s,
            battle: { ...b, units: b.units.map((u) => (u.id === acting ? { ...u, pos } : u)) },
          };
          app.resync();
          return pos;
        }
        return null;
      }, FLASK);
      trace.push(`${Date.now() - t0} kaya placed at ${JSON.stringify(spot)}`);
      await settleLayout(page, slow ? 120_000 : 30_000);
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
        await beat('flask-burning', 'Kaya stood within range by the fixture on her first turn');
      }
      await endTurn();
      continue;
    }
    if ((flaskBroken || turn >= 12) && !shortcut) {
      // End it: real attacks on 1 HP enemies, so the victory and aftermath play.
      shortcut = true;
      trace.push(`${Date.now() - t0} shortcut: enemies to 1 HP`);
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

  await page.waitForTimeout(1500);
  await beat('fight-end', shortcut ? 'enemies set to 1 HP after the flask turn' : undefined);
  // The aftermath: read whatever the story says after the fight.
  if (
    await page
      .locator('[data-conversation-control="next"]')
      .or(page.getByRole('button', { name: /^(Next|Continue)$/ }))
      .count()
  ) {
    await readThrough('aftermath');
  }
  await page.waitForTimeout(2000);
  await beat('after-the-road');
  save();
});
