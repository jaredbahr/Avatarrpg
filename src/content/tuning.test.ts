import { describe, expect, it } from 'vitest';
import { CONTENT } from './index';
import { COMBAT_TUNING } from './tuning';
import { combatTuningOverrideSchema, combatTuningSchema } from './tuning.schema';

/**
 * The shape guard for the combat tuning block. The authored numbers are pinned
 * by the hit-chance examples in `core/rules/damage.test.ts`; this file is about
 * a bad number being rejected, whether it arrives in code or in a
 * `BALANCE_TUNING` override file.
 */
describe('combat tuning', () => {
  it('validates the authored block and indexes it through CONTENT', () => {
    const parsed = combatTuningSchema.parse(COMBAT_TUNING);
    expect(parsed).toEqual(COMBAT_TUNING);
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(COMBAT_TUNING));
    expect(CONTENT.tuning).toBe(COMBAT_TUNING);
  });

  it('rejects a mistyped, out-of-band or nonsensical value', () => {
    const accepts = (value: unknown) => combatTuningSchema.safeParse(value).success;
    expect([
      accepts({ ...COMBAT_TUNING, baseHitChance: 'high' }),
      accepts({ ...COMBAT_TUNING, elevationStep: -1 }),
      accepts({ ...COMBAT_TUNING, coverPenalty: 7.5 }),
      accepts({ ...COMBAT_TUNING, climbCost: -1 }),
      accepts({ ...COMBAT_TUNING, hitChanceMax: 200 }),
      accepts({ ...COMBAT_TUNING, hitChanceMin: 99, hitChanceMax: 5 }),
      accepts({ ...COMBAT_TUNING, baseHit: 80 }),
      accepts(undefined),
    ]).toEqual([false, false, false, false, false, false, false, false]);
  });

  it('accepts a partial overlay and still rejects an unknown key', () => {
    const override = combatTuningOverrideSchema.safeParse({ coverPenalty: 0 });
    expect(override.success).toBe(true);
    if (!override.success) throw new Error('Partial override should parse');
    expect(override.data).toEqual({ coverPenalty: 0 });

    expect(combatTuningOverrideSchema.safeParse({ baseHitChance: 80 }).success).toBe(true);
    expect(combatTuningOverrideSchema.safeParse({ baseHit: 80 }).success).toBe(false);
    expect(combatTuningOverrideSchema.safeParse({ coverPenalty: 'heavy' }).success).toBe(false);
  });
});
