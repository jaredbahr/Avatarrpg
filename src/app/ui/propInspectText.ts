import type { DamageType, DousingType, PropDef, PropEffect, PropInstance } from '../../core/types';
import type { MarkKind } from './marks';

export interface PropInspectChip {
  readonly text: string;
  readonly icon?: MarkKind;
}

export interface PropInspectText {
  readonly description: string;
  readonly hint?: string;
  readonly toughness: string;
  readonly chips: readonly PropInspectChip[];
  readonly burning?: string;
}

const DAMAGE_NAMES: Readonly<Record<DamageType, string>> = {
  air: 'air',
  water: 'water',
  earth: 'earth',
  fire: 'fire',
  lightning: 'lightning',
  cold: 'cold',
  physical: 'blows',
  pure: 'pure damage',
};

const DOUSE_NAMES: Readonly<Record<DousingType, string>> = {
  water: 'water',
  cold: 'cold',
  earth: 'earth',
};

function list(words: readonly string[]): string {
  if (words.length < 2) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} or ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, or ${words.at(-1)}`;
}

function plainId(id: string): string {
  return id.replaceAll('_', ' ');
}

function andList(words: readonly string[]): string {
  if (words.length < 2) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`;
}

/** What a broken prop leaves on the ground, in words a young reader says aloud. */
const SPILLS: Readonly<Record<string, string>> = {
  water: 'water spills out',
  oil: 'oil spills out',
  fire: 'fire spreads',
  rubble: 'rubble falls',
  mud: 'mud spreads',
  ice: 'ice spreads',
  steam: 'steam rises',
};

function breakResult(effect: PropEffect): string {
  switch (effect.kind) {
    case 'surface':
      return SPILLS[effect.surface] ?? `${plainId(effect.surface)} is left on the ground`;
    case 'damage':
      return 'it hurts anyone next to it';
    case 'status':
      return `anyone next to it may end up ${plainId(effect.status)}`;
    case 'push':
      return 'it knocks back anyone next to it';
  }
}

/** Plain, deterministic copy for the prop card. */
export function propInspectText(def: PropDef, prop: PropInstance): PropInspectText {
  const results = def.onBreak.map(breakResult);
  const chips: PropInspectChip[] = [
    {
      text: results.length > 0 ? `Break it: ${results.join(', and ')}` : 'Break it',
      icon: 'fist',
    },
  ];

  if (def.pushable) chips.push({ text: 'Shove it', icon: 'push' });
  if (def.grantsCover) chips.push({ text: 'Hide behind it', icon: 'guard' });
  if (def.blocksMove) chips.push({ text: 'Blocks the way', icon: 'wall' });
  if (def.blocksSight) chips.push({ text: 'Blocks sight', icon: 'sense' });
  if ((def.fuel ?? 0) > 0) chips.push({ text: `Burns for ${def.fuel} rounds`, icon: 'torch' });
  if (def.douse && def.douse.length > 0)
    chips.push({
      text: `Put it out with ${list(def.douse.map((type) => DOUSE_NAMES[type]))}`,
      icon: 'wave',
    });
  if (def.vulnerableTo.length > 0)
    chips.push({ text: `Weak to ${list(def.vulnerableTo.map((type) => DAMAGE_NAMES[type]))}` });
  if (def.immuneTo.length > 0)
    chips.push({
      text: `Shrugs off ${andList(def.immuneTo.map((type) => DAMAGE_NAMES[type]))}`,
      icon: 'guard',
    });

  return {
    description: def.description,
    ...(def.hint ? { hint: def.hint } : {}),
    toughness: `Sturdy ${prop.hp} / ${def.hp}`,
    chips,
    ...(prop.burning !== undefined ? { burning: `On fire: ${prop.burning} rounds left` } : {}),
  };
}
