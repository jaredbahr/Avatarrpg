/**
 * Dialogue, story choices and the act epilogue.
 *
 * One line at a time with a big tap-anywhere target, because that is how a
 * six-year-old watching over a shoulder expects it to work. Choices interrupt
 * that with the decider's name in large type — the whole point of the rotating
 * decider is that nobody has to argue about who picks.
 */

import type { App, Scene } from '../App';
import type { StoryNode } from '../../core/types';
import { button, clear, el, painterCanvas } from '../ui/dom';
import { resolvePainter } from '../../render/painters/registry';

export class DialogueScene implements Scene {
  readonly name = 'dialogue';
  private host: HTMLElement | null = null;

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

  private render(): void {
    const host = this.host;
    const state = this.app.state;
    if (!host || !state) return;
    clear(host);

    const node = this.app.currentNode();
    if (!node) {
      host.appendChild(
        el(
          'div',
          { class: 'scene dialogue-scene' },
          el(
            'div',
            { class: 'panel' },
            el('h2', { text: 'The story lost its place.' }),
            button('Back to the title', () => this.app.start(), { class: 'btn-primary' }),
          ),
        ),
      );
      return;
    }

    const scene = el('div', { class: 'scene dialogue-scene' });
    scene.appendChild(this.topBar());

    switch (node.kind) {
      case 'dialogue':
        scene.appendChild(this.dialoguePanel(node));
        break;
      case 'choice':
        scene.appendChild(this.choicePanel(node));
        break;
      case 'end':
        scene.appendChild(this.endPanel(node));
        break;
      default:
        scene.appendChild(el('div', { class: 'panel' }, el('p', { text: 'Loading…' })));
        break;
    }

    host.appendChild(scene);
  }

  private topBar(): HTMLElement {
    return el(
      'div',
      { class: 'top-bar' },
      el('span', { class: 'muted tiny', text: this.app.placeLabel() }),
      el('div', { class: 'spacer' }),
      button('Pause', () => this.app.openPause(), { class: 'btn-ghost' }),
    );
  }

  private portrait(key: string, size = 6): HTMLElement {
    return painterCanvas(key, size, (ctx, px) => {
      resolvePainter(key).draw(ctx, { x: 0, y: 0, size: px });
    });
  }

  private dialoguePanel(node: Extract<StoryNode, { kind: 'dialogue' }>): HTMLElement {
    const state = this.app.state;
    const index = Math.min(state?.story.lineIndex ?? 0, node.lines.length - 1);
    const line = node.lines[index] ?? '';
    const isLast = index >= node.lines.length - 1;

    const advance = () => this.app.dispatch({ type: 'advanceDialogue' });

    const panel = el(
      'div',
      {
        class: 'panel dialogue-panel',
        attrs: { role: 'button', tabindex: '0', 'aria-label': 'Continue' },
        onClick: advance,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            advance();
          }
        },
      },
      el(
        'div',
        { class: 'row dialogue-head' },
        this.portrait(node.portrait),
        el(
          'div',
          { class: 'stack tight' },
          el('h2', { text: node.speaker }),
          el('span', {
            class: 'muted tiny',
            text: `${index + 1} of ${node.lines.length}`,
          }),
        ),
      ),
      el('p', { class: 'dialogue-line', text: line }),
      el(
        'div',
        { class: 'row' },
        el('div', { class: 'spacer' }),
        button(isLast ? 'Continue' : 'Next', advance, { class: 'btn-primary btn-large' }),
      ),
    );

    return panel;
  }

  private choicePanel(node: Extract<StoryNode, { kind: 'choice' }>): HTMLElement {
    const state = this.app.state;
    const decider = state ? this.app.session.decider(state) : undefined;
    const next = state ? this.app.session.nextDecider(state) : undefined;
    const solo = this.app.session.solo;

    const options = el('div', { class: 'stack choice-options' });
    node.options.forEach((option, index) => {
      options.appendChild(
        el(
          'button',
          {
            class: 'choice-option',
            onClick: () => this.app.dispatch({ type: 'chooseOption', optionIndex: index }),
          },
          el('strong', { text: option.label }),
          el('span', { class: 'muted', text: option.detail }),
        ),
      );
    });

    return el(
      'div',
      { class: 'panel dialogue-panel choice-panel' },
      el(
        'div',
        { class: 'row dialogue-head' },
        this.portrait(node.portrait),
        el(
          'div',
          { class: 'stack tight' },
          el('h2', { text: node.speaker }),
          el('p', { class: 'dialogue-line', text: node.prompt }),
        ),
      ),
      solo
        ? null
        : el(
            'div',
            { class: 'decider-banner' },
            el('span', { class: 'tiny muted', text: 'This one is decided by' }),
            el('strong', { text: decider?.name ?? 'the party' }),
            next && next.name !== decider?.name
              ? el('span', { class: 'tiny muted', text: `Next choice: ${next.name}` })
              : null,
          ),
      options,
      el('p', {
        class: 'tiny muted center',
        text: 'There is no right answer here. Both roads lead to the quarry.',
      }),
    );
  }

  private endPanel(node: Extract<StoryNode, { kind: 'end' }>): HTMLElement {
    const lines = el('div', { class: 'stack' });
    for (const line of node.lines) lines.appendChild(el('p', { text: line }));

    return el(
      'div',
      { class: 'panel dialogue-panel end-panel' },
      el('h1', { text: node.title }),
      lines,
      el(
        'div',
        { class: 'teaser' },
        el('span', { class: 'tiny muted', text: 'Next time' }),
        el('p', { text: node.teaser }),
      ),
      el(
        'div',
        { class: 'row' },
        button('Save this game', () => this.app.openPause()),
        el('div', { class: 'spacer' }),
        button('Back to the title', () => this.app.start(), { class: 'btn-primary btn-large' }),
      ),
    );
  }
}
