import type { StoryNode } from '../../core/types';
import { DISCOVERIES } from '../maps/discoveries';

const TEXT = {
  duck_nest: {
    first: [
      'A turtle-duck stands over a nest lined with reeds and a woollen sock. Three ducklings crowd into the heel.',
      'She spreads her wings when you get close. You step back. One duckling carries on pulling at a loose thread.',
      'Down by the stream, white silt has dried over an empty nest. The reeds around it are bent flat.',
    ],
    again: ['The ducklings are asleep in the sock. Their mother opens one eye as you pass.'],
    afterRescue: [
      'The nest is still tucked above the bank, untouched. A ring of fresh reeds keeps boots away.',
      'Dema has tied a strip of cloth to the branch. The water is still cloudy, but the nest is dry.',
    ],
  },
  runoff_marker: {
    first: [
      'Flood marks are cut into the stone beside the stream. A tied reed marks the usual water level.',
      'Pale silt covers the lower notches. Someone has scratched an arrow towards the quarry and the words “Settling pit blocked?”',
      'You dip a hand in the stream. The water leaves white grit between your fingers.',
    ],
    again: [
      'Another thin layer of silt has caught against the reed. The arrow on the stone points uphill.',
    ],
    afterRescue: [
      'The old silt line is still white. Fresh notches mark the water level beside it.',
      'A row of stakes points uphill toward the settling pit. The crews have marked where they will start when they are fit to work; the stream is not clear yet.',
    ],
  },
  tea_station: {
    first: [
      'Six cups stand beside the kettle. A seventh sits in the washing bowl with a tea leaf stuck to the bottom.',
      'Both quarry shifts have scratched their names into the bench. Under the foreman’s name: “Wash your own cup, Hesh.”',
      'You rinse the seventh cup and set it beside the others. The handle has been mended with wire.',
    ],
    again: [
      'The mended cup is back in the washing bowl. This time, someone has left a cloth beside it.',
    ],
    afterRescue: [
      'Used cups cover the bench and the flat stones beside it. The crews have filled the place and gone on.',
      'The kettle has only hot water left. The crews drank the last of the tea before taking the west road.',
    ],
  },
} as const;

export const DISCOVERY_STORY: readonly StoryNode[] = DISCOVERIES.flatMap((item): StoryNode[] => [
  {
    id: `discover_${item.id}`,
    kind: 'dialogue',
    speaker: item.name,
    portrait: item.sprite,
    lines: TEXT[item.id].first,
    next: `remember_${item.id}`,
  },
  {
    id: `remember_${item.id}`,
    kind: 'flags',
    set: { [`world.discovered.${item.id}`]: true },
    next: `leave_${item.id}`,
  },
  {
    id: `revisit_${item.id}`,
    kind: 'dialogue',
    speaker: item.name,
    portrait: item.sprite,
    lines: TEXT[item.id].again,
    variants: [
      {
        when: { kind: 'flag', key: 'act1_complete', op: 'set' },
        lines: TEXT[item.id].afterRescue,
      },
    ],
    next: `leave_${item.id}`,
  },
  {
    id: `leave_${item.id}`,
    kind: 'branch',
    flag: 'act1_complete',
    ifSet: item.map === 'forest_road' ? 'forest_return_explore' : 'cutting_return_explore',
    ifUnset: item.back,
  },
]);
