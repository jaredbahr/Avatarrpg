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
import type { StoryNode } from '../../core/types';
import { ELEMENT_IDS } from '../../core/types';
import { resolveDialogue } from '../../core/story/storyEngine';
import { resolveAsset } from '../../content/assets/manifest';
import { button, clear, el } from '../ui/dom';
import { assetCanvas } from '../ui/assetCanvas';
import { conversationPanel, resolveConversation } from '../ui/ConversationPanel';
import {
  INTERLUDES,
  INTERLUDE_ART,
  interludeHoldMs,
  type InterludeDef,
} from '../../content/story/interludes';

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
    const node = this.app.currentNode();
    const state = this.app.state;
    // Match the visible speaker, including party contributions. Illustrated
    // narration and endings keep their location label rather than inventing one.
    const label =
      node?.kind === 'dialogue' && state && !INTERLUDES[node.id]
        ? resolveDialogue(state, node).speaker
        : node?.kind === 'choice'
          ? node.speaker
          : this.app.placeLabel();
    return el(
      'div',
      { class: 'top-bar' },
      el('span', { class: 'muted tiny', text: label }),
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
    const shared = conversationPanel(this.app);
    const resolved = resolveConversation(this.app);
    if (shared && resolved) {
      const state = this.app.state;
      const index = Math.min(state?.story.lineIndex ?? 0, Math.max(0, resolved.lines.length - 1));
      return this.stage(
        'dialogue',
        {
          name: resolved.speaker,
          portrait: resolved.portrait,
          note: el('span', {
            class: 'muted tiny line-count',
            text: `${index + 1} of ${resolved.lines.length}`,
          }),
        },
        shared,
      );
    }

    // A valid render always has both values; keep a bounded fallback for a
    // malformed state instead of reviving a second copy of the panel logic.
    return this.stage(
      'dialogue',
      { name: node.speaker, portrait: node.portrait },
      el('div', { class: 'panel dialogue-panel' }, el('p', { text: 'Loading…' })),
    );
  }

  private choiceStage(node: Extract<StoryNode, { kind: 'choice' }>): HTMLElement {
    const shared = conversationPanel(this.app);
    const resolved = resolveConversation(this.app);
    if (shared && resolved)
      return this.stage('choice', { name: resolved.speaker, portrait: resolved.portrait }, shared);

    return this.stage(
      'choice',
      { name: node.speaker, portrait: node.portrait },
      el('div', { class: 'panel dialogue-panel choice-panel' }, el('p', { text: 'Loading…' })),
    );
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
