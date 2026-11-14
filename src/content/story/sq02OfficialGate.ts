/**
 * SQ-02, A Very Official Gate (story bible Part 06, "Ba Dan and the quarry").
 *
 * Dorin will not open the side gate, because the key register says it is already open. The
 * party reads the register, hears about the storm repairs, and follows a hen through the gap by
 * the hinge post: the gate was rehung back to front, so every morning Dorin "opens" it exactly
 * as the register says, and shuts it. The choice is recorded in `sq02.gate`:
 *
 * - `quiet`: fix the hinges and the register together, privately;
 * - `public`: stand with Dorin while he explains it at Mira's table;
 * - `mocked`: laugh and yank it open. It opens; Dorin keeps the next mistake to himself.
 *
 * The bible's payoffs, adapted to the demo: the side gate becomes a shortcut to the gardens
 * (narrated; the map has no side gate yet), and once the workers are home Dorin tells how he
 * brought them in. He corrected a bad instruction instead of repeating it, "I checked both sides
 * of the gate this time", and Dorin's finished river drill (`riverside_drill`) kept his feet on
 * the wet stones. Kaya, if present, tries not to grin.
 *
 * Offered only before the rescue: the return story needs the gate fixed before the crews came
 * home, and a skipped story is never claimed. Nothing gates the main route and nothing grants XP.
 */

import type { Condition, StoryNode } from '../../core/types';

const DORIN = 'Gate Guard Dorin';
const DORIN_FACE = 'portrait.dorin';
const GATE = 'The side gate';
const NARRATOR = 'portrait.narrator';

export const SQ02_FLAG = 'sq02.gate';
const outcome = (value: 'quiet' | 'public' | 'mocked'): Condition => ({
  kind: 'flag',
  key: SQ02_FLAG,
  op: 'eq',
  value,
});
/** The party found out why the side gate never opens and chose what to do about it. */
export const SQ02_RESOLVED: Condition = { kind: 'flag', key: SQ02_FLAG, op: 'set' };
const MOCKED = outcome('mocked');
const DRILLED: Condition = { kind: 'flag', key: 'riverside_drill', op: 'set' };

export const SQ02_STORY: readonly StoryNode[] = [
  /* --------------------------------------------------------- The hook */
  {
    id: 'sq02_hook',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: DORIN_FACE,
    lines: [
      'Halt! Sorry. Hello. If you were going to use the side gate, it is closed.',
      'I can’t open it. The key register says it’s already open. You can’t open a gate that is open.',
      'People keep climbing the fence instead. Gao went over yesterday with a sack of rice. I had to write that down.',
    ],
    next: 'sq02_ask',
  },
  {
    id: 'sq02_ask',
    kind: 'choice',
    speaker: DORIN,
    portrait: DORIN_FACE,
    prompt: 'I could show you the register. If you’re not busy.',
    options: [
      { label: 'Read the register', detail: 'Dorin keeps it himself.', next: 'sq02_register' },
      {
        label: 'Another time',
        detail: 'Ask him about the road instead.',
        next: 'dorin_directions',
      },
    ],
  },
  {
    id: 'sq02_register',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: DORIN_FACE,
    lines: [
      'Side gate. Every morning: “Opened. Dorin.” A month of it. Hanru never signs it at night. Hanru says a shut gate doesn’t need shutting.',
      'After the storm, the carpenters rehung it. Since then, the book says open every day, and every time I look, it’s shut.',
      'So either the gate is wrong or the book is. I keep the book.',
    ],
    next: 'sq02_hen',
  },
  {
    id: 'sq02_hen',
    kind: 'dialogue',
    speaker: GATE,
    portrait: NARRATOR,
    lines: [
      'A brown hen walks up to the side gate, considers it, and squeezes through the gap beside the hinge post.',
      'From her side you can see it: the hinges are on the wrong face and the latch points the wrong way. The gate was hung back to front.',
      'Every morning, Dorin opens it exactly as the register says. Back to front, opening it shuts it.',
      'Dorin looks at the hen. Then at the hinge. Then, for a long time, at the register.',
    ],
    next: 'sq02_choice',
  },
  {
    id: 'sq02_choice',
    kind: 'choice',
    speaker: DORIN,
    portrait: DORIN_FACE,
    prompt: 'A month. I wrote “opened” every day for a month.',
    options: [
      {
        label: 'Fix it quietly',
        detail: 'Swap the hinges and correct the register with Dorin. Nobody else needs to know.',
        next: 'sq02_quiet',
        setFlags: { [SQ02_FLAG]: 'quiet' },
      },
      {
        label: 'Help him tell the village',
        detail:
          'Stand with Dorin at Mira’s table while he explains. It will be embarrassing for him.',
        next: 'sq02_public',
        setFlags: { [SQ02_FLAG]: 'public' },
      },
      {
        label: 'Laugh and pull it open',
        detail: 'The gate opens. Dorin will not enjoy being laughed at.',
        next: 'sq02_mocked',
        setFlags: { [SQ02_FLAG]: 'mocked' },
      },
    ],
  },

  /* ----------------------------------------------------------- The choice */
  {
    id: 'sq02_quiet',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: DORIN_FACE,
    lines: [
      'Hold that side. No, the other side. Yes. That is the same side. I see it now.',
      'There. It swings the right way.',
      'I’ll put it in the register. In the margin, small: “Hung backwards since the storm. Not noticed. Dorin.”',
    ],
    next: 'sq02_shortcut',
  },
  {
    id: 'sq02_public',
    kind: 'dialogue',
    speaker: 'Mira’s table',
    portrait: NARRATOR,
    lines: [
      'Dorin stands by Mira’s table with the register open and reads it out: “Opened. Dorin.” Thirty times.',
      'Somebody laughs. Gao says his shop door stuck for a whole winter before he found it was locked.',
      'Mira asks to see the hinge. Half the square follows. Dorin explains it again at the gate, slower, with the hen as evidence.',
    ],
    next: 'sq02_public_after',
  },
  {
    id: 'sq02_public_after',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: DORIN_FACE,
    lines: [
      'That was terrible. I would like never to do it again.',
      'Mira wants every gate in Ba Dan checked after a storm. She asked me to do it.',
    ],
    next: 'sq02_shortcut',
  },
  {
    id: 'sq02_mocked',
    kind: 'dialogue',
    speaker: GATE,
    portrait: NARRATOR,
    lines: [
      'You laugh. Somebody pulls the gate the other way, and it swings wide.',
      'Dorin laughs too, a moment late. He writes something in the register and turns the page before you can read it.',
    ],
    next: 'sq02_mocked_after',
  },
  {
    id: 'sq02_mocked_after',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: DORIN_FACE,
    lines: ['It’s open now. Thank you.'],
    next: 'sq02_shortcut',
  },
  {
    id: 'sq02_shortcut',
    kind: 'dialogue',
    speaker: GATE,
    portrait: NARRATOR,
    lines: [
      'Beyond the side gate, a path runs behind the houses to the vegetable gardens. It is quicker than going round by the square.',
      'The hen goes through the gap anyway.',
    ],
    next: 'village_leave',
  },

  /* ------------------------------------------------- Before the rescue */
  {
    id: 'sq02_after',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: DORIN_FACE,
    lines: [
      'Side gate: open. I went and looked at it before I wrote that.',
      'East road, then the switchbacks. If you find anyone who can walk, send them down. I’ll be here.',
    ],
    variants: [
      {
        when: MOCKED,
        lines: [
          'The side gate’s fine.',
          'East road, then the switchbacks. If you find anyone who can walk, send them down.',
        ],
      },
    ],
    next: 'village_leave',
  },

  /* ----------------------------------------------- After the workers came home */
  {
    id: 'sq02_return',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: DORIN_FACE,
    lines: [
      'When the crews came round the bend, word came down the road: bring everyone in through the square.',
      'The square was full. Half the village, holding spoons. So I didn’t.',
      'I checked both sides of the gate this time. We brought the tired ones in by the side gate.',
    ],
    variants: [
      {
        when: MOCKED,
        lines: [
          'When the crews came round the bend, word came down the road: bring everyone in through the square.',
          'The square was full, so we came in by the side gate. It was quicker.',
          'There’s nothing to write down about it.',
        ],
      },
      {
        when: DRILLED,
        lines: [
          'When the crews came round the bend, word came down the road: bring everyone in through the square.',
          'The square was full. Half the village, holding spoons. So I didn’t.',
          'I checked both sides of the gate this time. The stones by the side gate were wet. Flow, spark, flow. Nobody slipped.',
        ],
      },
    ],
    next: 'sq02_return_gate',
  },
  {
    id: 'sq02_return_gate',
    kind: 'dialogue',
    speaker: GATE,
    portrait: NARRATOR,
    lines: [
      'Behind him, the side gate stands open the right way round. The hen is asleep on the post.',
    ],
    variants: [
      {
        when: MOCKED,
        lines: ['Dorin closes the register before you can see the page.'],
      },
      {
        when: { kind: 'partyHas', characterId: 'kaya' },
        lines: [
          'Behind him, the side gate stands open the right way round. The hen is asleep on the post.',
          'Kaya studies the hinge very closely. She is trying hard not to grin.',
        ],
      },
    ],
    next: 'village_leave',
  },
];
