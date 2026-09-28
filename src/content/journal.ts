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
    title: 'Pebble by the river',
    hint: 'An otter-turtle rests on the western riverbank.',
    found: 'Pebble accepted a scratch behind the shell. Keep an eye on your lunch.',
    when: { kind: 'flag', key: 'riverside_pet', op: 'set' },
  },
  {
    id: 'shrine',
    mapId: 'ba_dan_riverside',
    title: 'Everyone downstream',
    hint: 'Follow the narrow path north of the practice ground to the old shrine.',
    found:
      'Fresh flowers by the river inscription. The jar’s broken handle has been mended with wire.',
    when: { kind: 'flag', key: 'riverside_shrine_found', op: 'set' },
  },
  {
    id: 'veranda',
    mapId: 'ba_dan_riverside',
    title: 'An afternoon off',
    hint: 'A quiet veranda south of the banyan overlooks the river.',
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
    title: 'The crews’ rest stop',
    hint: 'A little workers’ rest sits along the southern verge of the cutting.',
    found:
      'Two shifts built the bench from offcuts and never agreed on its height. Sen keeps the kettle going in case they come down.',
    when: { kind: 'flag', key: 'world.tea_shared', op: 'set' },
  },
  {
    id: 'duck_nest',
    mapId: 'forest_road',
    title: 'A borrowed sock, a safer nest',
    hint: 'Look for a little nest beside the southwestern woodland path.',
    found:
      'Three ducklings crowd into the heel of a woollen sock. Their old nest by the stream lies under dried silt.',
    when: { kind: 'flag', key: 'world.discovered.duck_nest', op: 'set' },
  },
  {
    id: 'roadblock_workers',
    mapId: 'forest_road',
    title: 'Quarry dust on their cuffs',
    hint: 'Someone is watching the pine road from behind the trees.',
    found:
      'The people blocking the road had stone dust on their cuffs and hammer calluses on their thumbs. They worked the quarry.',
    when: {
      kind: 'any',
      of: [
        { kind: 'flag', key: 'lost_forest_road', op: 'set' },
        { kind: 'flag', key: 'ruon_spared', op: 'set' },
        { kind: 'flag', key: 'ruon_traded', op: 'set' },
      ],
    },
  },
  {
    id: 'runoff_marker',
    mapId: 'forest_road',
    title: 'Silt at the marker',
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
    found:
      'Washed the seventh cup, the one with the wire-mended handle. The bench says: “Wash your own cup, Hesh.”',
    when: { kind: 'flag', key: 'world.discovered.tea_station', op: 'set' },
  },
  {
    id: 'bo_shan_cart',
    mapId: 'quarry_gate',
    title: 'Five missing, not four',
    hint: 'Someone in Ba Dan knows who else went up this road.',
    found:
      'Pella’s brother, Bo-shan, took vegetables up before Mira’s messengers went. Look for a cart with cabbages piled above the seat.',
    when: { kind: 'flag', key: 'pella_asked', op: 'set' },
  },
  {
    id: 'gate_wages',
    mapId: 'quarry_gate',
    title: 'Why the gate shut',
    hint: 'Workers with slings hold the quarry gate. Someone there gives the orders.',
    found:
      'Ruon says the crews went unpaid, then the guards. His quartermaster shut the gate and locked people in the galleries. Ruon kept his post.',
    when: {
      kind: 'any',
      of: [
        { kind: 'flag', key: 'ruon_spared', op: 'set' },
        { kind: 'flag', key: 'ruon_traded', op: 'set' },
      ],
    },
  },
  {
    id: 'galleries',
    mapId: 'quarry_floor',
    title: 'Out of the galleries',
    hint: 'Below the stone ledges, the gallery entrances have been barred with timber.',
    found:
      'Pulled the bars from the gallery doors. Mira’s four messengers came out, then Bo-shan, asking where Pella was.',
    when: { kind: 'flag', key: 'act1_complete', op: 'set' },
  },
  {
    id: 'maker_plate',
    mapId: 'quarry_floor',
    title: 'The maker’s plate',
    hint: 'Look the driller over once it stops moving.',
    found: 'The driller carries a maker’s plate. Took a rubbing for Mira’s report to the province.',
    when: { kind: 'flag', key: 'act1_complete', op: 'set' },
  },
];
