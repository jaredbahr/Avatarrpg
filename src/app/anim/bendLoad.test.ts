import { describe, expect, it, vi } from 'vitest';
import { BEND_LOAD_WAIT_MS, waitForBendLoad } from './bendLoad';

describe('first bend load wait', () => {
  it('starts as soon as both stores are ready and is deterministic', async () => {
    const run = async () => {
      let at = 0;
      const sleeps: number[] = [];
      const loaded = await waitForBendLoad(
        false,
        () => at >= 48,
        () => false,
        () => at,
        async () => {
          at += 16;
          sleeps.push(at);
        },
      );
      return { loaded, sleeps };
    };
    expect(await run()).toEqual({ loaded: true, sleeps: [16, 32, 48] });
    expect(await run()).toEqual({ loaded: true, sleeps: [16, 32, 48] });
  });

  it('falls back at the bound and adds no reduced-motion wait', async () => {
    let at = 0;
    const sleep = vi.fn(async () => {
      at += 20;
    });
    expect(
      await waitForBendLoad(
        false,
        () => false,
        () => false,
        () => at,
        sleep,
      ),
    ).toBe(false);
    expect(at).toBe(BEND_LOAD_WAIT_MS);

    sleep.mockClear();
    expect(
      await waitForBendLoad(
        true,
        () => true,
        () => false,
        () => at,
        sleep,
      ),
    ).toBe(false);
    expect(sleep).not.toHaveBeenCalled();
  });
});
