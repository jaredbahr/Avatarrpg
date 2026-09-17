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
    found: 'The shrine reminds us that the river belongs to everyone downstream. Even the otter.',
    when: { kind: 'flag', key: 'riverside_shrine_found', op: 'set' },
  },
  {
    id: 'veranda',
    mapId: 'ba_dan_riverside',
    title: 'An afternoon off',
    hint: 'There is a quiet veranda south of the banyan. Heroes can stop for tea.',
    found: 'Jasmine tea on the veranda. For a moment, nobody needed saving.',
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
      'Sen’s crews built their own rest. Put the kettle on before asking which side someone is on.',
    when: { kind: 'flag', key: 'world.tea_shared', op: 'set' },
  },
];
