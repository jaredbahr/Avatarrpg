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
    description:
      'Takes 3 fire damage at the start of each turn and has 1 less Defence. Becoming Wet puts it out, so step into water.',
    kind: 'debuff',
    defaultDuration: 3,
    tickDamage: 3,
    tickDamageType: 'fire',
    modifiers: { defense: -1 },
  }),
  status({
    id: 'wet',
    name: 'Wet',
    description:
      'Soaked through. Takes half damage from fire, double from lightning and half as much again from cold. Becoming Wet puts out Burning.',
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
    description:
      '1 less Move, 2 less Speed and 5% lower hit chance. If a Chilled unit is Chilled again, it becomes Frozen.',
    kind: 'debuff',
    defaultDuration: 2,
    modifiers: { move: -1, speed: -2, accuracy: -5 },
  }),
  status({
    id: 'frozen',
    name: 'Frozen',
    description:
      'Locked in ice and loses the next turn. Has 2 less Defence, takes half as much again from earth and physical hits, and a quarter more from fire.',
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
    description: '1 less AP, 3 less Speed and 10% lower hit chance while it lasts.',
    kind: 'debuff',
    defaultDuration: 2,
    modifiers: { speed: -3, accuracy: -10, ap: -1 },
  }),
  status({
    id: 'stunned',
    name: 'Stunned',
    description: 'Dazed and loses the next turn.',
    kind: 'debuff',
    defaultDuration: 1,
    skipsTurn: true,
  }),
  status({
    id: 'slowed',
    name: 'Slowed',
    description: '2 less Move while it lasts.',
    kind: 'debuff',
    defaultDuration: 2,
    modifiers: { move: -2 },
  }),
  status({
    id: 'blinded',
    name: 'Blinded',
    description: '30% lower hit chance on every attack.',
    kind: 'debuff',
    defaultDuration: 2,
    modifiers: { accuracy: -30 },
  }),
  status({
    id: 'rooted',
    name: 'Rooted',
    description: 'Cannot walk, but can still use abilities.',
    kind: 'debuff',
    defaultDuration: 2,
    preventsMove: true,
  }),
  status({
    id: 'chiBlocked',
    name: 'Chi-Blocked',
    description: 'Cannot use any ability, bending or otherwise, but can still walk.',
    kind: 'debuff',
    defaultDuration: 2,
    preventsAbilities: true,
  }),
  status({
    id: 'guarded',
    name: 'Guarded',
    description: '3 more Defence, and fire and physical hits deal a quarter less.',
    kind: 'buff',
    defaultDuration: 2,
    modifiers: { defense: 3, incomingMultiplier: { fire: 0.75, physical: 0.75 } },
  }),
  status({
    id: 'inspired',
    name: 'Inspired',
    description:
      '2 more Power, 10% higher hit chance and 5% more Focus, their chance of a critical hit.',
    kind: 'buff',
    defaultDuration: 2,
    modifiers: { power: 2, accuracy: 10, focus: 5 },
  }),
];

export const STATUS_BY_ID: ReadonlyMap<StatusId, StatusDef> = new Map(
  STATUSES.map((s) => [s.id, s]),
);
