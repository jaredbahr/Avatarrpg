import type { ConsoleMessage, Page, TestInfo } from '@playwright/test';
import { appendDiagnosticToExistingError } from './diagnostic-error';

interface ObscurementSample {
  bodyElapsedMs: number;
  now: number;
  visibility: string;
  screen: string | null;
  scene: string | null;
  battlePhase: string | null;
  currentUnitId: string | null;
  selectedUnitId: string | null;
  animatorBusy: boolean | null;
  animatorRemainingMs: number | null;
  viewFrameTime: number | null;
  dialogs: { count: number; firstText: string | null };
  buttons: {
    name: string;
    disabled: boolean;
    visible: boolean;
    rect: { x: number; y: number; width: number; height: number };
  }[];
}

/** Cache one cheap page snapshot per second in Node, surviving a whole-test timeout. */
export async function recordObscurementDiagnostics(page: Page) {
  const prefix = '__FNT_OBSCUREMENT_DIAGNOSTIC__';
  const started = Date.now();
  const samples: ObscurementSample[] = [];
  let lastStep = 'before resetStorage';
  const receive = (message: ConsoleMessage) => {
    const value = message.text();
    if (!value.startsWith(prefix)) return;
    try {
      samples.push({
        bodyElapsedMs: Date.now() - started,
        ...JSON.parse(value.slice(prefix.length)),
      });
      if (samples.length > 100) samples.shift();
    } catch {
      // A diagnostic must never change the test's outcome.
    }
  };
  page.on('console', receive);
  await page.addInitScript((marker) => {
    const sample = () => {
      try {
        const app = window.fnt?.app;
        const battle = app?.state?.battle;
        const scene = (
          app as unknown as {
            scene?: { renderer?: { lastView?: { time: number; selectedUnitId: string | null } } };
          } | null
        )?.scene;
        const now = performance.now();
        const currentUnitId = battle?.order[battle.turnIndex] ?? null;
        const dialog = document.querySelector('[role="dialog"]');
        const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')]
          .filter((button) => /^(Confirm|Log)(\b|$)/.test(button.textContent?.trim() ?? ''))
          .map((button) => {
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return {
              name: button.textContent?.trim().slice(0, 40) ?? '',
              disabled: button.disabled,
              visible:
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none',
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            };
          });
        console.debug(
          marker +
            JSON.stringify({
              now,
              visibility: document.visibilityState,
              screen: app?.state?.screen ?? null,
              scene: scene?.constructor.name ?? null,
              battlePhase: battle?.phase ?? null,
              currentUnitId,
              selectedUnitId: scene?.renderer?.lastView?.selectedUnitId ?? null,
              animatorBusy: app?.animator.busy(now) ?? null,
              animatorRemainingMs: app ? Math.max(0, app.animator.finishesAt - now) : null,
              viewFrameTime: scene?.renderer?.lastView?.time ?? null,
              dialogs: {
                count: document.querySelectorAll('[role="dialog"]').length,
                firstText: dialog?.textContent?.trim().slice(0, 100) ?? null,
              },
              buttons,
            }),
        );
      } catch {
        // Diagnostics must not surface as page errors.
      }
    };
    setInterval(sample, 1_000);
  }, prefix);

  return {
    setStep(step: string) {
      lastStep = step;
    },
    async attachOnFailure(testInfo: TestInfo) {
      page.off('console', receive);
      if (testInfo.status === testInfo.expectedStatus) return;
      const summary = {
        test: testInfo.title,
        project: testInfo.project.name,
        status: testInfo.status,
        lastStep,
        bodyElapsedMs: Date.now() - started,
        configuredTimeoutMs: testInfo.timeout,
        latestSamples: samples.slice(-3),
      };
      try {
        appendDiagnosticToExistingError(
          testInfo,
          'Obscurement activity diagnostics',
          JSON.stringify(summary).slice(0, 3500),
        );
      } catch {
        // Reporting must never replace the original assertion or timeout.
      }
      if (process.env.GITHUB_ACTIONS === 'true') {
        try {
          const payload = JSON.stringify(summary).slice(0, 3500);
          console.log(
            `::warning title=Obscurement failure diagnostics::${payload.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`,
          );
        } catch {
          // Annotation failure must not replace the assertion failure.
        }
      }
      try {
        await testInfo.attach('obscurement-timeout-diagnostics', {
          body: JSON.stringify({ ...summary, samples }, null, 2),
          contentType: 'application/json',
        });
      } catch (error) {
        testInfo.annotations.push({
          type: 'diagnostic-warning',
          description: `Obscurement evidence could not be attached: ${String(error)}`,
        });
      }
    },
  };
}
