/**
 * The reactions reference.
 *
 * Until now the elemental table — the best system in the game — was explained
 * only in `README.md`, which is a document for whoever set the tablet up, not
 * for the eight-year-old holding it. Reaching it from the pause menu means a
 * player who has forgotten what fire does to oil can find out without asking
 * a grown-up to open a laptop.
 *
 * Every row is generated from `content.combos`, `content.surfaces` and
 * `content.statuses`. Nothing is written out by hand, so a tuning change
 * cannot leave a stale sentence behind on this screen — which is exactly what
 * the hand-written terrain note in the confirm step had been doing.
 */

import type { App } from '../App';
import type { ComboRule, ContentIndex, DamageType, SurfaceId } from '../../core/types';
import { describeFooting } from '../../core/rules/reactions';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { button, el } from './dom';

/** 'lightning' has no surface of its own; 'fire' has both and shares a name. */
function appliedName(content: ContentIndex, applied: DamageType | SurfaceId): string {
  const surface = content.surfaces.get(applied as SurfaceId);
  if (surface) return surface.name;
  return applied.charAt(0).toUpperCase() + applied.slice(1);
}

function surfaceName(content: ContentIndex, id: SurfaceId | null): string {
  if (!id) return 'bare ground';
  return content.surfaces.get(id)?.name ?? id;
}

export class ReactionsReference extends Dialog {
  protected options: DialogOptions = {
    title: 'How the elements react',
    subtitle: 'Terrain is a weapon. This is the whole table — go and break it.',
    dismissable: true,
    wide: true,
  };

  constructor(private app: App) {
    super();
  }

  protected build(body: HTMLElement): void {
    const content = this.app.content;

    body.appendChild(
      el('p', {
        class: 'muted',
        text: 'Land something on a tile that already holds something else and the ground answers. The first rule that matches is the one that happens.',
      }),
    );

    body.appendChild(el('h3', { text: 'When elements meet' }));
    body.appendChild(this.comboTable(content));

    body.appendChild(el('h3', { text: 'Standing in it' }));
    body.appendChild(this.footingList(content));

    body.appendChild(
      el(
        'div',
        { class: 'row dialog-footer' },
        el('div', { class: 'spacer' }),
        button('Close', () => this.close(), { class: 'btn-primary' }),
      ),
    );
  }

  /** Grouped by what you are applying, because that is how a player thinks:
   *  "I have a fireball — what can I aim it at?" */
  private comboTable(content: ContentIndex): HTMLElement {
    const groups = new Map<string, ComboRule[]>();
    for (const rule of content.combos) {
      const key = String(rule.applied);
      const list = groups.get(key);
      if (list) list.push(rule);
      else groups.set(key, [rule]);
    }

    const wrap = el('div', { class: 'stack tight' });

    for (const rules of groups.values()) {
      const first = rules[0];
      if (!first) continue;

      const section = el(
        'div',
        { class: 'stack tight reaction-group' },
        el('h4', {
          class: 'reaction-group-head',
          text: `${appliedName(content, first.applied)} onto…`,
        }),
      );

      for (const rule of rules) {
        section.appendChild(this.comboRow(content, rule));
      }
      wrap.appendChild(section);
    }

    return wrap;
  }

  private comboRow(content: ContentIndex, rule: ComboRule): HTMLElement {
    const chains = rule.chainThroughExisting;
    const row = el('div', {
      class: `reaction-row${chains ? ' reaction-row-chain' : ''}`,
    });

    row.appendChild(
      el('span', {
        class: 'reaction-row-arrow',
        text: `${surfaceName(content, rule.existing)} → ${surfaceName(content, rule.result)}`,
      }),
    );
    row.appendChild(el('span', { class: 'tiny reaction-row-label', text: rule.label }));

    const notes: string[] = [];
    if (chains) notes.push('travels through the whole connected patch');
    if (rule.chainDamage > 0) notes.push(`${rule.chainDamage} damage to everyone it reaches`);
    if (rule.spread > 0) notes.push('spreads outward each round');
    if (rule.status) {
      const name = content.statuses.get(rule.status)?.name ?? rule.status;
      notes.push(
        rule.statusChance >= 1
          ? `always ${name}`
          : `${Math.round(rule.statusChance * 100)}% ${name}`,
      );
    }
    if (notes.length > 0) {
      row.appendChild(el('span', { class: 'tiny reaction-row-notes', text: notes.join(' · ') }));
    }

    return row;
  }

  private footingList(content: ContentIndex): HTMLElement {
    const list = el('div', { class: 'stack tight' });
    for (const surface of content.surfaces.values()) {
      list.appendChild(
        el(
          'div',
          { class: 'reaction-row' },
          el('span', { class: 'reaction-row-arrow', text: surface.name }),
          el('span', { class: 'tiny reaction-row-label', text: surface.description }),
          el('span', {
            class: 'tiny reaction-row-notes',
            text: describeFooting(content, surface.id),
          }),
        ),
      );
    }
    return list;
  }
}
