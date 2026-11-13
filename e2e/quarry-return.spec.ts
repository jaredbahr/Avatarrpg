import { test } from '@playwright/test';
import { generateQuarryCheckpoints } from '../scripts/e2e/quarry-checkpoints';
import { resetStorage } from './helpers';
import {
  installQuarryRouteDiagnostics,
  loadQuarryCheckpoint,
  playQuarryDriller,
  playQuarryGate,
  playQuarryHome,
  playQuarryOpening,
} from './quarry-route';

installQuarryRouteDiagnostics();

for (const custody of ['trade', 'escort'] as const) {
  test(`${custody} 1/3: a new campaign reaches the gate custody choice`, async ({ page }) => {
    test.setTimeout(600_000);
    // Install before boot so the real route timers can finish.
    await page.clock.install();
    await resetStorage(page, '?renderer=canvas');
    await playQuarryOpening(page, custody);
    await playQuarryGate(page, custody);
  });

  test(`${custody} 2/3: the gate route resolves the Driller and summary`, async ({ page }) => {
    test.setTimeout(600_000);
    await loadQuarryCheckpoint(page, generateQuarryCheckpoints(custody).gate);
    await playQuarryDriller(page, custody);
  });

  test(`${custody} 3/3: reloads, walks home and revisits the resolved quarry`, async ({ page }) => {
    test.setTimeout(600_000);
    await loadQuarryCheckpoint(page, generateQuarryCheckpoints(custody).afterDriller);
    await playQuarryHome(page, custody);
  });
}
