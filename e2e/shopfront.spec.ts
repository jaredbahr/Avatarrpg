import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

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
      const mapId = app.state!.location.mapId;
      const npcCells = new Set([
        ...(app.content.maps.get(mapId)?.npcs ?? []).flatMap((npc) =>
          npc.pos ? [`${npc.pos.x},${npc.pos.y}`] : [],
        ),
        // Resident-bound NpcDefs stand on anchors (ADR 0047): count every anchor tile here.
        ...[...app.content.anchors.values()].flatMap(({ site }) =>
          site.kind === 'map' && site.mapId === mapId ? [`${site.pos.x},${site.pos.y}`] : [],
        ),
      ]);
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
}
