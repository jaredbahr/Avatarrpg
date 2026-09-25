import type { Condition, StoryNode } from '../../core/types';

const rescued: Condition = { kind: 'flag', key: 'act1_complete', op: 'set' };

export const RIVERSIDE_STORY: readonly StoryNode[] = [
  {
    // A sign, not Pella (ADR 0047 W7): she is placed elsewhere, often at the
    // court beside it. Her chalk keeps her contest and her invitation.
    id: 'riverside_invitation',
    kind: 'dialogue',
    speaker: 'Riverside path',
    portrait: 'portrait.narrator',
    lines: [
      '“To the river.” An arrow points down the path.',
      'Underneath, in careful chalk: “SIX SKIPS FROM ONE STONE. DORIN GOT THREE BUT HIS WENT FURTHER. STILL ARGUING WHO WON. COME AND LOOK. — PELLA”',
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
      'Dorin practises across the river at midday. He asks me to watch, but every time I look up he stops.',
      'There is a shrine past the practice ground. I took flowers on my way down. Mind the roots on the path.',
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
          'The flat stone is still his turn. I am keeping it until he is rested.',
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
