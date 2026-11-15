/**
 * Naming what grows (#525): live objects by constructor name, from a heap snapshot.
 *
 * The soak's counters say that the heap rose; this says with what. With FNT_SOAK_HEAP=1 the run
 * takes a snapshot after each cycle and reports the constructors whose instance count rises with
 * every one. Run it against `npm run dev` (FNT_SOAK_URL), where names are not minified.
 */
import type { CDPSession } from '@playwright/test';

export interface HeapCount {
  count: number;
  bytes: number;
}

interface Snapshot {
  readonly snapshot: {
    readonly meta: {
      readonly node_fields: string[];
      readonly node_types: [string[], ...unknown[]];
    };
  };
  readonly nodes: number[];
  readonly strings: string[];
}

/** Forces a collection, takes a snapshot and counts its objects by constructor name. */
export async function heapCounts(cdp: CDPSession): Promise<Map<string, HeapCount>> {
  const chunks: string[] = [];
  const onChunk = (event: { chunk: string }): void => {
    chunks.push(event.chunk);
  };
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  try {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  } finally {
    cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  }
  const snapshot = JSON.parse(chunks.join('')) as Snapshot;
  const fields = snapshot.snapshot.meta.node_fields;
  const types = snapshot.snapshot.meta.node_types[0];
  const typeAt = fields.indexOf('type');
  const nameAt = fields.indexOf('name');
  const sizeAt = fields.indexOf('self_size');
  const counted = new Set(['object', 'native', 'closure']);
  const counts = new Map<string, HeapCount>();
  for (let at = 0; at < snapshot.nodes.length; at += fields.length) {
    const type = types[snapshot.nodes[at + typeAt] ?? -1] ?? '';
    if (!counted.has(type)) continue;
    const name = snapshot.strings[snapshot.nodes[at + nameAt] ?? -1] ?? '';
    const key = type === 'closure' ? `closure ${name || '(anonymous)'}` : name;
    const entry = counts.get(key) ?? { count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += snapshot.nodes[at + sizeAt] ?? 0;
    counts.set(key, entry);
  }
  return counts;
}

export interface Growth {
  readonly name: string;
  readonly counts: readonly number[];
  readonly perCycle: number;
  readonly bytesPerCycle: number;
}

/**
 * The constructors whose count is higher after every cycle than after the one before, from the
 * cycle after the warm-up on, largest growth first.
 */
export function growing(
  cycles: readonly ReadonlyMap<string, HeapCount>[],
  warmup: number,
): Growth[] {
  const fitted = cycles.slice(warmup);
  const last = fitted[fitted.length - 1];
  const first = fitted[0];
  if (!last || !first || fitted.length < 3) return [];
  const out: Growth[] = [];
  for (const name of last.keys()) {
    const counts = fitted.map((cycle) => cycle.get(name)?.count ?? 0);
    if (!counts.every((count, index) => index === 0 || count > (counts[index - 1] ?? 0))) continue;
    const spans = fitted.length - 1;
    out.push({
      name,
      counts,
      perCycle: ((counts[spans] ?? 0) - (counts[0] ?? 0)) / spans,
      bytesPerCycle: ((last.get(name)?.bytes ?? 0) - (first.get(name)?.bytes ?? 0)) / spans,
    });
  }
  return out.sort((a, b) => b.bytesPerCycle - a.bytesPerCycle);
}
