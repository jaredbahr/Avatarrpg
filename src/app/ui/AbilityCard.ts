/**
 * Ability card.
 *
 * Shared by the level-up dialog, the unit inspector and the action-bar
 * long-press. Written to be readable by an eight-year-old: cost and range as
 * chips, then one plain sentence, then the flavour line.
 */

import type { Ability, AbilityEffect, ContentIndex } from '../../core/types';
import { el } from './dom';

function shapeLabel(ability: Ability): string {
  switch (ability.targeting.shape) {
    case 'self':
      return 'Yourself';
    case 'unit':
      return ability.targeting.allow === 'ally'
        ? 'One friend'
        : ability.targeting.allow === 'enemy'
          ? 'One enemy'
          : 'Anyone';
    case 'tile':
      return 'One tile';
    case 'blast':
      return `${ability.targeting.radius * 2 + 1}x${ability.targeting.radius * 2 + 1} area`;
    case 'line':
      return `Line of ${ability.targeting.length}`;
    case 'cone':
      return `Cone, ${ability.targeting.length} deep`;
  }
}

/** One short phrase per effect, in resolution order. */
export function effectLines(content: ContentIndex, effects: readonly AbilityEffect[]): string[] {
  const out: string[] = [];
  for (const effect of effects) {
    switch (effect.kind) {
      case 'damage':
        out.push(
          `${effect.base} + ${effect.scale}x Power ${effect.damageType} damage` +
            (effect.ignoreDefense ? ' (ignores armour)' : ''),
        );
        break;
      case 'heal':
        out.push(`Heals ${effect.base} + ${effect.scale}x Power`);
        break;
      case 'status': {
        const name = content.statuses.get(effect.status)?.name ?? effect.status;
        const who =
          effect.to === 'self' ? 'you' : effect.to === 'allies' ? 'your side' : 'the target';
        const chance =
          effect.chance >= 1 ? 'Always' : `${Math.round(effect.chance * 100)}% chance to`;
        out.push(`${chance} make ${who} ${name} for ${effect.duration} rounds`);
        break;
      }
      case 'surface': {
        const name = content.surfaces.get(effect.surface)?.name ?? effect.surface;
        out.push(`Leaves ${name} on the ground`);
        break;
      }
      case 'push':
        out.push(`Pushes ${effect.distance} tiles away`);
        break;
      case 'pull':
        out.push(`Pulls ${effect.distance} tiles closer`);
        break;
      case 'dash':
        out.push('Moves you to the target tile');
        break;
      case 'wall':
        out.push(`Raises a wall for ${effect.duration} rounds`);
        break;
      case 'cleanse':
        out.push(
          `Clears ${effect.statuses.map((s) => content.statuses.get(s)?.name ?? s).join(', ')}`,
        );
        break;
      case 'grantAp':
        out.push(`Gives ${effect.to === 'self' ? 'you' : 'them'} ${effect.amount} AP`);
        break;
      case 'revealSurfaces':
        out.push('Reveals the whole battlefield');
        break;
    }
  }
  return out;
}

export interface AbilityCardOptions {
  /** Shows the full effect breakdown, not just the description. */
  readonly expanded?: boolean;
  readonly reason?: string;
}

export function abilityCard(
  content: ContentIndex,
  ability: Ability,
  options: AbilityCardOptions = {},
): HTMLElement {
  const chips = el(
    'div',
    { class: 'row row-wrap chips' },
    el('span', { class: 'chip chip-ap', text: `${ability.apCost} AP` }),
    el('span', {
      class: 'chip',
      text: ability.range === 0 ? 'Self' : `Range ${ability.range}`,
    }),
    el('span', { class: 'chip', text: shapeLabel(ability) }),
    ability.cooldown > 0
      ? el('span', { class: 'chip', text: `Cooldown ${ability.cooldown}` })
      : null,
    ability.requiresLineOfSight ? null : el('span', { class: 'chip', text: 'Ignores cover' }),
  );

  const card = el(
    'div',
    { class: `ability-card element-${ability.element}` },
    el('h3', { text: ability.name }),
    chips,
    el('p', { text: ability.description }),
  );

  if (options.expanded) {
    const list = el('ul', { class: 'effect-list' });
    for (const line of effectLines(content, ability.effects)) {
      list.appendChild(el('li', { text: line }));
    }
    card.appendChild(list);
  }

  card.appendChild(el('p', { class: 'flavor muted tiny', text: ability.flavor }));

  if (options.reason) {
    card.appendChild(el('p', { class: 'warn-note tiny', text: options.reason }));
  }

  return card;
}
