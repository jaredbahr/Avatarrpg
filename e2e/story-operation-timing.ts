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

export interface StoryOperationReport {
  totals: Record<string, { count: number; totalMs: number; maxMs: number }>;
  slowest: StoryOperationSample[];
  latest: StoryOperationSample | null;
}

export function newStoryOperationReport(): StoryOperationReport {
  return { totals: {}, slowest: [], latest: null };
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
