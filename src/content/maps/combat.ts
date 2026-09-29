/**
 * The four Act 1 battlefields. All 20x12, which fits on a Surface in landscape
 * with the HUD docked without the camera ever having to scroll during a fight.
 *
 * Each map is built around one teaching idea:
 *   forest_road   puddles in the middle  -> Wet, Frozen, Shocked
 *   quarry_gate   oil by the gatehouse   -> fire spreads
 *   ambush_road   a narrow cutting       -> chokepoints and pushes
 *   quarry_floor  ledges, oil and mud    -> the boss rewrites the ground
 *
 * Party spawns use the same staggered pattern on every map: two columns two
 * tiles apart, alternating rows. Two measurements shaped it. Bunched into a
 * 2x3 block, a party of six was a single blast template and the simulator
 * wiped one on the oil map every other run. Strung out down the whole left
 * edge, the opposite happened — the party reached the boss in ones and twos
 * and the win rate collapsed. This is the middle: no 3x3 catches more than
 * about three of them, and they still start as a group.
 */

import type { MapDef, PropPlacement, Vec2 } from '../../core/types';
import { LEGEND } from './legend';
import { FOREST_ROAD_SCENE } from '../scenes/forestRoad';
import { QUARRY_GATE_SCENE } from '../scenes/quarryGate';
import { CUTTING_SCENE, DRILLER_FLOOR_SCENE } from '../scenes/quarryProjected';

/** Shared because every combat map uses the same staggered party entrance. */
const COMBAT_PARTY_SPAWNS: readonly Vec2[] = [
  { x: 1, y: 3 },
  { x: 3, y: 4 },
  { x: 1, y: 5 },
  { x: 3, y: 6 },
  { x: 1, y: 7 },
  { x: 3, y: 8 },
];

/** Compact authored placement form for the prop-heavy quarry maps. */
const propAt = (propId: string, x: number, y: number): PropPlacement => ({
  propId,
  pos: { x, y },
});

export const FOREST_ROAD: MapDef = {
  id: 'forest_road',
  projection: 'oblique',
  scene: FOREST_ROAD_SCENE,
  backdrop: { url: 'art/maps/forest_road.webp', pixelsPerTile: 80 },
  name: 'The Forest Road',
  kind: 'combat',
  width: 20,
  height: 12,
  ambience: 'forest',
  legend: LEGEND,
  /*
   * The road's footprint is shaped inside the 20x12 grid (M3): a pine wall with
   * three clearings closes the north, the through-road leaves through rows 4-8
   * on both sides, and the south is a deep-water creek (`W`) between alders. Every
   * walkable border cell is either one of those two exit mouths or covered by the
   * `edges` entries below, which is what `edgeContract: 'enforce'` holds it to.
   *
   * The interactables are the authored ground, not props: the central nine-cell
   * puddle is the Wet/Frozen/Shocked lesson and the shove target (the encounter
   * tells the player to put a bandit in it), and the two rubble heaps at (7,3)
   * and (8,9) are cover. This map authors no barrels, oil or braziers — those
   * belong to the Quarry Gate.
   */
  rows: [
    'TTTT,,TTTTTTTT,TTTTT',
    'TT,,,,,TTT,,,,,,^^TT',
    'T,,,,,,,,,,,,,,^^^^A',
    ',,,,,,,r,,,,,,,,^^^^',
    '====================',
    ',====~~~====,,,,,,^^',
    ',,==~~~~====,,,,,,,^',
    ',,===~~=====,,,,,,,,',
    ',,================,,',
    ',,,,,,,,r,,,,,,,,,,,',
    'T,,,WW,,,,,,,,,T,,,T',
    'TTWWWWWTTTTTWWWWWTTT',
  ],
  partySpawns: COMBAT_PARTY_SPAWNS,
  npcs: [],
  props: [],
  /*
   * The authored border claims. North keeps its truncated pines and the deer
   * paths between them; the south creek and alders are in-grid barriers. The
   * five-cell exit mouths occupy rows 4-8 on both sides and are deliberately
   * absent from these edge bands. West rows 3 and 9 and east rows 0-3 and 9
   * retain their authored edge treatments.
   */
  edges: [
    { side: 'north', span: [0, 19], treatment: 'band' },
    { side: 'south', span: [0, 19], treatment: 'barrier' },
    { side: 'west', span: [3, 3], treatment: 'band' },
    { side: 'west', span: [9, 9], treatment: 'band' },
    { side: 'east', span: [0, 3], treatment: 'band' },
    { side: 'east', span: [9, 9], treatment: 'band' },
  ],
  edgeContract: 'enforce',
};

export const QUARRY_GATE: MapDef = {
  id: 'quarry_gate',
  projection: 'oblique',
  scene: QUARRY_GATE_SCENE,
  backdrop: { url: 'art/maps/quarry_gate.webp', pixelsPerTile: 80 },
  name: 'The Quarry Gate',
  kind: 'combat',
  width: 20,
  height: 12,
  ambience: 'quarry',
  legend: LEGEND,
  rows: [
    'XXXX######GG######XX',
    'XX^^#....#..#....#^X',
    'X^^..........c....^X',
    '.....c....oo.......^',
    '..........oo........',
    '===========oo=======',
    '===========oo=======',
    '..........oo........',
    '.....c....oo.......^',
    'X^^...........c...^X',
    'XX^^#....#..#....#^X',
    'XXXX######GG######XX',
  ],
  partySpawns: COMBAT_PARTY_SPAWNS,
  npcs: [],
  /*
   * The encounter's intro has promised "barrels stacked against the gatehouse"
   * since Phase 1, and there were never any barrels. Now there are.
   *
   * The brazier is the interesting one. It sits at (10,5), one tile west of the
   * oil stripe, so a single Shove — which every party member has — tips it into
   * the oil and lights the whole channel. That is the play the map is built
   * around: available to the least experienced person at the table, obvious once
   * seen, and genuinely dangerous to whoever is standing too close.
   */
  props: [
    propAt('brazier', 10, 5),
    propAt('water_barrel', 14, 3),
    propAt('water_barrel', 14, 8),
    /*
     * Which SIDE of the oil channel a hazard sits on decides whether it is a
     * tool or a trap, and the simulator was blunt about it. At (9,4), on the
     * party's own approach lane, the flask spilled oil across the ground six
     * players had to walk over and the full-table win rate fell to 40%. One
     * tile group east, past the channel, and the same flask reads as 95% — it
     * now extends the hazard toward the people you are fighting.
     */
    propAt('oil_flask', 12, 4),
    /*
     * Pella's cart, turned away at the gate, sitting on the road behind the
     * party. Same lesson: at (13,6) it walled off the escape lane exactly when
     * the oil caught (40%); behind the party it is cover on the approach, and
     * average deaths at a full table drop from 4.1 to 3.2.
     */
    propAt('cabbage_cart', 6, 6),
  ],
  /*
   * The four-cell dead ends at each rim are an exterior spoil bank / curtain
   * wall band. Rows 5-6 remain the full-width M2 road mouths and are declared
   * by connectAct1's multi-tile exits, not narrowed into a single crossing.
   */
  edges: [
    { side: 'west', span: [3, 4], treatment: 'band' },
    { side: 'west', span: [7, 8], treatment: 'band' },
    { side: 'east', span: [3, 4], treatment: 'band' },
    { side: 'east', span: [7, 8], treatment: 'band' },
  ],
  edgeContract: 'enforce',
};

export const AMBUSH_ROAD: MapDef = {
  id: 'ambush_road',
  projection: 'oblique',
  scene: CUTTING_SCENE,
  backdrop: { url: 'art/maps/ambush_road.webp', pixelsPerTile: 80 },
  name: 'The Cutting',
  kind: 'combat',
  width: 20,
  height: 12,
  ambience: 'forest',
  legend: LEGEND,
  /*
   * A chokepoint, not a clearing (M5, Option A). Rows 4-7 are the only place
   * the road leaves the cutting, so the board is a four-wide corridor with the
   * runoff pool in its middle, two tier-1 ledges facing each other across it,
   * and everything else closed down to `X` rock. The NE ledge (14-17, 1-3)
   * holds the crossbow and the NW ledge (2-5, 1-2) is the party's answer; the
   * sergeant arrives on the SE bench (17-18, 9 / 14-17, 10) and the tea bay
   * (2-7, 9, with its lookout at 3-5, 10) sits under the southwest rim.
   *
   * The pool only reaches x6-9 and rows 4 and 7 are open wall-to-wall, so the
   * pinch is two dry lanes plus a wade rather than single file. Between the two
   * halves of the board, the only walking crossing is x9-10 on rows 4-7, which
   * is what keeps `crossing()` at column 8 impossible to slip past.
   *
   * Rock faces, not tier-2 paving: the old map's walkable `A` slabs and its six
   * 0-to-2 steps are gone, so every adjacent pair of walkable cells is exactly
   * one tier apart, which is the rule E4 climbing assumes. North and south are
   * the cut faces themselves, painted on the ground page (`quarry-rock.ts`):
   * the north faces stand up to two courses with drill scars, and the south
   * run's only face is a one-course sawn lip at the board's edge, so no rock
   * stands between the camera and the southern bays.
   *
   * Every walkable border cell is either one of the two four-cell road mouths
   * that `connectAct1` declares as M2 exits, or one of the three bands below;
   * `edgeContract: 'enforce'` holds the map to that.
   */
  rows: [
    'XXXXXXXXXXXXXXXXXXXX',
    'XXX^^^XXXXXXXX^^^XXX',
    'XX^^,,r,XXXXX,^^^^XX',
    ',,,,,,,,,XX,,r,^^^,X',
    '====================',
    '=====,~~~~====,,,,,=',
    '=====,~~~~====,,,,,=',
    '====================',
    ',,,,,,r,,XX,,r,,,,,,',
    'XX,,,,,,XXXXX,,,,^^X',
    'XXX^^^XXXXXXXX^^^^XX',
    'XXXXXXXXXXXXXXXXXXXX',
  ],
  partySpawns: COMBAT_PARTY_SPAWNS,
  npcs: [],
  props: [],
  /*
   * The flanks the road does not cover: (0,3), (0,8) and (19,8) stay walkable,
   * so rule-space needs them claimed. West, each stands against the gate's
   * cribbed spoil bank (`CUTTING_BAND_TOPS`); east, the front edge, against the
   * surround's low rock, never open ground running off the board.
   */
  edges: [
    { side: 'west', span: [3, 3], treatment: 'band' },
    { side: 'west', span: [8, 8], treatment: 'band' },
    { side: 'east', span: [8, 8], treatment: 'band' },
  ],
  edgeContract: 'enforce',
};

export const QUARRY_FLOOR: MapDef = {
  id: 'quarry_floor',
  projection: 'oblique',
  scene: DRILLER_FLOOR_SCENE,
  backdrop: { url: 'art/maps/quarry_floor.webp', pixelsPerTile: 80 },
  name: 'The Quarry Floor',
  kind: 'combat',
  width: 20,
  height: 12,
  ambience: 'quarry',
  legend: LEGEND,
  rows: [
    'AAA^^..........^^AAA',
    'AA^^....r..r....^^AA',
    '^^.....oo..oo.....^^',
    '.......oo..oo.......',
    '..r.....#...........',
    '..........mm........',
    '..........mm........',
    '..r........#........',
    '.......oo..oo.......',
    '^^.....oo..oo.....^^',
    'AA^^....r..r....^^AA',
    'AAA^^..........^^AAA',
  ],
  partySpawns: COMBAT_PARTY_SPAWNS,
  npcs: [],
  /*
   * Pella's side quest, paid out three fights later and never announced.
   *
   * Ask a child in the village about her missing brother and his produce cart is
   * on the quarry floor when you get there — parked beside the mud the driller
   * churns up, which is exactly where you want something that knocks people over
   * and blinds them. A party that never spoke to her fights this without it, and
   * nobody ever tells them what they missed.
   */
  props: [
    propAt('rubble_pile', 6, 7),
    propAt('rubble_pile', 13, 4),
    propAt('water_barrel', 12, 6),
    propAt('brazier', 10, 3),
    {
      propId: 'cabbage_cart',
      pos: { x: 9, y: 6 },
      when: { kind: 'flag', key: 'pella_asked', op: 'set' },
    },
  ],
};

export const COMBAT_MAPS: readonly MapDef[] = [FOREST_ROAD, QUARRY_GATE, AMBUSH_ROAD, QUARRY_FLOOR];
