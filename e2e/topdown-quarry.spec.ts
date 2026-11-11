import { expect, test, type Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { paintedTileCentre } from './projection';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * The quarry boards under `?style=topdown` (ADR 0104, T5) on both backends: the gate, the Cutting
 * and the Driller floor load their baked top-down scenes; in exploration a tap where a tile is
 * painted walks the party there, and in each fight a Move tapped on a painted tile lands the active
 * unit there.
 */
type Renderer = 'canvas' | 'webgl';

interface Board {
  readonly mapId: string;
  readonly folder: string;
  readonly explore: string;
  readonly battle: string;
  /** Short hops near the party's entry, west of the story crossing, each on open ground in view. */
  readonly hops: readonly { x: number; y: number }[];
}

const BOARDS: readonly Board[] = [
  {
    mapId: 'quarry_gate',
    folder: 'quarry-gate',
    explore: 'gate_trade_explore',
    battle: 'battle_quarry_gate',
    hops: [
      { x: 2, y: 5 },
      { x: 3, y: 6 },
      { x: 2, y: 7 },
      { x: 1, y: 6 },
    ],
  },
  {
    mapId: 'ambush_road',
    folder: 'cutting',
    explore: 'cutting_after_explore',
    battle: 'battle_ambush',
    hops: [
      { x: 2, y: 5 },
      { x: 3, y: 4 },
      { x: 2, y: 6 },
      { x: 1, y: 5 },
    ],
  },
  {
    mapId: 'quarry_floor',
    folder: 'quarry-floor',
    explore: 'quarry_after_explore',
    battle: 'battle_grumbler',
    hops: [
      { x: 2, y: 5 },
      { x: 3, y: 4 },
      { x: 2, y: 6 },
      { x: 1, y: 5 },
    ],
  },
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function webglAvailable(page: Page): Promise<boolean> {
  await page.goto('/');
  return page.evaluate(() => {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  });
}

async function expectTopDownBoard(page: Page, renderer: Renderer, board: Board): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
  const camera = await page.evaluate(() => window.fnt?.app.rendererCamera());
  expect(camera?.projection).toBe('topdown');
  expect(camera?.tile).toBe(40);
  const scene = await page.evaluate(() => {
    const map = window.fnt?.app.state?.location.mapId;
    const s = map ? window.fnt?.app.content.maps.get(map)?.scene : undefined;
    return { map, ground: s?.ground[0]?.url, scenery: s?.scenery.length ?? 0 };
  });
  expect(scene.map).toBe(board.mapId);
  expect(scene.ground).toBe(`art/topdown/${board.folder}/ground.webp`);
  expect(scene.scenery).toBeGreaterThan(0);
}

for (const renderer of ['canvas', 'webgl'] as const satisfies readonly Renderer[])
  for (const board of BOARDS) {
    test(`the top-down ${board.mapId} walks in exploration on ${renderer}`, async ({ page }) => {
      test.setTimeout(120_000);
      allowSoftwareWebgl(test, renderer);
      if (renderer === 'webgl')
        test.skip(!(await webglAvailable(page)), 'WebGL is unavailable on this Chromium host.');
      const errors = collectErrors(page);

      await resetStorage(page, `?renderer=${renderer}&style=topdown`);
      await startGame(page, ['Elias'], ['kaya'], `topdown-${board.mapId}-${renderer}`, {
        reduceMotion: false,
      });
      await enterNode(page, board.explore);
      await page.locator('.explore-scene .map-canvas').waitFor();
      await settleLayout(page);
      await expectTopDownBoard(page, renderer, board);

      for (const to of board.hops) {
        const point = await paintedTileCentre(page, to);
        expect(point, 'no camera to map the tile through').not.toBeNull();
        if (!point) return;
        await page.mouse.click(point.x, point.y);
        await waitForIdle(page);
        await expect
          .poll(async () => page.evaluate(() => window.fnt?.app.state?.location.pos))
          .toEqual(to);
      }
      expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
    });

    test(`the top-down ${board.mapId} fight moves a unit on ${renderer}`, async ({ page }) => {
      test.setTimeout(120_000);
      allowSoftwareWebgl(test, renderer);
      if (renderer === 'webgl')
        test.skip(!(await webglAvailable(page)), 'WebGL is unavailable on this Chromium host.');
      const errors = collectErrors(page);

      await resetStorage(page, `?renderer=${renderer}&style=topdown`);
      await startGame(page, ['Elias'], ['kaya'], `topdown-${board.mapId}-fight-${renderer}`);
      await enterNode(page, board.battle);
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      await expectTopDownBoard(page, renderer, board);

      const active = await page.evaluate(() => {
        const battle = window.fnt?.app.state?.battle;
        const id = battle?.order[battle.turnIndex];
        return battle?.units.find((u) => u.id === id) ?? null;
      });
      expect(active?.faction).toBe('party');
      if (!active) return;
      await page.getByRole('button', { name: /^Move\b/ }).click();
      // One step east of the spawn column: open ground on every quarry board.
      const to = { x: active.pos.x + 1, y: active.pos.y };
      const point = await paintedTileCentre(page, to);
      expect(point).not.toBeNull();
      if (!point) return;
      await page.mouse.click(point.x, point.y);
      const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
      await expect(confirm).toBeEnabled();
      await confirm.click();
      await waitForIdle(page);
      await expect
        .poll(async () =>
          page.evaluate(
            (id) => window.fnt?.app.state?.battle?.units.find((u) => u.id === id)?.pos ?? null,
            active.id,
          ),
        )
        .toEqual(to);
      expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
    });
  }
