/**
 * Owner's report (2026-11-17, part of #846): "the final attack from enemies against the party is
 * not seen since it promptly shows the next button." The hand-off card, like the defeat panel, must
 * wait for the last enemy action to finish playing (impact, hit-stop, damage number, knockdown) and
 * then hold a short readable beat, with and without reduced motion. A player's own turn never waits.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

interface Seen {
  /** What the board was doing when the hand-off card first appeared. */
  busyAtCard: boolean | null;
  /** Milliseconds from the board last being busy to the card appearing. */
  quietMs: number | null;
  /** Whether the enemy's blow was applied before the card. */
  enemyActed: boolean;
  timeline: string[];
}
declare global {
  interface Window {
    beatSeen?: Seen;
  }
}

async function stageLastEnemyBlow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    if (!app || !state || !battle) throw new Error('Missing battle.');
    const scene = (app as unknown as { scene: { handedOffTo: string | null } }).scene;
    const party = battle.units.filter((u) => u.faction === 'party');
    // The next player must be somebody other than the one who last had the table.
    const next = party.find(
      (u) => app.session.controllerFor(state, u.id)?.id !== scene.handedOffTo,
    );
    const enemy = battle.units.find((u) => u.faction === 'enemy');
    if (!next || !enemy) throw new Error('Missing staging units.');
    const rest = battle.order.filter((id) => id !== enemy.id && id !== next.id);
    const target = party.find((u) => u.id !== next.id) ?? next;
    app.state = {
      ...state,
      battle: {
        ...battle,
        order: [enemy.id, next.id, ...rest],
        turnIndex: 0,
        units: battle.units.map((u) => {
          if (u.id === enemy.id) return { ...u, pos: { x: target.pos.x + 1, y: target.pos.y } };
          return u;
        }),
      },
    };
    // Record, every frame, when the board last played and what it was doing at the card.
    let lastBusy = performance.now();
    const seen: Seen = { busyAtCard: null, quietMs: null, enemyActed: false, timeline: [] };
    window.beatSeen = seen;
    let wasBusy = false;
    let hadCard = false;
    let hurt = false;
    const t0 = performance.now();
    const tick = () => {
      const now = performance.now();
      const busy = app.boardBusy();
      const card = Boolean(document.querySelector('.handoff-banner'));
      const damaged =
        app.state?.battle?.units.some((u) => u.faction === 'party' && u.hp < u.base.maxHp) ?? false;
      if (busy !== wasBusy) seen.timeline.push(`${Math.round(now - t0)} busy=${busy}`);
      if (card !== hadCard) seen.timeline.push(`${Math.round(now - t0)} card=${card}`);
      if (damaged !== hurt) seen.timeline.push(`${Math.round(now - t0)} damaged=${damaged}`);
      wasBusy = busy;
      hadCard = card;
      hurt = damaged;
      if (app.boardBusy()) lastBusy = now;
      if (document.querySelector('.handoff-banner') && seen.busyAtCard === null) {
        seen.busyAtCard = app.boardBusy();
        seen.quietMs = now - lastBusy;
        seen.enemyActed =
          app.state?.battle?.units.some((u) => u.faction === 'party' && u.hp < u.base.maxHp) ??
          false;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    app.resync();
  });
}

for (const reduceMotion of [false, true]) {
  test(`the hand-off card waits for the last enemy blow to play (reduce motion ${reduceMotion})`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Ann', 'Ben'], ['kaya', 'sura'], 'enemy-beat', { reduceMotion });
    await enterNode(page, 'battle_quarry_gate');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    await stageLastEnemyBlow(page);

    await expect(page.locator('.handoff-banner')).toBeVisible({ timeout: 30_000 });
    const seen = await page.evaluate(() => window.beatSeen);
    expect(seen?.busyAtCard, (seen?.timeline ?? []).join(' | ')).toBe(false);
    // About 400 to 600 ms of quiet board first, so the hit and its number are read.
    expect(seen?.quietMs ?? 0, (seen?.timeline ?? []).join(' | ')).toBeGreaterThanOrEqual(400);
    expect(seen?.enemyActed).toBe(true);
  });
}
