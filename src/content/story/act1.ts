/**
 * Act 1: The Quarry of Ba Dan.
 *
 * A directed graph of story nodes. Every `next`, `ifSet`, `ifUnset`, `onDefeat`
 * and option target must resolve to another node id — the content-validation
 * test walks the whole graph and fails CI on a dangling link, which is the one
 * class of bug that would otherwise strand a family mid-session.
 *
 * The branch: Captain Ruon surrenders after the gate fight.
 *   escort him  -> `ruon_spared`, an extra ambush, and Ruon fights beside you
 *   trade him   -> `ruon_traded`, no ambush, but Jin's mercenaries are waiting
 *                  at the boss and Gao the shopkeeper will not look at you
 *
 * Choice descriptions state the consequences; the players judge Ruon themselves.
 */

import type { Condition, ResidentProfile, StoryNode } from '../../core/types';
import { RETURNEE_IDS } from '../residents/returnees';
import { RETURNEES_HOME } from './return';

const RETURNING_PROFILES = Object.fromEntries(
  RETURNEE_IDS.map((id) => [id, 'returning']),
) as Readonly<Record<(typeof RETURNEE_IDS)[number], ResidentProfile>>;

/**
 * What opens the gate talk (story bible C-07, C-08): Bo's crew work, Lin Mei's
 * survey eye, or what any party learned on the Forest Road below, from Lanfen
 * or from the flood marker. Never an element on its own.
 */
export const GATE_TALK_EARNED: Condition = {
  kind: 'any',
  of: [
    { kind: 'partyHas', characterId: 'bo' },
    { kind: 'partyHas', characterId: 'lin_mei' },
    { kind: 'flag', key: 'world.ducks_seen', op: 'set' },
    { kind: 'flag', key: 'world.discovered.runoff_marker', op: 'set' },
  ],
};

export const ACT1_NODES: readonly StoryNode[] = [
  /* --------------------------------------------------------------- Prologue */
  /*
   * The flash-forward (saga outline, decision 3; story bible C-28): a storm
   * inside a machine, long after Act I. No names and no faces, and nothing
   * that names the place or the woman at the valve (the reveal ladder). The
   * final battle replays it with names. Its stills are placeholder cards
   * until the art batch (`interludes.ts`); the last line cuts to Ba Dan.
   */
  {
    id: 'prologue_storm',
    kind: 'dialogue',
    speaker: 'The Storm',
    portrait: 'portrait.narrator',
    lines: [
      'Rain hammers on an iron roof, somewhere far overhead.',
      'Below the roof, water comes in under a steel door. Ankle-deep. Then deeper. A lantern swings on its hook and throws the shadows around.',
      'Somewhere in the dark a turbine is screaming. The sound climbs past anything a machine is meant to make.',
      'Red lamps flash down a gallery, one after another. A gauge needle leans hard against its pin and shivers there.',
      'A hand closes on a valve wheel. A woman’s hand, the knuckles scraped, a ring of grease worn into the thumb.',
      'She leans her whole weight on the wheel. It does not move.',
      'A drop falls from a pipe into the water at her feet. The water ripples once. A breath later, it ripples again.',
      'Then only the rain.',
      'Morning, far from there. In Ba Dan, someone has set bowls along an outdoor table, more than anyone will eat from today.',
    ],
    next: 'act1_open',
  },

  /* ---------------------------------------------------------------- Opening */
  {
    id: 'act1_open',
    kind: 'dialogue',
    speaker: 'Ba Dan',
    portrait: 'portrait.narrator',
    lines: [
      'Ba Dan lies below a limestone quarry, its houses built from the same pale stone as the hill.',
      'Every week, a cart of cut stone comes down from the quarry. Gao opens his shop early for the crew; by noon, the whole square is white with dust.',
      'The cart has not come for a month. Gao still opens early. By noon he has swept a square with nothing on it.',
    ],
    next: 'village_explore',
  },

  /* -------------------------------------------------------------- The hub */
  {
    id: 'village_explore',
    kind: 'explore',
    mapId: 'ba_dan_village',
    objective: 'Talk to Elder Mira, then take the east road to the quarry.',
    objectiveTargetId: 'elder_mira',
    objectiveVariants: [
      {
        when: RETURNEES_HOME,
        text: 'The workers are home. Talk with Mira, Pella, Gao or Dorin, or visit the river.',
        objectiveTargetId: null,
      },
      {
        when: { kind: 'visited', nodeId: 'mira_intro' },
        text: 'Take the east road to the quarry. You can speak with the neighbors before you leave.',
        objectiveTargetId: 'forest_road',
      },
    ],
    next: 'road_depart',
  },

  {
    id: 'mira_intro',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'Come in. There is rice if you have not eaten. We need to talk about the quarry.',
      'No carts for a month. I sent four people to find out why. None came home.',
      'Dorin went as far as the gate yesterday. They have guards now. Would not let him through.',
      'I can offer you food and a bed here. I wish it were more. Will you look for our people?',
    ],
    next: 'village_explore',
  },
  {
    id: 'mira_epilogue',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'Bo-shan came through the gate ahead of you. Pella has not let go of his sleeve.',
      'Bo-shan and all four messengers are home. I have counted everyone twice. They keep telling me to stop.',
      'You can stay as long as you need. Leave your washing by the door.',
    ],
    variants: [
      {
        when: { kind: 'flag', key: 'ruon_spared', op: 'set' },
        lines: [
          'Bo-shan and all four messengers are home. I have counted everyone twice. They keep telling me to stop.',
          'Dorin is taking Ruon’s statement. Bring me the maker-plate rubbing too; I’ll attach both to the province report.',
          'You can stay too. Gao has food ready, and I will find you a bed.',
        ],
      },
      {
        when: { kind: 'flag', key: 'ruon_traded', op: 'set' },
        lines: [
          'Bo-shan and all four messengers are home. Thank you for bringing them out.',
          'I wish Ruon were here to answer their questions. I will write to the province and ask where Jin delivered him.',
          'Bring me the maker-plate rubbing too; the province should know what the quarry was running. For now, go and eat.',
        ],
      },
    ],
    next: 'mira_rubbing',
  },
  /*
   * The rubbing from the driller's plate changes hands (#628). Mira routes to
   * `mira_rubbing_kept` once she has it, so a second visit never asks again.
   */
  {
    id: 'mira_rubbing',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'Is that the rubbing? Hold that corner flat for me.',
      'Republic City. Somebody paid to bring that machine a long way. It goes in the report, and the province can tell me who.',
    ],
    next: 'mira_rubbing_given',
  },
  {
    id: 'mira_rubbing_given',
    kind: 'flags',
    set: { rubbing_given: true },
    next: 'village_return_explore',
  },
  {
    id: 'mira_rubbing_kept',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'The rubbing is folded into the province report. Dorin asked to copy the maker’s mark into his watch book first.',
      'Go and eat. Gao has kept bowls for you.',
    ],
    next: 'village_return_explore',
  },
  {
    id: 'gao_friendly',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'For the quarry? Water skins are by the door. Take one. You can pay me when everyone is home.',
      'Check the stopper. Dorin brought one back empty and told me it leaked. I filled it, turned it upside down, and we stood there watching it.',
      'Then he asked if I had any more water.',
      'The cutting holds water after rain. If there is trouble up there, pick where you stand before it starts.',
    ],
    next: 'village_explore',
  },
  {
    id: 'gao_cold',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'Jin came through with Ruon. Rope round his wrists.',
      'He should answer for what happened up there. Here, where the families can hear him. What is Jin going to do with him?',
      "No. Leave the water skins on the counter. We're done.",
    ],
    next: 'village_explore',
  },
  /*
   * The side quest, and it is deliberately tiny.
   *
   * Talk to a child about her brother and a cabbage cart turns up on the boss
   * map to help you — a real mechanical reward for a completely optional
   * conversation, assembled entirely out of pieces that already exist: one flag,
   * one conditional prop placement. Nobody is told it happened. The payoff is
   * finding out three fights later that the funny thing you did mattered.
   */
  {
    id: 'pella_tips',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: [
      "You're going to the quarry? I can show you the way. I know it. Mira keeps saying I'm too little.",
      'My brother took vegetables up before Mira sent the others. Bo-shan. That makes five missing. He was supposed to be back on Tuesday.',
      'He says a lightning strike can go right across a puddle. He saw it happen to a whole crew. He also says he can lift an ostrich horse, so I would ask someone else.',
      'Mira says “the missing people” every time. She could say his name. She knows his name.',
      "Look for the cart with cabbages piled above the seat. Tell him I'm not doing his chores again this week.",
    ],
    next: 'pella_asked',
  },
  {
    id: 'pella_asked',
    kind: 'flags',
    set: { pella_asked: true },
    // SQ-01's entry: Pella hands over her copy of his packing list.
    next: 'sq01_packing_list',
  },
  {
    id: 'pella_again',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: [
      'He puts the cabbages on top of the turnips. Every bump, one falls off.',
      'If you find him, tell him to leave the cart. He can just come home.',
    ],
    next: 'village_explore',
  },
  {
    id: 'dorin_directions',
    kind: 'dialogue',
    speaker: 'Gate Guard Dorin',
    portrait: 'portrait.dorin',
    lines: [
      'East road, then the switchbacks. About two hours. Longer if the mud is bad.',
      'I got as far as the gate yesterday. There were workers up on the wall with slings. Would not answer me.',
      'Mira wants me here in case anyone makes it back. If you find someone who can walk, send them down. I will watch for them.',
    ],
    next: 'village_explore',
  },

  /* ------------------------------------------------------------ The road */
  {
    id: 'road_depart',
    kind: 'dialogue',
    speaker: 'The East Road',
    portrait: 'portrait.narrator',
    lines: [
      'The road climbs between the pines. Rainwater fills the wheel ruts, and wet needles cling to your boots.',
      'At the bend, a boot scrapes on stone. Someone is standing behind the trees.',
    ],
    next: 'forest_explore',
  },
  {
    id: 'battle_forest_road',
    kind: 'battle',
    encounterId: 'enc_forest_road',
    next: 'after_forest',
    onDefeat: 'defeat_forest',
  },
  /*
   * Losing does not send you back to the start of the fight.
   *
   * A wipe used to point straight at the battle again, which makes defeat a
   * chore and makes a five-year-old cry. Now it costs you something in the
   * story and the story carries on: you lose the fight, you lose your provisions, and
   * you go on up the hill anyway, carrying a flag that people will mention.
   *
   * The compensating XP is not generosity, it is arithmetic. All the XP for a
   * fight is paid on victory (reducer.ts gates it behind `if (victory)`), so a
   * defeat route that skipped it would arrive at the next fight under-levelled
   * and progression.test.ts would fail — correctly. 100 is this encounter's
   * 300-XP roster split across a baseline party of three.
   */
  {
    id: 'defeat_forest',
    kind: 'dialogue',
    speaker: 'Ba Dan',
    portrait: 'portrait.narrator',
    lines: [
      'You wake beside the road with grit in your mouth. Your food is gone. The robbers left the empty wrapping in your pocket.',
      'Nothing seems broken. Getting upright still takes a while.',
      'Their tracks lead uphill, towards the quarry.',
    ],
    next: 'lost_forest_road',
  },
  {
    id: 'lost_forest_road',
    kind: 'flags',
    set: { lost_forest_road: true },
    grantXp: 100,
    next: 'after_forest',
  },
  {
    id: 'after_forest',
    kind: 'dialogue',
    speaker: 'The East Road',
    portrait: 'portrait.narrator',
    lines: [
      "Stone dust coats the attackers' cuffs. Their hands are calloused around the thumb, where a quarry hammer wears the skin.",
      'One of them dropped a tally stick, cut with a notch for every cart sent down to Ba Dan. The newest notch has weathered grey.',
    ],
    // Back onto the road; reaching the quarry watch starts the parley.
    next: 'forest_after_explore',
    variants: [
      {
        when: {
          kind: 'all',
          of: [
            { kind: 'partyHas', characterId: 'kaya' },
            { kind: 'flag', key: 'lost_forest_road', op: 'set' },
          ],
        },
        speaker: 'Kaya',
        portrait: 'portrait.kaya',
        lines: [
          'They took our supplies. I saw quarry dust on their clothes.',
          'I want to know who put them out here.',
        ],
      },
      {
        // Losing the road makes the same observation land very differently.
        when: { kind: 'flag', key: 'lost_forest_road', op: 'set' },
        lines: [
          "You remember stone dust on the attackers' clothes and the worn hands of people who cut rock for a living.",
          'They took every scrap of food and left the coin lying beside it.',
        ],
      },
      {
        when: { kind: 'partyHas', characterId: 'kaya' },
        speaker: 'Kaya',
        portrait: 'portrait.kaya',
        lines: [
          'Quarry dust in their cuffs. My mother used to make the stonecutters shake it out before they came inside.',
          'I thought we were going up there to get these people home. Why are they guarding the road?',
        ],
      },
    ],
  },

  /* ------------------------------------------------------------ The gate */
  /*
   * The Speaker Choice: three ways up to the same gate, every one shown to
   * everyone, greyed with a reason when it is not yours to take, because
   * seeing the road you cannot walk is what makes somebody want to come back
   * with a different party.
   *
   * The talk is earned, not inherited (story bible C-07, C-08; canon MQ-01).
   * Ruon listens to people who know what his quarry is doing: Bo, who ran a
   * crew; Lin Mei, who reads ground for a living; or any party at all that
   * stopped on the road below to hear Lanfen out or to read the flood marker.
   * Element alone is not a biography, and a party of non-benders can walk in
   * through the front gate on what it bothered to learn.
   *
   * The bluff plays on one man's fear (C-09). Hotaro was a ship's guard; he
   * knows what a stack of lamp oil does near an open flame, and this post does
   * not pay enough to stand beside it. It is not a rule about anyone's nation.
   */
  {
    id: 'gate_parley',
    kind: 'choice',
    speaker: 'The Quarry Gate',
    portrait: 'portrait.narrator',
    prompt:
      'Quarry workers watch from the wall with slings. A hired guard stands by the oil barrels, as far from them as his post allows. How will you approach?',
    options: [
      {
        label: 'Walk up and knock',
        detail: 'Approach openly. The guards are armed and will fight.',
        next: 'battle_quarry_gate',
      },
      {
        label: 'Let the firebender do the talking',
        detail:
          'Make the guard by the oil barrels think twice about his post. You will still have to fight the quarry crew.',
        next: 'gate_bluff_words',
        speaker: { element: 'fire' },
        requires: { kind: 'partyHas', element: 'fire' },
        lockedHint: 'You need a firebender for this bluff.',
        // The old nation-standing nudge; community trust replaces it (C-25).
        adjust: { fire: 1, earth: -1 },
      },
      {
        label: 'Talk to Captain Ruon about the galleries',
        detail:
          'Tell him what you know about his quarry. If he listens, the gate may open without a fight.',
        next: 'gate_kinship',
        requires: GATE_TALK_EARNED,
        lockedHint:
          'Ruon listens to someone who knows quarry work, or knows what the quarry is doing to the stream below the road.',
        adjust: { earth: 2 },
      },
    ],
  },
  {
    id: 'gate_bluff_words',
    kind: 'dialogue',
    speaker: 'The Quarry Gate',
    portrait: 'portrait.narrator',
    lines: [
      'Your firebender calls up to the guard by the barrels: how much lamp oil is in that stack, and where would he like to be standing once a fight starts?',
    ],
    variants: [
      {
        when: { kind: 'partyHas', characterId: 'tenzo' },
        speaker: 'Tenzo',
        portrait: 'portrait.tenzo',
        lines: [
          'That stack by your feet. Lamp oil? Cooking oil smells sweeter.',
          'I light my stove with one finger every morning. I would not stand where you are standing. Not once this starts.',
        ],
      },
      {
        when: { kind: 'partyHas', characterId: 'kaya' },
        speaker: 'Kaya',
        portrait: 'portrait.kaya',
        lines: [
          'Hey! You by the barrels! Is all of that lamp oil?',
          'I’m a firebender. I’m only saying, if this turns into a fight, I’d stand somewhere else.',
        ],
      },
    ],
    next: 'gate_bluff',
  },
  {
    id: 'gate_bluff',
    kind: 'flags',
    // Feeds the `bluffed` variant on enc_quarry_gate: Hotaro walks off and the
    // quarry crew comes forward in his place, at the same threat cost.
    set: { gate_fire_bluff: true },
    next: 'battle_quarry_gate',
  },
  {
    /*
     * The party makes its case. Bo and Lin Mei speak from their own work
     * (`partyVoices.ts`); any other party says what the road showed it.
     */
    id: 'gate_kinship',
    kind: 'dialogue',
    speaker: 'The Quarry Gate',
    portrait: 'portrait.narrator',
    lines: [
      'You call up to the wall about the stream below the road, and the white silt in it.',
      'For a moment nobody answers. Then an officer comes to the top of the wall, a sabre at his belt.',
    ],
    variants: [
      {
        when: { kind: 'flag', key: 'world.discovered.runoff_marker', op: 'set' },
        lines: [
          'You call up to the wall about the stone by the stream below the road: its flood marks silted over, and the question someone scratched under the arrow.',
          '“Settling pit blocked?”',
          'For a moment nobody answers. Then an officer comes to the top of the wall, a sabre at his belt.',
        ],
      },
      {
        when: { kind: 'flag', key: 'world.ducks_seen', op: 'set' },
        lines: [
          'You call up to the wall. The road keeper below the switchbacks wants to know why her stream runs white, and she asked you to ask.',
          'For a moment nobody answers. Then an officer comes to the top of the wall, a sabre at his belt.',
        ],
      },
    ],
    next: 'gate_ruon_listens',
  },
  {
    /* Ruon answers whichever case was made, in the same order as `gate_kinship`. */
    id: 'gate_ruon_listens',
    kind: 'dialogue',
    speaker: 'Captain Ruon',
    portrait: 'portrait.ruon',
    lines: [
      'That silt is from the settling pit. It has been choked since the driller came.',
      'What cannot drain out of the pit runs down into the lower galleries. I told my quartermaster. He said the machine cuts faster than water rises.',
      'All right. Lower the slings. Open the gate.',
      'You want someone to answer for this, you can talk to me. Leave the crew out of it.',
    ],
    variants: [
      {
        when: { kind: 'partyHas', characterId: 'bo' },
        lines: [
          'A week of wages. My crews have not seen wages in a month.',
          'I told my quartermaster those supports needed replacing. He sent the crew back in anyway.',
          'All right. Lower the slings. Open the gate.',
          'You want someone to answer for this, you can talk to me. Leave the crew out of it.',
        ],
      },
      {
        when: { kind: 'partyHas', characterId: 'lin_mei' },
        lines: [
          'I was told. Twice.',
          'I told my quartermaster those supports needed replacing. He sent the crew back in anyway.',
          'All right. Lower the slings. Open the gate.',
          'You want someone to answer for this, you can talk to me. Leave the crew out of it.',
        ],
      },
      {
        when: { kind: 'flag', key: 'world.discovered.runoff_marker', op: 'set' },
        lines: [
          'Blocked since the driller came. It fills the pit with cuttings faster than anyone can dig them out.',
          'What cannot drain out of the pit runs down into the lower galleries. I told my quartermaster. He said the machine cuts faster than water rises.',
          'All right. Lower the slings. Open the gate.',
          'You want someone to answer for this, you can talk to me. Leave the crew out of it.',
        ],
      },
      {
        when: { kind: 'flag', key: 'world.ducks_seen', op: 'set' },
        lines: [
          'The road keeper. She has walked up here twice about that stream. I sent her back down twice.',
          'It runs white because the settling pit is choked with cuttings. What cannot drain out of the pit runs down into the lower galleries.',
          'I told my quartermaster. He said the machine cuts faster than water rises.',
          'All right. Lower the slings. Open the gate.',
          'You want someone to answer for this, you can talk to me. Leave the crew out of it.',
        ],
      },
    ],
    next: 'gate_talked_through',
  },
  {
    id: 'gate_talked_through',
    kind: 'flags',
    /*
     * A genuine non-combat resolution of a battle node — the gate opens and the
     * fight never happens. 150 is enc_quarry_gate's 450-XP roster across a
     * baseline of three, so talking your way in and fighting your way in arrive
     * at the boss at exactly the same level. Different content, not an easier
     * route; that is the whole point.
     */
    set: { gate_talked_through: true, ruon_respects_you: true },
    grantXp: 150,
    next: 'ruon_surrender',
  },
  {
    id: 'battle_quarry_gate',
    kind: 'battle',
    encounterId: 'enc_quarry_gate',
    next: 'ruon_surrender',
    onDefeat: 'defeat_gate',
  },
  {
    id: 'defeat_gate',
    kind: 'dialogue',
    speaker: 'The Quarry Gate',
    portrait: 'portrait.narrator',
    lines: [
      'You retreat down the switchbacks under a hail of stones. By the time you stop, no one is following.',
      'When you climb back, the gate stands open. The workers have left the wall.',
      'Captain Ruon waits in the yard. He lays his sabre on the ground as you approach.',
    ],
    next: 'lost_quarry_gate',
  },
  {
    id: 'lost_quarry_gate',
    kind: 'flags',
    // 450 XP across a baseline of three. Ruon surrenders either way; losing
    // changes who he thinks you are, not whether the story continues.
    set: { lost_quarry_gate: true },
    grantXp: 150,
    next: 'ruon_surrender',
  },
  {
    id: 'ruon_surrender',
    kind: 'dialogue',
    speaker: 'Captain Ruon',
    portrait: 'portrait.ruon',
    lines: [
      'My sabre stays on the ground. Tell me if anyone needs a bandage.',
      'Captain Ruon, provincial guard. Nineteen years. I still give the rank, though I doubt they would claim me now.',
      'The crews stopped getting paid. Then our wages stopped too. My quartermaster said holding the stone would make somebody listen. I let him shut the gate.',
      'Then he locked people in the galleries. I kept my post. Their families will want to know that.',
      'Jin’s mercenaries keep the inner gate. Jin holds a provincial bounty on me, and she will pay whoever hands me over.',
    ],
    next: 'ruon_choice',
  },
  {
    id: 'ruon_choice',
    kind: 'choice',
    speaker: 'Captain Ruon',
    portrait: 'portrait.ruon',
    prompt: 'Ruon has surrendered. What happens to him?',
    options: [
      {
        label: 'Escort him back to Ba Dan for trial',
        detail:
          'Keep Ruon with you to face the village court. Jin’s mercenaries will try to take him on the road.',
        next: 'escort_chosen',
        setFlags: { ruon_spared: true },
        // Ba Dan is an Earth Kingdom village and Ruon was its province's guard.
        // Handing him to a court rather than a mercenary is noticed.
        adjust: { earth: 2 },
      },
      {
        label: 'Trade him to Jin for the quarry key',
        detail:
          'Accept Jin’s payment and the inner gate key. Her crew will let you pass the cutting. Ruon leaves with her and will not answer to Ba Dan’s families.',
        next: 'trade_payment',
        setFlags: { ruon_traded: true },
        adjust: { earth: -2 },
      },
    ],
    footer: 'Both routes reach the quarry floor.',
  },

  /* ----------------------------------------------------- Branch A: escort */
  {
    id: 'escort_chosen',
    kind: 'dialogue',
    speaker: 'Captain Ruon',
    portrait: 'portrait.ruon',
    lines: [
      'Ba Dan, then, once the galleries are open.',
      "Jin will not let her bounty walk down the hill. She'll send people after us.",
      "If they catch us in the cutting, I'll need my sabre. You can take it back afterwards.",
    ],
    next: 'gate_escort_explore',
  },
  {
    id: 'battle_ambush',
    kind: 'battle',
    encounterId: 'enc_ambush',
    next: 'after_ambush',
    onDefeat: 'defeat_ambush',
  },
  {
    id: 'defeat_ambush',
    kind: 'dialogue',
    speaker: 'The Cutting',
    portrait: 'portrait.narrator',
    lines: [
      'The mercenaries block the road. Ruon points to a gap in the rocks and pulls you towards it.',
      'He hauls you over the loose scree, stopping to check that everyone is still with him.',
      'You lose the pursuers below the cutting. Ruon stays beside you, bent over and struggling for breath.',
    ],
    next: 'lost_ambush',
  },
  {
    id: 'lost_ambush',
    kind: 'flags',
    // 450 across three. `ruon_carried_you` is the sort of thing a later act
    // should remember about him.
    set: { lost_ambush: true, ruon_carried_you: true },
    grantXp: 150,
    next: 'after_ambush',
  },
  {
    id: 'after_ambush',
    kind: 'dialogue',
    speaker: 'Captain Ruon',
    portrait: 'portrait.ruon',
    lines: [
      'We cannot stay on the road. There is a path through the cutting to the quarry floor.',
      'My quartermaster will be down there. The crews call him Grumbler. He could find something wrong with a day off.',
      'He got hold of a mecha-driller last month. I signed for the delivery without asking who paid for it.',
    ],
    next: 'cutting_after_explore',
  },
  {
    // Ruon waits in the Cutting after the ambush (#628); tapping him gets this.
    id: 'ruon_cutting',
    kind: 'dialogue',
    speaker: 'Captain Ruon',
    portrait: 'portrait.ruon',
    lines: [
      'The quarry floor is east, past the ore cart. I’ll keep to the back.',
      'If Jin sends anyone else, they reach me first. That was the arrangement.',
    ],
    next: 'cutting_after_explore',
  },

  /* ------------------------------------------------------ Branch B: trade */
  /*
   * Jin pays, and the payment is worth the same as the ambush the party just
   * avoided. Without it this branch skips a whole fight's XP and arrives at
   * the quarry floor a level down against a boss scaled for the other route.
   * It also makes the choice land: you were paid, in coin, for a person.
   */
  {
    id: 'trade_payment',
    kind: 'flags',
    set: { ruon_paid: true },
    grantXp: 150,
    next: 'trade_chosen',
  },
  {
    id: 'trade_chosen',
    kind: 'dialogue',
    speaker: 'Jin',
    portrait: 'portrait.jin',
    lines: [
      'The inner gate key, as agreed. Your payment is in the pouch.',
      'Captain. Hands where I can see them.',
      'The province wants him alive. Keep the receipt if anyone asks who took him.',
      'My crew is in the quarry securing the equipment. The key gets you through the gate. It does not give you a claim on the machinery.',
    ],
    next: 'gate_trade_explore',
  },

  /* ------------------------------------------------------------ The boss */
  {
    id: 'quarry_descent',
    kind: 'dialogue',
    speaker: 'The Quarry',
    portrait: 'portrait.narrator',
    lines: [
      'Stone ledges step down to the quarry floor. Below them, the gallery entrances have been barred with timber.',
      'A mecha-driller idles beside the lowest ramp, its cabin shaking between two broad treads.',
      'Oil drips from a split hose. The driver sees you and reaches for a lever.',
    ],
    next: 'quarry_assessment',
  },
  {
    id: 'quarry_assessment',
    kind: 'dialogue',
    speaker: 'The Quarry',
    portrait: 'portrait.narrator',
    lines: [
      'Workers bang on the barred gallery doors. One shouts, "Grumbler!" The driver turns towards the bars, then back to you.',
      'The ramp behind you is clear. It is the way everyone will have to come out.',
    ],
    next: 'battle_grumbler',
  },
  {
    id: 'battle_grumbler',
    kind: 'battle',
    encounterId: 'enc_grumbler',
    next: 'act1_victory',
    onDefeat: 'defeat_boss',
  },
  {
    id: 'defeat_boss',
    kind: 'dialogue',
    speaker: 'The Quarry',
    portrait: 'portrait.narrator',
    lines: [
      'The driller blocks the ramp. You scramble up the loose stone beside it while the drill tears into the slope.',
      'By the switchback, you have to stop. The engine keeps running below.',
      'Mira finds you there with Dorin and a handcart. “Sit down,” she says. “We can talk at home.”',
    ],
    next: 'act1_lost',
  },
  {
    /*
     * The one defeat that genuinely ends the act rather than rejoining it.
     * No compensating XP: there is no next fight in Act 1 to arrive at, and
     * the two branches still land inside the level band the next act expects.
     */
    id: 'act1_lost',
    kind: 'flags',
    set: { act1_lost: true },
    next: 'act1_epilogue_lost',
  },
  {
    id: 'act1_epilogue_lost',
    kind: 'end',
    title: 'The Quarry Keeps Running',
    lines: [
      'Stone carts leave the quarry again. At the fork, each one takes the coast road past Ba Dan.',
      'Mira stretches the evening rice with broth. Families still come to her door asking for news from the galleries.',
      'Grumbler’s crew rolls Bo-shan’s cart down to the fork, emptied, one wheel split, and leaves it there. Under the seat, a worker has tucked a note for Dorin: Bo-shan, the four messengers and the crews are alive.',
      'The driller is still down there. Its parts came from Republic City; someone paid to bring them all this way.',
      'Gao patches the wheel with what he has in the shop. Pella watches every nail. “His deliveries are still waiting,” she tells you. “Take the cart for him. Bring it back with him on it.”',
      'Dorin writes himself a travel permit, signs it, reads it twice and stamps it. Then he climbs up and takes the reins.',
    ],
    teaser:
      'Across the bay, lamps burn in a Fire Nation outpost closed nine years ago. A supply boat ties up at its jetty.',
  },
  {
    id: 'act1_victory',
    kind: 'flags',
    set: { act1_complete: true },
    residentProfiles: RETURNING_PROFILES,
    next: 'act1_epilogue',
  },
  {
    /*
     * The workers are free: a beat, not the ending. The walk home follows, and
     * the demo closes in Ba Dan (`welcome_home_mira` in return.ts).
     */
    id: 'act1_epilogue',
    kind: 'dialogue',
    speaker: 'The Quarry',
    portrait: 'portrait.narrator',
    lines: [
      'The drill jams in the quarry floor. Grumbler tries the lever twice, then climbs out with his hands raised.',
      'You pull the bars from the gallery doors. Mira’s four messengers are there. Bo-shan follows them out and asks where Pella is.',
      'The driller bears a Republic City maker’s plate. You take a rubbing for Mira’s report to the province.',
      'The workers help each other up the ramp and start down the west road. It is time to take the news home to Ba Dan.',
    ],
    // The cart's delivery book, the party-neutral reason to keep going (reasons.ts).
    next: 'quarry_ledger',
  },
  {
    // Evening falls as the walk home begins. A phase change rests at an explore
    // node, never in a conversation, so it follows the beat rather than leading it.
    id: 'act1_evening',
    kind: 'flags',
    set: {},
    phase: 'evening',
    next: 'quarry_after_explore',
  },
];
