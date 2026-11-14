import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCombatCasePool } from '../../../scripts/test-support/runCombatCases';
import type { TurnCycleCoverage } from '../../../scripts/test-support/turnCycle';
import { CONTENT } from '../../content';
import { partyOfSize } from '../sim/balance';
import { seedFor } from '../sim/runCombat';

const pool = createCombatCasePool();
beforeAll(() => pool.warm(), 30_000);
afterAll(() => pool.close().then(() => undefined));

describe('the authored combat turn cycle', () => {
  const encounters = [...CONTENT.encounters.keys()];
  const sizes = [1, 2, 3, 4, 5, 6];
  const trials = 13;
  const combinations = encounters.flatMap((encounterId) =>
    sizes.map((size) => ({ encounterId, size })),
  );
  // The pool stripes by index. Rotate each trial's starting combination so
  // each lane handles large and small tables over the unchanged seed matrix.
  const cases = Array.from({ length: trials }, (_, trial) =>
    combinations.map((_, offset) => {
      const { encounterId, size } = combinations[(offset + trial) % combinations.length]!;
      return {
        encounterId,
        party: partyOfSize(size),
        seed: seedFor(`turn-cycle:${encounterId}:${size}`, trial),
        checkTurnCycle: true,
      };
    }),
  ).flat();

  it(
    'observes every seeded battle and finishes the whole matrix in under 20 seconds',
    {
      // Let the explicit timing assertion report elapsed time and full coverage.
      timeout: 60_000,
    },
    async (ctx) => {
      expect(encounters).toHaveLength(4);
      expect(cases).toHaveLength(312);
      expect(new Set(cases.map((item) => item.seed)).size).toBe(cases.length);
      const started = performance.now();
      const run = pool.run(cases, ctx.signal);
      ctx.onTestFinished(async () => {
        await Promise.allSettled([run]);
      });
      const results = await run;
      expect(results).toHaveLength(cases.length);
      const totals: TurnCycleCoverage = {
        starts: 0,
        completedRounds: 0,
        midRoundDeaths: 0,
        statusesExpired: 0,
        longStatusesExpired: 0,
        singleTurnSkips: 0,
        recoveredSkips: 0,
        cooldownsReady: 0,
        longCooldownsReady: 0,
        cooldownUseChecks: 0,
        bossRounds: 0,
      };
      for (const [index, result] of results.entries()) {
        const coverage = result.turnCycle;
        expect(coverage, 'case ' + index + ' ran its real draft observer').toBeDefined();
        for (const field of Object.keys(totals) as (keyof TurnCycleCoverage)[]) {
          totals[field] += coverage![field];
        }
      }
      for (const [field, witnessed] of Object.entries(totals)) {
        expect(witnessed, field).toBeGreaterThan(0);
      }
      const elapsed = performance.now() - started;
      console.info('turn-cycle', { battles: results.length, ...totals, elapsedMs: elapsed });
      expect(elapsed).toBeLessThan(20_000);
    },
  );
});
