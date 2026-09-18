import type { StoryNode } from '../../core/types';

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
    next: 'village_explore',
  },
  {
    id: 'riverside_mira',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'I wondered when you would find our quieter corner.',
      'Dorin practices on the far bank. Pella has been trying to copy his stance when he is not looking.',
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
      'Give yourself room. Set your feet before you start a form.',
      'Slow it down once. It is easier to feel where you are losing your balance.',
      'And check behind you. Pella has been leaving her skipping stones all over this bank.',
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
      'A small jar holds the flowers upright. Its handle has been carefully mended with wire.',
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
