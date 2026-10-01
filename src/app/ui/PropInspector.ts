import type { ContentIndex, PropDef, PropInstance } from '../../core/types';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { assetCanvas } from './assetCanvas';
import { button, el, mark } from './dom';
import { iconMarkup } from './icons';
import { propInspectText } from './propInspectText';

export class PropInspector extends Dialog {
  protected options: DialogOptions;

  constructor(
    private def: PropDef,
    private prop: PropInstance,
    private statuses: ContentIndex['statuses'],
    private onDismiss: () => void,
  ) {
    super();
    this.options = { title: def.name, wide: true };
  }

  protected override onClose(): void {
    this.onDismiss();
  }

  protected build(body: HTMLElement): void {
    const copy = propInspectText(this.def, this.prop, this.statuses);
    body.appendChild(
      el(
        'div',
        { class: 'row inspector-head prop-inspector-head' },
        assetCanvas(this.def.sprite, 5),
        el(
          'div',
          { class: 'stack tight' },
          el('p', { class: 'prop-inspector-lead', text: copy.description }),
          copy.hint ? el('p', { class: 'tiny muted prop-inspector-hint', text: copy.hint }) : null,
          el('span', { class: 'chip prop-toughness', text: copy.toughness }),
        ),
      ),
    );

    const appendChips = (heading: string, chips: typeof copy.actions) => {
      if (chips.length === 0) return;
      body.appendChild(el('h3', { text: heading }));
      body.appendChild(
        el(
          'div',
          { class: 'row row-wrap chips prop-action-chips' },
          ...chips.map((chip) =>
            el(
              'span',
              { class: 'chip prop-action-chip' },
              chip.icon ? mark(iconMarkup(chip.icon)) : null,
              el('span', { text: chip.text }),
            ),
          ),
        ),
      );
    };
    appendChips('What you can do', copy.actions);
    appendChips('Good to know', copy.notes);

    if (copy.burning) {
      body.appendChild(el('h3', { text: 'Right now' }));
      body.appendChild(
        el(
          'div',
          { class: 'status-row status-burning prop-burning' },
          el('strong', { text: copy.burning }),
        ),
      );
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

  get propId(): string {
    return this.prop.id;
  }

  update(prop: PropInstance): void {
    if (prop === this.prop) return;
    this.prop = prop;
    this.refresh();
  }
}
