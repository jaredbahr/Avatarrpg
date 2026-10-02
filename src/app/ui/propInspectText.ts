import type {
  DamageType,
  DousingType,
  PropDef,
  PropEffect,
  PropInstance,
  StatusDef,
  StatusId,
} from '../../core/types';
import { FIRE_ABILITIES } from '../../content/abilities/fire';
import type { MarkKind } from './marks';

export interface PropInspectChip {
  readonly text: string;
  readonly icon?: MarkKind;
}

export interface PropInspectText {
  readonly description: string;
  readonly hint?: string;
  readonly toughness: string;
  readonly actions: readonly PropInspectChip[];
  readonly notes: readonly PropInspectChip[];
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

const SMALLEST_SHIPPED_FIRE_HIT = Math.min(
  ...FIRE_ABILITIES.flatMap((ability) =>
    ability.effects.flatMap((effect) =>
      effect.kind === 'damage' && effect.damageType === 'fire' ? [effect.base] : [],
    ),
  ),
);

function list(words: readonly string[]): string {
  if (words.length < 2) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} or ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, or ${words.at(-1)}`;
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

type StatusNames = ReadonlyMap<StatusId, Pick<StatusDef, 'name'>>;

function surfaceResult(surface: string, radius: number): string {
  if (radius === 0) {
    const ownTile: Readonly<Record<string, string>> = {
      fire: 'fire is left where it stood',
      water: 'water pools where it stood',
      oil: 'oil pools where it stood',
      rubble: 'rubble is left where it stood',
    };
    return ownTile[surface] ?? `${surface.replaceAll('_', ' ')} is left where it stood`;
  }
  if (radius === 1)
    return SPILLS[surface] ?? `${surface.replaceAll('_', ' ')} is left on the ground`;
  return `${surface.replaceAll('_', ' ')} spreads ${radius} tiles around it`;
}

function nearbyResult(
  radius: number,
  own: string,
  next: string,
  within: (radius: number) => string,
) {
  if (radius === 0) return own;
  if (radius === 1) return next;
  return within(radius);
}

function breakResult(effect: PropEffect, statuses: StatusNames): string {
  switch (effect.kind) {
    case 'surface':
      return surfaceResult(effect.surface, effect.radius);
    case 'damage':
      return nearbyResult(
        effect.radius,
        'it hurts anyone standing on it',
        'it hurts anyone next to it',
        (radius) => `it hurts anyone within ${radius} tiles`,
      );
    case 'status': {
      const name = statuses.get(effect.status)?.name ?? effect.status.replaceAll('_', ' ');
      const outcome = effect.chance >= 1 ? `ends up ${name}` : `may end up ${name}`;
      return nearbyResult(
        effect.radius,
        `anyone standing on it ${outcome}`,
        `anyone next to it ${outcome}`,
        (radius) => `anyone within ${radius} tiles ${outcome}`,
      );
    }
    case 'push':
      return nearbyResult(
        effect.radius,
        'it knocks back anyone standing on it',
        'it knocks back anyone next to it',
        (radius) => `it knocks back anyone within ${radius} tiles`,
      );
  }
}

/** Plain, deterministic copy for the prop card. */
export function propInspectText(
  def: PropDef,
  prop: PropInstance,
  statuses: StatusNames,
): PropInspectText {
  const results = def.onBreak.map((effect) => breakResult(effect, statuses));
  const actions: PropInspectChip[] = [
    {
      text: results.length > 0 ? `Break it: ${andList(results)}` : 'Break it',
      icon: 'fist',
    },
  ];

  if (def.pushable) actions.push({ text: 'Shove it', icon: 'push' });
  if (def.grantsCover && !def.blocksMove)
    actions.push({ text: 'Stand on it for cover', icon: 'guard' });
  const douse = def.douse?.filter((type) => !def.immuneTo.includes(type)) ?? [];
  if ((def.fuel ?? 0) > 0 && prop.burning !== undefined && douse.length > 0)
    actions.push({
      text: `Put it out with ${list(douse.map((type) => DOUSE_NAMES[type]))}`,
      icon: 'wave',
    });

  const notes: PropInspectChip[] = [];
  if (def.blocksMove) notes.push({ text: 'Blocks the way', icon: 'wall' });
  if (def.blocksSight) notes.push({ text: 'Blocks sight', icon: 'sense' });
  if ((def.fuel ?? 0) > 0) {
    const fireDamage = SMALLEST_SHIPPED_FIRE_HIT * (def.vulnerableTo.includes('fire') ? 2 : 1);
    notes.push({
      text:
        prop.burning === undefined
          ? `Fire lights it; burns for ${def.fuel} ${def.fuel === 1 ? 'round' : 'rounds'}`
          : prop.hp - fireDamage <= 0
            ? 'Fire will break it now'
            : 'Fire hurts it now',
      icon: 'torch',
    });
  }
  const vulnerable =
    (def.fuel ?? 0) > 0 && prop.burning === undefined
      ? def.vulnerableTo.filter((type) => type !== 'fire')
      : def.vulnerableTo;
  if (vulnerable.length > 0)
    notes.push({ text: `Weak to ${list(vulnerable.map((type) => DAMAGE_NAMES[type]))}` });
  if (def.immuneTo.length > 0)
    notes.push({
      text: `Shrugs off ${andList(def.immuneTo.map((type) => DAMAGE_NAMES[type]))}`,
      icon: 'guard',
    });

  return {
    description: def.description,
    ...(def.hint ? { hint: def.hint } : {}),
    toughness: `${prop.hp} / ${def.hp} HP`,
    actions,
    notes,
    ...(prop.burning !== undefined
      ? { burning: `On fire: ${prop.burning} ${prop.burning === 1 ? 'round' : 'rounds'} left` }
      : {}),
  };
}
