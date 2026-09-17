import type { StoryNode } from '../../core/types';
import { DISCOVERIES } from '../maps/discoveries';

const TEXT = {
  duck_nest: {
    first: [
      'A turtle-duck stands over a nest lined with reeds and one very familiar sock. Three small shells wobble behind her.',
      'You give the family room to pass. The mother answers with a stern quack, as though this was her idea.',
      'Below the bank, pale quarry silt coats the old nesting reeds. The uphill nest is shelter, not mischief.',
    ],
    again: [
      'The ducklings have settled into the sock. Their mother watches you from a respectful distance. You return the courtesy.',
    ],
  },
  runoff_marker: {
    first: [
      'Notches in this stone measure the stream after rain. Someone has tied a reed beside the old clear-water line.',
      'Today, chalky sediment sits above that mark. A worker has scratched a note: “Ask upstream before blaming downstream.”',
      'The quarry and the village share more than a road. Whatever happens above will eventually arrive here.',
    ],
    again: [
      'The reed still marks the clear-water line. Reading the stone does not clean the stream; it tells you where to begin.',
    ],
  },
  tea_station: {
    first: [
      'Six mismatched cups sit beside a squat kettle. The seventh is upside down beneath a sign: “For whoever washes up.”',
      'A tally on the bench lists names from both quarry shifts. Beside a foreman’s name, somebody has written “Still owes two cups.”',
      'You rinse the spare cup and leave it ready. A small responsibility, but now the next traveller has somewhere to start.',
    ],
    again: [
      'The spare cup is waiting for the next traveller. Somebody has added a second towel. Apparently responsibility is catching.',
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
