/**
 * Slice B's five returnees.
 *
 * Identity and profile ownership live here; maps only bind the matching NpcDef
 * to an anchor. All visuals are replaceable placeholders during the art freeze.
 * Activities are deliberately neutral until biography/recovery copy is approved.
 */

import { DAY_PHASES } from '../../core/types';
import type {
  Condition,
  DayPhase,
  ResidentDef,
  ResidentProfile,
  ResidentSlot,
  WorldAnchor,
} from '../../core/types';

const FOREST = 'forest_road';
const VILLAGE = 'ba_dan_village';
const RIVERSIDE = 'ba_dan_riverside';

export const RETURNEE_IDS = [
  'lw.npc.bo_shan',
  'lw.npc.leto',
  'lw.npc.amri',
  'lw.npc.hesra',
  'lw.npc.senn_messenger',
] as const;

export type ReturneeId = (typeof RETURNEE_IDS)[number];

export type ReturneePresentation = {
  readonly npcSprite: 'npc.household' | 'npc.guard' | 'npc.hanru';
  readonly portrait: 'portrait.narrator';
  readonly placeholder: true;
};

/** One replaceable art hook for every map and later dialogue node. */
export const RETURNEE_PRESENTATIONS: Readonly<Record<ReturneeId, ReturneePresentation>> = {
  'lw.npc.bo_shan': {
    npcSprite: 'npc.household',
    portrait: 'portrait.narrator',
    placeholder: true,
  },
  'lw.npc.leto': {
    npcSprite: 'npc.guard',
    portrait: 'portrait.narrator',
    placeholder: true,
  },
  'lw.npc.amri': {
    npcSprite: 'npc.hanru',
    portrait: 'portrait.narrator',
    placeholder: true,
  },
  'lw.npc.hesra': {
    npcSprite: 'npc.household',
    portrait: 'portrait.narrator',
    placeholder: true,
  },
  'lw.npc.senn_messenger': {
    npcSprite: 'npc.hanru',
    portrait: 'portrait.narrator',
    placeholder: true,
  },
};

interface ReturneeRecord {
  readonly id: ReturneeId;
  readonly npc: 'bo_shan' | 'leto' | 'amri' | 'hesra' | 'senn';
  readonly name: string;
  readonly home: string;
  readonly returning: string;
  readonly recovery: string;
  readonly recoveryPhases: readonly DayPhase[];
  readonly readyPhases: readonly DayPhase[];
}

export const RETURNEE_RECORDS: readonly ReturneeRecord[] = [
  {
    id: 'lw.npc.bo_shan',
    npc: 'bo_shan',
    name: 'Bo-shan',
    home: 'home.bo_shan',
    returning: 'return.bo_shan',
    recovery: 'recovery.bo_shan',
    recoveryPhases: ['midday'],
    readyPhases: ['morning', 'midday'],
  },
  {
    id: 'lw.npc.leto',
    npc: 'leto',
    name: 'Leto',
    home: 'home.leto',
    returning: 'return.leto',
    recovery: 'recovery.leto',
    recoveryPhases: ['morning'],
    readyPhases: ['morning', 'afternoon'],
  },
  {
    id: 'lw.npc.amri',
    npc: 'amri',
    name: 'Amri',
    home: 'home.amri',
    returning: 'return.amri',
    recovery: 'recovery.amri',
    recoveryPhases: ['afternoon'],
    readyPhases: ['morning', 'afternoon'],
  },
  {
    id: 'lw.npc.hesra',
    npc: 'hesra',
    name: 'Hesra',
    home: 'home.hesra',
    returning: 'return.hesra',
    recovery: 'recovery.hesra',
    recoveryPhases: ['midday'],
    readyPhases: ['dawn', 'midday'],
  },
  {
    id: 'lw.npc.senn_messenger',
    npc: 'senn',
    name: 'Senn',
    home: 'home.senn',
    returning: 'return.senn',
    recovery: 'recovery.senn',
    recoveryPhases: ['afternoon'],
    readyPhases: ['midday', 'afternoon'],
  },
];

const tile = (id: string, place: string, mapId: string, x: number, y: number): WorldAnchor => ({
  id,
  place,
  site: { kind: 'map', mapId, pos: { x, y } },
});

const door = (id: string, place: string, x: number, y: number): WorldAnchor => ({
  id,
  place,
  site: { kind: 'private', door: { mapId: VILLAGE, pos: { x, y } } },
});

/**
 * The road group sits on the open north verge at the west bend, beyond the x=4
 * departure trigger and clear of Dema. BD12-BD15 are honest south-lane contact
 * doors, not claims that painted workshops exist on today's village map.
 */
export const RETURNEE_ANCHORS: readonly WorldAnchor[] = [
  tile('return.bo_shan', 'FOREST-RETURN', FOREST, 5, 3),
  tile('return.leto', 'FOREST-RETURN', FOREST, 6, 3),
  tile('return.amri', 'FOREST-RETURN', FOREST, 7, 2),
  tile('return.hesra', 'FOREST-RETURN', FOREST, 6, 2),
  tile('return.senn', 'FOREST-RETURN', FOREST, 5, 2),
  tile('recovery.bo_shan', 'BD04', VILLAGE, 12, 12),
  tile('recovery.amri', 'BD12-CONTACT', VILLAGE, 13, 9),
  tile('recovery.leto', 'BD13-CONTACT', VILLAGE, 10, 9),
  tile('recovery.hesra', 'BD14-CONTACT', VILLAGE, 17, 9),
  tile('recovery.senn', 'BD15-RIVER', RIVERSIDE, 18, 14),
  // Bo-shan shares the BD04 household door while keeping his own saved identity.
  door('home.bo_shan', 'BD04', 10, 13),
  door('home.amri', 'BD12', 12, 15),
  door('home.leto', 'BD13', 13, 15),
  door('home.hesra', 'BD14', 14, 15),
  door('home.senn', 'BD15', 15, 15),
];

const profile = (residentId: ReturneeId, ...profiles: ResidentProfile[]): Condition => ({
  kind: 'residentProfile',
  residentId,
  in: profiles,
});

const slot = (anchor: string, npc: string, activity: string): ResidentSlot => ({
  anchor,
  npc,
  activity,
  interrupt: 'talk',
});

const schedule = (
  publicSlot: ResidentSlot,
  publicPhases: readonly DayPhase[],
): Readonly<Record<DayPhase, ResidentSlot | 'home'>> =>
  Object.fromEntries(
    DAY_PHASES.map((phase) => [phase, publicPhases.includes(phase) ? publicSlot : 'home']),
  ) as Record<DayPhase, ResidentSlot | 'home'>;

const resident = (record: ReturneeRecord): ResidentDef => {
  const returning = slot(record.returning, record.npc, 'returning_together');
  const recovery = slot(record.recovery, record.npc, 'quiet_recovery');
  return {
    id: record.id,
    name: record.name,
    source: { runtimeNpcIds: [record.npc] },
    home: record.home,
    fallback: recovery,
    // No occupation is asserted: these are neutral safe appearances only.
    schedule: schedule({ ...recovery, activity: 'available' }, record.readyPhases),
    overrides: [
      {
        id: `${record.npc}_missing`,
        tier: 'presence',
        when: profile(record.id, 'missing'),
        slots: {},
        all: 'absent',
      },
      {
        id: `${record.npc}_returning`,
        tier: 'presence',
        when: profile(record.id, 'returning'),
        slots: {},
        all: returning,
      },
      {
        id: `${record.npc}_resting`,
        tier: 'care',
        when: profile(record.id, 'resting'),
        slots: {},
        all: 'home',
      },
      {
        id: `${record.npc}_recovering`,
        tier: 'care',
        when: profile(record.id, 'recovering'),
        slots: schedule(recovery, record.recoveryPhases),
      },
    ],
  };
};

export const RETURNEE_RESIDENTS: readonly ResidentDef[] = RETURNEE_RECORDS.map(resident);
