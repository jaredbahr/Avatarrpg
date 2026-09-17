import type { App } from '../App';
import type { Vec2 } from '../../core/types';
import { nearbyPlaces } from '../world/walking';
import { Dialog } from './Dialog';
import { button, el } from './dom';

export class NearbyPlaces extends Dialog {
  protected options = { title: 'Look around' };

  constructor(
    private app: App,
    private walk: (pos: Vec2) => void,
  ) {
    super();
  }

  protected build(body: HTMLElement): void {
    const state = this.app.state;
    if (!state) return;
    const places = nearbyPlaces(this.app.content, state);
    body.append(
      el('p', {
        text: 'A few things close to this stretch of path. Walk over and see what you find.',
      }),
    );
    for (const { npc } of places) {
      body.append(
        button(`Visit ${npc.name}`, () => {
          this.close();
          this.walk(npc.pos);
        }),
      );
    }
    if (!places.length)
      body.append(
        el('p', {
          class: 'muted',
          text: 'A quiet stretch. Follow the paths and look around again further along.',
        }),
      );
    body.append(button('Back to the path', () => this.close()));
  }
}
