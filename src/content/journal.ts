import type { Condition } from '../core/types';

export interface JournalNote {
  readonly id: string;
  readonly mapId: string;
  readonly title: string;
  readonly hint: string;
  readonly found: string;
  readonly when: Condition;
}

/** Discoveries are derived from story flags. The journal never owns a second copy. */
export const JOURNAL_NOTES: readonly JournalNote[] = [
  {
    id: 'pebble',
    mapId: 'ba_dan_riverside',
    title: 'A very important otter-turtle',
    hint: 'Someone on the western riverbank is taking a suspicious interest in lunches.',
    found: 'Pebble accepted a scratch behind the shell. Keep an eye on your lunch.',
    when: { kind: 'flag', key: 'riverside_pet', op: 'set' },
  },
  {
    id: 'shrine',
    mapId: 'ba_dan_riverside',
    title: 'Everyone downstream',
    hint: 'Follow the narrow path north of the practice ground to the old shrine.',
    found:
      'Fresh flowers by the river inscription. Someone added a sign to make sure the otter was included.',
    when: { kind: 'flag', key: 'riverside_shrine_found', op: 'set' },
  },
  {
    id: 'veranda',
    mapId: 'ba_dan_riverside',
    title: 'An afternoon off',
    hint: 'There is a quiet veranda south of the banyan. Heroes can stop for tea.',
    found: 'Stopped for jasmine tea on the veranda.',
    when: { kind: 'flag', key: 'riverside_tea', op: 'set' },
  },
  {
    id: 'ducks',
    mapId: 'forest_road',
    title: 'Dema’s unexpected tenants',
    hint: 'Meet the road keeper on the northwestern verge.',
    found: 'Dema says quarry runoff has driven the turtle-ducks uphill into her washing.',
    when: { kind: 'flag', key: 'world.ducks_seen', op: 'set' },
  },
  {
    id: 'workers_tea',
    mapId: 'ambush_road',
    title: 'A place for tired people',
    hint: 'A little workers’ rest sits along the southern verge of the cutting.',
    found:
      'The quarry crews built the bench. Sen keeps tea ready while he waits for them to come back.',
    when: { kind: 'flag', key: 'world.tea_shared', op: 'set' },
  },
  {
    id: 'duck_nest',
    mapId: 'forest_road',
    title: 'A borrowed sock, a safer nest',
    hint: 'Look for a little nest beside the southwestern woodland path.',
    found:
      'Quarry silt covers the old nest by the stream. The ducklings have a dry nest uphill, lined with a sock.',
    when: { kind: 'flag', key: 'world.discovered.duck_nest', op: 'set' },
  },
  {
    id: 'runoff_marker',
    mapId: 'forest_road',
    title: 'Ask upstream',
    hint: 'Beyond the roadblock, a measuring stone stands beside the stream.',
    found:
      'Silt covers the stream marker. A scratched note asks whether the quarry settling pit is blocked.',
    when: { kind: 'flag', key: 'world.discovered.runoff_marker', op: 'set' },
  },
  {
    id: 'tea_station',
    mapId: 'ambush_road',
    title: 'The seventh cup',
    hint: 'Look beside Sen’s rest stop for a shared kettle and mismatched cups.',
    found: 'Washed the seventh cup. Its handle is held on with wire.',
    when: { kind: 'flag', key: 'world.discovered.tea_station', op: 'set' },
  },
];
