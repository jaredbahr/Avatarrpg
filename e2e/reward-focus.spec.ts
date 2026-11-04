import { expect, test } from '@playwright/test';
import { deserialize, stateFromBlob } from '../src/core/save/serialize';
import { earnedRewardFixture } from './earnedRewardFixture';
import { resetStorage } from './helpers';

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const key of ['Enter', 'Space'] as const) {
    test(`earned reward chain returns ${key} to staged dialogue on ${renderer}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const fixture = earnedRewardFixture();
      const parsed = deserialize(fixture.json);
      if (!parsed.ok) throw new Error(parsed.error);
      const loaded = stateFromBlob(parsed.blob);
      await resetStorage(page, `?renderer=${renderer}`);
      // The save was earned through real commands and parsed normally. Adopt
      // it through the App's reconciliation path, skipping only the file picker.
      await page.evaluate(
        ({ state, session }) => {
          const app = window.fnt!.app;
          app.updateSettings({ reduceMotion: true });
          app.adoptSave(state, session);
        },
        { state: loaded, session: parsed.blob.session },
      );
      expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(fixture.state);
      await expect(page.locator('.dialogue-layer .stage[data-kind="dialogue"]')).toBeVisible();

      for (const [index, choice] of fixture.state.pendingChoices.entries()) {
        const dialog = page.getByRole('dialog');
        await expect(dialog).toHaveCount(1);
        await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
        const abilityId = choice.options[0];
        if (!abilityId) throw new Error('Earned choice has no first technique');
        const learn = dialog.getByRole('button', { name: /^Learn / }).first();
        await learn.focus();
        await page.keyboard.press(key);

        const after = await page.evaluate(() => ({
          state: window.fnt!.app.state!,
          autosave: localStorage.getItem('fnt.save.auto'),
        }));
        expect(after.state.pendingChoices).toEqual(fixture.state.pendingChoices.slice(index + 1));
        expect(after.state.party.find((unit) => unit.id === choice.unitId)?.abilities).toContain(
          abilityId,
        );
        // Learning must not consume a line or alter the route behind the modal.
        expect(after.state.story).toEqual(fixture.state.story);
        expect(after.state.location).toEqual(fixture.state.location);
        expect(after.state.flags).toEqual(fixture.state.flags);
        expect(after.state.screen).toBe('dialogue');
        expect(
          after.autosave,
          'each consumed reward must checkpoint its exact state',
        ).not.toBeNull();
        const saved = deserialize(after.autosave!);
        if (!saved.ok) throw new Error(saved.error);
        expect(stateFromBlob(saved.blob)).toEqual(after.state);
        expect(saved.blob.session).toEqual(fixture.session);
        if (index < fixture.state.pendingChoices.length - 1) {
          await expect(page.getByRole('dialog')).toHaveCount(1);
          await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toBeFocused();
        }
      }

      await expect(page.getByRole('dialog')).toHaveCount(0);
      const next = page.locator('.dialogue-layer [data-conversation-control="next"]');
      // No focus() workaround: completing the final reward must restore this.
      await expect(next).toBeFocused();
      expect(await page.evaluate(() => window.fnt!.app.state?.story.lineIndex)).toBe(0);
      await page.keyboard.press(key);
      await expect.poll(() => page.evaluate(() => window.fnt!.app.state?.story.lineIndex)).toBe(1);
      expect(await page.evaluate(() => window.fnt!.app.state?.story.nodeId)).toBe('ruon_surrender');
      expect(errors).toEqual([]);
    });
  }
}
