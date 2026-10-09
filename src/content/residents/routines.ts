/**
 * Working Ba Dan: people at their work between the day's placements.
 *
 * Presentation only (`residentRoutineSchema`). A routine runs while its
 * resident is placed at the anchor doing one of the listed activities, so it
 * follows the schedule rather than a clock of its own: Gao restocks only in
 * trading hours, and the household carrier only while Pella's household is
 * in its yard. Every tile below is open ground on the village map that no
 * anchor, sign, rest spot, door or exit uses (`routines.test.ts`).
 */

import type { ResidentRoutine } from '../schemas';

const VILLAGE = 'ba_dan_village';

export const BA_DAN_ROUTINES: readonly ResidentRoutine[] = [
  {
    // Gao restacks his display. Its crates sit under the table, reached from
    // the front at (8,5); the display's own corner blocks the diagonal, so he
    // goes round by the lane. Then up his steps to the rear room for stock.
    id: 'lw.npc.gao',
    mapId: VILLAGE,
    anchor: 'bd02.shopfront',
    activities: ['shop_service', 'short_stock_service', 'honest_stock_check', 'stock_and_repairs'],
    legs: [
      {
        path: [
          { x: 9, y: 5 },
          { x: 8, y: 5 },
        ],
        hold: 4000,
        work: true,
        face: 1,
      },
      {
        path: [
          { x: 9, y: 5 },
          { x: 9, y: 4 },
        ],
        hold: 5000,
      },
      { path: [{ x: 10, y: 3 }], hold: 2500, work: true, face: -1 },
      { path: [{ x: 9, y: 4 }], hold: 6000 },
    ],
  },
];

/**
 * Waiting on household art: routes that are authored and checked against the
 * village but not run, because the person who walks them is still a flat
 * placeholder figure and would walk it into the square among painted
 * residents. None of the painted residents fits the errand (Mira, Pella and
 * Dorin are each held to their own places by the story), so it waits for
 * the household adult's art rather than move to someone else.
 */
export const PARKED_ROUTINES: readonly ResidentRoutine[] = [
  {
    // Pella's household carries a basket up to the square and back. The
    // eight-leg schema cap sends it round the west end of the south court,
    // clear of the house, planters and the kitchen garden's fence, up the west
    // lane at x1, then along the road and over the canal bridge.
    id: 'bg.pella_household',
    mapId: VILLAGE,
    anchor: 'bd04.yard',
    activities: ['household_chores'],
    legs: [
      {
        path: [
          { x: 10, y: 14 },
          { x: 9, y: 14 },
          { x: 8, y: 14 },
          { x: 7, y: 14 },
          { x: 6, y: 14 },
          { x: 5, y: 14 },
          { x: 4, y: 14 },
          { x: 3, y: 14 },
        ],
        hold: 1500,
      },
      {
        path: [
          { x: 3, y: 13 },
          { x: 3, y: 12 },
          { x: 2, y: 12 },
          { x: 1, y: 12 },
          { x: 1, y: 11 },
          { x: 1, y: 10 },
          { x: 1, y: 9 },
          { x: 1, y: 8 },
        ],
        hold: 1500,
      },
      {
        path: [
          { x: 2, y: 8 },
          { x: 3, y: 8 },
          { x: 4, y: 8 },
          { x: 5, y: 8 },
          { x: 6, y: 8 },
          { x: 7, y: 8 },
          { x: 8, y: 8 },
          { x: 9, y: 8 },
        ],
        hold: 1500,
      },
      {
        path: [
          { x: 9, y: 7 },
          { x: 9, y: 6 },
          { x: 9, y: 5 },
        ],
        hold: 3500,
        work: true,
      },
      {
        path: [
          { x: 9, y: 6 },
          { x: 9, y: 7 },
          { x: 9, y: 8 },
          { x: 9, y: 9 },
        ],
        hold: 1500,
      },
      {
        path: [
          { x: 9, y: 8 },
          { x: 8, y: 8 },
          { x: 7, y: 8 },
          { x: 6, y: 8 },
          { x: 5, y: 8 },
          { x: 4, y: 8 },
          { x: 3, y: 8 },
          { x: 2, y: 8 },
        ],
        hold: 1500,
      },
      {
        path: [
          { x: 1, y: 8 },
          { x: 1, y: 9 },
          { x: 1, y: 10 },
          { x: 1, y: 11 },
          { x: 1, y: 12 },
          { x: 2, y: 12 },
          { x: 3, y: 12 },
          { x: 3, y: 13 },
        ],
        hold: 1500,
      },
      {
        path: [
          { x: 4, y: 14 },
          { x: 5, y: 14 },
          { x: 6, y: 14 },
          { x: 7, y: 14 },
          { x: 8, y: 14 },
          { x: 9, y: 14 },
          { x: 10, y: 14 },
          { x: 11, y: 13 },
        ],
        hold: 9000,
      },
    ],
  },
];
