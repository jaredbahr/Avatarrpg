import type { Page } from '@playwright/test';

/**
 * Shared driving helpers.
 *
 * The specs go through the real UI wherever the UI is what is being tested,
 * and drop to `window.fnt.app` only to skip *past* parts a given spec is not
 * about — otherwise every test would spend thirty taps getting to a fight.
 */

export interface AppSnapshot {
  screen: string;
  node: string | null;
  round: number | null;
  activeUnitId: string | null;
  partyPositions: { id: string; x: number; y: number; hp: number }[];
  players: string[];
}

/*
 * `src/main.ts` already declares `window.fnt` as `{ app: App }` globally, and
 * tsconfig covers both trees, so every evaluate() callback below gets the real
 * App types for free — no hand-maintained shadow interface to drift.
 */

export async function snapshot(page: Page): Promise<AppSnapshot> {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state ?? null;
    const battle = state?.battle ?? null;
    const units = battle ? battle.units.filter((u) => u.faction === 'party') : (state?.party ?? []);
    return {
      screen: state?.screen ?? 'none',
      node: state?.story.nodeId ?? null,
      round: battle?.round ?? null,
      activeUnitId: battle ? (battle.order[battle.turnIndex] ?? null) : null,
      partyPositions: units.map((u) => ({ id: u.id, x: u.pos.x, y: u.pos.y, hp: u.hp })),
      players: app?.session.players.map((p) => p.name) ?? [],
    };
  });
}

/**
 * Clears saved games and settings so each spec starts from nothing.
 *
 * `query` is kept across the reload, which is how a spec forces a renderer
 * (`?renderer=webgl`) or the frame-time readout (`?stats=1`): both are read
 * from `location.search` when the app boots.
 */
export async function resetStorage(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* private window: nothing to clear */
    }
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fnt?.app));
}

export interface StartOptions {
  /**
   * Reduce motion is on by default here: the suite tests rules and UI, not
   * the playback, and a full cast plays for most of a second per enemy per
   * round. A spec about motion turns it off.
   */
  readonly reduceMotion?: boolean;
}

/** Starts a game without walking the whole setup flow. */
export async function startGame(
  page: Page,
  players: string[],
  characterIds: string[],
  seed = 'e2e-seed',
  options: StartOptions = {},
): Promise<void> {
  await page.evaluate(
    ({ players, characterIds, seed, reduceMotion }) => {
      const app = window.fnt?.app;
      if (!app) throw new Error('The game has not finished booting.');
      app.updateSettings({ reduceMotion });
      app.newGame(
        players.map((name) => ({ name, unitId: '' })),
        characterIds.map((characterId) => ({ characterId })),
        seed,
      );
    },
    { players, characterIds, seed, reduceMotion: options.reduceMotion ?? true },
  );
}

/** Jumps straight to a battle node. */
export async function enterNode(page: Page, nodeId: string): Promise<void> {
  await page.evaluate((id) => {
    window.fnt?.app.dispatch({ type: 'enterNode', nodeId: id });
  }, nodeId);
}

/**
 * Waits until it is a party unit's turn and clears the hand-off card.
 *
 * Returns false if the fight ended while waiting, so a spec that drives
 * several rounds can stop rather than time out on a turn that will never come.
 */
export async function takeTurn(
  page: Page,
  options: { settleTimeout?: number } = {},
): Promise<boolean> {
  const result = await page.waitForFunction(
    () => {
      const battle = window.fnt?.app.state?.battle;
      if (!battle) return 'over';
      if (battle.phase !== 'active') return 'over';
      const id = battle.order[battle.turnIndex];
      const unit = battle.units.find((u) => u.id === id);
      return unit?.faction === 'party' ? 'ready' : false;
    },
    undefined,
    { timeout: 25_000 },
  );

  if ((await result.jsonValue()) === 'over') return false;

  const ready = page.getByRole('button', { name: /I'm ready/i });
  if (await ready.count()) await ready.click();
  await settleLayout(page, options.settleTimeout);
  return true;
}

/**
 * Waits for the map camera to hold still across two frames.
 *
 * Clearing the hand-off card reflows the HUD, which resizes the map a frame
 * later through the ResizeObserver, and the refit runs a frame after that.
 * On a viewport where the fit is height-limited (an iPad in landscape) the
 * refit changes the tile size, so a camera read taken before it lands maps a
 * tile to the wrong pixel. Slow frames (WebKit on software GL) open the gap
 * wide enough to matter; three reads two frames apart close it.
 *
 * `timeout` is the whole wait. The default is 30 s because this helper needs
 * four frames, and a forced-WebGL frame on CI's software rasteriser measured
 * about 3 s in run 35488793966 — four of those outlast the 10 s the suite used
 * to allow, which is the same reason the gallery already passes 30 s. Canvas
 * 2D returns as soon as the camera holds still, so the bound costs nothing
 * there, and a camera that genuinely never settles still fails.
 */
export async function settleLayout(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const read = () => JSON.stringify(window.fnt?.app.rendererCamera() ?? null);
        const frames = (n: number, then: () => void) => {
          if (n === 0) then();
          else requestAnimationFrame(() => frames(n - 1, then));
        };
        const reads: string[] = [read()];
        frames(2, () => {
          reads.push(read());
          frames(2, () => {
            reads.push(read());
            resolve(reads.every((r) => r === reads[0]));
          });
        });
      }),
    undefined,
    { timeout },
  );
}

/**
 * Waits for the map canvas to present at its own box size.
 *
 * Picking an action adds the aim hint, which changes the map's height; the
 * camera is measured from the canvas element, so it refits a frame or two later
 * through the ResizeObserver. Projecting a tile into page pixels before that
 * lands taps the wrong tile, and WebKit is where it bites: its frames are fast
 * enough that the click can beat the refit, where a software-WebGL Chromium
 * frame is slower than the refit itself. Settle the camera, then require the
 * backing store to agree with the CSS box at the device pixel ratio, which is
 * what `Renderer.resize` sizes it from.
 */
export async function settleMapCanvas(page: Page): Promise<void> {
  await settleLayout(page);
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!canvas) return false;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      return (
        Math.abs(canvas.width / dpr - rect.width) < 1 &&
        Math.abs(canvas.height / dpr - rect.height) < 1
      );
    },
    undefined,
    { timeout: 30_000 },
  );
}

/**
 * Waits until event playback has finished.
 *
 * Taps on the battlefield are deliberately ignored while the animator is
 * running — you should not be able to act in the middle of somebody else's
 * turn playing out — so a spec that taps the canvas has to wait for it.
 */
export async function waitForIdle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.fnt?.app.animator.busy(performance.now()) === false,
    undefined,
    { timeout: 20_000 },
  );
}

/**
 * Freezes the page clock at a moment still ahead of it.
 *
 * `clock.pauseAt` refuses a target that is not ahead of the fake clock, and
 * until it is paused that clock keeps pace with real time: on a software-WebGL
 * runner one frame can outlast the whole gap between reading the clock and
 * asking it to pause, which reddened `directional-walk` with "Cannot
 * fast-forward to the past" in run 35578795966. A failed attempt still leaves
 * the clock frozen, so reading it again with a wider margin converges instead
 * of racing the renderer. Callers resume once they are done stepping frames.
 */
export async function pauseClock(page: Page): Promise<void> {
  let margin = 1000;
  for (let attempt = 0; ; attempt++) {
    const now = await page.evaluate(() => Date.now());
    try {
      await page.clock.pauseAt(now + margin);
      return;
    } catch (error) {
      if (attempt >= 4) throw error;
      margin *= 2;
    }
  }
}

/** True while the fight is still running. */
export async function battleActive(page: Page): Promise<boolean> {
  return page.evaluate(() => window.fnt?.app.state?.battle?.phase === 'active');
}

/** Isolate the legacy painting contract before mounting a now-layered map. */
export async function useOrthographicBackdropFixture(page: Page, mapId: string): Promise<void> {
  await page.evaluate((id) => {
    const map = window.fnt?.app.content.maps.get(id);
    if (!map) throw new Error(`Missing backdrop fixture map: ${id}`);
    Object.defineProperties(map, {
      projection: { value: undefined, configurable: true },
      scene: { value: undefined, configurable: true },
    });
  }, mapId);
}
