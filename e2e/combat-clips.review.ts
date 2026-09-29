/**
 * Local review of the G knockouts (ADR 0059) and the G thug, on both
 * backends, at the combat camera's own scale: the forest ambush's thugs
 * roster beside Kaya, Sura and Bo, the thugs idling and one walking, each
 * party member struck (its G hit, ADR 0063) and then
 * downed, and held where it fell on the grass. Crops are named for the clip
 * the animator is playing in them.
 *
 * Run: FNT_REVIEW_OUT=<dir> npx playwright test -c playwright.combat-clips.config.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type * as CreateModule from '../src/core/state/createGame';
import type * as RngModule from '../src/core/rng';
import { pauseClock, resetStorage, settleLayout, startGame } from './helpers';

const OUT = process.env.FNT_REVIEW_OUT ?? 'test-results/combat-clips';

/** A unit's drawn feet on the page, in CSS pixels. */
async function footPoint(page: Page, id: string): Promise<{ x: number; y: number }> {
  return page.evaluate((unitId) => {
    const app = window.fnt!.app;
    const unit = app.state!.battle!.units.find((u) => u.id === unitId)!;
    const at = app.animator.renderPos(performance.now(), unitId) ?? unit.pos;
    const camera = app.rendererCamera()!;
    const m = camera.groundTransform;
    const x = (at.x + 0.5) * 64;
    const y = (at.y + 0.5) * 64;
    const rect = document.querySelector('.map-canvas')!.getBoundingClientRect();
    return { x: rect.left + m.a * x + m.c * y + m.tx, y: rect.top + m.b * x + m.d * y + m.ty };
  }, id);
}

async function crop(page: Page, id: string, name: string, w = 420, h = 300): Promise<void> {
  const at = await footPoint(page, id);
  const size = page.viewportSize()!;
  const x = Math.max(0, Math.min(size.width - w, at.x - w / 2));
  const y = Math.max(0, Math.min(size.height - h, at.y - h * 0.7));
  writeFileSync(
    join(OUT, `${name}.png`),
    await page.screenshot({ clip: { x, y, width: w, height: h } }),
  );
}

/**
 * Moves the paused clock on by `ms` and draws one frame there. `runFor` draws
 * every frame on the way, which software WebGL takes most of a second over;
 * the animator reads the time, so a jump lands on the same pose.
 */
async function advance(page: Page, ms: number): Promise<void> {
  await page.clock.fastForward(ms);
}

const clipOf = (page: Page, id: string, sprite: string) =>
  page.evaluate(
    ({ unitId, sprite }) =>
      // No pose playing: standing, or once fallen, the knockout's held last frame.
      window.fnt!.app.animator.unitPose(performance.now(), unitId, sprite)?.clip ?? 'rest-pose',
    { unitId: id, sprite },
  );

for (const backend of ['canvas', 'webgl'] as const) {
  test(`combat clips review (${backend})`, async ({ page }) => {
    test.setTimeout(900_000);
    mkdirSync(OUT, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install();
    await resetStorage(page, `?renderer=${backend}`);
    await startGame(page, ['Ana', 'Ben', 'Cy'], ['kaya', 'sura', 'bo'], 'combat-clips', {
      reduceMotion: false,
    });
    await page.evaluate(() =>
      window.fnt!.app.dispatch({ type: 'enterNode', nodeId: 'battle_forest_road' }),
    );
    await settleLayout(page);

    // The thugs roster, staged beside the party: rules untouched, positions only.
    const ids = await page.evaluate(async () => {
      // Through the dev server, as enemy-scale.review.ts does.
      const createPath = '/src/core/state/createGame.ts';
      const rngPath = '/src/core/rng.ts';
      const { createBattle } = (await import(createPath)) as typeof CreateModule;
      const { RngCursor } = (await import(rngPath)) as typeof RngModule;
      const app = window.fnt!.app;
      const state = app.state!;
      const battle = createBattle(app.content, state, 'enc_forest_road', new RngCursor(state.rng), {
        variantId: 'thugs',
      });
      const party = battle.units.filter((u) => u.faction === 'party');
      const thugs = battle.units.filter((u) => u.sprite === 'unit.enemy.thug');
      const others = battle.units.filter((u) => u.faction === 'enemy' && !thugs.includes(u));
      const [kaya, sura, bo] = party;
      const [t0, t1] = thugs;
      if (!kaya || !sura || !bo || !t0 || !t1) throw new Error('Expected the party and two thugs');
      // Around where Kaya stands, so the camera that follows her frames them all.
      const base = kaya.pos;
      const place: Record<string, { x: number; y: number }> = {
        [kaya.id]: base,
        [sura.id]: { x: base.x - 1, y: base.y + 2 },
        [bo.id]: { x: base.x - 1, y: base.y - 1 },
        [t0.id]: { x: base.x + 2, y: base.y },
        [t1.id]: { x: base.x + 2, y: base.y + 2 },
      };
      // Each party member has just stepped one tile, so each faces its own way.
      const stepFrom: Record<string, { x: number; y: number }> = {
        [kaya.id]: { x: base.x, y: base.y + 1 },
        [sura.id]: { x: base.x - 2, y: base.y + 2 },
        [bo.id]: { x: base.x - 1, y: base.y - 2 },
      };
      const units = [...party, ...thugs, ...others].map((u) =>
        place[u.id] ? { ...u, pos: place[u.id]! } : u,
      );
      app.state = { ...state, battle: { ...battle, units } };
      app.resync();
      app.animator.clear();
      const before = units.map((u) => (stepFrom[u.id] ? { ...u, pos: stepFrom[u.id]! } : u));
      app.animator.push(
        performance.now(),
        party.map((u) => ({
          type: 'unitMoved' as const,
          unitId: u.id,
          path: [place[u.id]!],
          cost: 1,
        })),
        before,
      );
      return { party: party.map((u) => [u.id, u.sprite] as const), thugs: [t0.id, t1.id] };
    });
    const ready = page.getByRole('button', { name: "I'm ready" });
    if (await ready.isVisible()) await ready.click();
    await page.getByRole('button', { name: 'Acting unit', exact: true }).click();
    await settleLayout(page);
    await pauseClock(page);
    // Frame by frame while the camera eases onto the party, then a jump.
    await page.clock.runFor(500);
    await advance(page, 3500);
    writeFileSync(join(OUT, `${backend}-00-full.png`), await page.screenshot());
    const [kaya] = ids.party;
    const [thug] = ids.thugs;
    if (!kaya || !thug) throw new Error('Missing staged units');
    await crop(page, kaya[0], `${backend}-01-party-and-thugs`, 640, 420);
    for (let frame = 0; frame < 4; frame++) {
      await crop(page, thug, `${backend}-02-thug-idle-${frame}`);
      await advance(page, 250);
    }

    // A thug walks toward the party and back out, then stands.
    for (const [leg, step] of [
      ['grid-west', [-1, 0]],
      ['grid-south', [0, 1]],
      ['grid-east', [1, 0]],
      ['grid-north', [0, -1]],
    ] as const) {
      const from = await page.evaluate(
        (id) => window.fnt!.app.state!.battle!.units.find((u) => u.id === id)!.pos,
        thug,
      );
      const path = [{ x: from.x + step[0], y: from.y + step[1] }];
      await page.evaluate(
        ({ id, from, path }) => {
          const app = window.fnt!.app;
          const state = app.state!;
          const battle = state.battle!;
          const before = battle.units;
          const to = path[path.length - 1]!;
          app.state = {
            ...state,
            battle: { ...battle, units: before.map((u) => (u.id === id ? { ...u, pos: to } : u)) },
          };
          app.animator.push(
            performance.now(),
            [{ type: 'unitMoved', unitId: id, path: [...path], cost: path.length }],
            before.map((u) => (u.id === id ? { ...u, pos: from } : u)),
          );
        },
        { id: thug, from, path },
      );
      for (let frame = 0; frame < 5; frame++) {
        await advance(page, 70);
        await crop(page, thug, `${backend}-03-thug-walk-${leg}-${frame}`);
      }
      await advance(page, 1500);
      await crop(page, thug, `${backend}-03-thug-walk-${leg}-stop`);
    }

    // Each party member is struck, then downed: several moments of each.
    let index = 4;
    for (const [id, sprite] of ids.party) {
      const name = sprite.slice(sprite.lastIndexOf('.') + 1);
      await page.evaluate(
        ({ id, thug }) => {
          const battle = window.fnt!.app.state!.battle!;
          window.fnt!.app.animator.push(
            performance.now(),
            [
              {
                type: 'damaged',
                unitId: id,
                amount: 1,
                crit: false,
                damageType: 'fire',
                sourceId: thug,
              },
            ],
            battle.units,
          );
        },
        { id, thug },
      );
      let struck = 0;
      for (const t of [20, 60, 120, 200, 300, 420]) {
        await advance(page, t - struck);
        struck = t;
        const clip = await clipOf(page, id, sprite);
        await crop(
          page,
          id,
          `${backend}-${String(index).padStart(2, '0')}-${name}-hit-${t}ms-${clip}`,
        );
      }
      await advance(page, 1500);
      await crop(
        page,
        id,
        `${backend}-${String(index).padStart(2, '0')}-${name}-hit-after-${await clipOf(page, id, sprite)}`,
      );
      index++;
      await page.evaluate((unitId) => {
        const app = window.fnt!.app;
        const state = app.state!;
        const battle = state.battle!;
        const before = battle.units;
        app.state = {
          ...state,
          battle: { ...battle, units: before.map((u) => (u.id === unitId ? { ...u, hp: 0 } : u)) },
        };
        app.animator.push(performance.now(), [{ type: 'unitDied', unitId }], before);
      }, id);
      let elapsed = 0;
      for (const t of [30, 110, 200, 300, 450, 700, 1000]) {
        await advance(page, t - elapsed);
        elapsed = t;
        const clip = await clipOf(page, id, sprite);
        await crop(
          page,
          id,
          `${backend}-${String(index).padStart(2, '0')}-${name}-ko-${t}ms-${clip}`,
        );
      }
      await advance(page, 2000);
      await crop(page, id, `${backend}-${String(index).padStart(2, '0')}-${name}-ko-held`);
      index++;
    }
    writeFileSync(join(OUT, `${backend}-99-full-after.png`), await page.screenshot());
    expect(errors).toEqual([]);
  });
}
