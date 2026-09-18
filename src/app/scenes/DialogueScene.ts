/**
 * Dialogue, story choices and the act epilogue.
 *
 * One line at a time with a big tap-anywhere target, because that is how a
 * six-year-old watching over a shoulder expects it to work. Choices interrupt
 * that with the decider's name in large type — the whole point of the rotating
 * decider is that nobody has to argue about who picks.
 *
 * Staged like a visual novel: the speaker stands over the text box, which
 * sits in the lower third of the screen, and the backdrop takes the colour
 * of their element while they talk.
 */

import type { App, Mood, Scene } from '../App';
import type { ElementId, GameState, StoryNode, StoryOption } from '../../core/types';
import { ELEMENT_IDS } from '../../core/types';
import { describe as describeCondition } from '../../core/story/conditions';
import { optionAvailable, resolveDialogue } from '../../core/story/storyEngine';
import { CONTENT } from '../../content';
import { resolveAsset } from '../../content/assets/manifest';
import { button, clear, el } from '../ui/dom';
import { assetCanvas } from '../ui/assetCanvas';
import {
  INTERLUDES,
  INTERLUDE_ART,
  interludeHoldMs,
  type InterludeDef,
} from '../../content/story/interludes';

/** What to call a bender the party does not have. */
const BENDER_LABEL: Record<ElementId, string> = {
  fire: 'A firebender',
  water: 'A waterbender',
  earth: 'An earthbender',
  air: 'An airbender',
  nonbender: 'Someone who does not bend',
};

/** Portraits in the HUD are 6rem; on the stage the speaker is nearly twice that. */
const STAGE_PORTRAIT_REM = 11;

/**
 * The element a portrait is painted in. The manifest already tags every
 * portrait with its palette, so a speaker's colour needs no story field.
 */
function moodFor(portraitKey: string): Mood {
  const palette = resolveAsset(portraitKey).palette;
  if (palette && (ELEMENT_IDS as readonly string[]).includes(palette)) return palette;
  return 'neutral';
}

export class DialogueScene implements Scene {
  readonly name = 'dialogue';
  private host: HTMLElement | null = null;
  private interludeNode = '';
  private endFrame = 0;
  private endSummary = false;
  private playing = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private onVisibility = () => {
    if (document.hidden) this.pauseInterlude();
  };

  constructor(private app: App) {}

  mount(host: HTMLElement): void {
    this.host = host;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.render();
  }

  unmount(): void {
    this.clearTimer();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.host = null;
  }

  sync(): void {
    this.render();
  }

  private render(): void {
    this.clearTimer();
    const host = this.host;
    const state = this.app.state;
    if (!host || !state) return;
    // A line refresh replaces the controls. Keep keyboard users on the same
    // control so the next Enter/Space press still reaches the dialogue.
    const focused = document.activeElement;
    const focusTarget =
      focused && host.contains(focused)
        ? focused instanceof HTMLElement && focused.dataset.interludeControl
          ? `[data-interlude-control="${focused.dataset.interludeControl}"]`
          : focused.matches('.dialogue-panel button')
            ? '.dialogue-panel button'
            : focused.matches('.dialogue-panel')
              ? '.dialogue-panel'
              : null
        : null;
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

    if (this.interludeNode !== node.id) {
      this.interludeNode = node.id;
      this.endFrame = 0;
      this.endSummary = false;
      this.playing = false;
    }
    const interlude = INTERLUDES[node.id];
    if (interlude && (node.kind === 'dialogue' || (node.kind === 'end' && !this.endSummary))) {
      scene.appendChild(this.interludeStage(node, interlude));
      host.appendChild(scene);
      if (focusTarget)
        scene.querySelector<HTMLElement>(focusTarget)?.focus({ preventScroll: true });
      return;
    }

    switch (node.kind) {
      case 'dialogue':
        scene.appendChild(this.dialogueStage(node));
        break;
      case 'choice':
        scene.appendChild(this.choiceStage(node));
        break;
      case 'end':
        scene.appendChild(this.stage('end', null, this.endPanel(node)));
        break;
      default:
        scene.appendChild(el('div', { class: 'panel' }, el('p', { text: 'Loading…' })));
        break;
    }

    host.appendChild(scene);
    if (focusTarget) {
      const target =
        scene.querySelector<HTMLElement>(focusTarget) ??
        scene.querySelector<HTMLElement>('.end-panel button');
      target?.focus({ preventScroll: true });
    }
  }

  /**
   * The stage: a speaker's portrait and name plate standing over the text
   * box. No speaker (the epilogue) means no head, and the backdrop keeps
   * the colour of wherever the party is.
   */
  private stage(
    kind: 'dialogue' | 'choice' | 'end',
    speaker: { name: string; portrait: string; note?: HTMLElement | null } | null,
    panel: HTMLElement,
  ): HTMLElement {
    let head: HTMLElement | null = null;
    if (speaker) {
      const mood = moodFor(speaker.portrait);
      this.app.setMood(mood);
      head = el(
        'div',
        { class: 'stage-head' },
        el(
          'div',
          { class: `stage-portrait element-${mood}`, attrs: { 'aria-hidden': 'true' } },
          this.portrait(speaker.portrait, STAGE_PORTRAIT_REM),
        ),
        el(
          'div',
          { class: `name-plate element-${mood}` },
          el('h2', { class: 'display', text: speaker.name }),
          speaker.note ?? null,
        ),
      );
    }
    return el('div', { class: 'stage', dataset: { kind } }, head, panel);
  }

  private topBar(): HTMLElement {
    return el(
      'div',
      { class: 'top-bar' },
      el('span', { class: 'muted tiny', text: this.app.placeLabel() }),
      el('div', { class: 'spacer' }),
      button(
        'Pause',
        () => {
          this.pauseInterlude();
          this.app.openPause();
        },
        { class: 'btn-ghost' },
      ),
    );
  }

  private portrait(key: string, size = 6): HTMLElement {
    return assetCanvas(key, size);
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private pauseInterlude(): void {
    this.clearTimer();
    if (!this.playing) return;
    this.playing = false;
    this.render();
  }

  private interludeStage(
    node: Extract<StoryNode, { kind: 'dialogue' | 'end' }>,
    interlude: InterludeDef,
  ): HTMLElement {
    const state = this.app.state;
    const lines =
      node.kind === 'end'
        ? [...node.lines, node.teaser]
        : state
          ? resolveDialogue(state, node).lines
          : node.lines;
    const index = Math.min(
      node.kind === 'end' ? this.endFrame : (state?.story.lineIndex ?? 0),
      lines.length - 1,
    );
    const text = lines[index] ?? '';
    const last = index === lines.length - 1;
    const art = INTERLUDE_ART[interlude.shots[index] ?? 'village'];
    const next = () => {
      this.clearTimer();
      if (node.kind === 'dialogue') this.app.dispatch({ type: 'advanceDialogue' });
      else {
        if (last) {
          this.endSummary = true;
          this.playing = false;
        } else this.endFrame++;
        this.render();
      }
    };
    const control = (id: string, label: string, action: () => void, primary = false) => {
      const item = button(label, action, {
        class: primary ? 'btn-primary btn-large' : 'btn-ghost',
      });
      item.dataset.interludeControl = id;
      item.addEventListener('keydown', (event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
      });
      return item;
    };
    const picture = el('img', {
      class: 'interlude-art',
      attrs: {
        src: `${import.meta.env.BASE_URL}art/interludes/${art.file}`,
        alt: art.alt,
        width: '1280',
        height: '720',
      },
    });
    // Slow or unavailable art must never strand the story or spend its reading time unseen.
    const schedule = () => {
      if (!this.playing || !this.host?.contains(picture) || document.hidden) return;
      this.clearTimer();
      this.timer = setTimeout(() => {
        if (last) this.pauseInterlude();
        else next();
      }, interludeHoldMs(text));
    };
    picture.addEventListener('load', schedule, { once: true });
    picture.addEventListener(
      'error',
      () => {
        picture.replaceWith(el('p', { class: 'muted', text: art.alt }));
        this.pauseInterlude();
      },
      { once: true },
    );
    const controls = el(
      'div',
      { class: 'interlude-controls' },
      control('play', this.playing ? 'Pause scene' : 'Play scene', () => {
        this.playing = !this.playing;
        this.render();
      }),
      control('replay', 'Restart scene', () => {
        this.endFrame = 0;
        if (node.kind === 'dialogue') this.app.dispatch({ type: 'enterNode', nodeId: node.id });
        else this.render();
      }),
      control('skip', node.kind === 'end' ? 'Read summary' : 'Skip scene', () => {
        this.playing = false;
        if (node.kind === 'dialogue') this.app.dispatch({ type: 'enterNode', nodeId: node.next });
        else {
          this.endSummary = true;
          this.render();
        }
      }),
      el('div', { class: 'spacer' }),
      control('next', last ? 'Continue' : 'Next', next, true),
    );
    return el(
      'div',
      { class: 'interlude-stage', dataset: { interlude: node.id } },
      el(
        'div',
        { class: 'interlude-content' },
        picture,
        el(
          'div',
          { class: 'panel interlude-caption' },
          el(
            'div',
            { class: 'row row-wrap' },
            el('h2', { text: interlude.title }),
            el('span', { class: 'muted tiny line-count', text: `${index + 1} of ${lines.length}` }),
          ),
          el('p', {
            class: 'dialogue-line',
            text,
            attrs: { 'aria-live': this.playing ? 'off' : 'polite' },
          }),
          controls,
        ),
      ),
    );
  }

  private dialogueStage(node: Extract<StoryNode, { kind: 'dialogue' }>): HTMLElement {
    const state = this.app.state;
    // Variants first: who is standing here changes what gets said.
    const said = state
      ? resolveDialogue(state, node)
      : { speaker: node.speaker, portrait: node.portrait, lines: node.lines };
    const index = Math.min(state?.story.lineIndex ?? 0, said.lines.length - 1);
    const line = said.lines[index] ?? '';
    const isLast = index >= said.lines.length - 1;

    const advance = () => this.app.dispatch({ type: 'advanceDialogue' });

    const panel = el(
      'div',
      {
        class: 'panel dialogue-panel',
        attrs: { role: 'button', tabindex: '0', 'aria-label': 'Continue' },
        onClick: (event) => {
          // The native Next/Continue button already advances. Its click still
          // bubbles through this old panel even after dispatch replaces the DOM.
          if (event.target instanceof Element && event.target.closest('button')) return;
          advance();
        },
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            if (event.repeat) {
              event.preventDefault();
              return;
            }
            // Let the nested native button synthesize its own click. Only the
            // panel itself needs a keyboard equivalent for tap-anywhere.
            if (event.target !== event.currentTarget) return;
            event.preventDefault();
            advance();
          }
        },
      },
      el('p', { class: 'dialogue-line', text: line }),
      el(
        'div',
        { class: 'row' },
        el('div', { class: 'spacer' }),
        button(isLast ? 'Continue' : 'Next', advance, { class: 'btn-primary btn-large' }),
      ),
    );

    return this.stage(
      'dialogue',
      {
        name: said.speaker,
        portrait: said.portrait,
        note: el('span', {
          class: 'muted tiny line-count',
          text: `${index + 1} of ${said.lines.length}`,
        }),
      },
      panel,
    );
  }

  private choiceStage(node: Extract<StoryNode, { kind: 'choice' }>): HTMLElement {
    const state = this.app.state;
    const decider = state ? this.app.session.decider(state) : undefined;
    const next = state ? this.app.session.nextDecider(state) : undefined;
    const solo = this.app.session.solo;

    /*
     * Every option is drawn, including the ones this party cannot take.
     *
     * Hiding them would be tidier and much worse: seeing that a firebender could
     * have talked their way through this gate is the thing that makes somebody
     * want to play it again with a different party. A locked option therefore
     * has to say *why* it is locked, or it is just a closed door.
     */
    const options = el('div', { class: 'stack choice-options' });
    node.options.forEach((option, index) => {
      const available = state ? optionAvailable(state, option) : true;
      const tag = state ? this.speakerTag(state, option) : null;

      const children: (HTMLElement | null)[] = [
        el('strong', { text: option.label }),
        el('span', { class: 'muted', text: option.detail }),
      ];
      if (tag) children.unshift(el('span', { class: 'speaker-tag', text: tag }));
      if (!available) {
        children.push(
          el('span', {
            class: 'locked-hint',
            text: option.lockedHint ?? this.lockedReason(option),
          }),
        );
      }

      options.appendChild(
        el(
          'button',
          {
            class: available ? 'choice-option' : 'choice-option is-locked',
            attrs: available ? {} : { disabled: 'true', 'aria-disabled': 'true' },
            onClick: available
              ? () => this.app.dispatch({ type: 'chooseOption', optionIndex: index })
              : undefined,
          },
          ...children,
        ),
      );
    });

    const panel = el(
      'div',
      { class: 'panel dialogue-panel choice-panel' },
      el('p', { class: 'dialogue-line', text: node.prompt }),
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
      node.footer ? el('p', { class: 'tiny muted center', text: node.footer }) : null,
    );

    return this.stage('choice', { name: node.speaker, portrait: node.portrait }, panel);
  }

  /**
   * Who in the party would say this — "Kaya · Fire" when you have a firebender,
   * "A firebender" when you do not.
   *
   * Naming the real party member is what turns a list of lines into a decision
   * about *who walks up*, which is the whole Speaker Choice: no extra UI step,
   * because picking a fire-tagged option already is picking the firebender.
   */
  private speakerTag(state: GameState, option: StoryOption): string | null {
    const speaker = option.speaker;
    if (!speaker) return null;

    const match = state.party.find(
      (u) =>
        u.hp > 0 &&
        (speaker.characterId ? u.characterId === speaker.characterId : true) &&
        (speaker.element ? u.element === speaker.element : true),
    );
    if (match) {
      const element = CONTENT.elements.get(match.element)?.name;
      return element ? `${match.name} · ${element}` : match.name;
    }

    if (speaker.characterId) {
      return CONTENT.characters.get(speaker.characterId)?.name ?? null;
    }
    return speaker.element ? BENDER_LABEL[speaker.element] : null;
  }

  /** Fallback for an author who did not write a `lockedHint`. */
  private lockedReason(option: StoryOption): string {
    if (!option.requires) return 'Not available.';
    return `Only if ${describeCondition(CONTENT, option.requires)}.`;
  }

  private endPanel(node: Extract<StoryNode, { kind: 'end' }>): HTMLElement {
    const next = node.next;
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
        el('span', { class: 'tiny muted', text: next ? 'What lies ahead' : 'Next time' }),
        el('p', { text: node.teaser }),
      ),
      el(
        'div',
        { class: 'row row-wrap' },
        button('Save this game', () => this.app.openPause()),
        INTERLUDES[node.id]
          ? button('Replay scene', () => {
              this.endFrame = 0;
              this.endSummary = false;
              this.render();
            })
          : null,
        el('div', { class: 'spacer' }),
        button('Back to the title', () => this.app.start(), {
          class: next ? 'btn-ghost' : 'btn-primary btn-large',
        }),
        next
          ? button(
              'Continue exploring',
              () => this.app.dispatch({ type: 'enterNode', nodeId: next }),
              {
                class: 'btn-primary btn-large',
              },
            )
          : null,
      ),
    );
  }
}
