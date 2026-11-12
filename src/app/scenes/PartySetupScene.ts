/**
 * Party setup.
 *
 * A strict sequence, because six people crowding one tablet needs a turn
 * order even here: pick how many are playing, then each person in turn types a
 * name, picks an element, picks a character, and confirms. Then a summary, then
 * Begin.
 *
 * Two rules that matter at a real table:
 *  - A character already taken cannot be taken again. Two Kayas is confusing
 *    for everyone and makes the turn banner useless.
 *  - The hand-off card between players is explicit, so nobody picks for
 *    somebody else while they are getting a drink.
 */

import type { App, Scene } from '../App';
import type { CharacterDef, Difficulty, ElementId } from '../../core/types';
import { DEFAULT_DIFFICULTY } from '../../core/rules/difficulty';
import { button, clear, el } from '../ui/dom';
import { assetCanvas } from '../ui/assetCanvas';
import { defaultPlayerName } from '../session';
import { DIFFICULTY_CHOICES, difficultyHint } from '../ui/difficultyText';
import { loadLastTitleArt } from '../storage/localSaves';
import { titleArtById, type TitleArtDef } from '../titleArt';

type Step = 'count' | 'handoff' | 'name' | 'element' | 'character' | 'summary';

interface PersonDraft {
  name: string;
}

interface HeroDraft {
  ownerIndex: number;
  element: ElementId | null;
  characterId: string | null;
}

export class PartySetupScene implements Scene {
  readonly name = 'setup';

  private host: HTMLElement | null = null;
  private step: Step = 'count';
  private playerCount = 1;
  private current = 0;
  private phase: 'names' | 'heroes' = 'names';
  private people: PersonDraft[] = [];
  private heroes: HeroDraft[] = [];
  private resumeHeroIndex: number | null = null;
  private difficulty: Difficulty = DEFAULT_DIFFICULTY;

  constructor(private app: App) {}

  mount(host: HTMLElement): void {
    this.host = host;
    this.render();
  }

  unmount(): void {
    this.host = null;
  }

  sync(): void {
    this.render();
  }

  /* ---------------------------------------------------------------- */

  private get elements() {
    return [...this.app.content.elements.values()];
  }

  private takenCharacterIds(): Set<string> {
    return new Set(
      this.heroes
        .map((d, index) => (index === this.current ? null : d.characterId))
        .filter((id): id is string => id !== null),
    );
  }

  private render(): void {
    const host = this.host;
    if (!host) return;
    clear(host);

    // The backdrop takes the colour of the path being chosen.
    this.app.setMood(
      this.phase === 'heroes' ? (this.heroes[this.current]?.element ?? 'neutral') : 'neutral',
    );

    const scene = el('div', { class: 'scene setup-scene' });
    const panel = el('div', { class: 'panel setup-panel scroll' });

    switch (this.step) {
      case 'count':
        this.renderCount(panel);
        break;
      case 'handoff':
        this.renderHandoff(panel);
        break;
      case 'name':
        this.renderName(panel);
        break;
      case 'element':
        this.renderElement(panel);
        break;
      case 'character':
        this.renderCharacter(panel);
        break;
      case 'summary':
        this.renderSummary(panel);
        break;
    }

    const art = titleArtById(loadLastTitleArt());
    if (art) scene.appendChild(this.backdrop(art));
    scene.appendChild(panel);
    host.appendChild(scene);

    // Replacing a step removes its focused control. Keep a selected count/card
    // selected for keyboard users, or begin the new step at its first choice.
    const target =
      panel.querySelector<HTMLElement>('input') ??
      panel.querySelector<HTMLElement>('button[aria-pressed="true"]:not([disabled])') ??
      panel.querySelector<HTMLElement>('button.pick-card:not([disabled])') ??
      panel.querySelector<HTMLElement>('button.btn-primary:not([disabled])') ??
      panel.querySelector<HTMLElement>('button:not([disabled])');
    target?.focus();
  }

  /** The title's last painting, held still beneath an ink scrim throughout setup. */
  private backdrop(art: TitleArtDef): HTMLElement {
    const base = `${import.meta.env.BASE_URL}art/title/`;
    const picture = el(
      'picture',
      {},
      el('source', {
        attrs: {
          media: '(max-aspect-ratio: 9/10)',
          srcset: `${base}${art.portrait.file}`,
          width: String(art.portrait.width),
          height: String(art.portrait.height),
        },
      }),
      el('img', {
        attrs: {
          src: `${base}${art.wide.file}`,
          alt: '',
          width: String(art.wide.width),
          height: String(art.wide.height),
          decoding: 'async',
        },
      }),
    );
    const backdrop = el(
      'div',
      {
        class: 'setup-art',
        attrs: { 'aria-hidden': 'true' },
        dataset: { art: art.id },
      },
      picture,
    );
    backdrop.style.setProperty('--art-focus', art.focus);
    backdrop.style.setProperty('--art-portrait-focus', art.portraitFocus);
    return backdrop;
  }

  /* ---------------------------------------------------------------- */

  private renderCount(panel: HTMLElement): void {
    panel.appendChild(el('h1', { text: 'Choose your party' }));
    panel.appendChild(
      el('p', {
        class: 'muted',
        text: 'Everyone shares this screen and passes it along. One to six.',
      }),
    );

    const row = el('div', { class: 'row row-wrap count-row' });
    for (let n = 1; n <= 6; n++) {
      const node = button(
        String(n),
        () => {
          this.playerCount = n;
          this.render();
        },
        { class: n === this.playerCount ? 'btn-primary btn-count' : 'btn-count' },
      );
      node.setAttribute('aria-pressed', String(n === this.playerCount));
      node.setAttribute('aria-label', `${n} player${n === 1 ? '' : 's'}`);
      row.appendChild(node);
    }
    panel.appendChild(row);

    panel.appendChild(
      el('p', {
        class: 'muted tiny',
        text:
          this.playerCount === 1
            ? 'You own all three heroes. Combat hand-offs are skipped.'
            : this.playerCount <= 3
              ? `${this.playerCount} people share three heroes and the story rotation. Hero ownership cycles in order.`
              : `${this.playerCount} people share three heroes and the story rotation. The first three own one hero each.`,
      }),
    );

    panel.appendChild(el('h2', { class: 'setup-subhead', text: 'How tough are the fights?' }));
    const levels = el('div', {
      class: 'row row-wrap count-row',
      attrs: { role: 'radiogroup', 'aria-label': 'Difficulty' },
    });
    for (const choice of DIFFICULTY_CHOICES) {
      const active = choice.value === this.difficulty;
      const node = button(
        choice.label,
        () => {
          this.difficulty = choice.value;
          this.render();
        },
        { class: active ? 'btn-primary btn-difficulty' : 'btn-difficulty' },
      );
      node.setAttribute('role', 'radio');
      node.setAttribute('aria-checked', String(active));
      levels.appendChild(node);
    }
    panel.appendChild(levels);
    panel.appendChild(
      el('p', {
        class: 'muted tiny',
        text: `${difficultyHint(this.difficulty)} You can change it in Settings.`,
      }),
    );

    panel.appendChild(
      el(
        'div',
        { class: 'row row-wrap setup-footer' },
        button('Back', () => this.app.start(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button('Choose your own', () => this.startDrafting(), { class: 'btn-ghost btn-large' }),
        button('Start with the suggested party', () => this.beginSuggested(), {
          class: 'btn-primary btn-large',
        }),
      ),
    );
  }

  private startDrafting(): void {
    this.people = Array.from({ length: this.playerCount }, (_, index) => ({
      name: defaultPlayerName(index),
    }));
    this.heroes = Array.from({ length: 3 }, (_, index) => ({
      ownerIndex: index % this.playerCount,
      element: null,
      characterId: null,
    }));
    this.phase = 'names';
    this.resumeHeroIndex = null;
    this.current = 0;
    this.step = this.playerCount > 1 ? 'handoff' : 'name';
    this.render();
  }

  private beginSuggested(): void {
    const participants = Array.from({ length: this.playerCount }, (_, index) => ({
      id: `player-${index + 1}`,
      name: defaultPlayerName(index),
    }));
    const characterIds = ['kaya', 'sura', 'bo'];
    const players = characterIds.map((_, index) => {
      const owner = participants[index % participants.length]!;
      return { name: owner.name, unitId: '', participantId: owner.id };
    });
    this.app.newGame(
      players,
      characterIds.map((characterId) => ({ characterId })),
      undefined,
      participants,
      this.difficulty,
    );
  }

  private activePersonIndex(): number {
    return this.phase === 'heroes' ? (this.heroes[this.current]?.ownerIndex ?? 0) : this.current;
  }

  private activeName(): string {
    const index = this.activePersonIndex();
    return this.people[index]?.name ?? defaultPlayerName(index);
  }

  private renderHandoff(panel: HTMLElement): void {
    panel.classList.add('handoff');
    panel.appendChild(
      el('p', {
        class: 'muted',
        text:
          this.phase === 'heroes'
            ? `Hero ${this.current + 1} of 3 · ${this.activeName()}`
            : `Player ${this.current + 1} of ${this.playerCount}`,
      }),
    );
    panel.appendChild(el('h1', { text: 'Pass the tablet along' }));
    panel.appendChild(el('p', { text: 'Next person: tap when you have it.' }));
    panel.appendChild(
      button(
        "I've got it",
        () => {
          this.step = this.phase === 'heroes' ? 'element' : 'name';
          this.render();
        },
        { class: 'btn-primary btn-large' },
      ),
    );
    panel.appendChild(button('Back', () => this.goBack(), { class: 'btn-ghost' }));
  }

  private renderName(panel: HTMLElement): void {
    const draft = this.people[this.current];
    if (!draft) return;

    panel.appendChild(
      el('p', { class: 'muted', text: `Player ${this.current + 1} of ${this.playerCount}` }),
    );
    panel.appendChild(el('h1', { text: 'What should we call you?' }));

    const input = el('input', {
      type: 'text',
      value: draft.name,
      placeholder: defaultPlayerName(this.current),
      attrs: { maxlength: '16', 'aria-label': 'Your name', autocomplete: 'off' },
      onInput: (event) => {
        draft.name = (event.target as HTMLInputElement).value;
      },
      onKeyDown: (event) => {
        if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault();
          this.finishName(input);
        }
      },
    });
    panel.appendChild(el('div', { class: 'stack' }, input));
    panel.appendChild(
      el('p', { class: 'muted tiny', text: 'This is the name on the "hand the tablet to" card.' }),
    );

    panel.appendChild(
      el(
        'div',
        { class: 'row setup-footer' },
        button('Back', () => this.goBack(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button('Next', () => this.finishName(input), { class: 'btn-primary btn-large' }),
      ),
    );

    window.setTimeout(() => input.focus(), 0);
  }

  private finishName(input: HTMLInputElement): void {
    const draft = this.people[this.current];
    if (!draft) return;
    const typed = input.value.trim();
    draft.name = typed.length > 0 ? typed : defaultPlayerName(this.current);
    if (this.resumeHeroIndex !== null) {
      this.phase = 'heroes';
      this.current = this.resumeHeroIndex;
      this.resumeHeroIndex = null;
      this.step = 'element';
    } else if (this.current + 1 < this.playerCount) {
      this.current += 1;
      this.step = 'handoff';
    } else {
      this.phase = 'heroes';
      this.current = 0;
      this.step = this.playerCount > 1 ? 'handoff' : 'element';
    }
    this.render();
  }

  private renderElement(panel: HTMLElement): void {
    const draft = this.heroes[this.current];
    if (!draft) return;

    panel.appendChild(
      el('p', { class: 'muted', text: `Hero ${this.current + 1} of 3 · ${this.activeName()}` }),
    );
    panel.appendChild(el('h1', { text: 'Pick your path' }));

    const grid = el('div', { class: 'card-grid' });
    for (const element of this.elements) {
      const selected = draft.element === element.id;
      const card = el(
        'button',
        {
          class: `pick-card element-${element.id}${selected ? ' selected' : ''}`,
          attrs: { 'aria-pressed': String(selected) },
          onClick: () => {
            draft.element = element.id;
            draft.characterId = null;
            this.render();
          },
        },
        el('h3', { text: element.name }),
        el('p', { class: 'tagline', text: element.tagline }),
        el('p', { class: 'tiny', text: element.playstyle }),
        el(
          'div',
          { class: 'row row-wrap chips' },
          el('span', { class: 'chip', text: `${element.base.maxHp} HP` }),
          el('span', { class: 'chip', text: `${element.base.maxAp} AP` }),
          el('span', { class: 'chip', text: `Power ${element.base.power}` }),
          el('span', { class: 'chip', text: `Speed ${element.base.speed}` }),
        ),
      );
      grid.appendChild(card);
    }
    panel.appendChild(grid);

    if (draft.element) {
      const chosen = this.app.content.elements.get(draft.element);
      if (chosen) panel.appendChild(el('p', { class: 'muted', text: chosen.description }));
    }

    panel.appendChild(
      el(
        'div',
        { class: 'row setup-footer' },
        button('Back', () => this.goBack(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button(
          'Next',
          () => {
            this.step = 'character';
            this.render();
          },
          { class: 'btn-primary btn-large', disabled: draft.element === null },
        ),
      ),
    );
  }

  private renderCharacter(panel: HTMLElement): void {
    const draft = this.heroes[this.current];
    if (!draft?.element) return;

    const taken = this.takenCharacterIds();
    const options = [...this.app.content.characters.values()].filter(
      (c) => c.element === draft.element,
    );

    panel.appendChild(
      el('p', { class: 'muted', text: `Hero ${this.current + 1} of 3 · ${this.activeName()}` }),
    );
    panel.appendChild(el('h1', { text: 'Pick your character' }));

    const grid = el('div', { class: 'card-grid' });
    for (const character of options) {
      const isTaken = taken.has(character.id);
      const selected = draft.characterId === character.id;
      grid.appendChild(this.characterCard(character, selected, isTaken, draft));
    }
    panel.appendChild(grid);

    if (options.every((c) => taken.has(c.id))) {
      panel.appendChild(
        el('p', {
          class: 'warn-note',
          text: 'Both characters of this element are taken. Go back and pick another path.',
        }),
      );
    }

    panel.appendChild(
      el(
        'div',
        { class: 'row setup-footer' },
        button('Back', () => this.goBack(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button('Confirm', () => this.confirmPlayer(), {
          class: 'btn-primary btn-large',
          disabled: draft.characterId === null,
        }),
      ),
    );
  }

  private characterCard(
    character: CharacterDef,
    selected: boolean,
    taken: boolean,
    draft: HeroDraft,
  ): HTMLElement {
    const card = el(
      'button',
      {
        class: `pick-card character-card element-${character.element}${selected ? ' selected' : ''}${taken ? ' taken' : ''}`,
        disabled: taken,
        attrs: { 'aria-pressed': String(selected) },
        onClick: () => {
          draft.characterId = character.id;
          this.render();
        },
      },
      assetCanvas(character.portrait, 5),
      el(
        'div',
        { class: 'character-copy' },
        el('h3', { text: character.name }),
        el('p', { class: 'tagline', text: character.blurb }),
        el('p', { class: 'tiny muted', text: character.bio }),
        taken ? el('span', { class: 'chip chip-warn', text: 'Already taken' }) : null,
      ),
      selected
        ? el('span', { class: 'selection-check', text: '✓', attrs: { 'aria-hidden': 'true' } })
        : null,
    );
    return card;
  }

  private confirmPlayer(): void {
    if (this.current + 1 < this.heroes.length) {
      this.current += 1;
      this.step = this.playerCount > 1 ? 'handoff' : 'element';
    } else {
      this.step = 'summary';
    }
    this.render();
  }

  private goBack(): void {
    switch (this.step) {
      case 'character':
        this.step = 'element';
        break;
      case 'element':
        this.resumeHeroIndex = this.current;
        this.current = this.heroes[this.current]?.ownerIndex ?? 0;
        this.phase = 'names';
        this.step = 'name';
        break;
      case 'name':
        if (this.resumeHeroIndex !== null) {
          if (this.resumeHeroIndex > 0) {
            this.phase = 'heroes';
            this.current = this.resumeHeroIndex - 1;
            this.step = 'character';
          } else {
            this.phase = 'names';
            this.current = this.playerCount - 1;
            this.step = 'name';
          }
          this.resumeHeroIndex = null;
        } else if (this.current > 0) {
          this.current -= 1;
          this.step = 'name';
        } else {
          this.step = 'count';
        }
        break;
      case 'handoff':
        if (this.phase === 'heroes' && this.current > 0) {
          this.current -= 1;
          this.step = 'character';
        } else if (this.phase === 'heroes') {
          this.phase = 'names';
          this.current = this.playerCount - 1;
          this.step = 'name';
        } else if (this.current > 0) {
          this.current -= 1;
          this.step = 'name';
        } else {
          this.step = 'count';
        }
        break;
      case 'summary':
        this.phase = 'heroes';
        this.current = this.heroes.length - 1;
        this.step = 'character';
        break;
      default:
        this.app.start();
        return;
    }
    this.render();
  }

  private renderSummary(panel: HTMLElement): void {
    panel.appendChild(el('h1', { text: 'The party' }));
    panel.appendChild(
      el('p', { class: 'muted', text: 'Check the names, then begin. You can pause at any time.' }),
    );

    const list = el('div', { class: 'card-grid' });
    for (const draft of this.heroes) {
      const character = draft.characterId
        ? this.app.content.characters.get(draft.characterId)
        : undefined;
      if (!character) continue;
      list.appendChild(
        el(
          'div',
          { class: `pick-card party-summary-card element-${character.element}` },
          assetCanvas(character.portrait, 4),
          el(
            'div',
            { class: 'character-copy' },
            el('h3', { text: character.name }),
            el('p', {
              class: 'tagline',
              text: this.people[draft.ownerIndex]?.name ?? defaultPlayerName(draft.ownerIndex),
            }),
            el('span', { class: 'chip element-chip', text: character.element }),
          ),
        ),
      );
    }
    panel.appendChild(list);
    panel.appendChild(
      el('p', {
        class: 'muted tiny',
        text: `${this.playerCount} people share the story rotation. Hero owners: ${this.heroes.map((hero) => this.people[hero.ownerIndex]?.name ?? defaultPlayerName(hero.ownerIndex)).join(', ')}.`,
      }),
    );

    panel.appendChild(
      el(
        'div',
        { class: 'row setup-footer' },
        button('Back', () => this.goBack(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button('Begin', () => this.begin(), { class: 'btn-primary btn-large', id: 'begin-game' }),
      ),
    );
  }

  private begin(): void {
    const participants = this.people.map((person, index) => ({
      id: `player-${index + 1}`,
      name: person.name,
    }));
    const players = this.heroes.map((hero) => ({
      name: this.people[hero.ownerIndex]?.name ?? defaultPlayerName(hero.ownerIndex),
      unitId: '',
      participantId: participants[hero.ownerIndex]?.id,
    }));
    const slots = this.heroes
      .filter((draft): draft is HeroDraft & { characterId: string } => draft.characterId !== null)
      .map((draft) => ({ characterId: draft.characterId }));

    if (slots.length !== this.heroes.length) {
      this.app.toasts.show('Somebody still needs to pick a character.', 'warn');
      return;
    }

    this.app.newGame(players, slots, undefined, participants, this.difficulty);
  }
}
