import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';
import { screenshotPixels } from './pixels';
import type { MapView } from '../src/render/view';

for (const renderer of ['canvas', 'webgl']) {
  test(`Look around → Visit Gao settles the party during conversation on ${renderer}`, async ({
    page,
  }) => {
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Kaya'], ['sura', 'kaya'], 'gao-conversation-settle', {
      reduceMotion: false,
    });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);

    await page.getByRole('button', { name: 'Look around', exact: true }).click();
    await page.getByRole('button', { name: /Visit Gao/ }).click();
    await expect(page.locator('.explore-conversation')).toBeVisible();
    // Conversation remains usable while the already-authorized follower route
    // finishes and gathers; entering it must not cancel or restart that route.
    await expect(page.locator('[data-conversation-control="next"]')).toBeEnabled();
    await page.waitForFunction(
      () =>
        new Promise<boolean>((resolve) => {
          const app = window.fnt!.app;
          const stable = (frames: number) => {
            if (frames === 0) return resolve(!app.animator.busy(performance.now()));
            requestAnimationFrame(() => {
              if (app.animator.busy(performance.now())) return resolve(false);
              stable(frames - 1);
            });
          };
          stable(3);
        }),
      undefined,
      { timeout: 20_000 },
    );
    const settled = await page.evaluate(() => {
      const app = window.fnt!.app;
      const scene = (
        app as unknown as {
          scene: {
            grid: {
              width: number;
              tiles: readonly {
                terrain: string;
                surface: { id: string; duration: number } | null;
              }[];
            };
          };
        }
      ).scene;
      const seats = app.partyPositions() ?? [];
      const npcCells = new Set(
        app.content.maps
          .get(app.state!.location.mapId)
          ?.npcs.map((npc) => `${npc.pos.x},${npc.pos.y}`),
      );
      return seats.map((seat) => ({
        ...seat,
        dry: (() => {
          const tile = scene.grid.tiles[seat.y * scene.grid.width + seat.x];
          return (
            tile?.terrain !== 'water_deep' &&
            !(tile?.surface?.id === 'water' && tile.surface.duration === -1)
          );
        })(),
        npc: npcCells.has(`${seat.x},${seat.y}`),
      }));
    });
    expect(settled).toHaveLength(2);
    expect(new Set(settled.map(({ x, y }) => `${x},${y}`)).size).toBe(2);
    for (const seat of settled) {
      expect(seat.dry).toBe(true);
      expect(seat.npc).toBe(false);
    }
  });

  test(`shopfront Talk chooses Gao on ${renderer}`, async ({ page }) => {
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(
      page,
      ['Nima', 'Kaya', 'Sura', 'Bo', 'Wen'],
      ['nima', 'kaya', 'sura', 'bo', 'wen'],
      'shopfront',
      { reduceMotion: false },
    );
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 10, y: 4 } }));
    await waitForIdle(page);
    await page.getByRole('button', { name: 'Follow party', exact: true }).click();
    const talk = page.getByRole('button', { name: /^Talk/ });
    await expect(talk).toContainText('Gao');
    await talk.click();
    await expect(page.locator('.explore-conversation, .dialogue-scene').first()).toBeVisible();
    expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('gao_friendly');
  });

  test(`ground ring cannot cover Mira on ${renderer}`, async ({ page }) => {
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(
      page,
      ['Nima', 'Kaya', 'Sura', 'Bo', 'Wen'],
      ['nima', 'kaya', 'sura', 'bo', 'wen'],
      'shopfront',
      { reduceMotion: false },
    );
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 10, y: 4 } }));
    await waitForIdle(page);
    await page.getByRole('button', { name: 'Follow party', exact: true }).click();
    const talk = page.getByRole('button', { name: /^Talk/ });
    await expect(talk).toContainText('Gao');
    const probe = await page.evaluate(() => {
      const app = window.fnt!.app;
      const scene = (app as unknown as { scene: { renderer: { draw(view: MapView): void } } })
        .scene;
      const draw = scene.renderer.draw.bind(scene.renderer);
      const win = window as Window & { hideGroundRing?: boolean; ringProbePresented?: boolean };
      // The probe freezes time already. Present each ring state once so software
      // WebGL does not redraw an identical scene throughout screenshot capture.
      let lastHidden: boolean | undefined;
      scene.renderer.draw = (view) => {
        const hidden = Boolean(win.hideGroundRing);
        if (hidden === lastHidden) return;
        lastHidden = hidden;
        draw({
          ...view,
          time: 1000,
          activeUnitId: hidden ? null : view.activeUnitId,
          selectedUnitId: null,
        });
        win.ringProbePresented = hidden;
      };
      const camera = app.rendererCamera()!;
      const m = camera.groundTransform;
      // Mira stands one diagonal step in front of the leader. Her upper torso
      // crosses the bottom of the leader's ring in this actual composition.
      const x = 11.5 * 64,
        y = 5.5 * 64;
      return {
        x: m.a * x + m.c * y + m.tx,
        y: m.b * x + m.d * y + m.ty - (54 * camera.tilePx) / 64,
      };
    });
    const canvas = page.locator('.map-canvas');
    expect(Number.isFinite(probe.x) && Number.isFinite(probe.y)).toBe(true);
    await page.waitForFunction(
      () => (window as Window & { ringProbePresented?: boolean }).ringProbePresented === false,
    );
    const withRing = await screenshotPixels(canvas);
    await page.evaluate(() => {
      (window as Window & { hideGroundRing?: boolean }).hideGroundRing = true;
    });
    await page.waitForFunction(
      () => (window as Window & { ringProbePresented?: boolean }).ringProbePresented === true,
    );
    const withoutRing = await screenshotPixels(canvas);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const a = withRing.at(probe.x + dx, probe.y + dy);
        const b = withoutRing.at(probe.x + dx, probe.y + dy);
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        if (!a || !b) throw new Error('Occlusion probe is outside the canvas');
        // Allow the source art's nearly opaque edge and raster rounding. The
        // old overlay changed these channels by roughly 60–140 levels.
        for (const channel of ['r', 'g', 'b'] as const)
          expect(Math.abs(a[channel] - b[channel])).toBeLessThanOrEqual(3);
      }
  });
}
