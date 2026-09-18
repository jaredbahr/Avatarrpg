/**
 * Ba Dan village — the Act 1 hub and the only explore map in the slice.
 *
 * Bigger than a battlefield (24x16) so there is somewhere to wander, with the
 * camera panning by drag. Tapping an NPC opens their story node; walking onto
 * the east gate advances the current explore node.
 *
 * The shopkeeper has an `altNode`: once `ruon_traded` is set he is cold with
 * the party and his prices go up, which is the most visible consequence of the
 * Act 1 choice short of the boss fight itself.
 */

import type { MapDef } from '../../core/types';
import { LEGEND } from './legend';

export const BA_DAN_VILLAGE: MapDef = {
  id: 'ba_dan_village',
  backdrop: { url: 'art/maps/ba_dan_village.webp', pixelsPerTile: 64 },
  name: 'Ba Dan Village',
  kind: 'explore',
  width: 24,
  height: 16,
  ambience: 'village',
  legend: LEGEND,
  rows: [
    'TTTT,,,,,,,,,,,,,,TTTTTT',
    'TT,,,,BBBB,,BBBB,,,,,,TT',
    'T,,,,,BwwB,,BwwB,,,,,,,T',
    'T,,,,,Bww=,,=wwB,,,,,,,T',
    'T,,,,,,,,=,,=,,,,,,,,,,T',
    'T,,,,,,,,=====,,,,,,,,,T',
    'T,,,,,,,,=~~~=,,,,,,,,,T',
    '======================..',
    '======================..',
    'T,,,,,,,,=====,,,,,,,,,T',
    'T,,,,,BBB=,,,=BBBB,,,,,T',
    'T,,,,,Bww=,,,=BwwB,,,,,T',
    'T,,,,,BwwB,,,BwwB,,,,,,T',
    'T,,,,,BBBB,,,BBBB,,,,,,T',
    'TT,,,,,,,,,,,,,,,,,,,,TT',
    'TTTT,,,,,,,,,,,,,,TTTTTT',
  ],
  partySpawns: [{ x: 3, y: 7 }],
  exit: { pos: { x: 23, y: 7 }, label: 'The east road, toward the quarry' },
  npcs: [
    {
      id: 'riverside_sign',
      name: 'Riverside path',
      pos: { x: 18, y: 12 },
      sprite: 'npc.kid',
      node: 'riverside_invitation',
    },
    {
      id: 'elder_mira',
      name: 'Elder Mira',
      pos: { x: 11, y: 5 },
      sprite: 'npc.elder',
      node: 'mira_intro',
      routes: [{ when: { kind: 'flag', key: 'act1_complete', op: 'set' }, node: 'mira_epilogue' }],
    },
    {
      id: 'shopkeeper_gao',
      name: 'Gao the Shopkeeper',
      pos: { x: 7, y: 3 },
      sprite: 'npc.shopkeeper',
      node: 'gao_friendly',
      routes: [{ when: { kind: 'flag', key: 'ruon_traded', op: 'set' }, node: 'gao_cold' }],
    },
    {
      id: 'kid_pella',
      name: 'Pella',
      pos: { x: 12, y: 10 },
      sprite: 'npc.kid',
      node: 'pella_tips',
      // Ask her twice and she is still on about the cabbages.
      routes: [{ when: { kind: 'flag', key: 'pella_asked', op: 'set' }, node: 'pella_again' }],
    },
    {
      id: 'guard_dorin',
      name: 'Gate Guard Dorin',
      pos: { x: 20, y: 8 },
      sprite: 'npc.dorin',
      node: 'dorin_directions',
    },
  ],
  props: [],
};
