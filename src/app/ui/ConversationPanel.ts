/**
 * Shared story conversation panel.
 *
 * DialogueScene supplies the large visual-novel stage around this panel. The
 * exploration scene supplies the compact world version over the live map.
 * Keeping line resolution, choice gating and the one-command controls here
 * prevents the two presentations from drifting.
 */

import type { App } from '../App';
import type { ElementId, GameState, StoryNode, StoryOption } from '../../core/types';
import { ELEMENT_IDS } from '../../core/types';
import { describe as describeCondition } from '../../core/story/conditions';
import { optionAvailable, resolveDialogue } from '../../core/story/storyEngine';
import { resolveAsset } from '../../content/assets/manifest';
import { assetCanvas } from './assetCanvas';
import { button, el } from './dom';

/** What to call a bender the party does not have. */
const BENDER_LABEL: Record<ElementId, string> = {
  fire: 'A firebender',
  water: 'A waterbender',
  earth: 'An earthbender',
  air: 'An airbender',
  nonbender: 'Someone who does not bend',
};

export interface ResolvedConversation {
  readonly speaker: string;
  readonly portrait: string;
  readonly lines: readonly string[];
}

export interface ConversationPanelOptions {
  /** World dialogue keeps this small so the map remains visible around it. */
  readonly compact?: boolean;
  readonly className?: string;
}

function isConversationNode(
  node: StoryNode | undefined,
): node is Extract<StoryNode, { kind: 'dialogue' | 'choice' }> {
  return node?.kind === 'dialogue' || node?.kind === 'choice';
}

function moodFor(portraitKey: string): string {
  const palette = resolveAsset(portraitKey).palette;
  if (palette && (ELEMENT_IDS as readonly string[]).includes(palette)) return palette;
  return 'neutral';
}

/** Resolves party-aware variants for both dialogue and choice prompts. */
export function resolveConversation(app: App): ResolvedConversation | undefined {
  const state = app.state;
  const node = app.currentNode();
  if (!state || !isConversationNode(node)) return undefined;
  return resolveDialogue(state, node);
}

function guardHeldKey(target: HTMLElement): void {
  target.addEventListener('keydown', (event) => {
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
  });
}

function speakerTag(state: GameState, app: App, option: StoryOption): string | null {
  const speaker = option.speaker;
  if (!speaker) return null;

  const match = state.party.find(
    (unit) =>
      unit.hp > 0 &&
      (speaker.characterId ? unit.characterId === speaker.characterId : true) &&
      (speaker.element ? unit.element === speaker.element : true),
  );
  if (match) {
    const element = app.content.elements.get(match.element)?.name;
    return element ? match.name + ' · ' + element : match.name;
  }

  if (speaker.characterId) return app.content.characters.get(speaker.characterId)?.name ?? null;
  return speaker.element ? BENDER_LABEL[speaker.element] : null;
}

function lockedReason(app: App, option: StoryOption): string {
  if (!option.requires) return 'Not available.';
  return 'Only if ' + describeCondition(app.content, option.requires) + '.';
}

function compactHeader(
  speaker: ResolvedConversation,
  compact: boolean,
  lineIndex: number | null,
): HTMLElement | null {
  if (!compact) return null;
  const mood = moodFor(speaker.portrait);
  const count =
    lineIndex !== null && speaker.lines.length > 0
      ? el('span', {
          class: 'muted tiny line-count',
          text: lineIndex + 1 + ' of ' + speaker.lines.length,
        })
      : null;
  return el(
    'div',
    { class: 'conversation-compact-head' },
    el(
      'div',
      { class: 'conversation-compact-portrait element-' + mood, attrs: { 'aria-hidden': 'true' } },
      assetCanvas(speaker.portrait, 4),
    ),
    el(
      'div',
      { class: 'conversation-compact-speaker' },
      el('strong', { class: 'display', text: speaker.speaker }),
      count,
    ),
  );
}

function dialoguePanel(
  app: App,
  state: GameState,
  speaker: ResolvedConversation,
  compact: boolean,
): HTMLElement {
  const index = Math.min(state.story.lineIndex, Math.max(0, speaker.lines.length - 1));
  const line = speaker.lines[index] ?? '';
  const isLast = index >= speaker.lines.length - 1;
  const advance = () => app.dispatch({ type: 'advanceDialogue' });
  const panel = el(
    'div',
    {
      class: [
        'panel',
        'dialogue-panel',
        'conversation-panel',
        compact ? 'conversation-panel-compact' : '',
      ]
        .filter(Boolean)
        .join(' '),
      attrs: compact
        ? { role: 'button', tabindex: '0', 'aria-label': 'Continue conversation' }
        : { role: 'button', tabindex: '0', 'aria-label': 'Continue' },
      onClick: (event) => {
        // The nested Next button already committed the line. Its click bubbles
        // through this panel even after dispatch has rebuilt the DOM.
        if (event.target instanceof Element && event.target.closest('button')) return;
        advance();
      },
      onKeyDown: (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.repeat) {
          event.preventDefault();
          return;
        }
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        advance();
      },
    },
    compactHeader(speaker, compact, index),
    el('p', {
      class: 'dialogue-line',
      text: line,
      attrs: { 'aria-live': 'polite' },
    }),
    el(
      'div',
      { class: 'row conversation-controls' },
      el('div', { class: 'spacer' }),
      (() => {
        const next = button(isLast ? 'Continue' : 'Next', advance, {
          class: 'btn-primary btn-large',
        });
        next.dataset.conversationControl = 'next';
        guardHeldKey(next);
        return next;
      })(),
    ),
  );
  return panel;
}

function choicePanel(
  app: App,
  state: GameState,
  node: Extract<StoryNode, { kind: 'choice' }>,
  compact: boolean,
): HTMLElement {
  const said = resolveDialogue(state, node);
  const decider = app.session.decider(state);
  const nextDecider = app.session.nextDecider(state);
  const options = el('div', { class: 'stack choice-options' });

  node.options.forEach((option, index) => {
    const available = optionAvailable(state, option);
    const tag = speakerTag(state, app, option);
    const children: (HTMLElement | null)[] = [
      el('strong', { text: option.label }),
      el('span', { class: 'muted', text: option.detail }),
    ];
    if (tag) children.unshift(el('span', { class: 'speaker-tag', text: tag }));
    if (!available)
      children.push(
        el('span', {
          class: 'locked-hint',
          text: option.lockedHint ?? lockedReason(app, option),
        }),
      );

    const choice = el(
      'button',
      {
        class: available ? 'choice-option' : 'choice-option is-locked',
        attrs: available ? {} : { disabled: 'true', 'aria-disabled': 'true' },
        onClick: available
          ? () => app.dispatch({ type: 'chooseOption', optionIndex: index })
          : undefined,
      },
      ...children,
    );
    guardHeldKey(choice);
    options.appendChild(choice);
  });

  return el(
    'div',
    {
      class: [
        'panel',
        'dialogue-panel',
        'choice-panel',
        'conversation-panel',
        compact ? 'conversation-panel-compact' : '',
      ]
        .filter(Boolean)
        .join(' '),
      attrs: { role: 'group', tabindex: '0', 'aria-label': 'Choose a response' },
    },
    compactHeader(said, compact, null),
    el('p', { class: 'dialogue-line', text: said.lines[0] ?? node.prompt }),
    app.session.solo
      ? null
      : el(
          'div',
          { class: 'decider-banner' },
          el('span', { class: 'tiny muted', text: 'This one is decided by' }),
          el('strong', { text: decider?.name ?? 'the party' }),
          nextDecider && nextDecider.name !== decider?.name
            ? el('span', { class: 'tiny muted', text: 'Next choice: ' + nextDecider.name })
            : null,
        ),
    options,
    node.footer ? el('p', { class: 'tiny muted center', text: node.footer }) : null,
  );
}

/** Builds the shared content panel for the current dialogue or choice node. */
export function conversationPanel(
  app: App,
  options: ConversationPanelOptions = {},
): HTMLElement | null {
  const state = app.state;
  const node = app.currentNode();
  if (!state || !isConversationNode(node)) return null;
  const compact = options.compact ?? false;
  const panel =
    node.kind === 'dialogue'
      ? dialoguePanel(app, state, resolveDialogue(state, node), compact)
      : choicePanel(app, state, node, compact);
  if (options.className) panel.classList.add(options.className);
  return panel;
}

/** Explicit name for callers that want to signal this is the shared panel. */
export const sharedConversationPanel = conversationPanel;
