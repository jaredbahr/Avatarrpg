/** Explicit route-actor scale fixture; legal reducer events drive each motion. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { focusStagedUnit } from './gallery/stage';
import type { Command, GameEvent } from '../src/core/types';
import type * as ReducerModule from '../src/core/state/reducer';
import type * as CreateModule from '../src/core/state/createGame';
import type * as RngModule from '../src/core/rng';

for (const renderer of ['canvas', 'webgl'] as const)
  for (const size of [64, 96])
    for (const reduced of [false, true])
      test(`${renderer} ${size} ${reduced ? 'reduced' : 'normal'} route enemies`, async ({
        page,
      }) => {
        test.setTimeout(180_000);
        const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
          encoding: 'utf8',
        }).trim();
        const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
          encoding: 'utf8',
        }).trim();
        const build = `${revision}${dirty ? '-modified' : ''}`;
        const folder = `${process.env.FNT_SCALE_REVIEW_DIR ?? '.shots/enemy-scale'}/${renderer}-${size}-${reduced ? 'reduced' : 'normal'}`;
        mkdirSync(folder, { recursive: true });
        const errors: string[] = [];
        const blocked: string[] = [];
        const fallback = process.env.FNT_SCALE_FALLBACK === '1';
        page.on('pageerror', (error) => errors.push(error.message));
        if (fallback)
          await page.route(
            /\/art\/units\/(thug|bruiser|slinger|quarrybender|crossbow)\.png$/,
            async (route) => {
              blocked.push(route.request().url());
              await route.abort();
            },
          );
        await page.clock.install();
        await resetStorage(page, `?renderer=${renderer}`);
        await expect(page.locator('[aria-label^="Game version"]')).toHaveText(
          new RegExp(`build ${build}$`),
        );
        await page.screenshot({ path: `${folder}/source-build.png` });
        await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'route-enemy-scale', {
          reduceMotion: reduced,
        });
        await enterNode(page, 'forest_explore');
        await waitForIdle(page);
        await settleLayout(page);
        const zoom = async () => {
          const box = await page.locator('.map-canvas').boundingBox();
          if (!box) throw new Error('Missing map canvas');
          const current = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(0, Math.log(current / size) / 0.002);
          await expect
            .poll(() => page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx))
            .toBeCloseTo(size, 1);
          await page.mouse.move(10, 10);
          await settleLayout(page);
        };
        await zoom();
        await page.screenshot({ path: `${folder}/forest-marker.png` });
        const reviews = [];
        for (const name of ['thug', 'bruiser', 'slinger', 'quarrybender', 'crossbow']) {
          await startGame(
            page,
            ['Sura', 'Riko', 'Bo', 'Kaya', 'Nima'],
            ['sura', 'riko', 'bo', 'kaya', 'nima'],
            'route-enemy-scale',
            { reduceMotion: reduced },
          );
          await enterNode(page, name === 'crossbow' ? 'battle_ambush' : 'battle_quarry_gate');
          await takeTurn(page);
          await waitForIdle(page);
          if (name === 'quarrybender')
            await page.evaluate(async () => {
              const createPath = '/src/core/state/createGame.ts';
              const rngPath = '/src/core/rng.ts';
              const { createBattle } = (await import(createPath)) as typeof CreateModule;
              const { RngCursor } = (await import(rngPath)) as typeof RngModule;
              const app = window.fnt!.app,
                state = app.state!;
              app.state = {
                ...state,
                battle: createBattle(
                  app.content,
                  state,
                  'enc_quarry_gate',
                  new RngCursor(state.rng),
                  { variantId: 'bluffed' },
                ),
              };
              app.resync();
            });
          const subject = await page.evaluate((name) => {
            const app = window.fnt!.app,
              state = app.state!,
              battle = state.battle!;
            const unit = battle.units.find((u) => u.sprite === `unit.enemy.${name}`);
            if (!unit) throw new Error(`Missing authored enemy ${name}`);
            const hero = battle.units.find((u) => u.sprite === 'unit.water.sura')!;
            const units = [
              { ...hero, pos: { x: 5, y: 4 } },
              {
                ...unit,
                pos: { x: 8, y: 4 },
                ap: unit.base.maxAp,
                move: unit.base.maxMove,
                statuses: [],
                cooldowns: {},
              },
            ];
            app.state = {
              ...state,
              battle: { ...battle, units, order: units.map((u) => u.id), turnIndex: 0 },
            };
            app.animator.clear();
            app.resync();
            return {
              id: unit.id,
              sprite: unit.sprite,
              ability: unit.abilities[0]!,
              mapId: battle.mapId,
            };
          }, name);
          await takeTurn(page);
          await waitForIdle(page);
          await settleLayout(page);
          await zoom();
          await focusStagedUnit(page, subject.id, 30_000);
          expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
          await page.mouse.move(10, 10);
          await page.screenshot({ path: `${folder}/${name}-idle.png` });
          await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
          const motion = await page.evaluate(async ({ id, ability }) => {
            const path = '/src/core/state/reducer.ts';
            const { apply } = (await import(path)) as typeof ReducerModule;
            const app = window.fnt!.app,
              original = app.state!,
              battle = original.battle!;
            let state = { ...original, battle: { ...battle, turnIndex: battle.order.indexOf(id) } };
            const before = state.battle.units;
            const commands: Command[] = [
              {
                type: 'move',
                unitId: id,
                path: [
                  { x: 7, y: 4 },
                  { x: 6, y: 4 },
                ],
              },
              { type: 'useAbility', unitId: id, abilityId: ability, target: { x: 5, y: 4 } },
            ];
            const events: GameEvent[] = [];
            for (const command of commands) {
              const step = apply(app.content, state, command);
              if (
                !step.events.some(
                  (e) => e.type === (command.type === 'move' ? 'unitMoved' : 'abilityUsed'),
                )
              )
                throw new Error(
                  `Illegal scale review command ${JSON.stringify({ command, events: step.events })}`,
                );
              state = { ...step.state, battle: step.state.battle! };
              events.push(...step.events);
            }
            app.state = state;
            app.animator.clear();
            const start = performance.now();
            app.animator.push(start, events, before);
            app.resync();
            return {
              commands,
              events,
              duration: app.animator.finishesAt - start,
              camera: app.rendererCamera(),
            };
          }, subject);
          let elapsed = 0;
          const samples = [];
          for (const time of reduced
            ? [16, Math.ceil(motion.duration) + 32]
            : [90, 300, 550, 730, Math.ceil(motion.duration) + 32]) {
            const delta = time - elapsed;
            if (delta <= 0) continue;
            if (delta > 17) await page.clock.fastForward(delta - 17);
            await page.clock.runFor(Math.min(delta, 17));
            samples.push(
              await page.evaluate(
                (id) => ({
                  time: performance.now(),
                  pose: window.fnt!.app.animator.unitPose(performance.now(), id),
                }),
                subject.id,
              ),
            );
            await page.screenshot({ path: `${folder}/${name}-${time}ms.png` });
            elapsed = time;
          }
          reviews.push({ subject, motion, samples });
          await page.clock.resume();
        }
        expect(errors).toEqual([]);
        if (fallback) expect(blocked.length).toBeGreaterThanOrEqual(5);
        writeFileSync(
          `${folder}/provenance.json`,
          JSON.stringify(
            {
              build,
              renderer,
              size,
              reduced,
              fallback,
              blocked,
              reviews,
              errors,
              fixture:
                'Authored gate/Cutting rosters (explicit gate bluffed variant for quarry worker). Two-actor comparison arranged on actual map; unchanged reducer supplies legal move/attack events. Forest marker uses original exploration entry. This is visual scale review, not full encounter acceptance.',
            },
            null,
            2,
          ),
        );
      });
