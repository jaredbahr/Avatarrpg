import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import { BattleDraft } from '../src/core/state/battleDraft';
import { RngCursor } from '../src/core/rng';
import { reachable, distance } from '../src/core/rules/grid';
import { resetStorage, startGame, enterNode, takeTurn, waitForIdle } from './helpers';
for (const renderer of ['canvas', 'webgl'])
  for (const reduced of [false, true]) {
    test(`${renderer} reduced=${reduced} legal air displacement`, async ({ page }, info) => {
      test.setTimeout(180000);
      const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      const out = `.shots/air-displacement/${revision.slice(0, 7)}/${renderer}-${reduced}`;
      mkdirSync(out, { recursive: true });
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Nima'], ['nima'], 'air-displacement', { reduceMotion: reduced });
      await enterNode(page, 'battle_forest_road');
      const commands = [];
      for (let turn = 0; turn < 12; turn++) {
        expect(await takeTurn(page)).toBeTruthy();
        await waitForIdle(page);
        const state = await page.evaluate(() => window.fnt!.app.state!);
        const b = state.battle!,
          h = b.units.find((u) => u.id === b.order[b.turnIndex])!;
        const enemies = b.units.filter((u) => u.faction === 'enemy' && u.hp > 0);
        const candidate = enemies
          .map((e) => ({
            type: 'useAbility' as const,
            unitId: h.id,
            abilityId: 'air_blast',
            target: e.pos,
          }))
          .find((c) => apply(CONTENT, state, c).events.some((e) => e.type === 'unitPushed'));
        if (candidate) {
          const push = apply(CONTENT, state, candidate).events.find(
            (e) => e.type === 'unitPushed',
          )!;
          if (push.type !== 'unitPushed') throw new Error('Missing push');
          const box = (await page.locator('.map-canvas').boundingBox())!;
          const current = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(0, Math.log(current / 96) / 0.002);
          await page.waitForTimeout(400);
          await page.evaluate(
            ({ a, b }) => {
              const canvas = document.querySelector('.map-canvas')!,
                r = canvas.getBoundingClientRect(),
                m = window.fnt!.app.rendererCamera()!.groundTransform!;
              const x = (a.x + b.x + 1) * 32,
                y = (a.y + b.y + 1) * 32;
              const p = { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty };
              const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 },
                to = { x: from.x + r.width / 2 - p.x, y: from.y + r.height / 2 + 50 - p.y };
              for (const [type, at] of [
                ['pointerdown', from],
                ['pointermove', to],
                ['pointerup', to],
              ] as const)
                canvas.dispatchEvent(
                  new PointerEvent(type, {
                    pointerId: 1,
                    pointerType: 'mouse',
                    isPrimary: true,
                    clientX: at.x,
                    clientY: at.y,
                    button: 0,
                    buttons: type === 'pointerup' ? 0 : 1,
                    bubbles: true,
                  }),
                );
            },
            { a: h.pos, b: push.to },
          );
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${out}/before.png` });
          const result = await page.evaluate((c) => {
            const a = window.fnt!.app;
            const at = performance.now();
            const events = a.dispatch(c);
            return {
              at,
              events,
              after: a.state,
              backend: a.rendererBackend(),
              camera: a.rendererCamera(),
            };
          }, candidate);
          expect(result.events.some((e) => e.type === 'abilityUsed')).toBeTruthy();
          expect(result.events.some((e) => e.type === 'unitPushed')).toBeTruthy();
          await waitForIdle(page);
          await page.waitForTimeout(600);
          await page.screenshot({ path: `${out}/after.png` });
          writeFileSync(
            `${out}/metadata.json`,
            JSON.stringify(
              {
                revision,
                renderer,
                reduced,
                staged:
                  'newGame/enterNode only; all positioning and ability commands use reducer; no battle mutation',
                commands,
                candidate,
                before: state,
                result,
                video: await page.video()?.path(),
              },
              null,
              2,
            ),
          );
          await info.attach('metadata', {
            path: `${out}/metadata.json`,
            contentType: 'application/json',
          });
          return;
        }
        const draft = new BattleDraft(CONTENT, b, new RngCursor(state.rng));
        const nearest = (p: typeof h.pos) => Math.min(...enemies.map((e) => distance(p, e.pos)));
        const step = [...reachable(draft.moveContext(h), h.pos, h.move).values()]
          .filter((c) => c.path.length && nearest(c.pos) < nearest(h.pos))
          .sort((a, b) => nearest(a.pos) - nearest(b.pos) || a.cost - b.cost)[0];
        if (step) {
          const c = { type: 'move' as const, unitId: h.id, path: step.path };
          commands.push(c);
          await page.evaluate((c) => window.fnt!.app.dispatch(c), c);
          await waitForIdle(page);
        }
        const c = { type: 'endTurn' as const, unitId: h.id };
        commands.push(c);
        await page.evaluate((c) => window.fnt!.app.dispatch(c), c);
      }
      throw new Error('No legal Air Blast displacement found in 12 turns');
    });
  }
