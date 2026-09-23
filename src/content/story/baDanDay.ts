/**
 * A Ba Dan day (ADR 0047 §8, W6): Gao's plant scene (LW-S-BD-01), the gate
 * handover (LW-S-BD-03), Hanru's watch and the school notice.
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

const GAO = 'Gao the Shopkeeper';
const DORIN = 'Gate Guard Dorin';
const HANRU = 'Hanru';
/** No Hanru portrait until A1 (it needs a prompt pack); the narrator's stands in. */
const HANRU_FACE = 'portrait.narrator';
const FLOAT =
  'A model parade float sits in the cupboard behind the post. Its little roof sticks out past the door.';

export const BA_DAN_DAY_STORY: readonly StoryNode[] = [
  /* ------------------------------------------- LW-S-BD-01: the plant's chair */
  {
    id: 'plant_chair',
    kind: 'choice',
    speaker: GAO,
    portrait: 'portrait.gao',
    prompt: 'Come in out of the sun. Sit down a minute.',
    // A visit does not reset the custody disagreement (guide §04.2).
    variants: [
      {
        when: { kind: 'flag', key: 'ruon_traded', op: 'set' },
        lines: ['You can sit, if you like. It does not change what I think about Ruon.'],
      },
    ],
    options: [
      { label: 'Sit down', detail: 'Take a break at the shop.', next: 'plant_chair_seat' },
      { label: 'Another time', detail: 'Talk with Gao instead.', next: 'plant_chair_decline' },
    ],
  },
  // Declining sets nothing: Gao says what he would have said without the
  // invitation (his NpcDef's later routes), and asks again next time.
  {
    id: 'plant_chair_decline',
    kind: 'branch',
    flag: 'act1_complete',
    ifSet: 'plant_chair_decline_home',
    ifUnset: 'plant_chair_decline_road',
  },
  {
    id: 'plant_chair_decline_home',
    kind: 'branch',
    flag: 'ruon_traded',
    ifSet: 'gao_home_cold',
    ifUnset: 'gao_home',
  },
  {
    id: 'plant_chair_decline_road',
    kind: 'branch',
    flag: 'ruon_traded',
    ifSet: 'gao_cold',
    ifUnset: 'gao_friendly',
  },
  {
    id: 'plant_chair_seat',
    kind: 'dialogue',
    speaker: 'Gao’s shop',
    portrait: 'portrait.narrator',
    lines: [
      'The only spare chair holds a potted plant. Gao moves it to the counter.',
      'A leaf touches the hanging scale. He turns the pot. Now a leaf rests on the wrapping paper.',
      'He looks back at the empty chair. “You sit,” he says. “I’ll find it somewhere.”',
      'He brings stools out from beside the storeroom, sits on one, and puts the plant back on its chair.',
    ],
    next: 'plant_chair_talk',
  },
  {
    id: 'plant_chair_talk',
    kind: 'choice',
    speaker: GAO,
    portrait: 'portrait.gao',
    prompt: 'There.',
    options: [
      { label: 'Admire the plant', detail: 'It has a new leaf.', next: 'plant_chair_leaf' },
      {
        label: 'Ask about the puzzle box',
        detail: 'It is on the counter.',
        next: 'plant_chair_box',
      },
      { label: 'Just sit', detail: 'Nobody needs anything.', next: 'plant_chair_quiet' },
    ],
  },
  {
    id: 'plant_chair_leaf',
    kind: 'dialogue',
    speaker: GAO,
    portrait: 'portrait.gao',
    lines: [
      'Third one this year. It only grows toward the door, so every morning I turn it round.',
      'Look. It is facing the door again.',
    ],
    next: 'plant_chair_done',
  },
  {
    id: 'plant_chair_box',
    kind: 'dialogue',
    speaker: GAO,
    portrait: 'portrait.gao',
    lines: [
      'There are three drawers in it. I have found two.',
      'Something rattles in the third. Don’t shake it. I’ve tried that.',
    ],
    next: 'plant_chair_done',
  },
  {
    id: 'plant_chair_quiet',
    kind: 'dialogue',
    speaker: 'Gao’s shop',
    portrait: 'portrait.narrator',
    lines: [
      'You sit. Gao sits. Somewhere across the square, a broom scrapes.',
      'Gao leans over and turns the pot a little toward the light.',
    ],
    next: 'plant_chair_done',
  },
  {
    id: 'plant_chair_done',
    kind: 'flags',
    set: { 'scene.bd01_plant_chair': 'completed' },
    next: 'village_leave',
  },

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
      'Dorin once wanted my fish prints on the notice board. They stay inside the hut.',
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

  /* -------------------------------------------------------- The school notice */
  // Morning only: it stands in for Pella while she is in class (§4).
  {
    id: 'school_notice',
    kind: 'dialogue',
    speaker: 'School notice',
    portrait: 'portrait.narrator',
    lines: [
      '“School this morning. Pupils home at midday.”',
      'Underneath, in careful chalk: “PELLA IS AT SCHOOL. IF BO-SHAN COMES HOME, FETCH ME.”',
    ],
    variants: [
      {
        // Held at home until she has told the party (§4), so she is not in class.
        when: both(victory, { kind: 'not', of: { kind: 'visited', nodeId: 'pella_home' } }),
        lines: [
          '“School this morning. Pupils home at midday.”',
          'The chalk line underneath has been rubbed out.',
        ],
      },
      {
        when: victory,
        lines: [
          '“School this morning. Pupils home at midday.”',
          'Underneath, in careful chalk: “PELLA IS AT SCHOOL. BO-SHAN, DO NOT MOVE MY STONES.”',
        ],
      },
    ],
    next: 'village_leave',
  },
  {
    id: 'village_leave',
    kind: 'branch',
    flag: 'act1_complete',
    ifSet: 'village_return_explore',
    ifUnset: 'village_explore',
  },
];
