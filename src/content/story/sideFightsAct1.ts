/**
 * Act I's optional side fights (the Ba Dan valley): SF-1.1, "The bend, again", on the Forest Road,
 * and SF-1.2, "Edge-on", in the Cutting.
 *
 * Lines are the merged script's (`docs/story/scripts/act1-side-fights.md`, #909), word for word. Its
 * outcome prose ("the four of them pull the handcart back…", "the slab is turned edge-on…") plays
 * as narrator lines, as SF-2.1's does.
 *
 * Both open once Act I is over, won (`demo_complete`) or lost (`act1_lost`), and close before the
 * coast road matters: Act I's four fights are tuned to exact levels, so nothing here can be played
 * earlier (the NPCs' `when` in `maps/world.ts`). Each pays `SIDE_FIGHT_XP` a head on a win (the
 * encounter's `xpPerHead`) and on "Carry on" (`grantXp`) alike, so a table that plays both reaches
 * level 5 before Saltstep, inside RG-02's band.
 *
 * Not built yet: what the bend took from the party on `lost_forest_road` (the script leaves it to
 * the build to name; a story issue asks the writing pass), and Ba Dan's trust rising after either
 * fight (community trust, C-25, has no mechanism yet).
 */
import type { Condition, DialogueVariant, StoryNode } from '../../core/types';
import type { StoryGroup } from '../regions/types';

/** XP each side fight pays a head, won or carried on (the script: "about 130 a head across the two"). */
export const SIDE_FIGHT_XP = 65;

const LOST: Condition = { kind: 'flag', key: 'act1_lost', op: 'set' };
const NARRATOR = 'portrait.narrator';
const LANFEN = 'Lanfen';
const LANFEN_PORTRAIT = 'portrait.dema';
// Bessa and Tolma have no portraits; the narrator frame stands in until the art pass.
const BESSA = 'Bessa';
const TOLMA = 'Tolma';
const BO_SHAN = 'Bo-shan';
const BO_SHAN_PORTRAIT = 'portrait.bo_shan';
const DORIN = 'Gate Guard Dorin';
const DORIN_PORTRAIT = 'portrait.dorin';

const say = (
  id: string,
  speaker: string,
  portrait: string,
  lines: readonly string[],
  next: string,
  variants?: readonly DialogueVariant[],
): StoryNode => ({
  id,
  kind: 'dialogue',
  speaker,
  portrait,
  lines,
  next,
  ...(variants ? { variants } : {}),
});

/** The driver after a loss is Dorin, as everywhere else in the scripts. */
const dorin = (lines: readonly string[]): DialogueVariant => ({
  when: LOST,
  speaker: DORIN,
  portrait: DORIN_PORTRAIT,
  lines,
});

/** Back to the map's explore node: the walk home's after a win, the occupied valley's after a loss. */
const backTo = (id: string, won: string, lost: string): StoryNode => ({
  id,
  kind: 'branchWhen',
  when: LOST,
  ifTrue: lost,
  ifFalse: won,
});

const NODES: readonly StoryNode[] = [
  /* ------------------------------------------- SF-1.1, The bend, again (optional) */
  say(
    'sf11_the_bend',
    LANFEN,
    LANFEN_PORTRAIT,
    ['That is my washing line on your cart. I know it is mine. It has a duck’s bite out of it.'],
    'sf11_bessa',
  ),
  say(
    'sf11_bessa',
    BESSA,
    NARRATOR,
    [
      'The company owes us two months. The road paid us for three weeks of it. We sell this lot over the hill and then we’re square with everybody.',
    ],
    'sf11_lanfen',
  ),
  say(
    'sf11_lanfen',
    LANFEN,
    LANFEN_PORTRAIT,
    ['Everybody except the people it belongs to.'],
    'sf11_bessa_else',
  ),
  say('sf11_bessa_else', BESSA, NARRATOR, ['...Everybody else.'], 'sf11_driver'),
  say(
    'sf11_driver',
    BO_SHAN,
    BO_SHAN_PORTRAIT,
    [
      'That crate is Dorin’s wheels. Forty of them, each the size of a plum. I carried it up from the coast myself. You can’t boast about a crate that small, so I never have. Until now.',
    ],
    'sf11_recognised',
    [
      dorin([
        'Those are my wheels. Forty, lime wood, for the lantern float. I entered them as lost on the fourth. I would like to correct the entry.',
      ]),
    ],
  ),
  {
    // The script's `lost_forest_road` beat: Bessa knows the party from the first fight.
    id: 'sf11_recognised',
    kind: 'branchWhen',
    when: { kind: 'flag', key: 'lost_forest_road', op: 'set' },
    ifTrue: 'sf11_bessa_sorry',
    ifFalse: 'sf11_battle',
  },
  say(
    'sf11_bessa_sorry',
    BESSA,
    NARRATOR,
    ['Oh. It’s you. ...I did say sorry at the time. You were lying down.'],
    'sf11_battle',
  ),
  {
    id: 'sf11_battle',
    kind: 'battle',
    encounterId: 'enc_sf11_the_bend',
    next: 'sf11_handcart_home',
    onDefeat: 'sf11_lost',
  },
  say(
    'sf11_handcart_home',
    'The East Road',
    NARRATOR,
    ['The four of them pull the handcart back to Ba Dan themselves.'],
    'sf11_won',
  ),
  say(
    'sf11_won',
    LANFEN,
    LANFEN_PORTRAIT,
    [
      'The province pays me for four hands on this road every spring. I have had two, and both of them are mine. Ditches, from the bend to the stream. A bowl at noon and a wage on the first. Bring my line back before you start.',
    ],
    'sf11_wheels',
  ),
  {
    // Carry on: a side fight pays its XP on a loss too (the script's rule for every side fight).
    id: 'sf11_lost',
    kind: 'flags',
    set: {},
    grantXp: SIDE_FIGHT_XP,
    next: 'sf11_over_the_hill',
  },
  say(
    'sf11_over_the_hill',
    'The East Road',
    NARRATOR,
    [
      'They get the handcart over the hill, but the wheel crate splits on the way and forty small wheels roll back down the road.',
      'The ducklings find the last of them by evening.',
    ],
    'sf11_thirty_nine',
  ),
  say(
    'sf11_thirty_nine',
    LANFEN,
    LANFEN_PORTRAIT,
    ['Thirty-nine. The duck can keep whichever one it took.'],
    'sf11_wheels',
  ),
  {
    // The script's loss branch, after either ending: Dorin's line about the float.
    id: 'sf11_wheels',
    kind: 'branchWhen',
    when: LOST,
    ifTrue: 'sf11_redesign',
    ifFalse: 'sf11_back',
  },
  say(
    'sf11_redesign',
    DORIN,
    DORIN_PORTRAIT,
    ['Thirty-nine wheels is nine axles and a spare. I will redesign the float.'],
    'sf11_back',
  ),
  backTo('sf11_back', 'forest_return_explore', 'forest_explore'),

  /* ------------------------------------------------------ SF-1.2, Edge-on (optional) */
  say(
    'sf12_the_slab',
    TOLMA,
    NARRATOR,
    [
      'Nothing with wheels. If I let the cabbages through today, tomorrow there’s a stone cart with one cabbage sat on top of it.',
    ],
    'sf12_driver',
  ),
  say(
    'sf12_driver',
    BO_SHAN,
    BO_SHAN_PORTRAIT,
    ['That’s a good trick. I’d have thought of that.'],
    'sf12_ruon',
    [dorin(['I have a manifest. I can show that every item on it is a cabbage.'])],
  ),
  {
    // One of two lines, by what the table did with Ruon at the gate.
    id: 'sf12_ruon',
    kind: 'branchWhen',
    when: { kind: 'flag', key: 'ruon_traded', op: 'set' },
    ifTrue: 'sf12_ruon_traded',
    ifFalse: 'sf12_ruon_spared',
  },
  say(
    'sf12_ruon_spared',
    TOLMA,
    NARRATOR,
    [
      'Ruon held that gate two months for the same money we didn’t get. Say so, to whoever judges him.',
    ],
    'sf12_bo',
  ),
  say(
    'sf12_ruon_traded',
    TOLMA,
    NARRATOR,
    ['You sold Ruon for a key. He was owed the same as us. I’ll hear the cabbages out. Not you.'],
    'sf12_bo',
  ),
  {
    id: 'sf12_bo',
    kind: 'branchWhen',
    when: { kind: 'partyHas', characterId: 'bo' },
    ifTrue: 'sf12_bo_crew',
    ifFalse: 'sf12_sets_her_feet',
  },
  say(
    'sf12_bo_crew',
    'Bo',
    'portrait.bo',
    [
      'I ran a crew of nine. I got to seven weeks before I stopped counting what we were owed. Turn the slab a quarter. I’ll show you where.',
    ],
    'sf12_sets_her_feet',
  ),
  say(
    'sf12_sets_her_feet',
    'The Cutting',
    NARRATOR,
    ['She sets her feet. The slab doesn’t move. Everything else on the road does.'],
    'sf12_battle',
  ),
  {
    id: 'sf12_battle',
    kind: 'battle',
    encounterId: 'enc_sf12_edge_on',
    next: 'sf12_edge_on',
    onDefeat: 'sf12_lost',
  },
  say(
    'sf12_edge_on',
    'The Cutting',
    NARRATOR,
    ['The slab is turned edge-on. A farm cart fits past it. A stone cart does not.'],
    'sf12_won',
  ),
  say(
    'sf12_won',
    TOLMA,
    NARRATOR,
    [
      'Edge-on. Huh. Cabbages through, stone stays. I can hold that all winter, and feed my lot while I do it.',
    ],
    'sf12_back',
    [
      {
        when: LOST,
        lines: [
          'Edge-on. Huh. Cabbages through, stone stays. I can hold that until the company comes down here and talks.',
        ],
      },
    ],
  ),
  {
    id: 'sf12_lost',
    kind: 'flags',
    set: {},
    grantXp: SIDE_FIGHT_XP,
    next: 'sf12_backs_the_cart',
  },
  say(
    'sf12_backs_the_cart',
    'The Cutting',
    NARRATOR,
    [
      'The driver backs the cart down the road and the party sleeps beside it.',
      'In the morning the slab is standing edge-on. Nobody on the picket will say who turned it.',
    ],
    'sf12_wind',
  ),
  say('sf12_wind', TOLMA, NARRATOR, ['Wind.'], 'sf12_back'),
  backTo('sf12_back', 'cutting_return_explore', 'cutting_after_explore'),
];

/** Each conversation plays over its own map, the camera keeping the person it is with (#628). */
const STAGED: Readonly<Record<string, { mapId: string; npc: string }>> = {
  sf11_the_bend: { mapId: 'forest_road', npc: 'sf11_bessa' },
  sf11_bessa: { mapId: 'forest_road', npc: 'sf11_bessa' },
  sf11_lanfen: { mapId: 'forest_road', npc: 'sf11_bessa' },
  sf11_bessa_else: { mapId: 'forest_road', npc: 'sf11_bessa' },
  sf11_driver: { mapId: 'forest_road', npc: 'sf11_bessa' },
  sf11_bessa_sorry: { mapId: 'forest_road', npc: 'sf11_bessa' },
  sf12_the_slab: { mapId: 'ambush_road', npc: 'sf12_tolma' },
  sf12_driver: { mapId: 'ambush_road', npc: 'sf12_tolma' },
  sf12_ruon_spared: { mapId: 'ambush_road', npc: 'sf12_tolma' },
  sf12_ruon_traded: { mapId: 'ambush_road', npc: 'sf12_tolma' },
  sf12_bo_crew: { mapId: 'ambush_road', npc: 'sf12_tolma' },
  sf12_sets_her_feet: { mapId: 'ambush_road', npc: 'sf12_tolma' },
};

export const SIDE_FIGHTS_ACT1_STORY: readonly StoryNode[] = NODES.map((node) => {
  const stage = STAGED[node.id];
  if (!stage || node.kind !== 'dialogue') return node;
  return { ...node, presentation: { mapId: stage.mapId, stage: { npc: stage.npc } } };
});

export const SIDE_FIGHTS_ACT1_GROUP: StoryGroup = {
  slug: 'side-fights-act1',
  title: 'Act I side fights',
  source: 'sideFightsAct1.ts',
  nodes: SIDE_FIGHTS_ACT1_STORY,
};
