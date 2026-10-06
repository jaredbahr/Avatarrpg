import { z } from 'zod';

/** One weather intensity's obscurement curve, checked band by band. */
export const weatherLevelSchema = z
  .object({
    perTile: z.number().int().min(0),
    minDistance: z.number().int().min(1),
    cap: z.number().int().min(0),
  })
  .strict();

const combatTuningShape = {
  baseHitChance: z.number().int().min(0).max(100),
  elevationStep: z.number().int().min(0),
  coverPenalty: z.number().int().min(0),
  obscurementCap: z.number().int().min(0),
  adjacentObscurementPenalty: z.number().int().min(0),
  obscurementReference: z.number().int().min(1),
  weather: z.array(weatherLevelSchema).min(3).max(3),
  plungingCoverDivisor: z.number().int().min(1),
  climbCost: z.number().int().min(0),
  heightReachBonus: z.number().int().min(0),
  ledgeDropDamage: z.number().int().min(0),
  hitChanceMin: z.number().int().min(0).max(100),
  hitChanceMax: z.number().int().min(0).max(100),
};

export const combatTuningSchema = z
  .object(combatTuningShape)
  .strict()
  .refine((tuning) => tuning.hitChanceMin <= tuning.hitChanceMax, {
    message: 'hitChanceMin must not exceed hitChanceMax',
    path: ['hitChanceMin'],
  });

export const combatTuningOverrideSchema = z.object(combatTuningShape).partial().strict();
