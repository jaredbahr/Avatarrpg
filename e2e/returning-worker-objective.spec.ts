import { expect, test } from '@playwright/test';
import { returningWorkerCheckpoint } from '../scripts/e2e/returning-worker-checkpoint';
import { worldObjective } from '../src/core/story/world';
import { CONTENT } from '../src/content';
import type { Command } from '../src/core/types';
import { allowSoftwareWebgl } from './budget';
import { resetStorage, settleLayout, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

interface InputObservation {
  command: Command;
  before: string | null;
  after: string | null;
}
type ObservedWindow = Window & { returningWorkerInputs: InputObservation[] };

const profiles = [
  { renderer: 'canvas', input: 'mouse', width: 1280, height: 800 },
  { renderer: 'webgl', input: 'touch', width: 834, height: 1194 },
] as const;

for (const custody of ['trade', 'escort'] as const) {
  for (const profile of profiles) {
    test(`returning-worker objective survives ${profile.input} and reload: ${custody}, ${profile.renderer}`, async ({
      page,
    }, info) => {
      allowSoftwareWebgl(test, profile.renderer);
      const fixture = returningWorkerCheckpoint(custody);
      const expectedLabel = `Current objective: ${worldObjective(CONTENT, fixture.state)}`;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width: profile.width, height: profile.height });
      await resetStorage(page, `?renderer=${profile.renderer}`);
      // The existing checkpoint earns every flag, outcome and position through
      // legal commands. Load its exact bytes through the player's ordinary UI.
      await page.evaluate((json) => localStorage.setItem('fnt.save.slot1', json), fixture.json);
      await page.reload();
      await page.getByRole('button', { name: /load a save/i }).click();
      await page
        .locator('.slot')
        .filter({ hasText: 'Slot 1' })
        .getByRole('button', { name: /^Load$/ })
        .click();
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(fixture.state);
      expect(await page.evaluate(() => window.fnt!.app.session.toMeta())).toEqual(fixture.session);
      const objective = page.getByRole('button', { name: /^Current objective:/ });
      await expect(objective).toHaveAttribute('aria-label', expectedLabel);

      await page.evaluate(() => {
        const app = window.fnt!.app;
        const dispatch = app.dispatch.bind(app);
        const observations: InputObservation[] = [];
        (window as unknown as ObservedWindow).returningWorkerInputs = observations;
        app.dispatch = (command) => {
          const before = app.state?.story.nodeId ?? null;
          const result = dispatch(command);
          observations.push({ command, before, after: app.state?.story.nodeId ?? null });
          return result;
        };
      });
      const point = await paintedTileCentre(page, { x: 5, y: 3 });
      if (!point) throw new Error('Bo-shan tile is unavailable');
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(profile.width);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(profile.height);
      if (profile.input === 'mouse') await page.mouse.click(point.x, point.y);
      else await page.touchscreen.tap(point.x, point.y);
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as unknown as ObservedWindow).returningWorkerInputs.some(
              ({ command }) =>
                command.type === 'walkTo' && command.pos.x === 5 && command.pos.y === 3,
            ),
          ),
        )
        .toBe(true);
      await waitForIdle(page);
      await settleLayout(page);
      if ((await objective.getAttribute('aria-expanded')) === 'false') await objective.click();
      const after = await page.evaluate(() => window.fnt!.app.state!);
      await info.attach('interaction', {
        body: JSON.stringify({
          custody,
          profile,
          inputs: await page.evaluate(
            () => (window as unknown as ObservedWindow).returningWorkerInputs,
          ),
          objective: await objective.getAttribute('aria-label'),
          after,
        }),
        contentType: 'application/json',
      });
      await page.screenshot({ path: info.outputPath('interaction.png') });
      await expect(objective).toHaveAttribute('aria-label', expectedLabel);
      expect(after.story.nodeId).toBe(fixture.state.story.nodeId);
      expect(after.location).toEqual(fixture.state.location);
      expect(after.world.residentProfiles).toEqual(fixture.state.world.residentProfiles);
      expect(after.battle).toBeNull();

      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Save game', exact: true }).click();
      await page
        .locator('.slot')
        .filter({ hasText: 'Slot 1' })
        .getByRole('button', { name: /save here/i })
        .click();
      await page.reload();
      await page.getByRole('button', { name: /load a save/i }).click();
      await page
        .locator('.slot')
        .filter({ hasText: 'Slot 1' })
        .getByRole('button', { name: /^Load$/ })
        .click();
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(after);
      await expect(page.getByRole('button', { name: /^Current objective:/ })).toHaveAttribute(
        'aria-label',
        expectedLabel,
      );
      expect(errors).toEqual([]);
    });
  }
}
