/**
 * Ba Dan's 24 x 16 board as it stood before the grey blockout (`docs/places/ba_dan_village.md`), frozen for the
 * tests that were written against it: the old top-down layout and dressing plan (drawn to these rows, and not
 * registered while the village is a blockout) and the follower-clearance squeeze at the one-tile bridge. The live
 * village is `village.ts`; nothing ships from here.
 */
import type { MapDef } from '../../core/types';

export const OLD_VILLAGE_ROWS: readonly string[] = [
  'TTTT,,,,,,,,,,,,,,TTTTTT',
  'TT,,,,BBBB,,BBBB,,,,,,TT',
  'T,,,,,BBBBllBBBB,ll,,T,T',
  'T,,,,,BBBB,,BBBB,,,,,,,T',
  'T,,,,,,,,=,,=,,,,,,,,,,T',
  'Tll,,Tll,=====,,,,,l,,,T',
  '~~~~~~~~~=~~~=,,,,l,l,,T',
  'W=====================..',
  'W=====================..',
  'T,lll,,,,=====,,,,l,l,,T',
  'T,lll,BBBB,,,BBBBB,lll,T',
  'T,lll,BBBB,,,BBBBB,,,,,T',
  'T,,,,,BBBB,,,BBBB,,,,,,T',
  'T,,,,,BBBB,,lBBBB,,,,,,T',
  'TT,,,,,,,,,,,,,,,,,,,,TT',
  'TTTT,,,,,,,,,,,,,,...TTT',
];

/** The live village's legend and ids on the old rows, with the old exits, spawn and sign cells. */
export function oldVillage(live: MapDef): MapDef {
  const mouth = (x: number, ys: readonly number[]) => ys.map((y) => ({ x, y }));
  return {
    ...live,
    width: 24,
    height: 16,
    rows: OLD_VILLAGE_ROWS,
    partySpawns: [{ x: 3, y: 7 }],
    exit: { pos: { x: 23, y: 7 }, label: 'The east road, toward the quarry' },
    exits: [
      {
        pos: { x: 23, y: 7 },
        toMapId: 'forest_road',
        toPos: { x: 1, y: 4 },
        label: 'East road → Forest Road',
        direction: 'east',
        area: mouth(23, [7, 8]),
      },
      {
        pos: { x: 19, y: 15 },
        toMapId: 'ba_dan_riverside',
        toPos: { x: 10, y: 19 },
        label: 'River path → Riverside',
        direction: 'south',
        area: [18, 19, 20].map((x) => ({ x, y: 15 })),
      },
    ],
    restSpots: [{ pos: { x: 10, y: 5 }, label: "Mira's table" }],
    arrivalShot: undefined,
    practice: undefined,
    triggers: undefined,
    edges: [
      { side: 'north', span: [4, 17], treatment: 'band' },
      { side: 'south', span: [4, 17], treatment: 'band' },
      { side: 'west', span: [6, 6], treatment: 'band' },
    ],
    npcs: live.npcs.map((npc) =>
      npc.id === 'riverside_sign'
        ? { ...npc, pos: { x: 18, y: 12 } }
        : npc.id === 'school_notice'
          ? { ...npc, pos: { x: 12, y: 11 } }
          : npc,
    ),
  };
}
