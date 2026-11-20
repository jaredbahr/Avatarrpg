/**
 * Every map's stage 5 set-piece plan with what it is held against: the map (its rows and legend) and its named tracks.
 * `setPieces.test.ts` validates each one against its live rows, and the `?boxes` overlay (a dev build) draws the plan
 * of whichever map is open. Plain data; the shipped runtime never imports it.
 */
import type { MapDef, Vec2 } from '../../core/types';
import { trackCells } from '../ground';
import { BA_DAN_VILLAGE } from '../maps/village';
import { RIVER_ROAD } from '../regions/saltstepEmberwatch/maps';
import type { SetPiecePlan } from '../setPieces';
import { BA_DAN_TRACKS } from './baDan.ground';
import { BA_DAN_SET_PIECE_PLAN } from './baDan.setpieces';
import { RIVER_ROAD_SET_PIECE_PLAN, riverRoadTracks } from './riverRoad.setpieces';

export interface PlannedMap {
  readonly plan: SetPiecePlan;
  readonly map: MapDef;
  /** Every named track's cells, by id. */
  readonly tracks: () => ReadonlyMap<string, readonly Vec2[]>;
  /** The disk and ring tracks' centres and outer radii in cells, by id (a piece's `ownDisk`). */
  readonly disks: () => ReadonlyMap<string, { x: number; y: number; r: number }>;
}

export const SET_PIECE_PLANS: readonly PlannedMap[] = [
  {
    plan: BA_DAN_SET_PIECE_PLAN,
    map: BA_DAN_VILLAGE,
    tracks: () =>
      new Map(
        BA_DAN_TRACKS.map((t) => [
          t.id,
          trackCells(t, BA_DAN_VILLAGE.width, BA_DAN_VILLAGE.height),
        ]),
      ),
    // a disk is worn out to its radius, a ring a half cell beyond it
    disks: () =>
      new Map(
        BA_DAN_TRACKS.flatMap((t) =>
          'disk' in t
            ? [[t.id, { x: t.disk[0], y: t.disk[1], r: t.r }] as const]
            : 'ring' in t
              ? [[t.id, { x: t.ring[0], y: t.ring[1], r: t.r + 0.5 }] as const]
              : [],
        ),
      ),
  },
  {
    plan: RIVER_ROAD_SET_PIECE_PLAN,
    map: RIVER_ROAD,
    tracks: riverRoadTracks,
    disks: () => new Map(),
  },
];

/** The plan for a map, if it has one. */
export const setPiecePlanFor = (mapId: string): PlannedMap | undefined =>
  SET_PIECE_PLANS.find((p) => p.plan.mapId === mapId);
