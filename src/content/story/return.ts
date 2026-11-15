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

const NARRATOR = 'portrait.narrator';
const TABLE = 'Mira’s Table';
const PELLA = 'Pella';
const BO_SHAN = 'Bo-shan';

type Turn = readonly [id: string, speaker: string, portrait: string, lines: readonly string[]];

/** A staged exchange, one speaker per node, each turn leading to the next. */
function reunion(turns: readonly Turn[], then: string): StoryNode[] {
  return turns.map(([id, speaker, portrait, lines], index) => ({
    id,
    kind: 'dialogue',
    speaker,
    portrait,
    lines,
    next: turns[index + 1]?.[0] ?? then,
  }));
}

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
      'The workers are returning to Ba Dan. Ba Dan lies west; Kuan is at the rest stop if you need a pause.',
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
      'The road bends, and Ba Dan is below: cooking smoke, the canal, the gate with someone sitting beside it.',
      'They stand up so fast that the stool goes over. Then the gate bell starts, and it does not stop.',
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
      'I set out bowls for a month and took them in clean. Tonight I have run out of bowls.',
      'Sit down, all of you. Nobody carries anything else tonight.',
    ],
    next: 'reunion_run',
  },
  /*
   * The reunion (canon DLG-07; story bible C-14), staged rather than told:
   * Pella and Bo-shan at Mira's table, his covered bowl from `mira_table_bowl`,
   * and it ends on sitting down. Bo-shan speaks in the narrator frame until
   * the owner approves his portrait. Nothing interrupts it: no reveal, no tally.
   */
  ...reunion(
    [
      [
        'reunion_run',
        TABLE,
        NARRATOR,
        [
          'Pella comes down the lane at a run. She reaches Bo-shan and tries to say something, and nothing comes out.',
          'She hugs him hard enough that he winces. She notices, and loosens her grip.',
        ],
      ],
      ['reunion_all_right', BO_SHAN, NARRATOR, ['I’m all right.']],
      ['reunion_shaking', PELLA, 'portrait.pella', ['You’re shaking.']],
      ['reunion_sit', BO_SHAN, NARRATOR, ['I know. Let me sit down a minute.']],
      [
        'reunion_sleeve',
        TABLE,
        NARRATOR,
        ['She keeps hold of his sleeve all the way to the table.'],
      ],
      ['reunion_tuesday', PELLA, 'portrait.pella', ['You said Tuesday.']],
      ['reunion_i_did', BO_SHAN, NARRATOR, ['I did.']],
      ['reunion_waited', PELLA, 'portrait.pella', ['I waited by the road.']],
      ['reunion_sorry', BO_SHAN, NARRATOR, ['I’m sorry.']],
      [
        'reunion_bowl',
        TABLE,
        NARRATOR,
        ['Mira sets his covered bowl in front of him and lifts the cloth.'],
      ],
      ['reunion_hot', 'Elder Mira', 'portrait.mira', ['Careful. It’s hot.']],
      ['reunion_thanks', BO_SHAN, NARRATOR, ['Thank you.']],
      [
        'reunion_kept',
        PELLA,
        'portrait.pella',
        ['She kept making it. In case you came back hungry.'],
      ],
    ],
    'welcome_home_gao',
  ),
  {
    id: 'welcome_home_gao',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'Bowls are on the table, and there’s more in the pot. Don’t stack them. Last time somebody stacked them, I lost three.',
      'Ruon walked down the hill beside you and never once tried to run. He is standing at the end of the table now. Nobody has told him he may sit, and he has not asked.',
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
    next: 'welcome_home_supper',
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
          'The crew says your firebender asked the guard by the oil barrels where he’d like to be standing once things caught. He picked somewhere else entirely.',
          'I’m putting all of it in the watch book, so it’s done properly. Does “mecha-driller” have a dash in it?',
        ],
      },
    ],
  },
  /*
   * The supper, and the boot (saga outline, decision 23; story bible C-30): a
   * worker's lost boot comes back to a Ba Dan doorstep with a river shell in
   * it, and nobody explains it. Latch returns the other boot in MQ-07. It is
   * Hesra's, which plants her outsider's background in passing (C-33): she is
   * a hill-farm girl lodging at the mason's yard as an apprentice. Pella's
   * lost shoe (`pella_home`) is a different story and stays one.
   */
  {
    id: 'welcome_home_supper',
    kind: 'dialogue',
    speaker: 'Ba Dan',
    portrait: 'portrait.narrator',
    lines: [
      'Lamps come on along the canal. Gao carries out a pot of soup big enough to sit in, and the whole village squeezes around Mira’s table.',
      'At the end of the bench, Bo-shan has fallen asleep sitting up. Pella slides his bowl out from under his chin and keeps hold of his sleeve.',
      'Late that night, Hesra finds a boot on the step of the mason’s yard, where she lodges.',
      'It is the one she lost in the galleries, hobnailed the hill-farm way. She walked home in the other boot and a sock.',
      'She tips it up. A river shell drops into her palm, still wet, with sand in its ridges.',
      'She looks up the lane and down it. Then she sets the shell on the windowsill and the boot by the door.',
    ],
    next: 'cart_departure',
  },
  /*
   * Bo-shan takes the reins (saga outline, decisions 8 and 9; story bible
   * C-32). He gets the bigger life he wanted, and it costs Pella. The cart is
   * the one Pella told the party to look for, home from the quarry floor.
   * Leto, Ba Dan's cart driver hired from the coast, and Amri, who came from
   * Saltstep about five years ago, each get one passing detail (C-33). Staged
   * as an interlude on the empty-cart painting until the art batch.
   */
  {
    id: 'cart_departure',
    kind: 'dialogue',
    speaker: 'Ba Dan',
    portrait: 'portrait.narrator',
    lines: [
      'Bo-shan’s cart comes down from the quarry floor with one wheel tied on with rope. Gao and Bo-shan mend it by lamplight, and by morning it runs true.',
      'Gao finds an axle pin at the back of his shop. Leto, who drove the coast road before Mira hired him, rehangs the harness the coast way, and nobody argues.',
      'Bo-shan loads the cart himself, piled higher than anyone thinks is sensible.',
      'Amri brings him a letter for Saltstep, addressed to a street she has not lived on for five years. He tucks it under the seat.',
      'He climbs up and takes the reins. In the early light, half the village has come to the east gate to see him off.',
      'Pella has not. Her shutter is open the width of a hand.',
      'Bo-shan looks at the shutter for a long moment. Then he shakes the reins, and the ostrich horse leans into the harness.',
    ],
    variants: [
      {
        // SQ-01's persistent change: he has learned to stack, mostly.
        when: SQ01_RESOLVED,
        lines: [
          'Bo-shan’s cart comes down from the quarry floor with one wheel tied on with rope. Gao and Bo-shan mend it by lamplight, and by morning it runs true.',
          'Gao finds an axle pin at the back of his shop. Leto, who drove the coast road before Mira hired him, rehangs the harness the coast way, and nobody argues.',
          'Bo-shan loads the cart himself, low and even. Then he sets one enormous cabbage on the very top.',
          'Amri brings him a letter for Saltstep, addressed to a street she has not lived on for five years. He tucks it under the seat.',
          'He climbs up and takes the reins. In the early light, half the village has come to the east gate to see him off.',
          'Pella has not. Her shutter is open the width of a hand.',
          'Bo-shan looks at the shutter for a long moment. Then he shakes the reins, and the ostrich horse leans into the harness.',
        ],
      },
    ],
    next: 'demo_complete',
  },
  {
    id: 'demo_complete',
    kind: 'end',
    title: 'Home to Ba Dan',
    lines: [
      'The cart rattles down to the coast road. There is room in the back, and you are in it, wedged between the sacks.',
    ],
    teaser:
      'Across the bay, in a Fire Nation outpost that has been dark for nine years, the lamps come on, one by one.',
    recap: {
      label: 'Demo complete',
      thanks:
        'Thank you for playing. The road plays differently with a different party, so try another one.',
      choices: [
        {
          when: { kind: 'flag', key: 'gate_talked_through', op: 'set' },
          text: 'At the quarry gate, you talked Captain Ruon into opening it.',
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
          text: 'At the quarry gate, your firebender talked the guard by the oil barrels off his post.',
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
          when: {
            kind: 'any',
            of: [
              { kind: 'flag', key: 'sq02.gate', op: 'eq', value: 'quiet' },
              { kind: 'flag', key: 'sq02.gate', op: 'eq', value: 'public' },
            ],
          },
          text: 'You helped Dorin find out why the side gate never opened.',
        },
        {
          when: { kind: 'flag', key: 'sq02.gate', op: 'eq', value: 'mocked' },
          text: 'You laughed the side gate open. Dorin wrote something down.',
        },
        {
          when: { kind: 'flag', key: 'sq03.ledger', op: 'eq', value: 'extension' },
          text: 'You helped Gao ask the wholesaler for more time, and kept his neighbours’ names out of it.',
        },
        {
          when: { kind: 'flag', key: 'sq03.ledger', op: 'eq', value: 'fund' },
          text: 'You helped Ba Dan start a food jar at Gao’s, with no names on it.',
        },
        {
          when: { kind: 'flag', key: 'sq03.ledger', op: 'eq', value: 'praised' },
          text: 'You told the square about Gao’s other ledger. He had asked you not to.',
        },
        {
          when: { kind: 'flag', key: 'world.ducks_seen', op: 'set' },
          text: 'You stopped for Lanfen’s ducklings on the Forest Road.',
        },
        {
          when: { kind: 'flag', key: 'world.tea_shared', op: 'set' },
          text: 'You shared Kuan’s tea in the Cutting.',
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
    speaker: 'Lanfen',
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
    speaker: 'Kuan',
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
