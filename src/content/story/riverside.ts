import type { StoryNode } from '../../core/types';

export const RIVERSIDE_STORY: readonly StoryNode[] = [
  {
    id: 'riverside_invitation',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: [
      'Come and see Pebble. He got his head stuck in Gao’s lunch basket. Ate everything before we could get it off.',
      "He's by the river. Bring something he can put his whole face in.",
    ],
    next: 'riverside_explore',
  },
  {
    id: 'riverside_explore',
    kind: 'explore',
    mapId: 'ba_dan_riverside',
    objective: 'Take your time. Meet the neighbors, cross the bridge, and follow the little paths.',
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
      'Mira’s flowers stand in a chipped jar beside the inscription.',
      '“The river belongs to everyone downstream.”',
      'Someone has added a smaller sign: “That includes the otter.”',
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
