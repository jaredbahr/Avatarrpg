import { expect, test } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleMapCanvas,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import { paintedTileCentre } from './projection';

const oilHint = 'and it lights any oil the target stands in.';
const flask = { x: 12, y: 4 };
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'ipad-landscape', width: 1194, height: 834 },
] as const;
const levelThreeChoices = ['fire_blast', 'fire_step'] as const;

for (const choice of levelThreeChoices) {
  for (const viewport of viewports) {
    test(`Kaya ${choice} header and target refit at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetStorage(page, '?renderer=canvas');
      await startGame(page, ['Explorer'], ['kaya'], 'ability-header-layout');
      await enterNode(page, 'battle_quarry_gate');
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);

      // Stage Kaya's level-three choice and position beside the authored flask. The ability, tap,
      // targeting rules and preview still run through the real player controls.
      await page.evaluate((chosen) => {
        const app = window.fnt?.app;
        const state = app?.state;
        const battle = state?.battle;
        const hero = battle?.units.find((unit) => unit.faction === 'party');
        if (!app || !state || !battle || !hero) throw new Error('No quarry battle hero.');
        const kaya = app.content.characters.get('kaya');
        if (
          !kaya?.kit.some(
            (entry) => entry.level === 2 && 'ability' in entry && entry.ability === 'flame_arc',
          ) ||
          !kaya.kit.some(
            (entry) => entry.level === 3 && 'choose' in entry && entry.choose.includes(chosen),
          )
        )
          throw new Error('Kaya no longer has the staged level-three kit.');
        app.state = {
          ...state,
          battle: {
            ...battle,
            units: battle.units.map((unit) =>
              unit.id === hero.id
                ? {
                    ...unit,
                    level: 3,
                    abilities: ['fire_jab', 'flame_arc', chosen],
                    pos: { x: 11, y: 4 },
                  }
                : unit,
            ),
            turnIndex: battle.order.indexOf(hero.id),
          },
        };
        app.resync();
      }, choice);

      const originalDescription = await page.evaluate(() => {
        const ability = window.fnt?.app.content.abilities.get('fire_jab');
        if (!ability) throw new Error('Fire Jab is missing.');
        return ability.description;
      });
      const abilities = await page.evaluate(() => {
        const app = window.fnt?.app;
        const battle = app?.state?.battle;
        const hero = battle?.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
        if (!app || !hero) throw new Error('No acting Kaya.');
        return [...hero.abilities, ...app.content.universalAbilities].map((id) => {
          const ability = app.content.abilities.get(id);
          if (!ability) throw new Error(`Unknown ability: ${id}`);
          return { name: ability.name, id };
        });
      });
      expect(abilities.map((ability) => ability.id)).toEqual([
        'fire_jab',
        'flame_arc',
        choice,
        'shove',
      ]);

      const setDescription = async (description: string) => {
        await page.evaluate((copy) => {
          const app = window.fnt?.app;
          const abilities = app?.content.abilities as
            Map<string, { description: string }> | undefined;
          const ability = abilities?.get('fire_jab');
          if (!app || !abilities || !ability) throw new Error('Fire Jab is missing.');
          abilities.set('fire_jab', { ...ability, description: copy });
          app.resync();
        }, description);
      };

      const readGeometry = () =>
        page.evaluate((hint) => {
          const header = document.querySelector<HTMLElement>('.ability-header');
          const description = header?.querySelector<HTMLElement>('.header-desc');
          const name = header?.querySelector<HTMLElement>('strong');
          const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
          const button = [...document.querySelectorAll<HTMLButtonElement>('.action-button')].find(
            (candidate) => candidate.textContent?.includes('Fire Jab'),
          );
          if (!header || !description || !name || !canvas || !button)
            throw new Error('Combat header fixture is incomplete.');
          const box = description.getBoundingClientRect();
          const text = description.firstChild;
          const hintStart = text?.textContent?.indexOf(hint) ?? -1;
          const range = document.createRange();
          if (text && hintStart >= 0) {
            range.setStart(text, hintStart);
            range.setEnd(text, hintStart + hint.length);
          }
          const hintRects = [...range.getClientRects()];
          const epsilon = 1;
          return {
            headerHeight: header.getBoundingClientRect().height,
            canvasTop: canvas.getBoundingClientRect().top,
            canvasHeight: canvas.getBoundingClientRect().height,
            descriptionHeight: box.height,
            descriptionScrollHeight: description.scrollHeight,
            descriptionLineClamp: getComputedStyle(description).webkitLineClamp,
            descriptionText: description.textContent,
            oilHintFits:
              hintStart >= 0 &&
              hintRects.length > 0 &&
              hintRects.every(
                (rect) =>
                  rect.left >= box.left - epsilon &&
                  rect.right <= box.right + epsilon &&
                  rect.top >= box.top - epsilon &&
                  rect.bottom <= box.bottom + epsilon,
              ),
            name: name.textContent,
            nameWidth: name.clientWidth,
            nameScrollWidth: name.scrollWidth,
            buttonHeight: button.getBoundingClientRect().height,
          };
        }, oilHint);

      for (const largeText of ['off', 'huge'] as const) {
        await setLargeText(page, largeText);
        await settleMapCanvas(page);

        const selectAndPick = async (description: string) => {
          await setDescription(description);
          await page.getByRole('button', { name: /^Fire Jab/ }).click();
          // The level-three fixture moved Kaya near the flask. The visible turn
          // strip's Focus control makes that adjacent target visible at Huge text.
          await page.getByRole('button', { name: 'Focus Kaya', exact: true }).first().click();
          await settleMapCanvas(page);
          const geometry = await readGeometry();
          const point = await paintedTileCentre(page, flask);
          expect(point, `${viewport.name}/${largeText}: no flask point`).not.toBeNull();
          if (!point) throw new Error('No flask point.');
          const box = await page.locator('.map-canvas').boundingBox();
          if (!box) throw new Error('No combat canvas.');
          expect(point.x).toBeGreaterThan(box.x);
          expect(point.x).toBeLessThan(box.x + box.width);
          expect(point.y).toBeGreaterThan(box.y);
          expect(point.y).toBeLessThan(box.y + box.height);
          await page.mouse.click(point.x, point.y);
          await expect(page.locator('.confirm-bar')).toContainText('Oil Flask');
          await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
          await page.getByRole('button', { name: 'Cancel', exact: true }).click();
          await page.getByRole('button', { name: 'Cancel', exact: true }).click();
          return geometry;
        };

        const short = await selectAndPick('A quick flame strike.');
        const long = await selectAndPick(originalDescription);
        const label = `${viewport.name}/${largeText}`;
        expect(short.descriptionLineClamp, label).toBe('2');
        expect(long.descriptionLineClamp, label).toBe('2');
        expect(short.descriptionText).toBe('A quick flame strike.');
        expect(long.descriptionText).toContain(oilHint);
        expect(long.name).toBe('Fire Jab');
        expect(long.nameWidth).toBeGreaterThanOrEqual(long.nameScrollWidth);
        expect(long.descriptionHeight).toBeLessThanOrEqual(long.headerHeight);
        expect(short.descriptionHeight).toBeLessThan(long.headerHeight);
        expect(long.headerHeight, label).toBeCloseTo(short.headerHeight, 1);
        expect(long.canvasTop, label).toBeCloseTo(short.canvasTop, 1);
        expect(long.canvasHeight, label).toBeCloseTo(short.canvasHeight, 1);
        expect(long.buttonHeight).toBeGreaterThanOrEqual(48);
        if (largeText === 'off') {
          expect(long.descriptionScrollHeight, label).toBeLessThanOrEqual(
            long.descriptionHeight + 1,
          );
          expect(long.oilHintFits, `${label}: the full oil hint must be visible`).toBe(true);
        }

        // Every action Kaya can select with this legal level-three choice must leave the
        // board where the Fire Jab selection put it, even with different copy.
        for (const ability of abilities) {
          await page.locator('.action-button').filter({ hasText: ability.name }).click();
          await settleMapCanvas(page);
          const selected = await readGeometry();
          expect(selected.name, `${label}/${ability.id}`).toBe(ability.name);
          expect(selected.headerHeight, `${label}/${ability.id}`).toBeCloseTo(long.headerHeight, 1);
          expect(selected.canvasTop, `${label}/${ability.id}`).toBeCloseTo(long.canvasTop, 1);
          expect(selected.canvasHeight, `${label}/${ability.id}`).toBeCloseTo(long.canvasHeight, 1);
          await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        }
      }
    });
  }
}
