/**
 * After a Driller loss: occupied Ba Dan (story bible C-01, C-16, C-32).
 *
 * The owner decided on 2026-11-14 that "Carry on" after the Driller continues
 * the saga. The quarry stays occupied and the five stay held; a note says they
 * are alive (canon MQ-01, "Defeat"). Nobody in Ba Dan is punished for it. The
 * night at Mira's table is crowded rather than festive (canon RG-01, "Return
 * changes"), and no welcome home plays. Pella asks canon's closing question,
 * and the honest answer is no.
 *
 * The next morning is the loss branch's departure (saga outline, decision
 * 10): Gao patches the cart, Pella asks the party to take it for her brother,
 * and Dorin writes himself a travel permit and takes the reins. Then the card
 * (`act1_epilogue_lost`) opens onto the village in its occupied state: Dorin
 * is away, Hanru keeps the gate by day too (`residents/baDan.ts`), and the
 * people the party can talk to say what an occupied valley looks like.
 *
 * Everything here keys on `act1_lost`, which a save made at the old terminal
 * card already carries, so such a save continues into the same village.
 */

import type { Condition, StoryNode } from '../../core/types';

const lost: Condition = { kind: 'flag', key: 'act1_lost', op: 'set' };
const spared: Condition = { kind: 'flag', key: 'ruon_spared', op: 'set' };
const traded: Condition = { kind: 'flag', key: 'ruon_traded', op: 'set' };

const MIRA = 'Elder Mira';
const GAO = 'Gao the Shopkeeper';
const PELLA = 'Pella';
const DORIN = 'Gate Guard Dorin';

/** The occupied village's objective, on the hub node and on the map itself. */
export const LOST_OBJECTIVE = {
  when: lost,
  text: 'The quarry is still held. Talk with Mira, Gao, Pella or Hanru, or visit the river.',
} as const;

export const LOST_STORY: readonly StoryNode[] = [
  /* ---------------------------------------------- The night at Mira's table */
  {
    id: 'lost_home_table',
    kind: 'dialogue',
    speaker: 'Ba Dan',
    portrait: 'portrait.narrator',
    lines: [
      'Ba Dan has not gone to bed. Lamps are lit all along the canal, and Mira’s table has been pushed up against two others.',
      'Families from the quarry houses have brought their own pots and stools. Nobody had enough for a meal, so everybody cooked a little.',
      'Someone asks whether the crews will be home before the rains. Gao keeps ladling.',
    ],
    variants: [
      {
        when: spared,
        lines: [
          'Ba Dan has not gone to bed. Lamps are lit all along the canal, and Mira’s table has been pushed up against two others.',
          'Families from the quarry houses have brought their own pots and stools. Nobody had enough for a meal, so everybody cooked a little.',
          'Someone asks whether the crews will be home before the rains. Gao keeps ladling. At the edge of the lamplight, Ruon sweeps the square. Nobody asked him to.',
        ],
      },
    ],
    next: 'lost_home_note',
  },
  {
    id: 'lost_home_note',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: 'portrait.dorin',
    lines: [
      'It isn’t signed. It says: “Bo-shan, the four messengers and the crews are alive. Tell their families.”',
      'I’m going to read it out at every table. Twice.',
    ],
    next: 'lost_home_pella',
  },
  // Canon MQ-01's closing beat, answered honestly for this outcome (owner, 2026-11-14).
  {
    id: 'lost_home_pella',
    kind: 'dialogue',
    speaker: PELLA,
    portrait: 'portrait.pella',
    lines: ['Does he come home now?'],
    next: 'lost_home_answer',
  },
  {
    id: 'lost_home_answer',
    kind: 'dialogue',
    speaker: MIRA,
    portrait: 'portrait.mira',
    lines: ['No. Not tonight.'],
    next: 'lost_home_bowl',
  },
  {
    id: 'lost_home_bowl',
    kind: 'dialogue',
    speaker: 'Mira’s Table',
    portrait: 'portrait.narrator',
    lines: [
      'Pella nods once. She sits down at the end of the bench, beside his covered bowl, and leaves the cloth on.',
    ],
    next: 'lost_departure',
  },

  /* ---------------------------------- The next morning: Dorin takes the reins */
  {
    id: 'lost_departure',
    kind: 'dialogue',
    speaker: 'Ba Dan',
    portrait: 'portrait.narrator',
    lines: [
      'In the morning, Gao has Bo-shan’s cart up on blocks outside his shop. He patches the split wheel with what he has: a barrel stave, a strip of iron, more nails than it needs.',
      'Pella watches every nail go in.',
    ],
    next: 'lost_departure_pella',
  },
  {
    id: 'lost_departure_pella',
    kind: 'dialogue',
    speaker: PELLA,
    portrait: 'portrait.pella',
    lines: [
      'His deliveries are still waiting. Take the cart for him.',
      'Bring it back with him on it.',
    ],
    next: 'lost_departure_permit',
  },
  {
    id: 'lost_departure_permit',
    kind: 'dialogue',
    speaker: DORIN,
    portrait: 'portrait.dorin',
    lines: [
      '“The bearer, Gate Guard Dorin, may leave his post to drive a delivery cart until its driver is home.”',
      'Signed, Gate Guard Dorin. Stamped. I checked the stamp was the right way up.',
      'Hanru, you have the gate.',
    ],
    next: 'lost_departure_hanru',
  },
  {
    id: 'lost_departure_hanru',
    kind: 'dialogue',
    speaker: 'Hanru',
    portrait: 'portrait.hanru',
    lines: ['I have the gate. Go.'],
    next: 'lost_departure_road',
  },
  {
    id: 'lost_departure_road',
    kind: 'dialogue',
    speaker: 'Ba Dan',
    portrait: 'portrait.narrator',
    lines: [
      'Dorin climbs up and takes the reins. The ostrich horse looks round at him for a long moment. Then it leans into the harness.',
      'Pella walks beside the cart as far as the east gate. She is still standing there when the road bends.',
    ],
    next: 'lost_morning',
  },
  {
    // The card falls on the morning after. A phase change rests on the card,
    // never inside a conversation (ADR 0047 §1).
    id: 'lost_morning',
    kind: 'flags',
    set: {},
    phase: 'morning',
    next: 'act1_epilogue_lost',
  },

  /* ------------------------------------- Occupied Ba Dan: who says what now */
  {
    id: 'mira_lost',
    kind: 'dialogue',
    speaker: MIRA,
    portrait: 'portrait.mira',
    lines: [
      'Sit, if you can find a stool. Half of mine are at other people’s tables.',
      'Every family with someone in the galleries has asked me when. I tell them what the note says. Then I tell them I don’t know when.',
      'Gao is sending soup to the fullest houses first. Eat something. That isn’t a request.',
    ],
    next: 'village_explore',
  },
  {
    // Canon MQ-02 after a loss: Gao has a delivery receipt. Planted, not explained.
    id: 'gao_lost',
    kind: 'dialogue',
    speaker: GAO,
    portrait: 'portrait.gao',
    lines: [
      'Soup’s on the back of the stove. Bring your own bowl. I’ve lent all mine out.',
      'The stone carts water their animals at my trough on the way to the coast. One carter left this on my counter. A delivery receipt. Not for stone.',
      'I’ve put it in the drawer with the debt slips. Mira knows where.',
    ],
    variants: [
      {
        when: traded,
        lines: [
          'Soup’s on the back of the stove. Bring your own bowl. I’ve lent all mine out.',
          'The stone carts water their animals at my trough on the way to the coast. One carter left this on my counter. A delivery receipt. Not for stone.',
          'The families would have asked Ruon about it. Jin has him. So it goes in the drawer with the debt slips.',
        ],
      },
    ],
    next: 'village_explore',
  },
  {
    id: 'pella_lost',
    kind: 'dialogue',
    speaker: PELLA,
    portrait: 'portrait.pella',
    lines: [
      'Mira tells everybody “soon.” She told me “not tonight.”',
      'I asked her what comes after not tonight. She said she would tell me when she knew.',
      'I wrote down for Dorin that the ostrich horse likes the cabbage hearts, not the leaves. He read it twice.',
    ],
    next: 'village_explore',
  },
  {
    id: 'dema_lost',
    kind: 'dialogue',
    speaker: 'Lanfen',
    portrait: 'portrait.dema',
    lines: [
      'So that’s where it comes in. You climbed out of my stream at dusk, grey to the knees, and the grit came up with you.',
      'I had a week’s washing on that bank.',
      'The ducks have gone further up. I would too.',
    ],
    next: 'forest_explore',
  },
  {
    id: 'sen_lost',
    kind: 'dialogue',
    speaker: 'Kuan',
    portrait: 'portrait.sen',
    lines: [
      'You came back the hard way, I hear. Sit. The water’s hot.',
      'The stone carts go past at first light now, loaded high, with a guard walking beside each one.',
      'I keep a pot on in case anyone from the galleries gets let out for an hour. Nobody has yet.',
    ],
    next: 'cutting_after_explore',
  },
];
