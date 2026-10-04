/** Maximum first-cast asset wait before the existing cast fallback wins. */
export const BEND_LOAD_WAIT_MS = 600;

/** Polls the two lazy bend stores without putting a wait on reduced motion. */
export async function waitForBendLoad(
  reduced: boolean,
  ready: () => boolean,
  failed: () => boolean,
  now: () => number,
  sleep: () => Promise<void>,
): Promise<boolean> {
  if (reduced) return false;
  const deadline = now() + BEND_LOAD_WAIT_MS;
  while (now() < deadline) {
    if (ready()) return true;
    if (failed()) return false;
    await sleep();
  }
  return ready();
}
