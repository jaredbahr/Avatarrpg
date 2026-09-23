import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';
import { pixelsFromDataUrl } from './pixels';
import type { MapView } from '../src/render/view';

for (const renderer of ['canvas', 'webgl']) {
  test(`Look around → Visit Gao settles the party during conversation on ${renderer}`, async ({
    page,
  }) => {
    allowSoftwareWebgl(test, renderer);
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
          // Authored NpcDefs, not resident-bound: pos is always set.
          ?.npcs.map((npc) => `${npc.pos!.x},${npc.pos!.y}`),
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
    allowSoftwareWebgl(test, renderer);
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
    allowSoftwareWebgl(test, renderer);
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
    /*
     * Both captures are drawn and read back inside one turn, so no compositor
     * step and no other frame can land between them. A screenshot cannot make
     * that promise: the page may present another frame, or resize the board,
     * while the capture is on its way, and on a software rasteriser that window
     * is seconds wide. Run 35568889528 measured this probe at 15 and then 146
     * levels of difference on WebKit, where 3 are allowed, because the two ring
     * states were read off two different frames.
     */
    const probe = await page.evaluate(() => {
      const app = window.fnt!.app;
      const renderer = (
        app as unknown as {
          scene: {
            renderer: {
              camera: unknown;
              lastView: MapView | null;
              backend: { draw(view: MapView, camera: unknown): void };
            };
          };
        }
      ).scene.renderer;
      const view = renderer.lastView;
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!view || !canvas) throw new Error('the board has not been drawn yet');
      // One draw per ring state, read back before the turn ends: the drawing
      // buffer still holds what that draw wrote. Both draws share one view, so
      // the ring is the only thing that can differ between the two.
      const capture = (activeUnitId: string | null) => {
        renderer.backend.draw({ ...view, activeUnitId }, renderer.camera);
        return canvas.toDataURL('image/png');
      };
      const withRing = capture(view.activeUnitId);
      const withoutRing = capture(null);
      const camera = app.rendererCamera()!;
      const m = camera.groundTransform;
      // Mira stands one diagonal step in front of the leader. Her upper torso
      // crosses the bottom of the leader's ring in this actual composition.
      const x = 11.5 * 64,
        y = 5.5 * 64;
      return {
        withRing,
        withoutRing,
        // The crop is read in the canvas' own device pixels.
        scale: canvas.width / canvas.getBoundingClientRect().width,
        x: m.a * x + m.c * y + m.tx,
        y: m.b * x + m.d * y + m.ty - (54 * camera.tilePx) / 64,
      };
    });
    expect(Number.isFinite(probe.x) && Number.isFinite(probe.y)).toBe(true);
    // Hiding the ring has to change the board, or the crop below would pass
    // without measuring anything.
    expect(probe.withRing, 'hiding the ring must change the board').not.toBe(probe.withoutRing);
    const withRing = pixelsFromDataUrl(probe.withRing);
    const withoutRing = pixelsFromDataUrl(probe.withoutRing);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const a = withRing.at((probe.x + dx) * probe.scale, (probe.y + dy) * probe.scale);
        const b = withoutRing.at((probe.x + dx) * probe.scale, (probe.y + dy) * probe.scale);
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
