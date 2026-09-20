/** Local fixture review: real reducer commands supply every motion event. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { focusStagedUnit } from './gallery/stage';
import type { Command, GameEvent } from '../src/core/types';
import type { Choreography } from '../src/app/anim/choreography';
import type * as ReducerModule from '../src/core/state/reducer';
import type * as ChoreographyModule from '../src/app/anim/choreography';

for (const renderer of ['canvas', 'webgl'] as const)
  for (const size of [64, 96])
    for (const reduced of [false, true])
      test(`${renderer} ${size} ${reduced ? 'reduced' : 'normal'} deserter`, async ({ page }) => {
        test.setTimeout(120_000);
        const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
          encoding: 'utf8',
        }).trim();
        const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
          encoding: 'utf8',
        }).trim();
        const build = `${revision}${dirty ? '-modified' : ''}`;
        const folder = `${process.env.FNT_DESERTER_REVIEW_DIR ?? '.shots/deserter'}/${renderer}-${size}-${reduced ? 'reduced' : 'normal'}`;
        mkdirSync(folder, { recursive: true });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const fallback = process.env.FNT_DESERTER_FALLBACK === '1';
        let failedImageRequests = 0;
        let failedPortraitRequests = 0;
        if (fallback) {
          await page.route('**/art/units/deserter.png', async (route) => {
            failedImageRequests++;
            await route.abort();
          });
          await page.route('**/art/portraits/enemy.deserter.webp', async (route) => {
            failedPortraitRequests++;
            await route.abort();
          });
        }
        await page.clock.install();
        await resetStorage(page, `?renderer=${renderer}`);
        await expect(page.locator('[aria-label^="Game version"]')).toHaveText(
          new RegExp(`build ${build}$`),
        );
        await page.screenshot({ path: `${folder}/source-build.png` });
        await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'deserter-motion-review', {
          reduceMotion: reduced,
        });
        await enterNode(page, 'battle_quarry_gate');
        await takeTurn(page);
        await waitForIdle(page);
        await settleLayout(page);
        const id = await page.evaluate(
          () =>
            window.fnt!.app.state!.battle!.units.find((u) => u.sprite === 'unit.enemy.deserter')
              ?.id,
        );
        if (!id) throw new Error('Authored gate deserter missing');
        expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
        const box = await page.locator('.map-canvas').boundingBox();
        if (!box) throw new Error('Missing canvas');
        const current = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, Math.log(current / size) / 0.002);
        await expect
          .poll(() => page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx))
          .toBeCloseTo(size, 1);
        await focusStagedUnit(page, id, 30_000);
        await page.evaluate(() => window.fnt!.loadedFxCels());
        await page.mouse.move(10, 10);
        await page.screenshot({ path: `${folder}/actual-gate.png` });
        // Arrange only actors/active turn in the real gate map. No map, ability,
        // resource cap, damage or animation event is fabricated.
        await page.evaluate((id) => {
          const app = window.fnt!.app,
            state = app.state!,
            battle = state.battle!;
          const hero = battle.units.find((u) => u.faction === 'party')!;
          app.state = {
            ...state,
            battle: {
              ...battle,
              units: battle.units.map((u) =>
                u.id === id
                  ? {
                      ...u,
                      pos: { x: 6, y: 4 },
                      ap: u.base.maxAp,
                      move: u.base.maxMove,
                      statuses: [],
                      cooldowns: {},
                    }
                  : u.id === hero.id
                    ? { ...u, pos: { x: 5, y: 4 } }
                    : u,
              ),
            },
          };
          app.resync();
        }, id);
        await focusStagedUnit(page, id, 30_000);
        await page.clock.pauseAt(Date.now() + 1000);
        const result = await page.evaluate(
          async ({ id, reduced }) => {
            const reducerPath = '/src/core/state/reducer.ts';
            const choreographyPath = '/src/app/anim/choreography.ts';
            const { apply } = (await import(reducerPath)) as typeof ReducerModule;
            const { choreograph } = (await import(choreographyPath)) as typeof ChoreographyModule;
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
                  { x: 8, y: 4 },
                ],
              },
              { type: 'useAbility', unitId: id, abilityId: 'oil_flask', target: { x: 5, y: 4 } },
              { type: 'useAbility', unitId: id, abilityId: 'fire_blast', target: { x: 5, y: 4 } },
            ];
            const events: GameEvent[] = [];
            const steps = commands.map((command) => {
              const step = apply(app.content, state, command);
              if (
                !step.events.some(
                  (e) => e.type === (command.type === 'move' ? 'unitMoved' : 'abilityUsed'),
                )
              )
                throw new Error(
                  `Illegal review command: ${JSON.stringify({ command, events: step.events })}`,
                );
              state = { ...step.state, battle: step.state.battle! };
              events.push(...step.events);
              return {
                command,
                events: step.events,
                actor: state.battle.units.find((u) => u.id === id),
              };
            });
            const choreography = choreograph({
              content: app.content,
              events,
              unitsBefore: before,
              cursor: 0,
              rate: reduced ? 0.02 : 1,
              pushIndex: 0,
              projection: 'oblique',
            });
            app.state = state;
            app.animator.clear();
            const start = performance.now();
            app.animator.push(start, events, before);
            app.resync();
            return {
              steps,
              choreography,
              duration: app.animator.finishesAt - start,
              start,
              finalAp: state.battle.units.find((u) => u.id === id)!.ap,
              camera: app.rendererCamera(),
            };
          },
          { id, reduced },
        );
        expect(result.finalAp).toBe(0);
        const tracks = (result.choreography as Choreography).tracks;
        const times = reduced
          ? [16, Math.ceil(result.duration) + 32]
          : [
              ...tracks
                .filter((t) => t.kind === 'move')
                .flatMap((t) =>
                  [0.2, 0.4, 0.65, 0.85].map((p) => Math.round(t.start + t.duration * p)),
                ),
              ...tracks
                .filter((t) => t.kind === 'pose' && t.unitId === id)
                .map((t) => Math.round(t.start + t.duration / 2)),
              Math.ceil(result.duration) + 32,
            ];
        const samples = [];
        let elapsed = 0;
        for (const time of [...new Set(times)].sort((a, b) => a - b)) {
          const delta = time - elapsed;
          if (delta > 17) await page.clock.fastForward(delta - 17);
          await page.clock.runFor(Math.min(delta, 17));
          const sample = await page.evaluate(
            (id) => ({
              time: performance.now(),
              pose: window.fnt!.app.animator.unitPose(performance.now(), id),
              locomotion: window.fnt!.app.animator.locomotion(performance.now(), id, 'idle'),
              actor: window.fnt!.app.state!.battle!.units.find((u) => u.id === id),
            }),
            id,
          );
          samples.push({ elapsed: time, ...sample });
          await page.screenshot({ path: `${folder}/motion-${time}ms.png` });
          elapsed = time;
        }
        expect(errors).toEqual([]);
        if (fallback) {
          expect(failedImageRequests).toBeGreaterThan(0);
          expect(failedPortraitRequests).toBeGreaterThan(0);
        }
        expect(samples.at(-1)?.actor?.ap).toBe(0);
        writeFileSync(
          `${folder}/provenance.json`,
          JSON.stringify(
            {
              build,
              renderer,
              size,
              reduced,
              fallback,
              failedImageRequests,
              failedPortraitRequests,
              seed: 'deserter-motion-review',
              fixture:
                'Actual gate roster and terrain; arrange actors, select deserter turn; apply legal move/oil/fire commands through unchanged reducer, present resulting events in one batch before AI resumes.',
              result,
              samples,
              errors,
            },
            null,
            2,
          ),
        );
      });
