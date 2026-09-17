import type { StoryNode } from '../../core/types';

export const RIVERSIDE_STORY: readonly StoryNode[] = [
  {
    id: 'riverside_invitation',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: [
      'There is an otter-turtle by the river. He has stolen three lunches and been promoted to local celebrity.',
      'Come on. Mira says even heroes are allowed an afternoon off.',
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
      'I wondered when you would find our quieter corner.',
      'Dorin practices on the far bank. He calls it discipline. Pella calls it splashing with excellent posture.',
      'There is an old shrine beyond him. The path is narrow, but somebody still leaves flowers.',
    ],
    next: 'riverside_explore',
  },
  {
    id: 'riverside_dorin',
    kind: 'dialogue',
    speaker: 'Dorin',
    portrait: 'portrait.dorin',
    lines: [
      'Feet first. Breath second. Dramatic shouting is optional.',
      'Watch how the water follows the hands. Give it a direction, then let it travel.',
      'Try your forms here. The otter-turtle is the only judge, and he accepts snacks.',
    ],
    next: 'riverside_explore',
  },
  {
    id: 'riverside_shrine',
    kind: 'dialogue',
    speaker: 'The riverside shrine',
    portrait: 'portrait.narrator',
    lines: [
      'Fresh flowers rest beside an old stone inscription.',
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
