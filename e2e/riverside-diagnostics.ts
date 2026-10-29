import type { ConsoleMessage, Page, TestInfo } from '@playwright/test';
import { FORM_DURATION, WAVE_DURATION } from '../src/render/living/poses';

/** Keep failure evidence in Node, so a whole-test timeout cannot cancel its collection. */
export async function recordRiversideDiagnostics(page: Page) {
  const prefix = '__FNT_RIVERSIDE_DIAGNOSTIC__';
  const started = Date.now();
  const samples: unknown[] = [];
  const receive = (message: ConsoleMessage) => {
    const text = message.text();
    if (!text.startsWith(prefix)) return;
    try {
      samples.push({
        bodyElapsedMs: Date.now() - started,
        ...JSON.parse(text.slice(prefix.length)),
      });
      if (samples.length > 128) samples.shift();
    } catch {
      // Diagnostics must never change the assertion's outcome.
    }
  };
  page.on('console', receive);
  await page.addInitScript(
    ({ prefix, formDuration, waveDuration }) => {
      const sample = (reason: string) => {
        try {
          const app = window.fnt?.app;
          const scene = (
            app as unknown as {
              scene?: {
                suspended?: boolean;
                conversationMode?: boolean;
                life?: {
                  lastFrame: number | null;
                  activity: { kind: string; started: number } | null;
                  drill: number | null;
                  pending: string | null;
                  busy(now: number): boolean;
                };
              };
            }
          )?.scene;
          const life = scene?.life;
          if (!app) return;
          const now = performance.now();
          const activity = life?.activity ?? null;
          console.debug(
            prefix +
              JSON.stringify({
                reason,
                now,
                timeOrigin: performance.timeOrigin,
                hasLife: Boolean(life),
                hidden: document.hidden,
                visibility: document.visibilityState,
                dialogs: document.querySelectorAll('[role="dialog"]').length,
                suspended: scene?.suspended ?? null,
                conversation: scene?.conversationMode ?? null,
                lastFrame: life?.lastFrame ?? null,
                activity,
                remainingMs: activity
                  ? Math.max(
                      0,
                      activity.started +
                        (activity.kind === 'wave' ? waveDuration : formDuration) -
                        now,
                    )
                  : null,
                busy: life?.busy(now) ?? null,
                animatorBusy: app.animator.busy(now),
                animatorFinishesAt: app.animator.finishesAt,
                drill: life?.drill ?? null,
                pending: life?.pending ?? null,
                location: app.state?.location,
                note: document.querySelector('.village-note')?.textContent,
                buttons: [
                  ...document.querySelectorAll<HTMLButtonElement>(
                    '.village-actions button, .village-secondary-action',
                  ),
                ].map((button) => ({ text: button.textContent, disabled: button.disabled })),
              }),
          );
        } catch {
          // A diagnostic probe must not surface as an application pageerror.
        }
      };
      document.addEventListener(
        'click',
        (event) => {
          const button = event.target instanceof Element ? event.target.closest('button') : null;
          if (!button?.closest('.village-controls, .explore-conversation')) return;
          const label = button.textContent?.trim() ?? 'button';
          sample(`before click: ${label}`);
          queueMicrotask(() => sample(`after click: ${label}`));
        },
        true,
      );
      setInterval(() => sample('heartbeat'), 1000);
    },
    { prefix, formDuration: FORM_DURATION, waveDuration: WAVE_DURATION },
  );
  return {
    async attach(testInfo: TestInfo) {
      page.off('console', receive);
      try {
        await testInfo.attach('riverside-activity-diagnostics', {
          body: JSON.stringify(
            {
              test: testInfo.title,
              project: testInfo.project.name,
              configuredTimeoutMs: testInfo.timeout,
              bodyElapsedMs: Date.now() - started,
              timing: { formDuration: FORM_DURATION, waveDuration: WAVE_DURATION },
              // Body elapsed excludes fixture setup; the Playwright trace owns exact test timing.
              samples,
            },
            null,
            2,
          ),
          contentType: 'application/json',
        });
      } catch (error) {
        testInfo.annotations.push({
          type: 'diagnostic-warning',
          description: `Riverside evidence could not be attached: ${String(error)}`,
        });
      }
    },
  };
}
