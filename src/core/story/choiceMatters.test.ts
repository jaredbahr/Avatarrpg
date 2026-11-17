import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { ContentIndex, StoryNode } from '../types';
import { choiceMatters } from './choiceMatters';

type Choice = Extract<StoryNode, { kind: 'choice' }>;

const line = (id: string, next: string): StoryNode => ({
  id,
  kind: 'dialogue',
  speaker: 'Ana',
  portrait: 'portrait.ana',
  lines: ['Hm.'],
  next,
});

function world(nodes: readonly StoryNode[]): ContentIndex {
  return { story: new Map(nodes.map((n) => [n.id, n])) } as unknown as ContentIndex;
}

const choice = (options: Choice['options']): Choice => ({
  id: 'ask',
  kind: 'choice',
  speaker: 'Ana',
  portrait: 'portrait.ana',
  prompt: 'Well?',
  options,
});

const opt = (label: string, next: string, extra: object = {}) => ({
  label,
  detail: '',
  next,
  ...extra,
});

describe('choiceMatters', () => {
  const content = world([
    line('a1', 'after'),
    line('b1', 'b2'),
    line('b2', 'after'),
    line('c1', 'elsewhere'),
    { id: 'after', kind: 'explore', mapId: 'm', objective: '', next: 'x' },
    { id: 'elsewhere', kind: 'explore', mapId: 'n', objective: '', next: 'x' },
  ]);

  it('is false when replies only differ in what is said before the same next beat', () => {
    expect(choiceMatters(content, choice([opt('Yes', 'a1'), opt('No', 'b1')]))).toBe(false);
    expect(choiceMatters(content, choice([opt('Yes', 'after'), opt('No', 'after')]))).toBe(false);
  });

  it('is true when an option sets a flag or moves standing', () => {
    expect(
      choiceMatters(
        content,
        choice([opt('Yes', 'a1', { setFlags: { kind: true } }), opt('No', 'a1')]),
      ),
    ).toBe(true);
    expect(
      choiceMatters(content, choice([opt('Yes', 'a1', { adjust: { fire: 1 } }), opt('No', 'a1')])),
    ).toBe(true);
    expect(
      choiceMatters(content, choice([opt('Yes', 'a1', { setFlags: {} }), opt('No', 'a1')])),
    ).toBe(false);
  });

  it('is true when replies lead to different places', () => {
    expect(choiceMatters(content, choice([opt('Yes', 'a1'), opt('No', 'c1')]))).toBe(true);
  });

  it('is false for a routine now-or-later prompt, wherever its options lead', () => {
    const ask = { ...choice([opt('Sit down', 'a1'), opt('Another time', 'c1')]), routine: true };
    expect(choiceMatters(content, ask)).toBe(false);
  });

  it('is true when the graph does not say', () => {
    expect(choiceMatters(content, choice([opt('Yes', 'a1'), opt('No', 'missing')]))).toBe(true);
  });
});

describe('choiceMatters over the shipped story', () => {
  const choices = [...CONTENT.story.values()].filter(
    (node): node is Choice => node.kind === 'choice',
  );

  it('keeps a vote on every choice that sets a flag or standing', () => {
    for (const node of choices) {
      const effect = node.options.some(
        (o) => Object.keys(o.setFlags ?? {}).length > 0 || Object.keys(o.adjust ?? {}).length > 0,
      );
      if (effect) expect(choiceMatters(CONTENT, node), node.id).toBe(true);
    }
  });

  it('marks the now-or-later prompts routine, so the one in charge answers them (#846)', () => {
    const routine = choices.filter((node) => node.routine).map((node) => node.id);
    expect(routine.sort()).toEqual(['plant_chair', 'sq02_ask', 'sq03_ask']);
  });
});
