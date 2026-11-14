import type { Condition, ResidentProfile, StoryNode } from '../../core/types';
import { RETURNEE_IDS } from '../residents/returnees';
import { SQ01_FLAG, SQ01_RESOLVED } from './sq01Cabbages';

const profilesAre = (...profiles: ResidentProfile[]): Condition => ({
  kind: 'all',
  of: RETURNEE_IDS.map((residentId) => ({
    kind: 'residentProfile',
    residentId,
    in: profiles,
  })),
});

const RESTING_PROFILES = Object.fromEntries(RETURNEE_IDS.map((id) => [id, 'resting'])) as Readonly<
  Record<(typeof RETURNEE_IDS)[number], ResidentProfile>
>;

export const RETURNEES_RETURNING: Condition = profilesAre('returning');
export const RETURNEES_HOME: Condition = {
  kind: 'any',
  of: [
    profilesAre('resting', 'recovering', 'ready'),
    {
      kind: 'all',
      of: [{ kind: 'flag', key: 'act1_complete', op: 'set' }, profilesAre('missing')],
    },
  ],
};

/** The four village homecomings are remembered by the existing story visit log. */
export const VILLAGE_HOMECOMINGS_COMPLETE: Condition = {
  kind: 'all',
  of: [
    { kind: 'visited', nodeId: 'mira_epilogue' },
    { kind: 'visited', nodeId: 'pella_home' },
    {
      kind: 'any',
      of: [
        { kind: 'visited', nodeId: 'gao_home' },
        { kind: 'visited', nodeId: 'gao_home_cold' },
      ],
    },
    { kind: 'visited', nodeId: 'dorin_home' },
  ],
};

/** Victory frees the route for a walk home; custody and optional visits still matter. */
export const RETURN_STORY: readonly StoryNode[] = [
  {
    id: 'quarry_after_explore',
    kind: 'explore',
    mapId: 'quarry_floor',
    objective: 'The five workers are returning with you. Take the west path towards Ba Dan.',
    next: 'cutting_return_explore',
  },
  {
    id: 'cutting_return_explore',
    kind: 'explore',
    mapId: 'ambush_road',
    objective:
      'The workers are returning to Ba Dan. Ba Dan lies west; Sen is at the rest stop if you need a pause.',
    next: 'gate_return_explore',
  },
  {
    id: 'gate_return_explore',
    kind: 'explore',
    mapId: 'quarry_gate',
    objective:
      'The workers are returning. The gate is open; follow the forest road west to Ba Dan.',
    next: 'forest_return_explore',
  },
  {
    id: 'forest_return_explore',
    kind: 'explore',
    mapId: 'forest_road',
    objective: 'The five workers are returning. Continue west to Ba Dan.',
    next: 'forest_return_arrival',
  },
  {
    id: 'forest_return_arrival',
    kind: 'dialogue',
    speaker: 'The West Road',
    portrait: 'portrait.narrator',
    lines: [
      'The west road reaches the edge of Ba Dan.',
      'The returning group crosses into the village together.',
    ],
    next: 'forest_return_arrived',
  },
  {
    id: 'forest_return_arrived',
    kind: 'flags',
    set: {},
    residentProfiles: RESTING_PROFILES,
    next: 'village_return_explore',
  },
  /*
   * The demo's ending (owner, 2026-11-11): the first step into Ba Dan after the
   * walk home crosses `welcome_home` (maps/world.ts), and the village comes out
   * to meet the party. It plays on arrival, not after the four homecoming talks,
   * so nobody who misses one of them misses the ending; those talks stay in the
   * free roam after the card. Each speaker pays off one thing the party did.
   */
  {
    id: 'welcome_home_mira',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'There you are! Dorin rang the gate bell so hard that half the street came out still holding their spoons.',
      'Five people walked out of that quarry, and every one of them asked for soup first. I have never been so happy to cook.',
      'Sit down, all of you. Nobody carries anything else tonight.',
    ],
    next: 'welcome_home_gao',
    variants: [
      {
        when: { kind: 'flag', key: 'pella_asked', op: 'set' },
        lines: [
          'There you are! Dorin rang the gate bell so hard that half the street came out still holding their spoons.',
          'Pella reached Bo-shan before I did. She told him about his chores first. Then she held on to him and would not let go.',
          'Sit down, all of you. Nobody carries anything else tonight.',
        ],
      },
    ],
  },
  {
    id: 'welcome_home_gao',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'Bowls are on the table, and there’s more in the pot. Don’t stack them. Last time somebody stacked them, I lost three.',
      'Ruon walked down the hill beside you and never once tried to run. Here, the families can ask him their questions. That’s right.',
      'And I want my water skins back. I counted them out, and I’m counting them in.',
    ],
    next: 'welcome_home_dorin',
    variants: [
      {
        when: { kind: 'flag', key: 'ruon_traded', op: 'set' },
        lines: [
          'Bowls are on the table, and there’s more in the pot. Don’t stack them. Last time somebody stacked them, I lost three.',
          'The workers are home, and I’ll feed every one of them. But the families wanted to ask Ruon why. Jin has him now, and I don’t like it.',
          'Leave the water skins on the counter. We’ll talk in the morning.',
        ],
      },
    ],
  },
  {
    id: 'welcome_home_dorin',
    kind: 'dialogue',
    speaker: 'Gate Guard Dorin',
    portrait: 'portrait.dorin',
    lines: [
      'The crew says you knocked on the quarry gate and fought your way in. When I knocked, I came straight home.',
      'I’m putting all of it in the watch book, so it’s done properly. Does “mecha-driller” have a dash in it?',
    ],
    next: 'demo_complete',
    variants: [
      {
        when: { kind: 'flag', key: 'gate_talked_through', op: 'set' },
        lines: [
          'The crew says you talked the quarry gate open without a single fight. I practised a speech for that gate all week. Nobody let me use it.',
          'I’m putting all of it in the watch book, so it’s done properly. Does “mecha-driller” have a dash in it?',
        ],
      },
      {
        when: { kind: 'flag', key: 'lost_quarry_gate', op: 'set' },
        lines: [
          'The crew says the slings chased you down the switchbacks, and you climbed straight back up. I would have sat down for a while first.',
          'I’m putting all of it in the watch book, so it’s done properly. Does “mecha-driller” have a dash in it?',
        ],
      },
      {
        when: { kind: 'flag', key: 'gate_fire_bluff', op: 'set' },
        lines: [
          'The crew says your firebender stared the deserter right out of the way. I tried a stern voice on that gate. It didn’t work on anybody.',
          'I’m putting all of it in the watch book, so it’s done properly. Does “mecha-driller” have a dash in it?',
        ],
      },
    ],
  },
  {
    id: 'demo_complete',
    kind: 'end',
    title: 'Home to Ba Dan',
    lines: [
      'Lamps come on along the canal. Gao carries out a pot of soup big enough to sit in, and the whole village squeezes around Mira’s table.',
      'Somewhere under the noise, Bo-shan is explaining that he could have lifted the driller by himself.',
    ],
    teaser:
      'Across the bay, lamps burn in a Fire Nation outpost closed nine years ago. A supply boat ties up at its jetty.',
    recap: {
      label: 'Demo complete',
      thanks:
        'Thank you for playing. The road plays differently with a different party, so try another one.',
      choices: [
        {
          when: { kind: 'flag', key: 'gate_talked_through', op: 'set' },
          text: 'At the quarry gate, your earthbender talked Captain Ruon into opening it.',
        },
        {
          when: { kind: 'flag', key: 'lost_quarry_gate', op: 'set' },
          text: 'At the quarry gate, the crew drove you back, and you climbed up again.',
        },
        {
          when: {
            kind: 'all',
            of: [
              { kind: 'flag', key: 'gate_fire_bluff', op: 'set' },
              { kind: 'flag', key: 'lost_quarry_gate', op: 'unset' },
            ],
          },
          text: 'At the quarry gate, your firebender bluffed the deserter aside.',
        },
        {
          when: {
            kind: 'all',
            of: [
              { kind: 'flag', key: 'gate_talked_through', op: 'unset' },
              { kind: 'flag', key: 'gate_fire_bluff', op: 'unset' },
              { kind: 'flag', key: 'lost_quarry_gate', op: 'unset' },
            ],
          },
          text: 'At the quarry gate, you knocked and fought your way in.',
        },
        {
          when: { kind: 'flag', key: 'ruon_spared', op: 'set' },
          text: 'You brought Captain Ruon home to answer to the families.',
        },
        {
          when: { kind: 'flag', key: 'ruon_traded', op: 'set' },
          text: 'You traded Captain Ruon to Jin for the quarry key.',
        },
        {
          when: { kind: 'flag', key: 'pella_asked', op: 'set' },
          text: 'You listened to Pella, and her brother’s cabbage cart helped on the quarry floor.',
        },
        {
          when: {
            kind: 'any',
            of: [
              { kind: 'flag', key: SQ01_FLAG, op: 'eq', value: 'families' },
              { kind: 'flag', key: SQ01_FLAG, op: 'eq', value: 'crew' },
            ],
          },
          text: 'You found Bo-shan’s tipped sled and sent his cabbages where they were needed.',
        },
        {
          when: { kind: 'flag', key: SQ01_FLAG, op: 'eq', value: 'leverage' },
          text: 'You found Bo-shan’s tipped sled and hid his cabbages to bargain with.',
        },
        {
          when: { kind: 'flag', key: 'world.ducks_seen', op: 'set' },
          text: 'You stopped for Dema’s ducklings on the Forest Road.',
        },
        {
          when: { kind: 'flag', key: 'world.tea_shared', op: 'set' },
          text: 'You shared Sen’s tea in the Cutting.',
        },
      ],
    },
    next: 'village_return_explore',
  },
  {
    id: 'village_return_explore',
    kind: 'explore',
    mapId: 'ba_dan_village',
    objective: 'The workers are home. Talk with Mira, Pella, Gao or Dorin, or visit the river.',
    objectiveVariants: [
      {
        when: VILLAGE_HOMECOMINGS_COMPLETE,
        text: "You've caught up with the village. Rest by the river, or explore the roads.",
      },
    ],
    // Audit link only: Ba Dan has exits, so the welcome home is entered by its trigger.
    next: 'welcome_home_mira',
  },
  {
    id: 'pella_home',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: [
      'My brother is home. Bo-shan. He came through the gate and I ran so fast I lost a shoe.',
      'He went back for it. I told him he was not allowed to go anywhere else.',
      'Thank you for finding him.',
    ],
    variants: [
      {
        // SQ-01: the party found his sled. Her list of helpers waits for the next talk.
        when: SQ01_RESOLVED,
        lines: [
          'You found him. I hugged him so hard his hat came off. Then I told him about the sled.',
          'He says the cabbages were only a little bit high. You saw them. They were not a little bit high.',
          'He is asleep now. I am making a list while he cannot argue.',
        ],
      },
      {
        // The return lands in the evening (D2); this hold lasts until she is heard.
        when: {
          kind: 'all',
          of: [
            { kind: 'flag', key: 'pella_asked', op: 'set' },
            { kind: 'phase', in: ['dawn', 'morning', 'midday', 'afternoon'] },
          ],
        },
        lines: [
          'You found him. He came through the gate and I ran so fast I lost a shoe.',
          'I told him about the chores. He said he would do them. All of them.',
          'He said he would start straight away. He is still asleep.',
        ],
      },
      {
        when: { kind: 'flag', key: 'pella_asked', op: 'set' },
        lines: [
          'You found him. He came through the gate and I ran so fast I lost a shoe.',
          'I told him about the chores. He said he would do them. All of them.',
          'He can start tomorrow. He is asleep now.',
        ],
      },
    ],
    next: 'village_return_explore',
  },
  {
    id: 'gao_home',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'Leave your packs by the door. There is rice in the pot.',
      'Bo-shan tried to pay me. Still had the vegetable money tied into his belt. I sent him home to his sister.',
      'You can return the water skins later. Eat while it is hot.',
    ],
    next: 'village_return_explore',
  },
  {
    id: 'gao_home_cold',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'The workers are home. I am glad of that. There is rice if you want it.',
      'I still wish you had brought Ruon here. These families should have heard him answer for the gate.',
      'If you find out where Jin took him, tell Mira.',
    ],
    next: 'village_return_explore',
  },
  {
    id: 'dorin_home',
    kind: 'dialogue',
    speaker: 'Gate Guard Dorin',
    portrait: 'portrait.dorin',
    lines: [
      'I saw them coming round the bend. Pella was through the gate before I could call her.',
      'Everyone who could walk is back. We took the handcart for the others.',
      'Go and see Mira. I will keep watch here.',
    ],
    variants: [
      {
        // Off the post in the evening and at night: Hanru has the watch (§4).
        when: { kind: 'phase', in: ['evening', 'night'] },
        lines: [
          'I saw them coming round the bend. Pella was through the gate before I could call her.',
          'Everyone who could walk is back. We took the handcart for the others.',
          'Hanru has the watch tonight. I stayed to see them in.',
        ],
      },
    ],
    next: 'village_return_explore',
  },
  {
    id: 'dema_home',
    kind: 'dialogue',
    speaker: 'Dema',
    portrait: 'portrait.dema',
    lines: [
      'The crews came past. A few stopped to ask about the stream.',
      'They will look at the settling pit when they are fit to work. There is still plenty of silt down here.',
      'The ducks can stay on the bank for now. Go home. Mira will be waiting.',
    ],
    next: 'forest_return_explore',
  },
  {
    id: 'sen_home',
    kind: 'dialogue',
    speaker: 'Sen',
    portrait: 'portrait.sen',
    lines: [
      'They came through just ahead of you. Filled this bench and most of the ground around it.',
      'I went through all the tea. Sit a moment; I have hot water left.',
      'Gao is feeding everyone in Ba Dan. Take the west road when you are ready.',
    ],
    next: 'cutting_return_explore',
  },
  {
    id: 'riverside_mira_home',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'I spent the morning moving beds. Everyone wants their relatives to stay in the same room.',
      'They are all home. I keep going back to check.',
      'Sit with me a while. The washing can wait.',
    ],
    next: 'riverside_explore',
  },
];
