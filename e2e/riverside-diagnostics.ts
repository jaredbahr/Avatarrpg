import type { ConsoleMessage, Page, TestInfo } from '@playwright/test';
import { FORM_DURATION, WAVE_DURATION } from '../src/render/living/poses';

interface DiagnosticSample {
  bodyElapsedMs: number;
  reason: string;
  now?: number;
  lastFrame?: number | null;
  activity?: { kind: string; started: number } | null;
  remainingMs?: number | null;
  animatorBusy?: boolean;
  animatorFinishesAt?: number;
  drill?: number | null;
  hidden?: boolean;
  dialogs?: number;
  note?: string | null;
  buttons?: { text: string | null; disabled: boolean }[];
}

/** GitHub exposes check annotations even when its short-lived artifact URL cannot be fetched. */
function emitFailureSummary(
  testInfo: TestInfo,
  samples: readonly DiagnosticSample[],
  elapsed: number,
) {
  if (process.env.GITHUB_ACTIONS !== 'true' || testInfo.status === testInfo.expectedStatus) return;
  try {
    const compact = (sample: DiagnosticSample) => ({
      elapsedMs: sample.bodyElapsedMs,
      reason: sample.reason,
      now: sample.now,
      lastFrame: sample.lastFrame,
      activity: sample.activity,
      remainingMs: sample.remainingMs,
      animatorBusy: sample.animatorBusy,
      animatorFinishesAt: sample.animatorFinishesAt,
      drill: sample.drill,
      hidden: sample.hidden,
      dialogs: sample.dialogs,
      note: sample.note?.slice(0, 160),
      buttons: sample.buttons
        ?.filter((button) =>
          ['Wave', 'Water form', 'Fire form', "Dorin's drill"].includes(button.text ?? ''),
        )
        .map((button) => ({ text: button.text, disabled: button.disabled })),
    });
    const clicks = samples
      .filter((sample) =>
        /^(before|after) click: (Wave|Water form|Fire form|Dorin's drill|Leave preview)$/.test(
          sample.reason,
        ),
      )
      .slice(-2)
      .map(compact);
    const heartbeats = samples
      .filter((sample) => sample.reason === 'heartbeat')
      .slice(-3)
      .map(compact);
    const payload = JSON.stringify({
      test: testInfo.title,
      project: testInfo.project.name,
      status: testInfo.status,
      bodyElapsedMs: elapsed,
      clicks,
      heartbeats,
    }).slice(0, 3500);
    console.log(
      `::warning title=Riverside form failure diagnostics::${payload.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`,
    );
  } catch {
    // Reporting must never replace the application's assertion failure.
  }
}

/** Keep failure evidence in Node, so a whole-test timeout cannot cancel its collection. */
export async function recordRiversideDiagnostics(page: Page) {
  const prefix = '__FNT_RIVERSIDE_DIAGNOSTIC__';
  const started = Date.now();
  const samples: DiagnosticSample[] = [];
  const receive = (message: ConsoleMessage) => {
    const text = message.text();
    if (!text.startsWith(prefix)) return;
    try {
      samples.push({
        bodyElapsedMs: Date.now() - started,
        ...JSON.parse(text.slice(prefix.length)),
      } as DiagnosticSample);
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
                    '.village-actions button, .village-secondary-action, .village-utilities button',
                  ),
                ].map((button) => ({ text: button.textContent, disabled: button.disabled })),
              }),
          );
        } catch {
          // A diagnostic probe must not surface as an application pageerror.
        }
      };
      const clickLabel = (event: MouseEvent): string | null => {
        const button = event.target instanceof Element ? event.target.closest('button') : null;
        if (!button?.closest('.village-controls, .explore-conversation')) return null;
        return button.textContent?.trim() ?? 'button';
      };
      const clickLabels = new WeakMap<Event, string>();
      document.addEventListener('click', (event) => {
        const label = clickLabels.get(event);
        if (label !== undefined) {
          sample(`after click: ${label}`);
          clickLabels.delete(event);
        }
      });
      // A microtask scheduled in capture can run before the target handler.
      // Observe the two event phases directly instead.
      document.addEventListener(
        'click',
        (event) => {
          const label = clickLabel(event);
          if (label !== null) {
            // The target handler can rebuild its panel before the bubble phase.
            clickLabels.set(event, label);
            sample(`before click: ${label}`);
          }
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
      emitFailureSummary(testInfo, samples, Date.now() - started);
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
