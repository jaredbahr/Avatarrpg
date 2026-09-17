/**
 * Settings.
 *
 * Six controls, each one aimed at a specific person at the table rather than
 * at a spec: text too small on a 2736x1824 screen, too much going on, a room
 * where sound is not welcome, can't tell the fire from the mud, the panels
 * washing out in daylight, or a planner who counts squares.
 */

import type { App } from '../App';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { button, el } from './dom';

/**
 * Four steps rather than a slider: `choiceRow` is already a row of real
 * buttons, so this inherits the tap size, the Largest-text scaling and the
 * `touch.spec` coverage instead of needing a range input with none of it.
 */
const VOLUME_CHOICES = [
  { label: 'Off', value: 0 },
  { label: 'Quiet', value: 0.35 },
  { label: 'Normal', value: 0.7 },
  { label: 'Loud', value: 1 },
] as const;

/** The step a stored volume sits on, so a hand-edited value still shows a selection. */
function nearestVolume(volume: number): number {
  let best: number = VOLUME_CHOICES[2].value;
  let gap = Infinity;
  for (const choice of VOLUME_CHOICES) {
    const distance = Math.abs(choice.value - volume);
    if (distance < gap) {
      gap = distance;
      best = choice.value;
    }
  }
  return best;
}

export class SettingsPanel extends Dialog {
  protected options: DialogOptions = {
    title: 'Settings',
    subtitle: 'These apply straight away and are remembered on this device.',
  };

  constructor(private app: App) {
    super();
  }

  protected build(body: HTMLElement): void {
    const settings = this.app.settings;

    body.appendChild(
      this.choiceRow(
        'Text size',
        'Scales the whole interface, including the size of every button.',
        [
          { label: 'Normal', value: 'off' },
          { label: 'Large', value: 'on' },
          { label: 'Largest', value: 'huge' },
        ],
        settings.largeText,
        (value) => this.app.updateSettings({ largeText: value as 'off' | 'on' | 'huge' }),
      ),
    );

    body.appendChild(
      this.choiceRow(
        'Sound',
        'Bending, footsteps and the interface. Off opens no audio at all.',
        VOLUME_CHOICES.map(({ label, value }) => ({ label, value: String(value) })),
        String(nearestVolume(settings.volume)),
        (value) => this.app.updateSettings({ volume: Number(value) }),
      ),
    );

    body.appendChild(
      this.toggleRow(
        'Reduce motion',
        'Results appear immediately instead of playing out. Nothing is hidden.',
        settings.reduceMotion,
        (value) => this.app.updateSettings({ reduceMotion: value }),
      ),
    );

    body.appendChild(
      this.toggleRow(
        'Patterned ground',
        'Draws a distinct texture on water, fire, mud and oil, so they are told apart by shape as well as colour.',
        settings.hatchSurfaces,
        (value) => this.app.updateSettings({ hatchSurfaces: value }),
      ),
    );

    body.appendChild(
      this.toggleRow(
        'Higher contrast',
        'Brighter panel edges and text, for playing in daylight. Also draws the grid.',
        settings.highContrast,
        (value) => this.app.updateSettings({ highContrast: value }),
      ),
    );

    body.appendChild(
      this.toggleRow(
        'Show grid',
        'Draws the tile lines over the ground, for anyone who plans by counting squares.',
        settings.showGrid,
        (value) => this.app.updateSettings({ showGrid: value }),
      ),
    );

    body.appendChild(
      el(
        'div',
        { class: 'row dialog-footer' },
        el('div', { class: 'spacer' }),
        button('Done', () => this.close(), { class: 'btn-primary' }),
      ),
    );
  }

  private toggleRow(
    label: string,
    hint: string,
    value: boolean,
    onChange: (next: boolean) => void,
  ): HTMLElement {
    const toggle = button(
      value ? 'On' : 'Off',
      () => {
        onChange(!value);
        this.refresh();
      },
      { class: value ? 'btn-primary' : '' },
    );
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', String(value));
    toggle.setAttribute('aria-label', label);

    return el(
      'div',
      { class: 'setting-row' },
      el(
        'div',
        { class: 'setting-text' },
        el('strong', { text: label }),
        el('span', { class: 'muted tiny', text: hint }),
      ),
      toggle,
    );
  }

  private choiceRow(
    label: string,
    hint: string,
    choices: readonly { label: string; value: string }[],
    value: string,
    onChange: (next: string) => void,
  ): HTMLElement {
    const group = el('div', {
      class: 'row row-wrap',
      attrs: { role: 'radiogroup', 'aria-label': label },
    });
    for (const choice of choices) {
      const active = choice.value === value;
      const node = button(
        choice.label,
        () => {
          onChange(choice.value);
          this.refresh();
        },
        { class: active ? 'btn-primary' : '' },
      );
      node.setAttribute('role', 'radio');
      node.setAttribute('aria-checked', String(active));
      group.appendChild(node);
    }

    return el(
      'div',
      { class: 'setting-row' },
      el(
        'div',
        { class: 'setting-text' },
        el('strong', { text: label }),
        el('span', { class: 'muted tiny', text: hint }),
      ),
      group,
    );
  }
}
