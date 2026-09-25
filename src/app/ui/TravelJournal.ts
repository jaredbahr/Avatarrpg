import type { App } from '../App';
import { travelJournal } from '../world/journal';
import { Dialog } from './Dialog';
import { append, button, el } from './dom';

export class TravelJournal extends Dialog {
  protected options = { title: 'Travel journal', wide: true };
  constructor(private app: App) {
    super();
  }

  protected build(body: HTMLElement): void {
    const state = this.app.state;
    if (!state) return;
    const journal = travelJournal(this.app.content, state);
    append(body, [
      el(
        'p',
        { class: 'explore-title' },
        el('strong', { text: journal.location }),
        el('span', { class: 'explore-phase', text: journal.time }),
      ),
      journal.wait && el('p', { class: 'muted', text: journal.wait }),
      el('p', { text: journal.objective }),
      button('Return to the path', () => this.close(), { class: 'btn-primary' }),
    ]);
    const section = (title: string) => {
      const part = el(
        'section',
        { class: 'stack', attrs: { 'aria-label': title } },
        el('h3', { text: title }),
      );
      body.append(part);
      return part;
    };
    const routes = section('Paths from here');
    for (const route of journal.routes)
      routes.append(
        el(
          'div',
          {},
          el('strong', { text: route.label }),
          el('p', { class: 'muted', text: route.detail }),
        ),
      );
    if (!journal.routes.length)
      routes.append(el('p', { text: 'Finish the conversation to return to the paths.' }));
    const places = section('Places');
    for (const place of journal.places)
      places.append(el('p', { text: `${place.name} · ${place.status}` }));
    const discoveries = section('Little discoveries');
    for (const note of journal.discoveries)
      discoveries.append(
        el(
          'article',
          { class: 'journal-note' },
          el('strong', { text: `${note.found ? 'Remembered' : 'A lead'} · ${note.title}` }),
          el('p', { class: 'muted tiny', text: note.location }),
          el('p', { text: note.text }),
        ),
      );
    if (!journal.discoveries.length)
      discoveries.append(
        el('p', { text: 'Talk to the people along the road. The little things belong here too.' }),
      );
    body.append(button('Close journal', () => this.close()));
  }
}
