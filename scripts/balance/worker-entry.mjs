/**
 * The balance sweep's worker entry.
 *
 * `--import tsx` in `package.json` registers the loader in the main thread only.
 * Node drops `--import` from the execArgv a worker inherits, so a worker started
 * straight on `worker.ts` resolves its imports with Node's own ESM resolver,
 * which rejects `src/content` as a directory import. Register tsx in this
 * thread, before loading the lane, so both threads resolve the same way.
 */
import { register } from 'tsx/esm/api';

register();

await import('./worker.ts');
