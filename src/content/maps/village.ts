/**
 * Ba Dan village — the Act 1 hub and the only explore map in the slice.
 *
 * Bigger than a battlefield (24x16) so there is somewhere to wander, with the
 * camera panning by drag. Tapping an NPC opens their story node; walking onto
 * the east gate advances the current explore node.
 *
 * NPC routes remember the rescue and Ruon's custody. Gao can welcome the
 * workers home while still disagreeing with the party about handing Ruon to Jin.
 */

import type { MapDef } from '../../core/types';
import { LEGEND } from './legend';
import { RETURNEE_PRESENTATIONS } from '../residents/returnees';
import { SQ01_RESOLVED } from '../story/sq01Cabbages';
import { SQ02_RESOLVED } from '../story/sq02OfficialGate';
import { SQ03_RESOLVED } from '../story/sq03GaosLedger';

/** After a Driller loss (C-16): the occupied village's conversations come first. */
const LOST = { kind: 'flag', key: 'act1_lost', op: 'set' } as const;

export const BA_DAN_VILLAGE: MapDef = {
  id: 'ba_dan_village',
  projection: 'topdown',
  cameraCentreMargin: 1,
  name: 'Ba Dan Village',
  kind: 'explore',
  width: 32,
  height: 23,
  ambience: 'village',
  // The courtyard's open air, with a pond tone that swells near the canal's water.
  soundscape: 'courtyard',
  // Bending practice (#284) from the wash steps on the canal's north bank: the party stands at (9,11)
  // and every bend goes south at the mark on the bank's edge (9,12), out over the canal. It sits two
  // steps west of the new-game spawn (11,10), so Practice is not offered before the party moves.
  practice: {
    label: 'Wash steps',
    anchor: { x: 9, y: 11 },
    reach: 1,
    mark: { x: 9, y: 12 },
  },
  legend: {
    ...LEGEND,
    // A low worked-stone block: solid, but you can see over it.
    l: { terrain: 'stone', blocked: true, blocksSight: false },
    // The canal is a physical edge; only the bridge at (13..14, 12..13) carries walkers.
    '~': {
      terrain: 'dirt',
      surface: 'water',
      surfaceDuration: -1,
      blocked: true,
      blocksSight: false,
    },
  },
  /*
   * GREY BLOCKOUT (stage 3 of `docs/level-design.md`; the brief is `docs/places/ba_dan_village.md`). The table
   * stands at the crossing of the routes: the east road comes in through the gate gap in the east wall (x 29,
   * rows 9-10) past Gao's shop (x 19-22, rows 4-6, storeroom 23-24) to the square, where Mira's table is the
   * two `l` cells (13..14, 9), seated from the rest spot below it at (13,10). The canal runs along rows 12-13
   * west of x 16 and rows 13-14 east of it, with the bridge at (13..14, 12..13), and leaves the board east under the wall. Past it lie the quarry houses,
   * a back lane on row 18 with a back row of two houses on rows 19-20 facing it (owner, 2026-11-19), and the river
   * path running down between them to its mouth at (18..19, 22). The terrace `^` under the north cliff is reached by the steps
   * `S` at (9,4); the mason's yard (blocks at (5,6), (6,6), (5,8)) lies west of the square; the garden fence
   * `F` has its side gate gap at (25,3). The west road ends at the ford, `W` at (0,9), flooded this season;
   * a future west region opens there behind a `Condition`. Every blocked cell comes from the brief's plan.
   */
  rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXX^^XXXXXXXTTTXXXTTTTTXXXXX',
    'XXXTTT^^^^TTTTTT,,,TTT,,,F...XXX',
    'TTT,,,^^^^...................#TT',
    'TT,,,,,,,S,BBBBB,,,BBBBBBF...#TT',
    'TTBBB,,,,,,BBBBB,,,BBBBBBFFFF#TT',
    'T,BBBll..,,BBBBB,,,BBBB,,,,BB#TT',
    'T,BBB....,........,,,l,,,l,BB#TT',
    'T,,,,l...,........=====,,,,,,lTT',
    'W............ll...==============',
    'WW,,,,,,,,........,,,,,=========',
    'T,,,,,,,,.........,,,,,,,,,,,#TT',
    'T~~~~~~~~~~~~==~,,,,,,,,,,,,,#TT',
    'T~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~',
    'T,..............~~~~~~~~~~~~~~~~',
    'TT,,,,,,BBBB,................#TT',
    'TT,BBB,,BBBB,,,BBB..BBBB,,BB,#TT',
    'TT,BBB,,BBBB,,,BBB..BBBB,,BB,#TT',
    'TT,,,,,,,,,,,,,,,,..,,,B,,,,T#TT',
    'TT,,,,,,BBB,,BBB,,..,,,,,,,,T#TT',
    'TT,,,,,,BBB,,BBB,,..,,,,,,,,T#TT',
    'TTTT,,,,,,,,,,,,,,..,,,,,,,TTTTT',
    'TTTTTTTTTTTTTTTTTT..TTTTTTTTTTTT',
  ],
  partySpawns: [{ x: 11, y: 10 }],
  exit: { pos: { x: 31, y: 9 }, label: 'The east road, toward the quarry' },
  // The first view of a new game centres on row 9, so Mira's table (13,9) sits in the middle of the frame.
  arrivalShot: { at: { x: 11, y: 10 }, unlessVisited: 'mira_intro', rows: 6, centreY: 9 },
  edgeContract: 'enforce',
  restSpots: [{ pos: { x: 13, y: 10 }, label: "Mira's table" }],
  npcs: [
    {
      id: 'riverside_sign',
      name: 'Riverside path',
      // Beside the river path one cell short of its mouth on the south rim.
      pos: { x: 20, y: 21 },
      // A marker post, not Pella's figure: she is a resident placed elsewhere.
      sprite: 'world.route_sign',
      interaction: 'route-sign',
      node: 'riverside_invitation',
    },
    {
      id: 'elder_mira',
      name: 'Elder Mira',
      resident: 'lw.npc.mira',
      sprite: 'npc.elder',
      node: 'mira_intro',
      routes: [
        { when: LOST, node: 'mira_lost' },
        // Once the maker-plate rubbing is in her hands, she never asks for it again (#628).
        { when: { kind: 'flag', key: 'rubbing_given', op: 'set' }, node: 'mira_rubbing_kept' },
        { when: { kind: 'flag', key: 'act1_complete', op: 'set' }, node: 'mira_epilogue' },
      ],
    },
    {
      id: 'shopkeeper_gao',
      name: 'Gao the Shopkeeper',
      resident: 'lw.npc.gao',
      sprite: 'npc.shopkeeper',
      node: 'gao_friendly',
      routes: [
        // After a loss, his word on the occupied valley comes first, once; then
        // SQ-03 and the plant's chair, which still fit, and then the same word again.
        {
          when: {
            kind: 'all',
            of: [LOST, { kind: 'not', of: { kind: 'visited', nodeId: 'gao_lost' } }],
          },
          node: 'gao_lost',
        },
        // LW-S-BD-01 (ADR 0047 §8): an afternoon break, once. The homecoming
        // comes first, and before victory so does his objection to the trade.
        {
          when: {
            kind: 'all',
            of: [
              { kind: 'phase', in: ['afternoon'] },
              { kind: 'flag', key: 'scene.bd01_plant_chair', op: 'unset' },
              {
                kind: 'any',
                of: [
                  { kind: 'flag', key: 'act1_complete', op: 'unset' },
                  { kind: 'visited', nodeId: 'gao_home' },
                  { kind: 'visited', nodeId: 'gao_home_cold' },
                ],
              },
              {
                kind: 'any',
                of: [
                  { kind: 'flag', key: 'ruon_traded', op: 'unset' },
                  { kind: 'flag', key: 'act1_complete', op: 'set' },
                  { kind: 'visited', nodeId: 'gao_cold' },
                ],
              },
            ],
          },
          node: 'plant_chair',
        },
        // SQ-03, before the rescue only: once Gao has given his first word (`gao_friendly`) and,
        // after the trade, his objection (`gao_cold`), the parcels.
        {
          when: {
            kind: 'all',
            of: [
              { kind: 'not', of: SQ03_RESOLVED },
              { kind: 'flag', key: 'act1_complete', op: 'unset' },
              { kind: 'visited', nodeId: 'gao_friendly' },
              {
                kind: 'any',
                of: [
                  { kind: 'flag', key: 'ruon_traded', op: 'unset' },
                  { kind: 'visited', nodeId: 'gao_cold' },
                ],
              },
            ],
          },
          node: 'sq03_hook',
        },
        // SQ-03's return detail, once, after his homecoming: the jar.
        {
          when: {
            kind: 'all',
            of: [
              SQ03_RESOLVED,
              { kind: 'flag', key: 'act1_complete', op: 'set' },
              {
                kind: 'any',
                of: [
                  { kind: 'visited', nodeId: 'gao_home' },
                  { kind: 'visited', nodeId: 'gao_home_cold' },
                ],
              },
              { kind: 'not', of: { kind: 'visited', nodeId: 'sq03_jar' } },
            ],
          },
          node: 'sq03_jar',
        },
        { when: LOST, node: 'gao_lost' },
        {
          when: {
            kind: 'all',
            of: [
              { kind: 'flag', key: 'act1_complete', op: 'set' },
              { kind: 'flag', key: 'ruon_traded', op: 'set' },
            ],
          },
          node: 'gao_home_cold',
        },
        { when: { kind: 'flag', key: 'act1_complete', op: 'set' }, node: 'gao_home' },
        { when: { kind: 'flag', key: 'ruon_traded', op: 'set' }, node: 'gao_cold' },
      ],
    },
    {
      id: 'kid_pella',
      name: 'Pella',
      resident: 'lw.npc.pella',
      sprite: 'npc.kid',
      node: 'pella_tips',
      routes: [
        { when: LOST, node: 'pella_lost' },
        // SQ-01: once her homecoming is heard, the corrected list of helpers.
        {
          when: {
            kind: 'all',
            of: [
              { kind: 'flag', key: 'act1_complete', op: 'set' },
              { kind: 'visited', nodeId: 'pella_home' },
              SQ01_RESOLVED,
            ],
          },
          node: 'sq01_pella_list',
        },
        { when: { kind: 'flag', key: 'act1_complete', op: 'set' }, node: 'pella_home' },
        { when: { kind: 'flag', key: 'pella_asked', op: 'set' }, node: 'pella_again' },
      ],
    },
    {
      id: 'guard_dorin',
      name: 'Gate Guard Dorin',
      resident: 'lw.npc.dorin',
      sprite: 'npc.dorin',
      node: 'dorin_directions',
      routes: [
        // The homecoming comes first after the rescue.
        {
          when: {
            kind: 'all',
            of: [
              { kind: 'flag', key: 'act1_complete', op: 'set' },
              { kind: 'not', of: { kind: 'visited', nodeId: 'dorin_home' } },
            ],
          },
          node: 'dorin_home',
        },
        // SQ-02: once he has given the directions, before the rescue, the side gate.
        {
          when: {
            kind: 'all',
            of: [
              { kind: 'visited', nodeId: 'dorin_directions' },
              { kind: 'flag', key: 'act1_complete', op: 'unset' },
              { kind: 'not', of: SQ02_RESOLVED },
            ],
          },
          node: 'sq02_hook',
        },
        {
          when: {
            kind: 'all',
            of: [SQ02_RESOLVED, { kind: 'flag', key: 'act1_complete', op: 'unset' }],
          },
          node: 'sq02_after',
        },
        // After the rescue, once: how he brought the crews in.
        {
          when: {
            kind: 'all',
            of: [SQ02_RESOLVED, { kind: 'not', of: { kind: 'visited', nodeId: 'sq02_return' } }],
          },
          node: 'sq02_return',
        },
        { when: { kind: 'flag', key: 'act1_complete', op: 'set' }, node: 'dorin_home' },
      ],
    },
    {
      // D7: a placeholder sprite, distinct from both of Dorin's.
      id: 'guard_hanru',
      name: 'Hanru',
      resident: 'lw.npc.hanru',
      sprite: 'npc.hanru',
      node: 'hanru_watch',
      routes: [
        {
          // LW-S-BD-03: the handover, once, at either change of watch.
          when: {
            kind: 'all',
            of: [
              { kind: 'phase', in: ['dawn', 'evening'] },
              { kind: 'flag', key: 'scene.bd03_handover', op: 'unset' },
              // Dorin is away driving the cart after a loss: nobody to hand over to.
              { kind: 'flag', key: 'act1_lost', op: 'unset' },
            ],
          },
          node: 'handover_scene',
        },
      ],
    },
    {
      // BD05 has no building (ADR 0047 §3): in the morning this notice stands
      // in for Pella, who is in class. Placeholder art until A1.
      id: 'school_notice',
      name: 'School notice',
      pos: { x: 16, y: 7 },
      sprite: 'world.school_notice',
      interaction: 'route-sign',
      when: { kind: 'phase', in: ['morning'] },
      node: 'school_notice',
    },
    // Later states (`docs/places/ba_dan_village.md`): small standing objects, native size, shown once their
    // story condition holds. The bake never changes; each is a one-image `TOPDOWN_OBJECTS` marker that is tapped to look at.
    {
      // SQ-02: the side gate hung the right way round, a hen on its roof, standing over the baked open gate
      // (set piece `side_gate`, drawn on the fence cell (25,2), which is blocked). The marker needs an open cell, so it
      // stands in the gap just south, (25,3), and its art carries transparent rows below the gate (`tools/bd20set.py`)
      // that put the gate's own base on the baked one; it casts no foot blob (`exploreMarkerScale.ts`).
      id: 'side_gate_hung',
      name: 'Side gate',
      pos: { x: 25, y: 3 },
      sprite: 'world.side_gate_hung',
      interaction: 'route-sign',
      when: SQ02_RESOLVED,
      node: 'look_side_gate_hung',
    },
    {
      // SQ-03: the jar "for whoever needs it", by the west end of Gao's counter (the shop-front cells (19,7) and (20,7)
      // are Gao's own restocking steps).
      id: 'gao_jar',
      name: 'Counter jar',
      pos: { x: 18, y: 7 },
      sprite: 'world.gao_jar',
      interaction: 'route-sign',
      when: SQ03_RESOLVED,
      node: 'look_gao_jar',
    },
    {
      // After the welcome-home supper: Hesra's lost boot with a river shell, in the mason's yard by her step. The step
      // (5,7) is her door anchor `home.hesra` and (6,7) her `recovery.hesra` tile, and no NPC may stand on an anchor
      // (`residents/baDan.test.ts`), so the boot waits on the yard cell south-east of both.
      id: 'hesra_boot',
      name: 'Boot on the step',
      pos: { x: 6, y: 8 },
      sprite: 'world.hesra_boot',
      interaction: 'route-sign',
      when: { kind: 'visited', nodeId: 'welcome_home_supper' },
      node: 'look_hesra_boot',
    },
    {
      id: 'bo_shan',
      name: 'Bo-shan',
      resident: 'lw.npc.bo_shan',
      sprite: RETURNEE_PRESENTATIONS['lw.npc.bo_shan'].npcSprite,
      node: 'village_explore',
    },
    {
      id: 'leto',
      name: 'Leto',
      resident: 'lw.npc.leto',
      sprite: RETURNEE_PRESENTATIONS['lw.npc.leto'].npcSprite,
      node: 'village_explore',
    },
    {
      id: 'amri',
      name: 'Amri',
      resident: 'lw.npc.amri',
      sprite: RETURNEE_PRESENTATIONS['lw.npc.amri'].npcSprite,
      node: 'village_explore',
    },
    {
      id: 'hesra',
      name: 'Hesra',
      resident: 'lw.npc.hesra',
      sprite: RETURNEE_PRESENTATIONS['lw.npc.hesra'].npcSprite,
      node: 'village_explore',
    },
  ],
  props: [],
};
