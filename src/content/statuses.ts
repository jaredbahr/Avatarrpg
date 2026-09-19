/**
 * Status effects.
 *
 * Durations are in rounds and tick down at the *owner's* turn start, so a
 * 2-round Burning always burns twice regardless of where the owner sits in the
 * initiative order.
 *
 * Design notes for tuning later:
 *  - Wet is the keystone. It clears Burning, halves fire, doubles lightning and
 *    makes cold hit harder. Teaching a kid "get them wet first" is the
 *    single best combo lesson in the game.
 *  - Nothing here removes a turn for longer than one round. Losing two turns in
 *    a row is miserable at a shared table.
 */

import type { StatusDef, StatusId, StatusModifiers } from '../core/types';

const NO_MODS: StatusModifiers = {
  power: 0,
  defense: 0,
  speed: 0,
  focus: 0,
  move: 0,
  ap: 0,
  accuracy: 0,
  incomingMultiplier: {},
};

function mods(partial: Partial<StatusModifiers>): StatusModifiers {
  return { ...NO_MODS, ...partial };
}

function status(def: {
  id: StatusId;
  name: string;
  description: string;
  kind: 'buff' | 'debuff';
  defaultDuration: number;
  maxStacks?: number;
  tickDamage?: number;
  tickDamageType?: StatusDef['tickDamageType'];
  skipsTurn?: boolean;
  preventsMove?: boolean;
  preventsAbilities?: boolean;
  modifiers?: Partial<StatusModifiers>;
  clears?: readonly StatusId[];
  upgradeFrom?: readonly StatusId[] | null;
}): StatusDef {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    kind: def.kind,
    defaultDuration: def.defaultDuration,
    maxStacks: def.maxStacks ?? 1,
    tickDamage: def.tickDamage ?? 0,
    tickDamageType: def.tickDamageType ?? 'pure',
    skipsTurn: def.skipsTurn ?? false,
    preventsMove: def.preventsMove ?? false,
    preventsAbilities: def.preventsAbilities ?? false,
    modifiers: mods(def.modifiers ?? {}),
    clears: def.clears ?? [],
    upgradeFrom: def.upgradeFrom ?? null,
  };
}

export const STATUSES: readonly StatusDef[] = [
  status({
    id: 'burning',
    name: 'Burning',
    description: '3 fire damage at the start of your turn. Water or standing in water puts it out.',
    kind: 'debuff',
    defaultDuration: 3,
    tickDamage: 3,
    tickDamageType: 'fire',
    modifiers: { defense: -1 },
  }),
  status({
    id: 'wet',
    name: 'Wet',
    description: 'Fire damage halved, lightning doubled, and cold hits harder. Puts out Burning.',
    kind: 'debuff',
    defaultDuration: 3,
    clears: ['burning'],
    modifiers: {
      incomingMultiplier: { fire: 0.5, lightning: 2, cold: 1.5 },
    },
  }),
  status({
    id: 'chilled',
    name: 'Chilled',
    description: 'Slow and clumsy. Chill something that is already Chilled and it Freezes.',
    kind: 'debuff',
    defaultDuration: 2,
    modifiers: { move: -1, speed: -2, accuracy: -5 },
  }),
  status({
    id: 'frozen',
    name: 'Frozen',
    description: 'Cannot act for a turn. Takes extra damage from earth and physical hits.',
    kind: 'debuff',
    defaultDuration: 1,
    skipsTurn: true,
    upgradeFrom: ['chilled'],
    modifiers: {
      defense: -2,
      incomingMultiplier: { earth: 1.5, physical: 1.5, fire: 1.25 },
    },
  }),
  status({
    id: 'shocked',
    name: 'Shocked',
    description: 'Jittery: slower, less accurate, and one less AP next turn.',
    kind: 'debuff',
    defaultDuration: 2,
    modifiers: { speed: -3, accuracy: -10, ap: -1 },
  }),
  status({
    id: 'stunned',
    name: 'Stunned',
    description: 'Loses the next turn entirely.',
    kind: 'debuff',
    defaultDuration: 1,
    skipsTurn: true,
  }),
  status({
    id: 'slowed',
    name: 'Slowed',
    description: 'Two fewer move points.',
    kind: 'debuff',
    defaultDuration: 2,
    modifiers: { move: -2 },
  }),
  status({
    id: 'blinded',
    name: 'Blinded',
    description: 'Much harder to hit anything. Smoke and dust do this.',
    kind: 'debuff',
    defaultDuration: 2,
    modifiers: { accuracy: -30 },
  }),
  status({
    id: 'rooted',
    name: 'Rooted',
    description: 'Stuck in place, but can still attack.',
    kind: 'debuff',
    defaultDuration: 2,
    preventsMove: true,
  }),
  status({
    id: 'chiBlocked',
    name: 'Chi-Blocked',
    description: 'Cannot bend or use abilities. Can still move. The chi-blocker signature.',
    kind: 'debuff',
    defaultDuration: 2,
    preventsAbilities: true,
  }),
  status({
    id: 'guarded',
    name: 'Guarded',
    description: 'Braced behind a shield: much harder to hurt.',
    kind: 'buff',
    defaultDuration: 2,
    modifiers: { defense: 3, incomingMultiplier: { fire: 0.75, physical: 0.75 } },
  }),
  status({
    id: 'inspired',
    name: 'Inspired',
    description: 'Hits harder and truer.',
    kind: 'buff',
    defaultDuration: 2,
    modifiers: { power: 2, accuracy: 10, focus: 5 },
  }),
];

export const STATUS_BY_ID: ReadonlyMap<StatusId, StatusDef> = new Map(
  STATUSES.map((s) => [s.id, s]),
);
