/**
 * MQ-02, Paper and Stone: Scenes 2.1 to 2.9, Saltstep (the trial slice of RG-02).
 *
 * Every line is the merged script's (`docs/story/scripts/act2-sparks.md`, #814, owner-reviewed),
 * word for word, with the game's curly quotes. The script's `Party:` lines are shown as a
 * narrator-framed "The party" line until a one-option tap exists (a choice needs two options and
 * a line needs a speaker; see `docs/pipeline-trial-log.md`, friction). The strings the script does
 * not give (option details, objectives) are the writing pass's.
 *
 * The driver: after an Act I win Bo-shan drives the cart; after a loss (`act1_lost`) Dorin does.
 * Where the script replaces a whole block, a `branch` on `act1_lost` runs one of two sequences
 * that rejoin; where it replaces one line, the node carries a variant.
 *
 * Hero variants. A hero's lines are extra nodes, and only an NPC route can choose a chain by who is
 * in the party, so a variant is wired where its scene starts at an NPC: Kaya's crates, Tenzo at the
 * bowl stall (`bowlStall`) and Jinu on the coast road after a loss (`lossRoad`, entered from the
 * coast-road sign's route in `maps/world.ts`). Each is the same chain again under its own ids,
 * ending on the hero's lines. Sura and Wen (2.4) and Riko (2.6) sit in the middle of the long
 * chain that runs from the customs stall through the fight, and wait for a `branch` that takes a
 * `Condition` (trial log, friction 3).
 *
 * Not wired yet (listed in the trial log): those three, Veyra's fight barks (no bark hook), and
 * the customs stall's drifting (the stall is an NPC on the quay).
 */
import type { Condition, DialogueVariant, StoryNode } from '../../../core/types';
import { PLACEHOLDER_PORTRAIT } from './placeholders';
import { staged } from './stage';

const LOST: Condition = { kind: 'flag', key: 'act1_lost', op: 'set' };
const DOCKS_LOST: Condition = { kind: 'flag', key: 'lost_saltstep_docks', op: 'set' };

const BO_SHAN = 'Bo-shan';
const BO_SHAN_PORTRAIT = 'portrait.bo_shan';
const DORIN = 'Gate Guard Dorin';
const DORIN_PORTRAIT = 'portrait.dorin';
const NARRATOR = 'portrait.narrator';
const PARTY = 'The party';
const VEYRA = 'Veyra';
const TAVI = 'Tavi Ren';
const CLERK = 'Customs clerk';
const HANDLER = 'Freight handler';
const BOWL_SELLER = 'Bowl-seller';
const TENZO = 'Tenzo';
const TENZO_PORTRAIT = 'portrait.tenzo';
const JINU = 'Jinu';
const JINU_PORTRAIT = 'portrait.jinu';

/** The second bowl is being carried: either way through Scene 2.2 (see `bowlStall`). */
const BOWL_CARRIED: Condition = {
  kind: 'any',
  of: [
    { kind: 'visited', nodeId: 'mq02_bowl_seller' },
    { kind: 'visited', nodeId: 'mq02_bowl_seller_tenzo' },
  ],
};

/** XP the winch fight pays a head (5 freight handlers at 120 over a baseline of 4 with Veyra). */
export const WINCH_XP_PER_HEAD = 150;

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

/** The driver's line: Bo-shan's, or Dorin's after an Act I loss. */
const driver = (
  id: string,
  boShan: readonly string[],
  dorin: readonly string[],
  next: string,
): StoryNode =>
  say(id, BO_SHAN, BO_SHAN_PORTRAIT, boShan, next, [
    { when: LOST, speaker: DORIN, portrait: DORIN_PORTRAIT, lines: dorin },
  ]);

const COAST_ROAD_OPENING =
  'The coast road drops out of the pines. Below it the bay is flat and grey. Far across the water, a row of lamps is burning in broad daylight.';

/**
 * Scene 2.1's loss branch, Dorin and Gao's receipt. In the data twice: the plain chain, and the
 * one a party with Jinu hears, which ends on her line about the courier office.
 */
const lossRoad = (suffix: '' | '_jinu', next: string): readonly StoryNode[] => [
  say(
    `mq02_coast_dorin${suffix}`,
    DORIN,
    DORIN_PORTRAIT,
    [
      'Those lamps were not lit last month. I have that in the watch book. I did not know what to write next to it, so I wrote “lamps”.',
      'Gao gave me this for you. And a second water skin. He counted them out loud.',
    ],
    `mq02_coast_receipt${suffix}`,
  ),
  say(
    `mq02_coast_receipt${suffix}`,
    'The Coast Road',
    NARRATOR,
    [
      'A delivery receipt, from the drawer where Gao keeps the debt slips. A stone carter left it on his counter. It is not for stone. “Received at Stoneback: six sealed crates. Sent on: stop fourteen, route nine, bell three.” It is stamped with a mark nobody in Ba Dan knows: a lamp over a wavy line.',
    ],
    `mq02_coast_dorin_receipt${suffix}`,
  ),
  say(
    `mq02_coast_dorin_receipt${suffix}`,
    DORIN,
    DORIN_PORTRAIT,
    [
      'That is all we have. There is no rubbing. The machine is still running, and Bo-shan’s delivery book is still up there with it. One receipt.',
      'A receipt is half of something. The courier office in Saltstep keeps the other halves. If the two say the same thing, it is evidence. If they don’t, it is two pieces of paper. I looked that up.',
      'Bo-shan’s customers are still waiting. Gao loaded what he could. I am going to deliver it. Nobody told me to.',
    ],
    next,
  ),
];

/**
 * Scene 2.2 at the bowl stall. In the data twice: the plain chain, and the one a party with Tenzo
 * hears, which ends on his exchange with the bowl-seller.
 */
const bowlStall = (suffix: '' | '_tenzo', next: string): readonly StoryNode[] => [
  say(
    `mq02_bowl_seller${suffix}`,
    BOWL_SELLER,
    NARRATOR,
    ['New faces. Sit. Here.'],
    `mq02_bowl_set_down${suffix}`,
  ),
  say(
    `mq02_bowl_set_down${suffix}`,
    'Saltstep',
    NARRATOR,
    ['She puts down two bowls of pepper broth. Then she taps the second one.'],
    `mq02_bowl_custom${suffix}`,
  ),
  say(
    `mq02_bowl_custom${suffix}`,
    BOWL_SELLER,
    NARRATOR,
    [
      'That one’s not yours. First bowl you eat. Second bowl you carry to somebody. That’s how it’s done here.',
    ],
    `mq02_bowl_who${suffix}`,
  ),
  say(
    `mq02_bowl_who${suffix}`,
    PARTY,
    NARRATOR,
    ['Carry it to who?'],
    `mq02_bowl_pump_woman${suffix}`,
  ),
  say(
    `mq02_bowl_pump_woman${suffix}`,
    BOWL_SELLER,
    NARRATOR,
    [
      'Anybody who hasn’t eaten. Today, the pump woman out on the freight pontoon. She’s been out there since the tide turned, and she never comes in.',
      'Bring the bowl back. People will tell you this custom is about kindness. It’s about me not washing bowls on a pontoon.',
    ],
    next,
  ),
];

const NODES: readonly StoryNode[] = [
  /* ------------------------------------------------- Scene 2.1, the coast road */
  say('mq02_coast_road', 'The Coast Road', NARRATOR, [COAST_ROAD_OPENING], 'mq02_coast_driver'),
  {
    id: 'mq02_coast_driver',
    kind: 'branch',
    flag: 'act1_lost',
    ifSet: 'mq02_coast_dorin',
    ifUnset: 'mq02_coast_boshan',
  },
  say(
    'mq02_coast_boshan',
    BO_SHAN,
    BO_SHAN_PORTRAIT,
    [
      'Somebody over there forgot to put them out. Or they want us to look.',
      'Mira gave me this for you. She said read it before Saltstep, not after. She knows me.',
    ],
    'mq02_coast_note',
  ),
  say(
    'mq02_coast_note',
    'The Coast Road',
    NARRATOR,
    [
      'A folded note, tucked into the delivery book. Mira’s handwriting leans to the left, like her awning.',
    ],
    'mq02_mira_note',
  ),
  say(
    'mq02_mira_note',
    'Mira’s note',
    // A letter shown as a card in the art pass; the narrator frame until then.
    PLACEHOLDER_PORTRAIT,
    [
      'The rubbing goes to the harbour customs office. So do the back pages of Bo-shan’s book, and the mark Senn copied off those crates. Ask who shipped that machine. Write down who will not answer. Eat something on the way. M.',
    ],
    'mq02_coast_stencil',
  ),
  say(
    'mq02_coast_stencil',
    'The Coast Road',
    NARRATOR,
    [
      'In the back of the delivery book, after the pages in the other hand, Senn has drawn the stencil from the sealed crates beside the Driller: a lamp over a wavy line. Under it, in his tallyman’s figures: “Not the quarry company’s. Not any carrier’s I know.”',
    ],
    'mq02_coast_boshan_stencil',
  ),
  say(
    'mq02_coast_boshan_stencil',
    BO_SHAN,
    BO_SHAN_PORTRAIT,
    [
      'I’ve seen every stencil that comes up the coast road. I’ve sat on most of them. I’ve never seen that one.',
      'Somebody counted crates out of my cart at night for two weeks and never wrote where they went. I’d like to ask them about that.',
    ],
    'mq02_coast_parcel',
  ),
  ...lossRoad('', 'mq02_coast_parcel'),
  // Jinu's moment (loss branch): the coast-road sign routes here when she is in the party.
  say(
    'mq02_coast_road_jinu',
    'The Coast Road',
    NARRATOR,
    [COAST_ROAD_OPENING],
    'mq02_coast_dorin_jinu',
  ),
  ...lossRoad('_jinu', 'mq02_jinu_other_half'),
  say(
    'mq02_jinu_other_half',
    JINU,
    JINU_PORTRAIT,
    [
      'Saltstep office, second drawer, under “returned, no such person”. That’s where a receipt’s other half goes when nobody claims it. I’ve filed a hundred. I never once wondered what they were for.',
    ],
    'mq02_coast_parcel',
  ),
  say(
    'mq02_coast_parcel',
    'The Coast Road',
    NARRATOR,
    [
      'The road levels out. The ostrich horse slows down by himself at a water trough, and waits until somebody notices.',
    ],
    'mq02_parcel',
  ),
  driver(
    'mq02_parcel',
    ['That’s Parcel. He stops where he thinks stops should be. Mostly he’s right.'],
    ['That’s Parcel. He stops when he likes. I have decided to call those inspections.'],
    // The cart reaches the market: the explore node moves the party to Saltstep, and the first
    // step in plays the arrival (the market's crossing trigger).
    'mq02_market_explore',
  ),

  /* ------------------------------------------ Scene 2.2, Saltstep, two bowls */
  say(
    'mq02_saltstep_arrival',
    'Saltstep',
    NARRATOR,
    [
      'Saltstep is a market on the water. Stalls sit on platforms that rise and drop with the tide. Tall poles show the water level in bright paint. Two sellers are arguing from boats that are slowly drifting apart.',
    ],
    'mq02_market_explore',
  ),
  {
    id: 'mq02_market_explore',
    kind: 'explore',
    mapId: 'saltstep_market',
    objective: 'Stop at the bowl stall on the quay.',
    objectiveTargetId: 'mq02_bowl_seller',
    objectiveVariants: [
      {
        when: {
          kind: 'any',
          of: [
            { kind: 'flag', key: 'inquiry_public', op: 'set' },
            { kind: 'flag', key: 'inquiry_quiet', op: 'set' },
          ],
        },
        text: 'Board Tavi’s ferry at the landing to cross the bay.',
        objectiveTargetId: 'mq02_tavi',
      },
      {
        when: BOWL_CARRIED,
        text: 'Carry the bowl and your papers to the customs stall with the flag.',
        objectiveTargetId: 'mq02_customs_clerk',
      },
    ],
    next: 'mq02_market_explore',
  },
  ...bowlStall('', 'mq02_market_explore'),
  // Tenzo's moment: the bowl-seller's NPC routes here when he is in the party.
  ...bowlStall('_tenzo', 'mq02_tenzo_broth'),
  say(
    'mq02_tenzo_broth',
    TENZO,
    TENZO_PORTRAIT,
    ['Pepper, river fish, and something sour right at the end. Pickled plum?'],
    'mq02_bowl_plum_skin',
  ),
  say(
    'mq02_bowl_plum_skin',
    BOWL_SELLER,
    NARRATOR,
    ['Pickled plum skin. The plum I eat myself.'],
    'mq02_tenzo_both_bowls',
  ),
  say(
    'mq02_tenzo_both_bowls',
    TENZO,
    TENZO_PORTRAIT,
    ['I’ll wash both bowls.'],
    'mq02_market_explore',
  ),
  say(
    'mq02_tavi',
    TAVI,
    PLACEHOLDER_PORTRAIT,
    [
      'Ferry goes when the tide says. The company wants it to go when the company says. So far the tide’s winning.',
      'You’re from up the stone road. You’ll want customs. It’s the stall with the flag, the one that’s drifting. Run.',
    ],
    'mq02_market_explore',
  ),
  say(
    'mq02_freight_office',
    'Saltstep',
    NARRATOR,
    [
      'A freight office with a clean brass plate: “Jin. Contracts and Carriage.” The shutter is half down.',
    ],
    'mq02_freight_clerk',
  ),
  say(
    'mq02_freight_clerk',
    'Freight clerk',
    NARRATOR,
    [
      'She’s across the bay. If it’s about a bill, leave it under the door. If it’s about a person, she’ll want it in writing.',
    ],
    'mq02_market_explore',
    [
      {
        when: { kind: 'flag', key: 'ruon_traded', op: 'set' },
        lines: [
          'Oh. It’s you. She said if you came by, I was to say the receipt still stands, and offer you tea. Do you want the tea?',
        ],
      },
    ],
  ),
  say(
    'mq02_miri_crates',
    'Saltstep',
    NARRATOR,
    [
      'Lantern crates, stacked by the ferry. Each one is stamped with a lantern with a crooked handle. A chalked note says: “Miri’s. Do not sit on these. This means you, Oko.”',
    ],
    'mq02_market_explore',
  ),
  // Kaya's opening (first exchange only): the crates' NPC routes here when she is in the party.
  say(
    'mq02_miri_crates_kaya',
    'Saltstep',
    NARRATOR,
    [
      'Lantern crates, stacked by the ferry. Each one is stamped with a lantern with a crooked handle. A chalked note says: “Miri’s. Do not sit on these. This means you, Oko.”',
    ],
    'mq02_kaya_forty_steps',
  ),
  say(
    'mq02_kaya_forty_steps',
    'Kaya',
    'portrait.kaya',
    ['She’s here. The shop’s here. It’s about forty steps that way.'],
    'mq02_kaya_reads_chalk',
  ),
  say(
    'mq02_kaya_reads_chalk',
    'Saltstep',
    NARRATOR,
    ['Kaya does not take the forty steps. She reads the chalk again instead.'],
    'mq02_kaya_after_customs',
  ),
  say(
    'mq02_kaya_after_customs',
    'Kaya',
    'portrait.kaya',
    ['After customs. I’ll go after customs.'],
    'mq02_market_explore',
  ),

  /* ------------------------------------- Scene 2.3, the customs stall drifts off */
  say(
    'mq02_stall_drifts',
    'The Customs Stall',
    NARRATOR,
    [
      'The customs office is a floating stall with a flag, a stool and a brass seal on a chain. A customs clerk and a freight handler are shouting across a crate.',
    ],
    'mq02_stall_count',
  ),
  say(
    'mq02_stall_count',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    ['It says nine crates. I count ten. I can count to ten. They test us.'],
    'mq02_stall_handler',
  ),
  say(
    'mq02_stall_handler',
    HANDLER,
    NARRATOR,
    [
      'Nine are freight. The tenth is safety materials. Safety materials don’t get counted, they get loaded. Tide’s going.',
    ],
    'mq02_stall_stool',
  ),
  say(
    'mq02_stall_stool',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    ['Everything gets counted. That’s why they gave me a stool.'],
    'mq02_stall_rope',
  ),
  say(
    'mq02_stall_rope',
    'The Customs Stall',
    NARRATOR,
    [
      'The handler slaps the mooring post to make his point. The rope was only looped. The stall, the clerk, the stool and the argument start to drift away from the quay.',
    ],
    'mq02_approach',
  ),
  {
    // Not a vote in the script: the decider picks, and all three arrive at Scene 2.4. The game
    // has one choice kind, the table vote (see the trial log, friction).
    id: 'mq02_approach',
    kind: 'choice',
    speaker: CLERK,
    portrait: PLACEHOLDER_PORTRAIT,
    prompt: 'This happens. Keep talking, I can still hear you!',
    footer: 'All three reach the clerk.',
    options: [
      {
        label: 'Jump aboard now.',
        detail: 'Land on the stall before the gap gets any wider. It will rock.',
        next: 'mq02_approach_jump',
      },
      {
        label: 'Follow along the pole walk.',
        detail: 'Keep level with the stall along the plank walk and shout across the water.',
        next: 'mq02_approach_walk',
      },
      {
        label: 'Ask Tavi for a tow.',
        detail: 'The ferry is at the landing, and Tavi has towed that stall back before.',
        next: 'mq02_approach_tow',
      },
    ],
  },
  say(
    'mq02_approach_jump',
    'The Customs Stall',
    NARRATOR,
    [
      'You land on the stall. It dips, the seal swings on its chain, and the clerk hands your papers back without looking. “Hold the flag. If the flag goes in the water I have to fill in the long form.”',
    ],
    'mq02_stall_reads',
  ),
  say(
    'mq02_approach_walk',
    'The Customs Stall',
    NARRATOR,
    [
      'You run the plank walk beside the level poles, past a wedding being argued about and a man selling one spoon. The stall stays level with you the whole way, close enough to shout at.',
    ],
    'mq02_stall_reads',
  ),
  say(
    'mq02_approach_tow',
    TAVI,
    PLACEHOLDER_PORTRAIT,
    ['Again? That’s the third time this month. Get in. Sit low. Don’t help.'],
    'mq02_stall_reads',
  ),
  {
    id: 'mq02_stall_reads',
    kind: 'branch',
    flag: 'act1_lost',
    ifSet: 'mq02_stall_receipt',
    ifUnset: 'mq02_stall_rubbing',
  },
  say(
    'mq02_stall_rubbing',
    'The Customs Stall',
    NARRATOR,
    [
      'However you get there, the clerk reads the rubbing, and then Senn’s drawing in the back of the delivery book, while the stall turns in a slow circle.',
    ],
    'mq02_stall_plate',
  ),
  say(
    'mq02_stall_plate',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    [
      'A Republic City plate. Came in four months back, in parts, on a Commonworks contractor’s manifest. I stamped it. “Excavation plant, public works.”',
      'And that stencil, the lamp over the wave. That’s Emberwatch stores. Everything the contractor lands goes across the bay first and comes back with that on it.',
    ],
    'mq02_stall_boshan_lamps',
  ),
  say(
    'mq02_stall_boshan_lamps',
    BO_SHAN,
    BO_SHAN_PORTRAIT,
    [
      'Commonworks. They put the lamps in at the Saltstep ferry. Good lamps. I’ve unloaded cabbages under them at midnight and counted every one. I didn’t know they sent drilling machines to people.',
    ],
    'mq02_stall_stamp',
  ),
  say(
    'mq02_stall_receipt',
    'The Customs Stall',
    NARRATOR,
    [
      'However you get there, the clerk reads Gao’s receipt while the stall turns in a slow circle. He sends a boy along the pole walk to the courier office. The boy comes back with the other half.',
    ],
    'mq02_stall_match',
  ),
  say(
    'mq02_stall_match',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    [
      'They match. Six sealed crates, landed here on a Commonworks contractor’s manifest. That stamp, the lamp over the wave, is Emberwatch stores. Everything the contractor lands goes across the bay first and comes back with that on it.',
      'Same contractor brought an excavating machine through in parts, four months back. From Republic City. I stamped that too.',
    ],
    'mq02_stall_dorin_lamps',
  ),
  say(
    'mq02_stall_dorin_lamps',
    DORIN,
    DORIN_PORTRAIT,
    [
      'Commonworks put the lamps in at the Saltstep ferry. I have stood under them. I did not know they also sent machines to quarries.',
    ],
    'mq02_stall_stamp',
  ),
  say(
    'mq02_stall_stamp',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    [
      'I stamp what the paper says. If the paper said “cabbages” I’d have stamped that. I want that understood before anybody is cross with me.',
      'The same contractor’s loading at the freight pontoon right now. Ten crates. Nine on paper.',
    ],
    'mq02_stall_bumps',
  ),
  say(
    'mq02_stall_bumps',
    'The Customs Stall',
    NARRATOR,
    ['The stall bumps to a stop against the freight pontoon.'],
    'mq02_pump_woman',
  ),

  /* ------------------------------------------------ Scene 2.4, the pump woman */
  say(
    'mq02_pump_woman',
    'The Freight Pontoon',
    NARRATOR,
    [
      'A woman in a dark blue work coat is kneeling on the pontoon beside a crated pump. Her cuffs have been mended more than once. So has the teapot beside her: there is a neat line of solder all the way round the spout.',
      'She is trying to walk the pump crate onto a handcart alone, one corner at a time.',
    ],
    'mq02_veyra_bollard',
  ),
  say(
    'mq02_veyra_bollard',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    [
      'If that’s for me, put it on the bollard. If you’re with the freight office, I already said no.',
    ],
    'mq02_party_broth',
  ),
  say(
    'mq02_party_broth',
    PARTY,
    NARRATOR,
    ['It’s a bowl of broth. The seller sent it.'],
    'mq02_veyra_bowl_back',
  ),
  say(
    'mq02_veyra_bowl_back',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    ['Did she say to bring the bowl back?'],
    'mq02_party_twice',
  ),
  say('mq02_party_twice', PARTY, NARRATOR, ['Twice.'], 'mq02_veyra_laughs'),
  say(
    'mq02_veyra_laughs',
    'The Freight Pontoon',
    NARRATOR,
    ['She laughs. It is a good laugh, and a slightly awkward one.'],
    'mq02_veyra_corner',
  ),
  say(
    'mq02_veyra_corner',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    [
      'Then I’d better eat it. Veyra. Take that corner, would you? Not that one. The one that looks heavier.',
    ],
    'mq02_corner_heavier',
  ),
  say(
    'mq02_corner_heavier',
    'The Freight Pontoon',
    NARRATOR,
    ['You take the corner. It is heavier.'],
    'mq02_veyra_pump',
  ),
  say(
    'mq02_veyra_pump',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    [
      'This goes to the low end of Saltstep. Hand pump. One person can work it, any person. No waiting on a crew to come and move the water for you.',
      'The last one I fitted, a girl of ten kept it going for an hour because she wanted to beat her brother. I’ve stopped fitting them for adults in my head. I fit them for her.',
    ],
    'mq02_pump_driver',
  ),
  {
    id: 'mq02_pump_driver',
    kind: 'branch',
    flag: 'act1_lost',
    ifSet: 'mq02_dorin_good_morning',
    ifUnset: 'mq02_boshan_tipping',
  },
  say(
    'mq02_boshan_tipping',
    BO_SHAN,
    BO_SHAN_PORTRAIT,
    [
      'You’ve got the rope the wrong way round. It’ll tip. I know tipping. I am a student of tipping.',
    ],
    'mq02_veyra_show_me',
  ),
  say('mq02_veyra_show_me', VEYRA, PLACEHOLDER_PORTRAIT, ['Show me.'], 'mq02_crate_tips'),
  say(
    'mq02_crate_tips',
    'The Freight Pontoon',
    NARRATOR,
    [
      'Bo-shan shows her. The crate tips anyway, slowly, onto the handcart, exactly where it was meant to go. They both look at it.',
    ],
    'mq02_boshan_on_purpose',
  ),
  say(
    'mq02_boshan_on_purpose',
    BO_SHAN,
    BO_SHAN_PORTRAIT,
    ['That was on purpose.'],
    'mq02_laugh_echo',
  ),
  say(
    'mq02_laugh_echo',
    'The Freight Pontoon',
    NARRATOR,
    [
      'He laughs. It carries across the flat water of the harbour.',
      'A moment later, from under the pontoon, the water gives the same laugh back. Smaller. Just once.',
    ],
    'mq02_veyra_odd',
  ),
  say(
    'mq02_dorin_good_morning',
    DORIN,
    DORIN_PORTRAIT,
    ['Good morning. Dorin, gate guard, Ba Dan. I am away from my gate with a permit.'],
    'mq02_veyra_other_corner',
  ),
  say(
    'mq02_veyra_other_corner',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    ['Good morning, Dorin, gate guard. Take the other corner.'],
    'mq02_dorin_echo',
  ),
  say(
    'mq02_dorin_echo',
    'The Freight Pontoon',
    NARRATOR,
    [
      'Dorin takes the corner. The crate goes onto the handcart with a bump. He straightens his collar.',
      'From under the pontoon, the water says it back: “Good morning.” Smaller. Just once.',
    ],
    'mq02_dorin_heard',
  ),
  say(
    'mq02_dorin_heard',
    DORIN,
    DORIN_PORTRAIT,
    ['I heard that. I am not going to write it down.'],
    'mq02_veyra_odd',
  ),
  say(
    'mq02_veyra_odd',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    ['Odd. The piles do that some days. I keep meaning to look into it.'],
    'mq02_veyra_tea',
  ),
  say(
    'mq02_veyra_tea',
    'The Freight Pontoon',
    NARRATOR,
    [
      'She pours the last of her tea into the pot’s lid, because there is only one cup, and holds the cup out to you.',
    ],
    'mq02_sling',
  ),

  /* ------------------------------------------------------ Scene 2.5, the sling */
  say(
    'mq02_sling',
    'The Freight Pontoon',
    NARRATOR,
    [
      'Across the pontoon, the freight handlers have the tenth crate in a crane sling. It swings out over the water. One strap is already fraying.',
    ],
    'mq02_clerk_put_down',
  ),
  say(
    'mq02_clerk_put_down',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    ['That’s the one! Put it down! I haven’t counted it!'],
    'mq02_handler_paid',
  ),
  say(
    'mq02_handler_paid',
    HANDLER,
    NARRATOR,
    ['We’re paid by the crate and the tide’s going. Count it at Emberwatch.'],
    'mq02_clerk_overboard',
  ),
  say(
    'mq02_clerk_overboard',
    'The Freight Pontoon',
    NARRATOR,
    [
      'The clerk grabs the sling rope. A handler shoves him. The clerk goes backwards off the stall into the harbour, with the stool.',
    ],
    'mq02_veyra_winch',
  ),
  say(
    'mq02_veyra_winch',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    ['Stop that winch. That strap is going. There are people under it.'],
    'mq02_handler_who',
  ),
  say('mq02_handler_who', HANDLER, NARRATOR, ['Who are you to say?'], 'mq02_veyra_strap'),
  say(
    'mq02_veyra_strap',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    ['Somebody who can see a strap.'],
    'mq02_lance',
  ),
  say(
    'mq02_lance',
    'The Freight Pontoon',
    NARRATOR,
    [
      'They do not stop the winch. Two more handlers step in front of it. Veyra picks up a long brass lance from beside the pump and thumbs a valve. It hisses.',
    ],
    'mq02_veyra_coming',
  ),
  say(
    'mq02_veyra_coming',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    ['I’d rather not. Are you coming?'],
    'mq02_winch_battle',
  ),
  {
    id: 'mq02_winch_battle',
    kind: 'battle',
    encounterId: 'enc_mq02_winch',
    next: 'mq02_winch_won',
    onDefeat: 'mq02_winch_lost',
  },
  say(
    'mq02_winch_won',
    'The Freight Pontoon',
    NARRATOR,
    [
      'The handlers lower the sling. Tavi poles the clerk back to the pontoon. He is still holding the seal.',
    ],
    'mq02_handler_docked',
  ),
  say(
    'mq02_handler_docked',
    HANDLER,
    NARRATOR,
    ['We get docked for every crate that misses the tide. You know that? Every one.'],
    'mq02_veyra_who_docks',
  ),
  say(
    'mq02_veyra_who_docks',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    ['I do now. Who docks you?'],
    'mq02_handler_contract',
  ),
  say(
    'mq02_handler_contract',
    HANDLER,
    NARRATOR,
    ['The contract. Nobody. It just comes out.'],
    'mq02_safety_materials',
  ),
  {
    /*
     * CARRY ON. Forgiving by default (owner, 2026-11-15): the lost fight pays what the win would
     * have, so the party reaches Emberwatch on the same level either way.
     */
    id: 'mq02_winch_lost',
    kind: 'flags',
    set: { lost_saltstep_docks: true },
    grantXp: WINCH_XP_PER_HEAD,
    next: 'mq02_barge_leaves',
  },
  say(
    'mq02_barge_leaves',
    'The Freight Pontoon',
    NARRATOR,
    [
      'The winch does not stop. The handlers swing the tenth crate onto their barge and push off. The strap gives as it lands. Something small and white drops out of the split corner and into the water.',
      'Veyra hooks it out with the tip of the lance before it sinks. Tavi hauls the clerk aboard.',
    ],
    'mq02_duplicate_manifest',
  ),
  say(
    'mq02_duplicate_manifest',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    [
      'I’ll write you a duplicate manifest. Nine crates on paper, ten on the water, and the name of the barge. Tavi will witness it. It takes a day. Everything takes a day.',
    ],
    'mq02_safety_materials',
  ),

  /* ---------------------------------------------- Scene 2.6, safety materials */
  say(
    'mq02_safety_materials',
    'The Freight Pontoon',
    NARRATOR,
    [
      'The tenth crate has split along one corner. It is stencilled “safety materials”. Inside there is straw, a coil of chain, and a flat paper packet tied with red string.',
    ],
    'mq02_pay_packet',
    [
      {
        when: DOCKS_LOST,
        lines: [
          'What Veyra hooked out of the water is a flat paper packet tied with red string. The ink has run, but not much.',
        ],
      },
    ],
  ),
  say(
    'mq02_pay_packet',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    ['That’s a pay packet. I know a pay packet. I get one.'],
    'mq02_clerk_reads',
  ),
  say(
    'mq02_clerk_reads',
    'The Freight Pontoon',
    NARRATOR,
    ['The clerk reads the front out loud, slowly.'],
    'mq02_wages',
  ),
  say(
    'mq02_wages',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    ['“Stoneback Quarry. Lower galleries crew. Wages, third month.” The seal’s never been broken.'],
    'mq02_rope_creaks',
  ),
  say(
    'mq02_rope_creaks',
    'The Freight Pontoon',
    NARRATOR,
    ['Nobody says anything. A rope creaks.'],
    'mq02_galleries',
  ),
  driver(
    'mq02_galleries',
    [
      'I was in those galleries. We were told the pay was late on the road.',
      'It wasn’t on the road. It was in a box.',
    ],
    [
      'Lower galleries. That is where they are keeping him. That is his crew’s money, and it is sitting in a box with a chain.',
    ],
    'mq02_veyra_somebodys_pay',
  ),
  say(
    'mq02_veyra_somebodys_pay',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    ['That shouldn’t be in there. That’s somebody’s pay.'],
    'mq02_veyra_hands_packet',
  ),
  say(
    'mq02_veyra_hands_packet',
    'The Freight Pontoon',
    NARRATOR,
    ['She turns the packet over, reads the back, and hands it to the clerk, not to you.'],
    'mq02_veyra_log_it',
  ),
  say(
    'mq02_veyra_log_it',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    [
      'Log it. Properly. Date and weight. Whoever packed that crate should have to explain it to somebody with a stamp.',
    ],
    'mq02_ferry_bell',
  ),
  say(
    'mq02_ferry_bell',
    'The Freight Pontoon',
    NARRATOR,
    ['Across the harbour, the ferry bell rings. She looks at the pump, and at the tide.'],
    'mq02_veyra_before_dark',
  ),
  say(
    'mq02_veyra_before_dark',
    VEYRA,
    PLACEHOLDER_PORTRAIT,
    [
      'I have to get this fitted before dark or forty households carry water another night. Thank you for the corner. And the bowl.',
      'Ask your questions loudly. People round here answer better when their neighbours are listening.',
    ],
    'mq02_veyra_leaves',
  ),
  say(
    'mq02_veyra_leaves',
    'The Freight Pontoon',
    NARRATOR,
    [
      'She wheels the handcart away along the pontoon. She has left the bowl on the bollard, rinsed.',
    ],
    'mq02_two_ways',
  ),

  /* ------------------------------------------ Scene 2.7, VOTE: loud or quiet */
  say(
    'mq02_two_ways',
    CLERK,
    PLACEHOLDER_PORTRAIT,
    [
      'I can do this two ways. I can read that packet out at the level pole at noon, with the seal in my hand. Everybody on the water will hear it. Including whoever packed it.',
      'Or I seal a copy, you carry it over the bay in your coat, and the first anyone at Emberwatch knows is you standing in the doorway.',
    ],
    'mq02_tavi_how_it_goes',
  ),
  say(
    'mq02_tavi_how_it_goes',
    TAVI,
    PLACEHOLDER_PORTRAIT,
    [
      'Loud, and my crews will talk to you. Half of them have carried a crate they didn’t like the weight of. Quiet, and they’ll wonder why you sat on a stolen pay packet. I’m only telling you how it’ll go.',
    ],
    'mq02_vote',
  ),
  {
    id: 'mq02_vote',
    kind: 'choice',
    speaker: 'The Customs Stall',
    portrait: NARRATOR,
    prompt: 'How does Ba Dan’s complaint start?',
    footer: 'Both ways cross the bay. The packet stays in the customs office either way.',
    options: [
      {
        label: 'Read it out at the level pole.',
        detail:
          'The market hears it. Dock workers come forward as witnesses. Emberwatch is warned before you arrive.',
        next: 'mq02_public',
        setFlags: { inquiry_public: true },
      },
      {
        label: 'Seal a copy and carry it quietly.',
        detail:
          'Nobody at Emberwatch is warned. Some people here will think you kept it to yourselves.',
        next: 'mq02_quiet',
        setFlags: { inquiry_quiet: true },
      },
    ],
  },
  say(
    'mq02_public',
    'Saltstep',
    NARRATOR,
    [
      'At noon the clerk stands on his stool at the level pole and reads the packet out, front and back. The boats stop drifting to listen.',
    ],
    'mq02_public_witnesses',
  ),
  {
    // After CARRY ON the handlers have gone with the barge: only the clerk and Tavi sign.
    id: 'mq02_public_witnesses',
    kind: 'branch',
    flag: 'lost_saltstep_docks',
    ifSet: 'mq02_public_two_sign',
    ifUnset: 'mq02_dock_worker',
  },
  say(
    'mq02_dock_worker',
    'Dock worker',
    NARRATOR,
    ['I loaded one of those. “Safety materials.” It clinked.'],
    'mq02_second_dock_worker',
  ),
  say(
    'mq02_second_dock_worker',
    'Second dock worker',
    NARRATOR,
    ['Mine didn’t clink. Mine was light as bread. I thought, safety must be mostly straw.'],
    'mq02_six_names',
  ),
  say(
    'mq02_six_names',
    'Saltstep',
    NARRATOR,
    ['By the time the clerk gets down, six people are waiting to give him their names.'],
    'mq02_market_explore',
  ),
  say(
    'mq02_public_two_sign',
    'Saltstep',
    NARRATOR,
    [
      'The handlers have gone with the barge. The clerk signs. Tavi signs under him, in letters as square as a hull.',
    ],
    'mq02_market_explore',
  ),
  say(
    'mq02_quiet',
    'Saltstep',
    NARRATOR,
    [
      'The clerk folds the copy small and seals it. A fish-seller at the next stall has stopped gutting to watch.',
    ],
    'mq02_fish_seller',
  ),
  say(
    'mq02_fish_seller',
    'Fish-seller',
    NARRATOR,
    ['That’s a quarry crew’s wages you’ve got folded up in there. I’d have thought you’d shout.'],
    'mq02_party_rest_of_it',
  ),
  say(
    'mq02_party_rest_of_it',
    PARTY,
    NARRATOR,
    ['We want to see who’s holding the rest of it.'],
    'mq02_fish_seller_mm',
  ),
  say(
    'mq02_fish_seller_mm',
    'Fish-seller',
    NARRATOR,
    ['Mm. Well. You’d know.'],
    'mq02_no_second_bowl',
  ),
  say(
    'mq02_no_second_bowl',
    'Saltstep',
    NARRATOR,
    ['She goes back to her fish. She does not offer a second bowl.'],
    'mq02_market_explore',
  ),

  /* -------------------------------------------- Scene 2.8, what Jin hears */
  say(
    'mq02_jin_hears_public',
    'Freight clerk',
    NARRATOR,
    [
      'I heard the whole thing from here. I’ve written it down and it goes over on the evening boat. Don’t look at me like that. Writing things down for her is the job.',
    ],
    'mq02_market_explore',
  ),
  say(
    'mq02_jin_hears_quiet',
    'Freight clerk',
    NARRATOR,
    [
      'Our handlers say a crate split and some strangers were stood round it. That goes over on the evening boat. I don’t know what was in it. I’ve found I sleep better.',
    ],
    'mq02_market_explore',
  ),

  /* --------------------------------------------------- Scene 2.9, the ferry */
  say(
    'mq02_ferry',
    'The Ferry',
    NARRATOR,
    [
      'Parcel will not walk up the ferry ramp. He stands at the bottom of it with both feet planted and looks at the sea.',
    ],
    'mq02_ferry_ramp',
  ),
  say(
    'mq02_ferry_ramp',
    TAVI,
    PLACEHOLDER_PORTRAIT,
    ['Give him a minute. First time on a boat, they all want to read the ramp.'],
    'mq02_ferry_parcel_boards',
  ),
  say(
    'mq02_ferry_parcel_boards',
    'The Ferry',
    NARRATOR,
    [
      'Tavi waits. Nobody pulls. After a while Parcel puts one foot on the plank, and then, as if it had been his idea all along, the rest of himself.',
    ],
    'mq02_long_blink',
  ),
  say(
    'mq02_long_blink',
    TAVI,
    PLACEHOLDER_PORTRAIT,
    [
      'This crossing’s called the Long Blink. Old pilots’ name. Halfway over, you blink, and the shore you left looks like the one you’re going to.',
      'Nine years I’ve made it with that headland dark. I’m not saying dark was better.',
    ],
    'mq02_lamps_come_on',
  ),
  say(
    'mq02_lamps_come_on',
    'The Ferry',
    NARRATOR,
    [
      'The rope comes off the post. Water opens between the ferry and the quay.',
      'Across the bay, on the old outpost, the lamps come on one after another, in a line.',
    ],
    'mq02_ferry_driver',
  ),
  {
    id: 'mq02_ferry_driver',
    kind: 'branch',
    flag: 'act1_lost',
    ifSet: 'mq02_ferry_dorin',
    ifUnset: 'mq02_ferry_boshan',
  },
  say(
    'mq02_ferry_boshan',
    BO_SHAN,
    BO_SHAN_PORTRAIT,
    ['Pella would count them.'],
    'mq02_ferry_counts',
  ),
  say('mq02_ferry_counts', 'The Ferry', NARRATOR, ['He counts them.'], 'mq03_parade_ground'),
  say(
    'mq02_ferry_dorin',
    DORIN,
    DORIN_PORTRAIT,
    ['Fourteen. No. Fifteen. I’ll count again on the other side, in case some of them are for us.'],
    'mq03_parade_ground',
  ),
];

/** Scene 2.1's nodes: all of it plays over Ba Dan as the cart leaves, beside the coast-road sign. */
const SCENE_2_1 = [
  'mq02_coast_road',
  'mq02_coast_boshan',
  'mq02_coast_note',
  'mq02_mira_note',
  'mq02_coast_stencil',
  'mq02_coast_boshan_stencil',
  'mq02_coast_dorin',
  'mq02_coast_receipt',
  'mq02_coast_dorin_receipt',
  'mq02_coast_road_jinu',
  'mq02_coast_dorin_jinu',
  'mq02_coast_receipt_jinu',
  'mq02_coast_dorin_receipt_jinu',
  'mq02_jinu_other_half',
  'mq02_coast_parcel',
  'mq02_parcel',
] as const;

/**
 * MQ-02, with each found conversation played over the market beside its person, and Scene 2.1
 * over Ba Dan beside the coast-road sign it starts from.
 */
export const MQ02_STORY: readonly StoryNode[] = staged(
  staged(
    NODES,
    'ba_dan_village',
    Object.fromEntries(SCENE_2_1.map((id) => [id, 'coast_road_sign'])),
  ),
  'saltstep_market',
  {
    mq02_bowl_seller: 'mq02_bowl_seller',
    mq02_bowl_seller_tenzo: 'mq02_bowl_seller',
    mq02_tavi: 'mq02_tavi',
    mq02_ferry: 'mq02_tavi',
    mq02_freight_office: 'mq02_freight_clerk',
    mq02_jin_hears_public: 'mq02_freight_clerk',
    mq02_jin_hears_quiet: 'mq02_freight_clerk',
    mq02_miri_crates: 'mq02_miri_crates',
    mq02_miri_crates_kaya: 'mq02_miri_crates',
    mq02_stall_drifts: 'mq02_customs_clerk',
  },
);
