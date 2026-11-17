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
    // Gao restacks his display, one step west of the shopfront at (20,7). Then he goes round
    // the trough (21,7) by the road, to the storeroom door at (23,6) for the stock, and back.
    id: 'lw.npc.gao',
    mapId: VILLAGE,
    anchor: 'bd02.shopfront',
    activities: ['shop_service', 'short_stock_service', 'honest_stock_check', 'stock_and_repairs'],
    legs: [
      {
        path: [{ x: 19, y: 7 }],
        hold: 4000,
        work: true,
        face: 1,
      },
      {
        path: [{ x: 20, y: 7 }],
        hold: 5000,
      },
      {
        path: [
          { x: 20, y: 8 },
          { x: 21, y: 8 },
          { x: 22, y: 8 },
          { x: 23, y: 7 },
          { x: 23, y: 6 },
        ],
        hold: 2500,
        work: true,
        face: -1,
      },
      {
        path: [
          { x: 23, y: 7 },
          { x: 22, y: 8 },
          { x: 21, y: 8 },
          { x: 20, y: 8 },
          { x: 20, y: 7 },
        ],
        hold: 6000,
      },
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
    // Pella's household carries a basket from the yard at (13,16) up over the canal bridge to
    // the foot of Mira's table at (13,10), and back the same way.
    id: 'bg.pella_household',
    mapId: VILLAGE,
    anchor: 'bd04.yard',
    activities: ['household_chores'],
    legs: [
      {
        path: [
          { x: 13, y: 15 },
          { x: 13, y: 14 },
          { x: 13, y: 13 },
          { x: 13, y: 12 },
          { x: 13, y: 11 },
        ],
        hold: 1500,
      },
      {
        path: [{ x: 13, y: 10 }],
        hold: 3500,
        work: true,
      },
      {
        path: [
          { x: 13, y: 11 },
          { x: 13, y: 12 },
          { x: 13, y: 13 },
          { x: 13, y: 14 },
        ],
        hold: 1500,
      },
      {
        path: [
          { x: 13, y: 15 },
          { x: 13, y: 16 },
        ],
        hold: 9000,
      },
    ],
  },
];
