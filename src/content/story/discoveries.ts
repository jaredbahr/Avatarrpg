import type { StoryNode } from '../../core/types';
import { DISCOVERIES } from '../maps/discoveries';

const TEXT = {
  duck_nest: {
    first: [
      'A turtle-duck stands beside a nest lined with reeds. The heel of a woollen sock sticks out beneath three eggs.',
      'She tugs the sock further into the nest, turns round twice, and settles over it.',
      'Below the bank, pale quarry silt coats the reeds and several empty nests.',
    ],
    again: [
      'The turtle-duck lifts her head as you pass. You stay on the path; after a moment she settles again.',
    ],
  },
  runoff_marker: {
    first: [
      'Notches in this stone measure the stream after rain. Someone has tied a reed beside the old clear-water line.',
      'A second reed is tied higher up, level with a fresh band of chalky sediment.',
      'Beside the upper mark, someone has scratched a date and the words “after the quarry wash”.',
    ],
    again: [
      'The two reeds remain tied to the marker. Fresh chalky sediment has gathered in the lower notches.',
    ],
  },
  tea_station: {
    first: [
      'Six mismatched cups stand beside a squat kettle. A seventh has been rinsed and left upside down on a towel.',
      'Someone has carved their name into the bench. Another hand has added “owes me a cup” underneath it.',
      'There is clean water in a covered jug for washing up.',
    ],
    again: [
      'A cup dries upside down beside the kettle. The towel has been hung over the back of the bench.',
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
    next: item.back,
  },
  {
    id: `revisit_${item.id}`,
    kind: 'dialogue',
    speaker: item.name,
    portrait: item.sprite,
    lines: TEXT[item.id].again,
    next: item.back,
  },
]);
