import type { TestInfo } from '@playwright/test';

/**
 * What one forced-WebGL case is allowed on a runner with no GPU.
 *
 * CI runners have no GPU, so `?renderer=webgl` drives SwiftShader in Chromium
 * (and Mesa's software path in WebKit). Run 35488793966 measured the cost at
 * the Surface viewport: one frame of the game's render loop took about 3
 * seconds and one Playwright screenshot about 14, so a case that waits for two
 * frames per probe and probes a dozen times needs three to four minutes where
 * its Canvas 2D twin needs five seconds. Budgets that assumed accelerated
 * hardware therefore failed on cost rather than on behaviour — the same case
 * passed one attempt and exhausted its timeout on the next — and
 * `maxFailures: 1` then abandoned everything else in that shard.
 *
 * Measured on that run, against the budgets that were in the suite then:
 * painted rubble needed over 183s of its 180 (both attempts), forest aftermath
 * 184s of 180, the resize-confirm repaint 128s of 120 (both attempts), the
 * forced board render 107s of 120, the painted ground 59s of 120, and the gate
 * approach 115s and 98s of 180.
 *
 * Run 35555673408, a green pass on 8de10f0e, measured painted rubble at 297.2s
 * of this cap and the painted elevation at 260.0s: the two heaviest cases were
 * already spending 99% and 87% of what they were allowed, so art that costs a
 * few seconds - run 35560977952 added 13 by carrying each exterior apron over
 * the board's rim - turned a required gate red without any behaviour changing.
 * A cap that a normal art delta can exhaust is not measuring a hang, so the
 * cap carries a margin over those measurements instead. The cases themselves
 * keep every assertion; the probe round trips that made them expensive are
 * being paid down separately.
 *
 * This is a cap, not a sleep. Canvas 2D cases keep the suite default, a case
 * that finishes early still finishes early, and a genuinely hung case still
 * fails its shard after its retry.
 */
export const SOFTWARE_WEBGL_BUDGET_MS = 360_000;

interface BudgetedTest {
  setTimeout(timeout: number): void;
  info(): TestInfo;
}

/**
 * Give this case the software-rasteriser budget when it forces WebGL. Call it
 * from the test body; a spec that set itself a longer budget keeps it.
 */
export function allowSoftwareWebgl(test: BudgetedTest, renderer: string): void {
  if (renderer !== 'webgl') return;
  if (test.info().timeout < SOFTWARE_WEBGL_BUDGET_MS) test.setTimeout(SOFTWARE_WEBGL_BUDGET_MS);
}
