/**
 * The words for the two difficulties (ADR 0110), shared by party setup and
 * Settings so both say the same thing. Short, for a table with young readers.
 */

import type { Difficulty } from '../../core/types';

export const DIFFICULTY_CHOICES: readonly { readonly label: string; readonly value: Difficulty }[] =
  [
    { label: 'Story', value: 'story' },
    { label: 'Hard', value: 'hard' },
  ];

export function difficultyHint(difficulty: Difficulty): string {
  return difficulty === 'hard'
    ? 'Hard: enemies are tougher and hit harder. For players who want a real test.'
    : 'Story: friendly fights, good for a first time. Most parties win if they try.';
}
