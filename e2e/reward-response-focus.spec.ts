import { expect, test } from '@playwright/test';
import { CONTENT } from '../src/content';
import { deserialize, serialize, stateFromBlob } from '../src/core/save/serialize';
import { apply } from '../src/core/state/reducer';
import { optionAvailable, resolveDialogue } from '../src/core/story/storyEngine';
import { earnedRewardFixture } from './earnedRewardFixture';
import { resetStorage } from './helpers';

function responseRewardFixture(chained: boolean) {
  const earned = earnedRewardFixture();
  let state = earned.state;
  const narration = CONTENT.story.get('ruon_surrender');
  if (narration?.kind !== 'dialogue') throw new Error('Missing the earned Ruon narration');
  // The 49-command checkpoint earned these rewards. Stage a supported save
  // cursor using real dialogue commands; this does not claim that the live App
  // lets players bypass its mandatory reward modal to reach the response choice.
  const lineCount = resolveDialogue(state, narration).lines.length;
  for (let line = 0; line < lineCount; line++) {
    state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
  }
  expect(state.story.nodeId).toBe('ruon_choice');
  expect(state.pendingChoices).toEqual(earned.state.pendingChoices);
  expect(state.party).toEqual(earned.state.party);
  if (!chained) {
    // Consume the first two actual earned techniques before browser adoption,
    // leaving the last reward as the single-modal case. No debt is fabricated.
    for (const choice of state.pendingChoices.slice(0, -1)) {
      const abilityId = choice.options[0];
      if (choice.kind !== 'ability' || !abilityId) throw new Error('Missing earned technique');
      state = apply(CONTENT, state, {
        type: 'chooseLevelUp',
        unitId: choice.unitId,
        abilityId,
      }).state;
    }
  }
  expect(state.pendingChoices).toHaveLength(chained ? 3 : 1);
  expect(state.pendingChoices.every((choice) => choice.kind === 'ability')).toBe(true);
  expect(state.party.every((unit) => unit.level === 3 && unit.xp === 250)).toBe(true);
  expect(state.location).toEqual(earned.state.location);
  expect(state.world).toEqual(earned.state.world);
  expect(state.flags).toEqual(earned.state.flags);

  const parsed = deserialize(
    serialize(state, {
      label: 'Earned techniques at a supported response cursor',
      summary: 'Real earned rewards; cursor staged with core dialogue commands',
      savedAt: 1_700_000_000_000,
      session: earned.session,
    }),
  );
  if (!parsed.ok) throw new Error(parsed.error);
  const loaded = stateFromBlob(parsed.blob);
  expect(loaded).toEqual(state);
  return { state: loaded, session: parsed.blob.session };
}

for (const chained of [false, true]) {
  for (const key of ['Enter', 'Space'] as const) {
    test(`${chained ? 'chained' : 'single'} earned technique picks return ${key} to response choices`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const fixture = responseRewardFixture(chained);
      await resetStorage(page, '?renderer=canvas');
      await page.evaluate(({ state, session }) => {
        const app = window.fnt!.app;
        app.updateSettings({ reduceMotion: true, storyChoices: 'turns' });
        app.adoptSave(state, session);
      }, fixture);
      expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(fixture.state);
      await expect(page.locator('.dialogue-layer .stage[data-kind="choice"]')).toBeHidden();
      await expect(page.locator('.dialogue-layer')).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator('canvas.map-canvas')).toBeVisible();
      await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toBeFocused();
      const initialCapture = info.outputPath('initial-technique-response-modal.png');
      await page.screenshot({ path: initialCapture });
      await info.attach('initial-technique-response-modal', {
        path: initialCapture,
        contentType: 'image/png',
      });

      let expected = fixture.state;
      for (const [index, choice] of fixture.state.pendingChoices.entries()) {
        const dialog = page.getByRole('dialog');
        await expect(dialog).toHaveCount(1);
        await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
        const abilityId = choice.options[0];
        const ability = abilityId ? CONTENT.abilities.get(abilityId) : undefined;
        if (!ability) throw new Error('Missing first earned technique');
        expected = apply(CONTENT, expected, {
          type: 'chooseLevelUp',
          unitId: choice.unitId,
          abilityId: ability.id,
        }).state;
        const learn = dialog.getByRole('button', { name: `Learn ${ability.name}`, exact: true });
        await learn.focus();
        await page.keyboard.press(key);

        const after = await page.evaluate(() => ({
          state: window.fnt!.app.state!,
          session: window.fnt!.app.session.toMeta(),
          autosave: localStorage.getItem('fnt.save.auto'),
        }));
        expect(after.state).toEqual(expected);
        expect(after.session).toEqual(fixture.session);
        expect(after.state.pendingChoices).toEqual(fixture.state.pendingChoices.slice(index + 1));
        expect(after.state.party.find((unit) => unit.id === choice.unitId)?.abilities).toContain(
          ability.id,
        );
        // Learning consumes only its reward; it must not select the response
        // behind the modal or change the earned route or its story facts.
        expect(after.state.story).toEqual(fixture.state.story);
        expect(after.state.location).toEqual(fixture.state.location);
        expect(after.state.flags).toEqual(fixture.state.flags);
        expect(after.state.screen).toBe('dialogue');
        expect(after.autosave).not.toBeNull();
        const saved = deserialize(after.autosave!);
        if (!saved.ok) throw new Error(saved.error);
        expect(stateFromBlob(saved.blob)).toEqual(expected);
        expect(saved.blob.session).toEqual(fixture.session);
        if (expected.pendingChoices.length) {
          await expect(page.getByRole('dialog')).toHaveCount(1);
          await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toBeFocused();
        }
      }

      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('.dialogue-scene [data-conversation-control="next"]')).toHaveCount(
        0,
      );
      const node = CONTENT.story.get(expected.story.nodeId ?? '');
      if (node?.kind !== 'choice') throw new Error('Expected the real Ruon response choice');
      const optionIndex = node.options.findIndex((option) => optionAvailable(expected, option));
      const option = node.options[optionIndex];
      if (!option) throw new Error('The real choice has no enabled response');
      const response = page.locator('.dialogue-scene .choice-option:not(:disabled)').first();
      await expect(response).toBeVisible();
      await expect(response).toBeEnabled();
      await expect(response).toContainText(option.label);
      // No focus workaround. Returning focus must leave the actual response
      // unselected until the next independent Enter/Space press.
      await expect(response).toBeFocused();
      expect(await page.evaluate(() => window.fnt!.app.state?.story)).toEqual(fixture.state.story);
      const finalCapture = info.outputPath('final-focused-response.png');
      await page.screenshot({ path: finalCapture });
      await info.attach('technique-response-focus', {
        path: finalCapture,
        contentType: 'image/png',
      });

      const selected = apply(CONTENT, expected, { type: 'chooseOption', optionIndex }).state;
      await page.keyboard.press(key);
      await expect.poll(() => page.evaluate(() => window.fnt!.app.state)).toEqual(selected);
      expect(selected.story.deciderIndex).toBe(fixture.state.story.deciderIndex + 1);
      expect(selected.story.nodeId).toBe('escort_chosen');
      expect(selected.story.lineIndex).toBe(0);
      expect(selected.flags.ruon_spared).toBe(true);
      expect(selected.flags.ruon_traded).toBeUndefined();
      const afterSelection = await page.evaluate(() => ({
        session: window.fnt!.app.session.toMeta(),
        autosave: localStorage.getItem('fnt.save.auto'),
      }));
      expect(afterSelection.session).toEqual(fixture.session);
      expect(afterSelection.autosave).not.toBeNull();
      const saved = deserialize(afterSelection.autosave!);
      if (!saved.ok) throw new Error(saved.error);
      expect(stateFromBlob(saved.blob)).toEqual(selected);
      expect(saved.blob.session).toEqual(fixture.session);
      expect(errors).toEqual([]);
    });
  }
}
