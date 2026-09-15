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

/** Clears saved games and settings so each spec starts from nothing. */
export async function resetStorage(page: Page): Promise<void> {
  await page.goto('/');
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

/** Starts a game without walking the whole setup flow. */
export async function startGame(
  page: Page,
  players: string[],
  characterIds: string[],
  seed = 'e2e-seed',
): Promise<void> {
  await page.evaluate(
    ({ players, characterIds, seed }) => {
      const app = window.fnt?.app;
      if (!app) throw new Error('The game has not finished booting.');
      app.newGame(
        players.map((name) => ({ name, unitId: '' })),
        characterIds.map((characterId) => ({ characterId })),
        seed,
      );
    },
    { players, characterIds, seed },
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
export async function takeTurn(page: Page): Promise<boolean> {
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
  return true;
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

/** True while the fight is still running. */
export async function battleActive(page: Page): Promise<boolean> {
  return page.evaluate(() => window.fnt?.app.state?.battle?.phase === 'active');
}
