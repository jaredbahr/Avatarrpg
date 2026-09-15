/**
 * The terrain half of the confirm step.
 *
 * Damage gets chips because it is a number. A reaction is a *sentence* — the
 * combo table already writes one, in the same plain words the combat log
 * prints a moment later, which is the point: a kid should read "the oil
 * catches — the fire is spreading!" before they commit, recognise it when it
 * scrolls past, and connect the two. Chips are `nowrap`, so a sentence in one
 * would run off the side of a tablet. These get their own block instead.
 *
 * Nothing here decides anything. Everything shown comes from the forecast in
 * `core/rules/reactions.ts`, which gets its answers by running the real combo
 * engine.
 */

import type { ContentIndex } from '../../core/types';
import type { ForecastEntry } from '../../core/rules/reactions';
import { describeFooting } from '../../core/rules/reactions';
import { el } from './dom';

/** "Kaya (6 damage, Shocked)" — who a chain reaches and what it does to them. */
function describeCaught(content: ContentIndex, entry: ForecastEntry): HTMLElement | null {
  if (entry.caught.length === 0) return null;

  const row = el('div', { class: 'row row-wrap chips reaction-caught' });
  for (const caught of entry.caught) {
    const parts: string[] = [];
    if (caught.damage > 0) parts.push(`${caught.damage} damage`);
    if (caught.status) {
      const name = content.statuses.get(caught.status)?.name ?? caught.status;
      parts.push(
        caught.statusChance >= 1 ? name : `${Math.round(caught.statusChance * 100)}% ${name}`,
      );
    }
    row.appendChild(
      el('span', {
        class: `chip ${caught.friendly ? 'chip-friendly' : 'chip-hostile'}`,
        text: parts.length > 0 ? `${caught.name}: ${parts.join(' · ')}` : caught.name,
      }),
    );
  }
  return row;
}

/** The one-line consequence of the ground becoming what it is about to become. */
function describeResult(content: ContentIndex, entry: ForecastEntry): string {
  if (!entry.to) return 'The ground is left bare.';

  const name = content.surfaces.get(entry.to)?.name ?? entry.to;
  const scope = entry.tiles === 1 ? '1 tile' : `${entry.tiles} tiles`;
  const spread = entry.spreads ? ', and it spreads further each round' : '';
  return `${name} on ${scope}${spread} — ${describeFooting(content, entry.to)}`;
}

/**
 * One block per rule that will fire. Returns an empty array when the ground
 * does nothing, so the caller can append unconditionally.
 */
export function reactionNotes(
  content: ContentIndex,
  reactions: readonly ForecastEntry[],
): HTMLElement[] {
  const notes: HTMLElement[] = [];

  for (const entry of reactions) {
    const chains = entry.chainTiles > 0;
    const classes = ['reaction-note'];
    if (entry.kind === 'reaction') classes.push('reaction-fires');
    if (chains) classes.push('reaction-chain');

    const note = el(
      'div',
      { class: classes.join(' ') },
      el('strong', { class: 'reaction-label', text: entry.label }),
      el('span', { class: 'tiny reaction-result', text: describeResult(content, entry) }),
    );

    if (chains) {
      note.appendChild(
        el('span', {
          class: 'tiny reaction-reach',
          text: `It carries ${entry.chainTiles} tile${entry.chainTiles === 1 ? '' : 's'} beyond what you aimed at.`,
        }),
      );
    }

    const caught = describeCaught(content, entry);
    if (caught) note.appendChild(caught);

    notes.push(note);
  }

  return notes;
}
