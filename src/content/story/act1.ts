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

import type { StoryNode } from '../../core/types';

export const ACT1_NODES: readonly StoryNode[] = [
  /* ---------------------------------------------------------------- Opening */
  {
    id: 'act1_open',
    kind: 'dialogue',
    speaker: 'Ba Dan',
    portrait: 'portrait.narrator',
    lines: [
      'Ba Dan lies below a limestone quarry, its houses built from the same pale stone as the hill.',
      'Every week, a cart of cut stone comes down from the quarry. Gao opens his shop early for the crew; by noon, the whole square is white with dust.',
      'The cart has not come for a month. Elder Mira has asked you to find out why her messengers have not come home.',
    ],
    next: 'village_explore',
  },

  /* -------------------------------------------------------------- The hub */
  {
    id: 'village_explore',
    kind: 'explore',
    mapId: 'ba_dan_village',
    objective: 'Talk to Elder Mira, then take the east road to the quarry.',
    objectiveNpcId: 'elder_mira',
    objectiveVariants: [
      {
        when: { kind: 'visited', nodeId: 'mira_intro' },
        text: 'Take the east road to the quarry. You can speak with the neighbors before you leave.',
        objectiveNpcId: null,
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
    next: 'village_return_explore',
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
      'The cutting is flooded in places. Mind your footing, especially if there is a fight.',
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
      'He says a lightning strike can go right across a puddle. He saw it happen to a whole crew. He also says he can lift an ostrich-horse, so I would ask someone else.',
      'Mira says “the missing people” every time. She could say his name. She knows his name.',
      "Look for the cart with cabbages piled above the seat. Tell him I'm not doing his chores again this week.",
    ],
    next: 'pella_asked',
  },
  {
    id: 'pella_asked',
    kind: 'flags',
    set: { pella_asked: true },
    next: 'village_explore',
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
      'Their tracks lead uphill. You follow once you can stand.',
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
      'These people worked the quarry. Something has put them on the road with weapons.',
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
          'Quarry workers have robbed you. There is still no word from the people Mira sent.',
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
   * The Speaker Choice, and the first place the party's *composition* is the
   * decision rather than its abilities.
   *
   * Avatar's whole argument is that difference is the problem and also the
   * answer: the same gate opens differently for a firebender and for an
   * earthbender, and a party with neither has to do it the hard way. Every
   * option is shown to everyone, greyed with a reason when it is not yours to
   * take, because seeing the road you cannot walk is what makes somebody want
   * to come back with a different four people.
   */
  {
    id: 'gate_parley',
    kind: 'choice',
    speaker: 'The Quarry Gate',
    portrait: 'portrait.narrator',
    prompt:
      'Quarry workers watch from the wall. A Fire Nation deserter stands beside the oil barrels. How will you approach?',
    options: [
      {
        label: 'Walk up and knock',
        detail: 'Approach openly. The guards are armed and will fight.',
        next: 'battle_quarry_gate',
      },
      {
        label: 'Let the firebender do the talking',
        detail:
          'Bluff the deserter into standing aside. You will still have to fight the quarry crew.',
        next: 'gate_bluff',
        speaker: { element: 'fire' },
        requires: { kind: 'partyHas', element: 'fire' },
        lockedHint: 'You need a firebender for this bluff.',
        // Trading on Fire Nation fear works, and it is remembered on both sides.
        adjust: { fire: 1, earth: -1 },
      },
      {
        label: 'Let the earthbender speak — these are quarry workers',
        detail:
          'Ask about the unsafe galleries. An earthbender may get Ruon to open the gate without a fight.',
        next: 'gate_kinship',
        speaker: { element: 'earth' },
        requires: { kind: 'partyHas', element: 'earth' },
        lockedHint: 'You need an earthbender to speak about the stonework.',
        adjust: { earth: 2 },
      },
    ],
  },
  {
    id: 'gate_bluff',
    kind: 'flags',
    // Feeds the `bluffed` variant on enc_quarry_gate: the deserter steps back
    // and the quarry crew comes forward in his place, at the same threat cost.
    set: { gate_fire_bluff: true },
    next: 'battle_quarry_gate',
  },
  {
    id: 'gate_kinship',
    kind: 'dialogue',
    speaker: 'Captain Ruon',
    portrait: 'portrait.ruon',
    lines: [
      'Hold on. You know the galleries? The supports under the east face?',
      'I told him those needed replacing. He sent the crew back in anyway.',
      'All right. Lower the slings. Open the gate.',
      'You want someone to answer for this, you can talk to me. Leave the crew out of it.',
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
          'Accept Jin’s payment and the inner gate key. Her crew will let you pass the cutting, but Gao will hear about the trade.',
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
      'Ba Dan, then. I know the way.',
      "Jin has been waiting to collect the bounty on me. She'll send people after us.",
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
      'The man down there was my quartermaster. We called him Grumbler. He could find something wrong with a day off.',
      'He got hold of a mecha-driller last month. I signed for the delivery without asking who paid for it.',
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
      'A worker gets a note to Dorin: Bo-shan, the four messengers and the crews are alive. Grumbler is still holding them in the quarry.',
      'The driller is still down there. Its parts came from Republic City; someone paid to bring them all this way.',
    ],
    teaser:
      'Across the bay, lamps burn in a Fire Nation outpost closed nine years ago. A supply boat ties up at its jetty.',
  },
  {
    id: 'act1_victory',
    kind: 'flags',
    set: { act1_complete: true },
    phase: 'evening',
    next: 'act1_epilogue',
  },
  {
    id: 'act1_epilogue',
    kind: 'end',
    title: 'The Quarry of Ba Dan',
    lines: [
      'The drill jams in the quarry floor. Grumbler tries the lever twice, then climbs out with his hands raised.',
      'You pull the bars from the gallery doors. Mira’s four messengers are there. Bo-shan follows them out and asks where Pella is.',
      'The driller bears a Republic City maker’s plate. You take a rubbing for Mira’s report to the province.',
      'The workers help each other up the ramp and start down the west road. It is time to take the news home to Ba Dan.',
    ],
    teaser:
      'Across the bay, lamps burn in a Fire Nation outpost closed nine years ago. A supply boat ties up at its jetty.',
    next: 'quarry_after_explore',
  },
];
