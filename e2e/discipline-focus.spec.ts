import { expect, test } from '@playwright/test';
import { CONTENT } from '../src/content';
import { awardXp, disciplineUnlocked, xpForLevel } from '../src/core/rules/leveling';
import { reconcileDisciplines } from '../src/core/save/reconcile';
import { deserialize, serialize, stateFromBlob } from '../src/core/save/serialize';
import { createGame } from '../src/core/state/createGame';
import { apply } from '../src/core/state/reducer';
import { earnedRewardFixture } from './earnedRewardFixture';
import { resetStorage } from './helpers';

function disciplineFixture(presentation: 'retained world' | 'plain fallback', chained: boolean) {
  const earned = earnedRewardFixture();
  let state = earned.state;
  let session = earned.session;
  if (presentation === 'retained world') {
    // Preserve the earned Ruon dialogue/location/world boundary, resolving its
    // original level-3 techniques through actual commands before adding XP.
    for (const choice of state.pendingChoices) {
      const abilityId = choice.options[0];
      if (choice.kind !== 'ability' || !abilityId) throw new Error('Missing earned technique');
      state = apply(CONTENT, state, {
        type: 'chooseLevelUp',
        unitId: choice.unitId,
        abilityId,
      }).state;
    }
    state = {
      ...state,
      party: state.party.map((unit, index) => {
        if (!chained && index > 0) return unit;
        const character = unit.characterId ? CONTENT.characters.get(unit.characterId) : undefined;
        return awardXp(CONTENT, unit, xpForLevel(5) - unit.xp, character).unit;
      }),
    };
  } else {
    const characters = chained ? ['nilak', 'sura'] : ['nilak'];
    state = createGame(CONTENT, {
      seed: `discipline-focus-plain-${chained}`,
      startNode: 'ruon_surrender',
      party: characters.map((characterId) => {
        const character = CONTENT.characters.get(characterId);
        if (!character) throw new Error(`Missing ${characterId}`);
        return {
          characterId,
          level: 5,
          chosen: character.kit.flatMap((entry) => ('choose' in entry ? [entry.choose[0]] : [])),
        };
      }),
    });
    state = { ...state, party: state.party.map((unit) => ({ ...unit, xp: xpForLevel(5) })) };
    session = {
      players: state.party.map((unit, index) => ({ name: `Reader ${index + 1}`, unitId: unit.id })),
      soloPlay: !chained,
    };
  }
  state = reconcileDisciplines(CONTENT, state);
  if (
    state.pendingChoices.length !== (chained ? state.party.length : 1) ||
    state.pendingChoices.some((choice) => choice.kind !== 'discipline')
  )
    throw new Error('Expected only the staged level-5 discipline debts');

  // These are supported save fixtures, not a claim that Act1 earned level 5.
  // Retained-world fixtures add XP with awardXp; plain fixtures start at level 5
  // with canonical 700 XP and an intentionally absent map for the fallback UI.
  const json = serialize(state, {
    label: 'Supported level-5 discipline focus fixture',
    summary: 'Explicit extra-XP or level fixture; not an earned level-5 campaign',
    savedAt: 1_700_000_000_000,
    session,
  });
  const parsed = deserialize(json);
  if (!parsed.ok) throw new Error(parsed.error);
  const loaded = stateFromBlob(parsed.blob);
  expect(loaded).toEqual(state);
  return { state: loaded, session: parsed.blob.session };
}

for (const presentation of ['retained world', 'plain fallback'] as const) {
  for (const chained of [false, true]) {
    for (const key of ['Enter', 'Space'] as const) {
      test(`${chained ? 'chained' : 'single'} discipline picks return ${key} to ${presentation} dialogue`, async ({
        page,
      }, info) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const fixture = disciplineFixture(presentation, chained);
        await resetStorage(page, '?renderer=canvas');
        await page.evaluate(({ state, session }) => {
          const app = window.fnt!.app;
          app.updateSettings({ reduceMotion: true });
          app.adoptSave(state, session);
        }, fixture);
        expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(fixture.state);
        if (presentation === 'retained world') {
          await expect(page.locator('.dialogue-layer .stage[data-kind="dialogue"]')).toBeVisible();
          await expect(page.locator('canvas.map-canvas')).toBeVisible();
        } else {
          await expect(page.locator('.dialogue-scene .stage[data-kind="dialogue"]')).toBeVisible();
          await expect(page.locator('.dialogue-layer')).toHaveCount(0);
        }
        await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toBeFocused();
        const initialCapture = info.outputPath('initial-discipline-modal.png');
        await page.screenshot({ path: initialCapture });
        await info.attach('initial-discipline-modal', {
          path: initialCapture,
          contentType: 'image/png',
        });

        let expected = fixture.state;
        for (const choice of fixture.state.pendingChoices) {
          const dialog = page.getByRole('dialog');
          await expect(dialog).toHaveCount(1);
          await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
          const discipline = choice.options
            .map((id) => CONTENT.disciplines.get(id))
            .find((path) => path && disciplineUnlocked(path, expected.flags));
          if (!discipline) throw new Error('No unlocked discipline in the fixture');
          const command = {
            type: 'chooseDiscipline' as const,
            unitId: choice.unitId,
            disciplineId: discipline.id,
          };
          expected = apply(CONTENT, expected, command).state;
          const pick = dialog.getByRole('button', {
            name: `Take up ${discipline.name}`,
            exact: true,
          });
          await pick.focus();
          await page.keyboard.press(key);

          const after = await page.evaluate(() => ({
            state: window.fnt!.app.state!,
            session: window.fnt!.app.session.toMeta(),
            autosave: localStorage.getItem('fnt.save.auto'),
          }));
          // Compare the complete reducer result, including discipline, kit,
          // pending queue and log; the keyboard must not also consume a line.
          expect(after.state).toEqual(expected);
          expect(after.session).toEqual(fixture.session);
          expect(after.state.story).toEqual(fixture.state.story);
          expect(after.state.location).toEqual(fixture.state.location);
          expect(after.state.flags).toEqual(fixture.state.flags);
          expect(after.state.party.find((unit) => unit.id === choice.unitId)?.disciplineId).toBe(
            discipline.id,
          );
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
        const next = page.locator('.dialogue-scene [data-conversation-control="next"]');
        await expect(next).toHaveCount(1);
        await expect(next).toBeVisible();
        await expect(next).toBeEnabled();
        // No focus workaround: the final discipline must return to the live
        // replacement; intermediate closes must leave the next modal in charge.
        await expect(next).toBeFocused();
        expect(await page.evaluate(() => window.fnt!.app.state?.story.lineIndex)).toBe(0);
        const finalCapture = info.outputPath('final-focused-next.png');
        await page.screenshot({ path: finalCapture });
        await info.attach('discipline-dialogue-focus', {
          path: finalCapture,
          contentType: 'image/png',
        });
        await page.keyboard.press(key);
        const advanced = apply(CONTENT, expected, { type: 'advanceDialogue' }).state;
        await expect.poll(() => page.evaluate(() => window.fnt!.app.state)).toEqual(advanced);
        expect(advanced.story.lineIndex).toBe(1);
        expect(advanced.story.nodeId).toBe('ruon_surrender');
        expect(errors).toEqual([]);
      });
    }
  }
}
