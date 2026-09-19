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
import { BA_DAN_SCENE, BA_DAN_COURTYARD_FOOTPRINTS, BA_DAN_COURT_TREES } from '../scenes/baDan';

export const BA_DAN_VILLAGE: MapDef = {
  id: 'ba_dan_village',
  projection: 'oblique',
  scene: BA_DAN_SCENE,
  backdrop: { url: 'art/maps/ba_dan_village.webp', pixelsPerTile: 64 },
  name: 'Ba Dan Village',
  kind: 'explore',
  width: 24,
  height: 16,
  ambience: 'village',
  legend: { ...LEGEND, l: { terrain: 'stone', blocked: true, blocksSight: false } },
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
  ].map((row, y) =>
    [...row]
      .map((tile, x) =>
        BA_DAN_COURT_TREES.some((p) => p.x === x && p.y === y)
          ? 'T'
          : BA_DAN_COURTYARD_FOOTPRINTS.some((p) => p.x === x && p.y === y)
            ? 'l'
            : tile,
      )
      .join(''),
  ),
  partySpawns: [{ x: 3, y: 7 }],
  exit: { pos: { x: 23, y: 7 }, label: 'The east road, toward the quarry' },
  npcs: [
    {
      id: 'riverside_sign',
      name: 'Riverside path',
      pos: { x: 18, y: 12 },
      sprite: 'npc.kid',
      interaction: 'route-sign',
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
      pos: { x: 9, y: 4 },
      sprite: 'npc.shopkeeper',
      node: 'gao_friendly',
      routes: [
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
      pos: { x: 12, y: 10 },
      sprite: 'npc.kid',
      node: 'pella_tips',
      routes: [
        { when: { kind: 'flag', key: 'act1_complete', op: 'set' }, node: 'pella_home' },
        { when: { kind: 'flag', key: 'pella_asked', op: 'set' }, node: 'pella_again' },
      ],
    },
    {
      id: 'guard_dorin',
      name: 'Gate Guard Dorin',
      pos: { x: 20, y: 8 },
      sprite: 'npc.dorin',
      node: 'dorin_directions',
      routes: [{ when: { kind: 'flag', key: 'act1_complete', op: 'set' }, node: 'dorin_home' }],
    },
  ],
  props: [],
};
