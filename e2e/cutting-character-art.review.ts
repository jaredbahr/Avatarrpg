/** Explicit, local art review. Staged motion is not combat-rules acceptance. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const reduced of [false, true]) {
    test(`${renderer} ${reduced ? 'reduced' : 'normal'} Cutting figures`, async ({ page }) => {
      test.setTimeout(180_000);
      const revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        encoding: 'utf8',
      }).trim();
      const folder = `.shots/cutting-characters/${renderer}-${reduced ? 'reduced' : 'normal'}`;
      mkdirSync(folder, { recursive: true });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.clock.install();
      await resetStorage(page, `?renderer=${renderer}`);
      await expect(page).toHaveTitle(new RegExp(revision));
      await startGame(page, ['One', 'Two', 'Three'], ['sura', 'kaya', 'bo'], 'cutting-art-review', {
        reduceMotion: reduced,
      });
      await enterNode(page, 'battle_ambush');
      await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
      await page.screenshot({ path: `${folder}/actual-cutting.png` });
      // Six party members plus Ruon naturally unlock the authored sergeant reinforcement.
      await startGame(
        page,
        ['One', 'Two', 'Three', 'Four', 'Five', 'Six'],
        ['sura', 'kaya', 'bo', 'tenzo', 'nilak', 'riko'],
        'cutting-art-review',
        { reduceMotion: reduced },
      );
      await enterNode(page, 'battle_ambush');
      await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);
      const metadata = await page.evaluate(() => {
        const app = window.fnt!.app;
        return {
          title: document.title,
          camera: app.rendererCamera(),
          backend: app.rendererBackend(),
          units: app.state?.battle?.units.map((u) => ({ id: u.id, sprite: u.sprite, pos: u.pos })),
        };
      });
      expect(metadata.units?.some((u) => u.sprite === 'unit.enemy.sergeant')).toBe(true);
      await page.screenshot({ path: `${folder}/actual-sergeant-reinforcement.png` });
      await page.evaluate(async () => {
        await Promise.all(
          ['ruon', 'merc', 'sergeant'].map(async (name) => {
            const image = new Image();
            image.src = new URL(`art/units/${name}.png`, document.baseURI).href;
            await image.decode();
          }),
        );
      });
      const now = await page.evaluate(() => Date.now());
      await page.clock.pauseAt(now + 1000);
      // Gallery-style choreography fixture: preserve actual map and unit identities,
      // arrange a clear central lane, then feed existing presentation events.
      const motion = await page.evaluate(() => {
        const app = window.fnt!.app;
        const state = app.state;
        const battle = state?.battle;
        if (!state || !battle) throw new Error('Missing Cutting battle');
        const subjects = ['unit.ally.ruon', 'unit.enemy.merc', 'unit.enemy.sergeant'].map(
          (sprite) => {
            const u = battle.units.find((unit) => unit.sprite === sprite);
            if (!u) throw new Error(`Missing ${sprite}`);
            return u;
          },
        );
        const before = battle.units.map((u) => {
          const index = subjects.findIndex((s) => s.id === u.id);
          return index < 0 ? u : { ...u, pos: { x: 7 + index * 2, y: 5 + index } };
        });
        app.state = {
          ...state,
          battle: {
            ...battle,
            units: before.map((u) =>
              subjects.some((s) => s.id === u.id)
                ? { ...u, pos: { x: u.pos.x + 2, y: u.pos.y } }
                : u,
            ),
          },
        };
        app.resync();
        app.animator.clear();
        const time = performance.now();
        const timings = [];
        for (const subject of subjects) {
          const start = before.find((u) => u.id === subject.id);
          if (!start) throw new Error('Missing start');
          const to = { x: start.pos.x + 2, y: start.pos.y };
          const target = { x: to.x + 1, y: to.y };
          app.animator.push(
            time,
            [
              {
                type: 'unitMoved',
                unitId: subject.id,
                path: [{ x: start.pos.x + 1, y: start.pos.y }, to],
                cost: 2,
              },
              {
                type: 'abilityUsed',
                unitId: subject.id,
                abilityId: subject.sprite === 'unit.ally.ruon' ? 'ruon_sabre' : 'merc_blade',
                target,
                tiles: [target],
              },
            ],
            before,
          );
          timings.push({ id: subject.id, sprite: subject.sprite, from: start.pos, to });
        }
        return { timings, duration: app.animator.finishesAt - time };
      });
      let elapsed = 0;
      for (const time of reduced ? [80, 500] : [50, 150, 300, 450, 620, 850, 1100, 1450]) {
        const delta = time - elapsed;
        if (delta > 17) await page.clock.fastForward(delta - 17);
        await page.clock.runFor(Math.min(delta, 17));
        await page.screenshot({ path: `${folder}/staged-${time}ms.png` });
        elapsed = time;
      }
      await page.clock.resume();
      expect(errors).toEqual([]);
      writeFileSync(
        `${folder}/provenance.json`,
        JSON.stringify(
          {
            revision,
            reduced,
            seed: 'cutting-art-review',
            source: 'e2e/cutting-character-art.review.ts',
            actual: metadata,
            staged: motion,
            errors,
          },
          null,
          2,
        ),
      );
    });
  }
}
