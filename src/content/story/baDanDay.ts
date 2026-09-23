/**
 * A Ba Dan day (ADR 0047 §8, W6): the gate handover (LW-S-BD-03) and
 * Hanru's watch.
 *
 * Voice for Hanru is set here, since the story bible is not available: few
 * words, practical, kind without saying so. Hanru uses they/them (D7).
 *
 * No line claims time passing inside a conversation; the phase is fixed while
 * one is open. Scene memory uses the reserved `scene.` prefix and is written
 * only by each scene's last node, so a scene left early grants nothing.
 */

import type { Condition, StoryNode } from '../../core/types';

const victory: Condition = { kind: 'flag', key: 'act1_complete', op: 'set' };
const atDawn: Condition = { kind: 'phase', in: ['dawn'] };
const both = (...of: Condition[]): Condition => ({ kind: 'all', of });

const DORIN = 'Gate Guard Dorin';
const HANRU = 'Hanru';
/** No Hanru portrait until A1 (it needs a prompt pack); the narrator's stands in. */
const HANRU_FACE = 'portrait.narrator';
const FLOAT =
  'A model parade float sits in the cupboard behind the post. Its little roof sticks out past the door.';

export const BA_DAN_DAY_STORY: readonly StoryNode[] = [
  /* ------------------------------------------------ LW-S-BD-03: the handover */
  // The outgoing guard reports: Dorin in the evening, Hanru at dawn.
  {
    id: 'handover_scene',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: 'portrait.dorin',
    lines: [
      'Handover. East road is soft past the bend. Gao’s lamp oil is a day late.',
      'If anyone comes down from the quarry, wake Mira. Whatever the hour.',
    ],
    variants: [
      {
        when: both(atDawn, victory),
        speaker: HANRU,
        portrait: HANRU_FACE,
        lines: [
          'Handover. Quiet night. Two lamps left on at Mira’s, both on purpose.',
          'Lamps on late in most houses. Then out, one at a time.',
        ],
      },
      {
        when: atDawn,
        speaker: HANRU,
        portrait: HANRU_FACE,
        lines: [
          'Handover. Quiet night. Two lamps left on at Mira’s, both on purpose.',
          'Nothing on the east road. I looked every hour.',
        ],
      },
      {
        when: victory,
        lines: [
          'Handover. East road is soft past the bend. Gao’s lamp oil is a day late.',
          'Everyone is home. Nobody else expected tonight.',
        ],
      },
    ],
    next: 'handover_repeat',
  },
  // The incoming guard repeats what matters.
  {
    id: 'handover_repeat',
    kind: 'dialogue',
    speaker: HANRU,
    portrait: HANRU_FACE,
    lines: ['Soft past the bend. Oil late. Anyone from the quarry, wake Mira.'],
    variants: [
      {
        when: atDawn,
        speaker: DORIN,
        portrait: 'portrait.dorin',
        lines: ['Night quiet. Two lamps at Mira’s, deliberate. Noted.'],
      },
      { when: victory, lines: ['Soft past the bend. Oil late. Nobody expected.'] },
    ],
    next: 'handover_float',
  },
  {
    id: 'handover_float',
    kind: 'dialogue',
    speaker: 'The Village Gate',
    portrait: 'portrait.narrator',
    lines: [
      FLOAT,
      'Dorin lowers his voice. “The roof on the small float still catches.”',
      'Hanru looks at the cupboard. “I won’t close it.”',
    ],
    variants: [
      {
        when: atDawn,
        lines: [
          FLOAT,
          'Hanru lowers their voice. “The roof still catches. I left the door as it was.”',
          'Dorin looks at the cupboard. “Thank you.”',
        ],
      },
    ],
    next: 'handover_done',
  },
  {
    id: 'handover_done',
    kind: 'flags',
    set: { 'scene.bd03_handover': 'completed' },
    next: 'hanru_watch_leave',
  },

  /* ------------------------------------------------------------ Hanru's watch */
  // Evening and night on the post; at dawn, off watch on the handover verge.
  {
    id: 'hanru_watch',
    kind: 'dialogue',
    speaker: HANRU,
    portrait: HANRU_FACE,
    lines: [
      'I have the watch until dawn. Walk where you like. I only ask where people are going when they look lost.',
      'That lamp by the east road stays lit. If anyone comes down from the quarry in the dark, they will see it.',
      'Dorin wants my fish prints for the notice board. They stay in the cupboard.',
    ],
    variants: [
      {
        when: atDawn,
        lines: [
          'Dorin has the road. I am off watch.',
          'Mira is setting out bowls, if you want breakfast.',
        ],
      },
      {
        when: victory,
        lines: [
          'I have the watch until dawn. Walk where you like. I only ask where people are going when they look lost.',
          'I had just taken the watch when the workers came round the bend. Someone had to stay on the post, so I counted them in.',
          'Nobody needs the east road lamp now. I lit it anyway.',
        ],
      },
    ],
    next: 'hanru_watch_leave',
  },
  {
    // Back to whichever village hub is current, as the discoveries do.
    id: 'hanru_watch_leave',
    kind: 'branch',
    flag: 'act1_complete',
    ifSet: 'village_return_explore',
    ifUnset: 'village_explore',
  },
];
