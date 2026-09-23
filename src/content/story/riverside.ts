import type { Condition, StoryNode } from '../../core/types';

const rescued: Condition = { kind: 'flag', key: 'act1_complete', op: 'set' };

export const RIVERSIDE_STORY: readonly StoryNode[] = [
  {
    id: 'riverside_invitation',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: [
      'I got six skips from one stone. Dorin only got three, but his went further.',
      'We are still arguing about who won. Come down to the river and look.',
    ],
    next: 'riverside_explore',
  },
  {
    id: 'riverside_explore',
    kind: 'explore',
    mapId: 'ba_dan_riverside',
    objective: 'Take your time. Meet the neighbors, cross the bridge, and follow the little paths.',
    objectiveVariants: [
      {
        when: rescued,
        text: 'Rest by the river, or follow the southern path back to Ba Dan.',
      },
    ],
    next: 'village_explore',
  },
  {
    id: 'riverside_mira',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'You found me. Sit down. That end of the bench is dry.',
      'Dorin has been practising across the river. He asked me to watch, but every time I look up he stops.',
      'There is a shrine past the practice ground. I took flowers this morning. Mind the roots on the path.',
    ],
    next: 'riverside_explore',
  },
  {
    // Afternoons at the safe bank, only with Mira on the bank (ADR 0047 §4). After
    // victory she is here only once she has told the party at home (`pella_home`).
    id: 'riverside_pella',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: [
      'I have to stay where Mira can see me. That is why I am standing here and not there.',
      'I am selling stones. The smooth one is two coins. The sparkly one is three, or two if you are nice about it.',
      'The flat one is not for sale. My brother Bo-shan and I are halfway through a skipping game. It is his turn. He is late.',
    ],
    variants: [
      {
        when: rescued,
        lines: [
          'I have to stay where Mira can see me. Bo-shan says that is a good rule. He never followed it.',
          'He is resting. Mira says to let him, so I am letting him.',
          'I gave him the flat stone so we could finish our game. He only got four skips. He says his arm is out of practice.',
        ],
      },
    ],
    next: 'riverside_explore',
  },
  {
    id: 'riverside_dorin',
    kind: 'dialogue',
    speaker: 'Dorin',
    portrait: 'portrait.dorin',
    lines: [
      "I'm working on my footing. I keep doing well on the dry bit and falling over here.",
      'Go on, there is room. Practise a form. I can watch where you put your feet.',
      'Pebble may climb onto the bank. Let him through. Last time I tried to move him, I was the one who moved.',
    ],
    next: 'riverside_explore',
  },
  {
    id: 'riverside_shrine',
    kind: 'dialogue',
    speaker: 'The riverside shrine',
    portrait: 'portrait.narrator',
    lines: [
      'Fresh flowers stand in a chipped jar beside the inscription.',
      '“The river belongs to everyone downstream.”',
      'The jar’s handle has been carefully mended with wire.',
    ],
    next: 'riverside_shrine_found',
  },
  {
    id: 'riverside_shrine_found',
    kind: 'flags',
    set: { riverside_shrine_found: true },
    next: 'riverside_explore',
  },
];
