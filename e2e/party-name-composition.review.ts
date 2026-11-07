/** Rendered name-entry regression; Chromium IME protocol, not physical OS input. */
import { expect, test, type Locator } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resetStorage } from './helpers';

interface KeyObservation {
  key: string;
  isComposing: boolean;
}
type NameReviewWindow = Window & { nameReviewKeys: KeyObservation[] };

for (const portrait of [false, true]) {
  for (const composing of [false, true]) {
    test(`player name: ${portrait ? 'portrait touch' : 'desktop'}, ${composing ? 'IME' : 'ordinary'} Enter`, async ({
      page,
    }, info) => {
      await page.setViewportSize(
        portrait ? { width: 834, height: 1194 } : { width: 1368, height: 912 },
      );
      const activate = async (control: Locator) => {
        if (portrait) await control.tap();
        else await control.click();
      };
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await resetStorage(page);
      await activate(page.getByRole('button', { name: /new game/i }));
      await activate(page.getByRole('button', { name: '1 player', exact: true }));
      await activate(page.getByRole('button', { name: 'Continue', exact: true }));
      const input = page.getByRole('textbox', { name: 'Your name' });
      await input.fill('');
      await input.focus();
      await page.evaluate(() => {
        const review = window as unknown as NameReviewWindow;
        review.nameReviewKeys = [];
        document.addEventListener(
          'keydown',
          (event) => {
            review.nameReviewKeys.push({ key: event.key, isComposing: event.isComposing });
          },
          true,
        );
      });
      const name = composing ? '明子' : 'Aster';
      try {
        if (composing) {
          const cdp = await page.context().newCDPSession(page);
          await cdp.send('Input.imeSetComposition', {
            text: '明',
            selectionStart: 1,
            selectionEnd: 1,
          });
          await page.keyboard.press('Enter');
          await expect(input, 'composition confirmation keeps name entry open').toBeVisible();
          await expect(input).toBeFocused();
          await expect(input).toHaveValue('明');
          await expect(page.getByRole('heading', { name: 'Pick your path' })).toHaveCount(0);
          expect(
            await page.evaluate(() => (window as unknown as NameReviewWindow).nameReviewKeys),
          ).toContainEqual({ key: 'Enter', isComposing: true });
          await page.screenshot({ path: info.outputPath('composition-retained.png') });
          await cdp.send('Input.insertText', { text: '明' });
          await page.keyboard.type('子');
          await expect(input).toHaveValue(name);
          await page.keyboard.press('Enter');
          await cdp.detach();
        } else {
          await page.keyboard.type(`  ${name}  `);
          await page.keyboard.press('Enter');
        }
        await expect(page.getByRole('heading', { name: 'Pick your path' })).toBeVisible();
        await expect(page.locator('.setup-panel > p').first()).toHaveText(name);
        // Explicit Next retains the existing blank-name fallback after going Back.
        if (!composing) {
          await activate(page.getByRole('button', { name: 'Back', exact: true }));
          await input.fill('   ');
          await activate(page.getByRole('button', { name: 'Next', exact: true }));
          await expect(page.locator('.setup-panel > p').first()).toHaveText('Player 1');
          await activate(page.getByRole('button', { name: 'Back', exact: true }));
          await input.fill(` ${name} `);
          await activate(page.getByRole('button', { name: 'Next', exact: true }));
          await expect(page.locator('.setup-panel > p').first()).toHaveText(name);
        }
        await activate(page.locator('.pick-card').first());
        await activate(page.getByRole('button', { name: 'Next', exact: true }));
        await activate(page.locator('.character-card').first());
        await activate(page.getByRole('button', { name: 'Confirm', exact: true }));
        await activate(page.getByRole('button', { name: /^Begin$/ }));
        await expect
          .poll(() => page.evaluate(() => window.fnt!.app.session.players.map((p) => p.name)))
          .toEqual([name]);
        expect(await page.evaluate(() => window.fnt!.app.state !== null)).toBe(true);
        expect(errors).toEqual([]);
        await page.screenshot({ path: info.outputPath('game-started.png') });
      } finally {
        writeFileSync(
          info.outputPath('name-observation.json'),
          JSON.stringify(
            {
              portrait,
              composing,
              expectedName: name,
              keys: await page.evaluate(
                () => (window as unknown as NameReviewWindow).nameReviewKeys,
              ),
              scene: await page.locator('.scene').first().getAttribute('class'),
              players: await page.evaluate(() => window.fnt!.app.session.players),
              errors,
              protocol:
                'real setup controls, Chromium IME composition plus keyboard Enter; normal clock; no synthetic key or fabricated game state',
              limits:
                'local Chromium viewport/input protocol only; physical IME, WebKit/Safari/PWA follow-ups remain',
            },
            null,
            2,
          ),
        );
      }
    });
  }
}
