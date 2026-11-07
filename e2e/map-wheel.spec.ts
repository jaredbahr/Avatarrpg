import { expect, test, type Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { reachable } from '../src/core/rules/grid';
import { BattleDraft } from '../src/core/state/battleDraft';
import type { Vec2 } from '../src/core/types';
import { liftAt } from '../src/render/geometry/elevation';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { groundPoint } from './projection';

async function readView(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state?.battle;
    const camera = app.rendererCamera();
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    if (!battle || !camera || !canvas) throw new Error('Missing live battlefield.');
    const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
    if (!actor) throw new Error('Missing acting unit.');
    const scene = (
      app as unknown as {
        scene: { enemyOverview: unknown; mode: unknown; pending: Vec2 | null };
      }
    ).scene;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      state: JSON.stringify(app.state),
      session: JSON.stringify(app.session.toMeta()),
      mode: JSON.stringify(scene.mode),
      pending: scene.pending,
      overview: scene.enemyOverview != null,
      backend: app.rendererBackend(),
      battle,
      actor,
      rng: app.state!.rng,
      camera,
      box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      stretch: { x: rect.width / (canvas.width / dpr), y: rect.height / (canvas.height / dpr) },
    };
  });
}

type View = Awaited<ReturnType<typeof readView>>;

function pagePoint(view: View, pos: Vec2): Vec2 {
  const point = groundPoint(view.camera, { x: pos.x + 0.5, y: pos.y + 0.5 });
  return {
    x: view.box.x + point.x * view.stretch.x,
    y: view.box.y + point.y * view.stretch.y,
  };
}

function visibleMoveTarget(view: View): Vec2 {
  const draft = new BattleDraft(CONTENT, view.battle, new RngCursor(view.rng));
  const actor = draft.unit(view.actor.id);
  if (!actor) throw new Error('Missing movement actor.');
  const target = [...reachable(draft.moveContext(actor), actor.pos, actor.move).values()].find(
    ({ pos }) => {
      if (pos.x === actor.pos.x && pos.y === actor.pos.y) return false;
      if (liftAt(view.battle.grid, pos, view.camera.projection) !== 0) return false;
      const point = pagePoint(view, pos);
      return (
        point.x > view.box.x + 24 &&
        point.x < view.box.x + view.box.width - 24 &&
        point.y > view.box.y + 24 &&
        point.y < view.box.y + view.box.height - 24
      );
    },
  );
  if (!target) throw new Error('Missing visible legal movement target.');
  return target.pos;
}

async function showEnemies(page: Page): Promise<void> {
  const more = page.getByRole('button', { name: 'More', exact: true });
  if (await more.isVisible()) await more.click();
  await page.getByRole('button', { name: 'Show enemies', exact: true }).click();
  await settleLayout(page);
}

function expectUnspent(after: View, before: View): void {
  expect(after.state).toBe(before.state);
  expect(after.session).toBe(before.session);
  expect(after.mode).toBe(before.mode);
  expect(after.pending).toEqual(before.pending);
}

async function wheelAt(
  page: Page,
  browserName: string,
  at: Vec2,
  delta: { x: number; y: number },
): Promise<void> {
  expect(
    await page.evaluate(
      (point) =>
        document.elementFromPoint(point.x, point.y) === document.querySelector('.map-canvas'),
      at,
    ),
  ).toBe(true);
  if (browserName === 'webkit') {
    // Mobile WebKit lacks mouse.wheel; exercise the same adapter without skipping it.
    await page.locator('.map-canvas').dispatchEvent('wheel', {
      clientX: at.x,
      clientY: at.y,
      deltaX: delta.x,
      deltaY: delta.y,
      deltaMode: 0,
      ctrlKey: false,
      bubbles: true,
      cancelable: true,
    });
  } else {
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(delta.x, delta.y);
  }
}

const PROFILES = [
  { name: 'desktop Canvas', renderer: 'canvas', width: 1368, height: 912, dpr: 1 },
  { name: 'portrait Canvas', renderer: 'canvas', width: 820, height: 1180, dpr: 2 },
  { name: 'desktop WebGL', renderer: 'webgl', width: 1368, height: 912, dpr: 1 },
] as const;

for (const profile of PROFILES) {
  test.describe(`native map wheel ${profile.name}`, () => {
    test.use({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr,
    });

    test('horizontal wheel retains pending overview and its first-tap return', async ({
      page,
      browserName,
    }, info) => {
      allowSoftwareWebgl(test, profile.renderer);
      await resetStorage(page, `?renderer=${profile.renderer}`);
      await startGame(
        page,
        ['Elias', 'Lorelai', 'Frehley'],
        ['kaya', 'sura', 'bo'],
        'avatar-328-threat-overview',
        { reduceMotion: false },
      );
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      await page.getByRole('button', { name: /^Move/ }).click();
      await settleLayout(page);
      const initial = await readView(page);
      expect(initial.backend).toBe(profile.renderer);
      const target = visibleMoveTarget(initial);
      const point = pagePoint(initial, target);
      expect(
        await page.evaluate(
          (at) => document.elementFromPoint(at.x, at.y) === document.querySelector('.map-canvas'),
          point,
        ),
      ).toBe(true);
      await page.touchscreen.tap(point.x, point.y);
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
      await settleLayout(page);
      const pending = await readView(page);
      expect(pending.pending).toEqual(target);
      expect(pending.state).toBe(initial.state);
      expect(pending.session).toBe(initial.session);

      await showEnemies(page);
      const before = await readView(page);
      expect(before.overview).toBe(true);
      expectUnspent(before, pending);
      await page.screenshot({ path: info.outputPath('overview-before-wheel.png') });

      const centre = {
        x: before.box.x + before.box.width / 2,
        y: before.box.y + before.box.height / 2,
      };
      await wheelAt(page, browserName, centre, { x: 160, y: 0 });
      await settleLayout(page);
      const horizontal = await readView(page);
      expect(horizontal.overview).toBe(true);
      expect(horizontal.camera).toEqual(before.camera);
      expectUnspent(horizontal, before);

      // This tap must return to the actor, not inspect or change the selected move.
      await page.touchscreen.tap(centre.x, centre.y);
      await settleLayout(page);
      const returned = await readView(page);
      expect(returned.overview).toBe(false);
      expectUnspent(returned, pending);
      expect(returned.camera.tilePx).toBe(pending.camera.tilePx);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.screenshot({ path: info.outputPath('actor-after-return.png') });

      // Nonzero vertical wheel is still manual zoom intent, even at zoom limits.
      await showEnemies(page);
      const beforeVertical = await readView(page);
      expect(beforeVertical.overview).toBe(true);
      await wheelAt(
        page,
        browserName,
        {
          x: beforeVertical.box.x + beforeVertical.box.width / 2,
          y: beforeVertical.box.y + beforeVertical.box.height / 2,
        },
        { x: 0, y: -240 },
      );
      await settleLayout(page);
      const vertical = await readView(page);
      expect(vertical.overview).toBe(false);
      expect(vertical.camera.tilePx).toBeGreaterThan(beforeVertical.camera.tilePx);
      expectUnspent(vertical, pending);
      await page.screenshot({ path: info.outputPath('vertical-zoom-control.png') });
      await info.attach('wheel-navigation-readback', {
        body: JSON.stringify({
          profile,
          browserName,
          wheelProtocol:
            browserName === 'webkit' ? 'canvas WheelEvent dispatch' : 'native browser mouse.wheel',
          pending,
          before,
          horizontal,
          returned,
          beforeVertical,
          vertical,
        }),
        contentType: 'application/json',
      });
    });
  });
}
