/**
 * Playtest issue #846: arming an attack shows its range on the board, on both backends, and the
 * chosen button says it is chosen (aria-pressed, a check badge and a heavy frame, not colour alone).
 */
import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import type { MapView } from '../src/render/view';

interface Probe {
  overlays: { kind: string; tiles: number }[];
}
declare global {
  interface Window {
    rangeProbe?: Probe;
  }
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`an armed attack shows its range and the button shows it is chosen on ${renderer}`, async ({
    page,
  }) => {
    test.setTimeout(renderer === 'webgl' ? 90_000 : 60_000);
    allowSoftwareWebgl(test, renderer);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], `range-overlay-${renderer}`);
    await enterNode(page, 'battle_quarry_gate');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);

    await page.evaluate(() => {
      const app = window.fnt?.app;
      const scene = (app as unknown as { scene: { renderer: { draw(view: MapView): void } } })
        .scene;
      const draw = scene.renderer.draw;
      scene.renderer.draw = function (view) {
        window.rangeProbe = {
          overlays: (view.overlays ?? []).map((l) => ({ kind: l.kind, tiles: l.tiles.length })),
        };
        draw.call(this, view);
      };
    });

    const move = page.getByRole('button', { name: /^Move/ });
    await expect(move).toHaveAttribute('aria-pressed', 'false');
    const attack = page
      .locator('.action-button[aria-pressed]:not(.end-turn):not([disabled])')
      .filter({ hasNot: page.getByText(/^Move$/) })
      .nth(1);
    await attack.click();
    await expect(attack).toHaveAttribute('aria-pressed', 'true');
    await expect(attack).toHaveClass(/selected/);
    // The check badge is drawn, so selection is not told by colour alone.
    const badge = await attack.evaluate((node) => getComputedStyle(node, '::before').content);
    expect(badge).toContain('✓');

    await expect
      .poll(() =>
        page.evaluate(
          () => window.rangeProbe?.overlays.find((l) => l.kind === 'reach')?.tiles ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    const layers = await page.evaluate(() => window.rangeProbe?.overlays ?? []);
    const reach = layers.find((l) => l.kind === 'reach')?.tiles ?? 0;
    const targets = layers.find((l) => l.kind === 'target')?.tiles ?? 0;
    expect(reach).toBeGreaterThanOrEqual(targets);

    // Tapping it again disarms it: the range goes and the button lets go.
    await attack.click();
    await expect(attack).toHaveAttribute('aria-pressed', 'false');
    await expect
      .poll(() => page.evaluate(() => window.rangeProbe?.overlays.some((l) => l.kind === 'reach')))
      .toBe(false);
  });
}
