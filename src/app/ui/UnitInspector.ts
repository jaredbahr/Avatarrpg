/**
 * Unit inspector.
 *
 * Opened by long-pressing (or right-clicking) anyone on the battlefield,
 * friend or enemy. Enemies show their full kit deliberately: "what can that
 * thing do to me" is exactly the question a tactics game should answer before
 * you commit, not after.
 */

import type { App } from '../App';
import type { Unit } from '../../core/types';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { button, el } from './dom';
import { assetCanvas } from './assetCanvas';
import { abilityCard } from './AbilityCard';
import { effectiveStats } from '../../core/rules/stats';
import { describeIncoming } from '../../core/rules/status';
import { describeFooting } from '../../core/rules/reactions';
import { occupiedCells, tileAt } from '../../core/rules/grid';
import { levelProgress, xpToNextLevel } from '../../core/rules/leveling';

export class UnitInspector extends Dialog {
  protected options: DialogOptions;

  constructor(
    private app: App,
    private unit: Unit,
    private onDismiss: () => void,
  ) {
    super();
    const player = app.session.playerFor(unit.id);
    this.options = {
      title: player ? `${unit.name} (${player.name})` : unit.name,
      subtitle:
        unit.faction === 'enemy'
          ? (app.content.enemies.get(unit.enemyId ?? '')?.description ?? 'An enemy.')
          : ((unit.characterId ? app.content.characters.get(unit.characterId)?.blurb : undefined) ??
            ''),
      wide: true,
    };
  }

  protected override onClose(): void {
    this.onDismiss();
  }

  /**
   * What this unit is standing in. A puddle under an enemy is a plan, and a
   * puddle under your own firebender is a warning — neither was visible
   * anywhere in the HUD before, only as a tint on the map.
   */
  private footingRow(): HTMLElement | null {
    const battle = this.app.state?.battle;
    if (!battle) return null;

    // A 2-tile boss stands in whichever of its cells carries a surface; the
    // first one is close enough for an at-a-glance readout.
    const cell = occupiedCells(this.unit).find((c) => tileAt(battle.grid, c)?.surface);
    const surface = cell ? tileAt(battle.grid, cell)?.surface : undefined;
    if (!surface) return null;

    const def = this.app.content.surfaces.get(surface.id);
    return el(
      'div',
      { class: 'status-row status-footing' },
      el('strong', { text: `Standing in ${def?.name ?? surface.id}` }),
      el('span', {
        class: 'tiny muted',
        text: describeFooting(this.app.content, surface.id),
      }),
    );
  }

  protected build(body: HTMLElement): void {
    const unit = this.unit;
    const stats = effectiveStats(this.app.content, unit);
    const portraitKey = unit.characterId
      ? (this.app.content.characters.get(unit.characterId)?.portrait ?? unit.sprite)
      : unit.sprite;

    body.appendChild(
      el(
        'div',
        { class: 'row inspector-head' },
        assetCanvas(portraitKey, 5),
        el(
          'div',
          { class: 'stack tight' },
          el(
            'div',
            { class: 'row row-wrap chips' },
            el('span', { class: 'chip', text: `${unit.hp} / ${unit.base.maxHp} HP` }),
            el('span', { class: 'chip', text: `${unit.ap} / ${stats.maxAp} AP` }),
            el('span', { class: 'chip', text: `Move ${unit.move} / ${stats.maxMove}` }),
          ),
          el(
            'div',
            { class: 'row row-wrap chips' },
            el('span', { class: 'chip', text: `Power ${stats.power}` }),
            el('span', { class: 'chip', text: `Defence ${stats.defense}` }),
            el('span', { class: 'chip', text: `Speed ${stats.speed}` }),
            el('span', { class: 'chip', text: `Focus ${stats.focus}%` }),
          ),
          unit.faction === 'party'
            ? el('span', {
                class: 'tiny muted',
                text: `Level ${unit.level} — ${Math.round(levelProgress(unit.level, unit.xp) * 100)}% to level ${unit.level + 1} (${xpToNextLevel(unit.level, unit.xp)} XP to go)`,
              })
            : null,
        ),
      ),
    );

    const footing = this.footingRow();

    if (unit.statuses.length > 0 || footing) {
      const list = el('div', { class: 'stack tight status-list' });
      for (const status of unit.statuses) {
        const def = this.app.content.statuses.get(status.id);
        if (!def) continue;
        // The prose says "lightning doubled"; this says "lightning ×2", read
        // straight off the modifier the damage roll will use. If someone
        // retunes Wet, this line moves and the prose does not.
        const incoming = describeIncoming(this.app.content, status.id);
        list.appendChild(
          el(
            'div',
            { class: `status-row status-${def.kind}` },
            el('strong', { text: `${def.name} (${status.duration})` }),
            el('span', { class: 'tiny muted', text: def.description }),
            incoming ? el('span', { class: 'tiny status-incoming', text: incoming }) : null,
          ),
        );
      }
      if (footing) list.appendChild(footing);
      body.appendChild(el('h3', { text: 'Right now' }));
      body.appendChild(list);
    }

    const abilities = unit.abilities
      .map((id) => this.app.content.abilities.get(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);

    const discipline = unit.disciplineId
      ? this.app.content.disciplines.get(unit.disciplineId)
      : undefined;
    if (discipline) {
      body.appendChild(el('h3', { text: 'Path' }));
      body.appendChild(
        el(
          'div',
          { class: 'stack tight' },
          el('strong', { text: discipline.name }),
          el('span', { class: 'tiny muted', text: discipline.blurb }),
        ),
      );
    }

    if (abilities.length > 0) {
      body.appendChild(
        el('h3', { text: unit.faction === 'enemy' ? 'What it can do' : 'Techniques' }),
      );
      const grid = el('div', { class: 'choice-cards' });
      for (const ability of abilities) {
        const cooldown = unit.cooldowns[ability.id] ?? 0;
        grid.appendChild(
          abilityCard(this.app.content, ability, {
            expanded: true,
            reason: cooldown > 0 ? `Cooling down for ${cooldown} more round(s).` : undefined,
          }),
        );
      }
      body.appendChild(grid);
    }

    body.appendChild(
      el(
        'div',
        { class: 'row dialog-footer' },
        el('div', { class: 'spacer' }),
        button('Close', () => this.close(), { class: 'btn-primary' }),
      ),
    );
  }
}
