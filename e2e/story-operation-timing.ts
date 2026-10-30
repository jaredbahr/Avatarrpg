/** Node-side timing of existing browser operations; no extra page requests. */
export interface StoryOperationContext {
  readonly nodeId: string | null;
  readonly lineIndex: number | null;
  readonly branch: string;
}

export interface StoryOperationSample extends StoryOperationContext {
  readonly operation: string;
  readonly elapsedMs: number;
  readonly failed: boolean;
}

export interface ActiveStoryOperation extends StoryOperationContext {
  readonly operation: string;
  /** Node monotonic time, set before the original browser operation starts. */
  readonly startedAt: number;
}

export interface StoryOperationReport {
  totals: Record<string, { count: number; totalMs: number; maxMs: number }>;
  slowest: StoryOperationSample[];
  latest: StoryOperationSample | null;
  active: ActiveStoryOperation | null;
}

export function newStoryOperationReport(): StoryOperationReport {
  return { totals: {}, slowest: [], latest: null, active: null };
}

/** Snapshot a still-pending operation for the existing failure annotation. */
export function storyOperationSnapshot(report: StoryOperationReport) {
  return {
    totals: report.totals,
    slowest: report.slowest,
    latest: report.latest,
    active: report.active && {
      ...report.active,
      elapsedMs: Math.round(performance.now() - report.active.startedAt),
    },
  };
}

/** The original promise value or rejection is returned without substitution. */
export async function timeStoryOperation<T>(
  report: StoryOperationReport | null,
  operation: string,
  context: StoryOperationContext,
  action: () => Promise<T>,
  contextFromResult?: (result: T) => StoryOperationContext,
): Promise<T> {
  const started = performance.now();
  const active: ActiveStoryOperation = { ...context, operation, startedAt: started };
  try {
    if (report) report.active = active;
  } catch {
    // Even a broken diagnostic report cannot prevent the original operation.
  }
  let observedContext = context;
  let failed = false;
  try {
    const result = await action();
    if (contextFromResult) {
      try {
        observedContext = contextFromResult(result);
      } catch {
        // A diagnostic label must never change the browser operation's result.
      }
    }
    return result;
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      if (report) {
        if (report.active === active) report.active = null;
        const sample: StoryOperationSample = {
          ...observedContext,
          operation,
          elapsedMs: Math.round(performance.now() - started),
          failed,
        };
        const key = `${operation}:${sample.branch}`;
        const total = (report.totals[key] ??= { count: 0, totalMs: 0, maxMs: 0 });
        total.count++;
        total.totalMs += sample.elapsedMs;
        total.maxMs = Math.max(total.maxMs, sample.elapsedMs);
        report.latest = sample;
        report.slowest.push(sample);
        report.slowest.sort((a, b) => b.elapsedMs - a.elapsedMs);
        report.slowest.length = Math.min(5, report.slowest.length);
      }
    } catch {
      // Telemetry cannot turn a passing operation into a failure or mask one.
    }
  }
}
