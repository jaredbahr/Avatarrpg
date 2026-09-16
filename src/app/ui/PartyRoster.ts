/**
 * The party at a glance, out of combat: one row per member down the side of
 * the village, built from the same pieces as the fight's unit panel (the
 * square portrait with its element badge, the name, the level, the health
 * bar, the action pips) so the two read as one HUD. Tapping a row opens
 * the member's inspector; the leader's row is plated.
 */

import type { App } from '../App';
import type { ContentIndex, Unit } from '../../core/types';
import { effectiveStats } from '../../core/rules/stats';
import { paletteFor } from '../../render/palettes';
import { paintElementGlyph } from '../../render/painters/glyphs';
import { assetCanvas } from './assetCanvas';
import { el, painterCanvas } from './dom';

/** A hero's portrait; anyone else is drawn from their own sprite. */
export function portraitKeyFor(content: ContentIndex, unit: Unit): string {
  return unit.characterId
    ? (content.characters.get(unit.characterId)?.portrait ?? unit.sprite)
    : unit.sprite;
}

export function partyRoster(
  app: App,
  party: readonly Unit[],
  leaderId: string | null,
  onPick: (unit: Unit) => void,
): HTMLElement {
  const roster = el('div', { class: 'roster', attrs: { 'aria-label': 'The party' } });
  for (const unit of party) {
    roster.appendChild(rosterRow(app, unit, unit.id === leaderId, onPick));
  }
  return roster;
}

function rosterRow(
  app: App,
  unit: Unit,
  active: boolean,
  onPick: (unit: Unit) => void,
): HTMLElement {
  const stats = effectiveStats(app.content, unit);
  const player = app.session.playerFor(unit.id);
  const palette = paletteFor(unit.element);
  const hpFraction = Math.max(0, unit.hp / Math.max(1, unit.base.maxHp));

  const pips = el('div', { class: 'pips', attrs: { 'aria-label': `${unit.ap} action points` } });
  for (let i = 0; i < Math.max(stats.maxAp, unit.ap); i++) {
    pips.appendChild(el('span', { class: `pip${i < unit.ap ? ' pip-on' : ''}` }));
  }

  const portrait = el(
    'div',
    { class: 'unit-portrait-frame' },
    assetCanvas(portraitKeyFor(app.content, unit), 3, 'unit-portrait square'),
    el(
      'span',
      { class: 'portrait-badge', attrs: { 'aria-hidden': 'true' } },
      painterCanvas(`glyph.${unit.element}`, 1, (ctx, px) =>
        paintElementGlyph(ctx, { x: 0, y: 0, size: px }, palette, unit.element),
      ),
    ),
  );

  return el(
    'div',
    {
      class: `hud-panel roster-row element-${unit.element}${active ? ' active' : ''}`,
      attrs: {
        role: 'button',
        tabindex: '0',
        'aria-label': `${unit.name}, level ${unit.level}, ${unit.hp} of ${unit.base.maxHp} health`,
      },
      onClick: () => onPick(unit),
      onKeyDown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPick(unit);
        }
      },
    },
    el(
      'div',
      { class: 'row tight unit-panel-body' },
      portrait,
      el(
        'div',
        { class: 'stack tight grow' },
        el(
          'div',
          { class: 'row tight' },
          el(
            'div',
            { class: 'stack tight' },
            el('strong', { class: 'roster-name', text: unit.name }),
            player ? el('span', { class: 'tiny muted', text: player.name }) : null,
          ),
          el('div', { class: 'spacer' }),
          el('span', { class: 'roster-level', text: `Lv ${unit.level}` }),
        ),
        el(
          'div',
          { class: 'bar' },
          el('div', { class: 'bar-fill', style: { width: `${hpFraction * 100}%` } }),
          el('span', { class: 'bar-label', text: `${unit.hp} / ${unit.base.maxHp}` }),
        ),
        pips,
      ),
    ),
  );
}
