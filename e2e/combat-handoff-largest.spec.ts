import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { resetStorage, setLargeText, settleLayout } from './helpers';

const LONG_NAME = 'WWWWWWWWWWWW';
const VIEWPORT = { width: 1180, height: 820 };

for (const renderer of ['canvas', 'webgl'] as const) {
  test.describe(renderer, () => {
    test.use({ viewport: VIEWPORT, deviceScaleFactor: 2 });

    test('Largest combat hand-off clears the real Forest Road caption', async ({ page }, info) => {
      allowSoftwareWebgl(test, renderer);
      await resetStorage(page, `?renderer=${renderer}`);
      await page.evaluate((handoffName) => {
        const app = window.fnt!.app;
        app.updateSettings({ reduceMotion: true });
        app.newGame(
          [
            { name: 'Player 1', unitId: '', participantId: 'player-1' },
            { name: 'Player 2', unitId: '', participantId: 'player-2' },
          ],
          [{ characterId: 'riko' }, { characterId: 'bo' }],
          'combat-handoff-largest',
          [
            { id: 'player-1', name: 'Player 1', handoffName },
            { id: 'player-2', name: 'Player 2' },
          ],
        );
      }, LONG_NAME);
      await setLargeText(page, 'huge');

      const before = await page.evaluate(() => {
        const app = window.fnt!.app;
        const events = app.dispatch({ type: 'enterNode', nodeId: 'battle_forest_road' });
        const battle = app.state?.battle;
        const started = events.find((event) => event.type === 'battleStarted');
        const intro = events.find((event) => event.type === 'message');
        if (!battle || started?.encounterId !== 'enc_forest_road' || !intro?.text) {
          throw new Error('The public story command did not start the real Forest Road encounter');
        }
        const active = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
        return { intro: intro.text, active, state: app.state, session: app.session.toMeta() };
      });
      expect(before.active).toMatchObject({ faction: 'party', characterId: 'riko' });

      const card = page.locator('.combat-scene .handoff-banner:not(.result-banner) > .panel');
      const ready = card.getByRole('button', { name: "I'm ready", exact: true });
      const caption = page
        .locator('.toasts .toast')
        .and(page.getByText(before.intro, { exact: true }));
      await expect(card.getByRole('heading')).toHaveText(LONG_NAME);
      await expect(card.getByText('Playing Riko', { exact: true })).toBeVisible();
      await expect(caption).toBeVisible();

      const geometry = await card.evaluate((panel, intro) => {
        function find(selector: string, within: ParentNode = document): HTMLElement {
          const element = within.querySelector<HTMLElement>(selector);
          if (!element) throw new Error(`Missing ${selector}`);
          return element;
        }
        function box(element: Element) {
          const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
          return { left, top, right, bottom, width, height };
        }
        const caption = [...document.querySelectorAll<HTMLElement>('.toasts .toast')].find(
          (toast) => toast.textContent === intro,
        );
        if (!caption) throw new Error('The authored caption expired before the geometry sample');
        const toast = box(caption);
        const app = window.fnt!.app;
        const button = find('button', panel);
        const controls = [...panel.children].map((child) => {
          if (!(child instanceof HTMLElement)) throw new Error('Unexpected hand-off control');
          const rect = box(child);
          return {
            text: child.textContent,
            ...rect,
            intersectsCaption:
              rect.left < toast.right &&
              toast.left < rect.right &&
              rect.top < toast.bottom &&
              toast.top < rect.bottom,
          };
        });
        const ready = box(button);
        const hit = document.elementFromPoint(
          (ready.left + ready.right) / 2,
          (ready.top + ready.bottom) / 2,
        );
        const style = getComputedStyle(document.documentElement);
        const token = style.getPropertyValue('--tap').trim();
        const tap = parseFloat(token) * (token.endsWith('rem') ? parseFloat(style.fontSize) : 1);
        const title = find('.combat-bar .title-plate-name');
        const pause = find('.combat-bar .combat-pause');
        const name = title.firstChild;
        if (!name || name.nodeType !== Node.TEXT_NODE)
          throw new Error('Missing encounter title text');
        const range = document.createRange();
        range.setStart(name, 0);
        range.setEnd(name, 4);
        return {
          viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
          backend: app.rendererBackend(),
          projection: app.rendererCamera()?.projection,
          largeText: app.settings.largeText,
          state: app.state,
          session: app.session.toMeta(),
          board: box(find('.combat-scene .map-canvas')),
          panel: box(panel),
          toast,
          title: {
            ...box(title),
            text: title.textContent,
            firstFour: range.getBoundingClientRect().width,
          },
          pause: box(pause),
          ready,
          readyHit: button.contains(hit),
          tap,
          controls,
        };
      }, before.intro);
      await info.attach('combat-handoff-before-ready', {
        body: JSON.stringify(geometry, null, 2),
        contentType: 'application/json',
      });

      expect(geometry.viewport).toEqual({ ...VIEWPORT, dpr: 2 });
      expect(geometry.backend).toBe(renderer);
      expect(geometry.projection).toBe('topdown');
      expect(geometry.largeText).toBe('huge');
      expect(geometry.state).toEqual(before.state);
      expect(geometry.session).toEqual(before.session);
      expect(geometry.controls.map(({ text }) => text)).toEqual([
        'Hand the tablet to',
        LONG_NAME,
        'Playing Riko',
        "I'm ready",
      ]);
      expect.soft(Number.isFinite(geometry.tap) && geometry.tap > 0).toBe(true);
      expect.soft(geometry.title.text).toBe('Ambush on the Forest Road');
      expect.soft(geometry.title.firstFour).toBeGreaterThan(0);
      expect.soft(geometry.title.width).toBeGreaterThanOrEqual(geometry.title.firstFour);
      expect.soft(geometry.pause.width).toBeGreaterThanOrEqual(geometry.tap);
      expect.soft(geometry.pause.height).toBeGreaterThanOrEqual(geometry.tap);
      expect.soft(geometry.board.height).toBeGreaterThanOrEqual(VIEWPORT.height * 0.4);
      for (const rect of [geometry.panel, geometry.toast, geometry.pause, ...geometry.controls]) {
        expect.soft(rect.left).toBeGreaterThanOrEqual(0);
        expect.soft(rect.top).toBeGreaterThanOrEqual(0);
        expect.soft(rect.right).toBeLessThanOrEqual(VIEWPORT.width);
        expect.soft(rect.bottom).toBeLessThanOrEqual(VIEWPORT.height);
      }
      for (const control of geometry.controls) {
        expect.soft(control.intersectsCaption, control.text ?? '').toBe(false);
      }
      expect.soft(geometry.ready.width).toBeGreaterThanOrEqual(geometry.tap);
      expect.soft(geometry.ready.height).toBeGreaterThanOrEqual(geometry.tap);
      expect.soft(geometry.readyHit).toBe(true);

      await ready.tap();
      await expect(card).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Move\b/ })).toBeVisible();
      await settleLayout(page);
      const after = await page.evaluate(() => ({
        state: window.fnt!.app.state,
        session: window.fnt!.app.session.toMeta(),
        boardHeight: document.querySelector('.combat-scene .map-canvas')!.getBoundingClientRect()
          .height,
      }));
      expect(after.state).toEqual(before.state);
      expect(after.session).toEqual(before.session);
      expect(after.boardHeight).toBeGreaterThanOrEqual(VIEWPORT.height * 0.4);
    });
  });
}
