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
import { assetCanvas, fitAssetToBox } from './assetCanvas';
import { button, el } from './dom';
import type { Participant } from '../session';
import {
  ballotFor,
  castVote,
  holdsVote,
  outright,
  takeOver,
  tallyVotes,
  voteOrder,
} from '../tableVote';

/** What to call a bender the party does not have. */
const BENDER_LABEL: Record<ElementId, string> = {
  fire: 'A firebender',
  water: 'A waterbender',
  earth: 'An earthbender',
  air: 'An airbender',
  nonbender: 'Someone who does not bend',
};

/** Large enough to remain crisp when the world-conversation frame expands it. */
const COMPACT_PORTRAIT_REM = 15;

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
  const portrait = assetCanvas(speaker.portrait, COMPACT_PORTRAIT_REM);
  // The frame's --conversation-portrait (15rem, or 6rem/5rem on upright and phone layouts) sizes the
  // canvas, not this inline default: an inline size overrides it and paints over the name (#651).
  portrait.style.width = '';
  portrait.style.height = '';
  fitAssetToBox(portrait);
  return el(
    'div',
    { class: 'conversation-compact-head' },
    el(
      'div',
      { class: 'conversation-compact-portrait element-' + mood, attrs: { 'aria-hidden': 'true' } },
      portrait,
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
      attrs: { role: 'group', tabindex: '-1', 'aria-label': 'Conversation' },
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

interface ChoiceVote {
  readonly key: string;
  readonly voters: readonly Participant[];
  readonly votes: readonly number[];
  readonly ready: boolean;
}

/** The vote at this choice, or null when the choice goes to the decider alone. */
function choiceVote(
  app: App,
  state: GameState,
  node: Extract<StoryNode, { kind: 'choice' }>,
): ChoiceVote | null {
  const people = app.session.participants;
  const open = node.options.filter((option) => optionAvailable(state, option)).length;
  if (!holdsVote(app.settings.storyChoices, people.length, open)) return null;
  const key = [node.id, state.story.deciderIndex, ...people.map((person) => person.id)].join('|');
  const ballot = ballotFor(key);
  return {
    key,
    voters: voteOrder(people, state.story.deciderIndex),
    votes: ballot.votes,
    ready: ballot.ready,
  };
}

/** The table's banner: whose secret pick it is, the hand-off, or the result. */
function voteBanner(
  vote: ChoiceVote,
  decider: string,
  tied: boolean,
  winner: StoryOption | undefined,
  rebuild: (focus: string) => void,
  choose: () => void,
): HTMLElement {
  const done = vote.votes.length >= vote.voters.length;
  const voter = vote.voters[vote.votes.length];
  const banner = (...children: (HTMLElement | null)[]) =>
    el(
      'div',
      { class: 'decider-banner vote-banner', attrs: { 'aria-live': 'polite' } },
      ...children,
    );
  if (!done && voter && vote.ready)
    return banner(
      el('span', {
        class: 'tiny muted',
        text: 'Table vote · ' + (vote.votes.length + 1) + ' of ' + vote.voters.length,
      }),
      el('strong', { text: voter.name + ', your pick' }),
      el('span', { class: 'tiny muted', text: 'Keep it secret! A tie goes to ' + decider + '.' }),
    );
  if (!done && voter) {
    const ready = button(
      "I'm ready",
      () => {
        takeOver(vote.key);
        rebuild('.choice-option:not([disabled])');
      },
      { class: 'btn-primary btn-large' },
    );
    ready.dataset.voteControl = 'ready';
    guardHeldKey(ready);
    return banner(
      el('span', { class: 'tiny muted', text: 'Vote saved. Pass the screen to' }),
      el('strong', { text: voter.name }),
      ready,
    );
  }
  if (tied)
    return banner(
      el('span', { class: 'tiny muted', text: 'The votes are in' }),
      el('strong', { text: "It's a tie!" }),
      el('span', { class: 'tiny muted', text: decider + ' picks between the tied answers.' }),
    );
  const go = button('Continue', choose, { class: 'btn-primary btn-large' });
  go.dataset.voteControl = 'continue';
  guardHeldKey(go);
  return banner(
    el('span', { class: 'tiny muted', text: 'The votes are in' }),
    el('strong', { text: (winner?.label ?? 'The table') + ' wins!' }),
    go,
  );
}

function choicePanel(
  app: App,
  state: GameState,
  node: Extract<StoryNode, { kind: 'choice' }>,
  compact: boolean,
  rebuild: (focus: string) => void,
): HTMLElement {
  const said = resolveDialogue(state, node);
  const decider = app.session.decider(state);
  const nextDecider = app.session.nextDecider(state);
  const options = el('div', { class: 'stack choice-options' });
  const vote = choiceVote(app, state, node);
  const counted = vote && vote.votes.length >= vote.voters.length;
  const tally = vote ? tallyVotes(vote.votes, node.options.length) : null;
  const winner = tally ? outright(tally) : undefined;
  const tied = counted && winner === undefined;
  const choose = (index: number) => app.dispatch({ type: 'chooseOption', optionIndex: index });

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
    // Picks stay hidden until the last vote is in; then every name shows.
    const pickedBy = counted
      ? vote.voters.filter((_, voter) => vote.votes[voter] === index).map((person) => person.name)
      : [];
    if (pickedBy.length)
      children.push(el('span', { class: 'vote-names', text: 'Picked by ' + pickedBy.join(', ') }));

    const leading = counted && tally?.leaders.includes(index) === true;
    // While voting every open road takes a vote; once counted only a tied
    // leader can still be tapped, by the decider.
    const enabled = available && (!counted || (tied && leading));
    const action = !enabled
      ? undefined
      : !vote
        ? () => choose(index)
        : counted
          ? () => choose(index)
          : () => {
              castVote(vote.key, index);
              rebuild(
                vote.votes.length + 1 >= vote.voters.length
                  ? '[data-vote-control="continue"], .choice-option:not([disabled])'
                  : '[data-vote-control="ready"]',
              );
            };
    const classes = ['choice-option'];
    if (!available) classes.push('is-locked');
    if (leading) classes.push(tied ? 'is-tied' : 'is-winner');
    const choice = el(
      'button',
      {
        class: classes.join(' '),
        attrs: enabled ? {} : { disabled: 'true', 'aria-disabled': 'true' },
        onClick: action,
      },
      ...children,
    );
    guardHeldKey(choice);
    options.appendChild(choice);
  });

  const between = vote && !counted && !vote.ready;
  const banner = vote
    ? voteBanner(
        vote,
        decider?.name ?? 'the decider',
        tied === true,
        node.options[winner ?? -1],
        rebuild,
        () => (winner === undefined ? undefined : choose(winner)),
      )
    : app.session.solo
      ? null
      : el(
          'div',
          { class: 'decider-banner' },
          el('span', { class: 'tiny muted', text: 'This one is decided by' }),
          el('strong', { text: decider?.name ?? 'the party' }),
          nextDecider && nextDecider.id !== decider?.id
            ? el('span', { class: 'tiny muted', text: 'Next choice: ' + nextDecider.name })
            : null,
        );

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
      dataset: vote
        ? { vote: counted ? (tied ? 'tie' : 'result') : between ? 'pass' : 'pick' }
        : {},
    },
    compactHeader(said, compact, null),
    el('p', { class: 'dialogue-line', text: said.lines[0] ?? node.prompt }),
    banner,
    // The hand-off hides the answers, so nobody passes the screen over with a pick in view.
    between ? null : options,
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
  // A vote moves on without a command: swap this panel for a fresh one in place.
  const rebuild = (focus: string) => {
    const next = conversationPanel(app, options);
    if (!next || !panel.isConnected) return;
    panel.replaceWith(next);
    next.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  };
  const panel =
    node.kind === 'dialogue'
      ? dialoguePanel(app, state, resolveDialogue(state, node), compact)
      : choicePanel(app, state, node, compact, rebuild);
  if (options.className) panel.classList.add(options.className);
  return panel;
}

/** Explicit name for callers that want to signal this is the shared panel. */
export const sharedConversationPanel = conversationPanel;
