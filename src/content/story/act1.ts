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
 * Neither option is the "good" one. That is the point.
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
      'Forty years after the Avatar Korra, the outer Earth Kingdom provinces run themselves — mostly well, and mostly quietly.',
      'Ba Dan is a stone village. It has always been a stone village. The quarry above it has sent down a cart of cut blocks every week for three generations.',
      'It has now sent nothing for a month.',
    ],
    next: 'village_explore',
  },

  /* -------------------------------------------------------------- The hub */
  {
    id: 'village_explore',
    kind: 'explore',
    mapId: 'ba_dan_village',
    objective: 'Talk to Elder Mira, then take the east road to the quarry.',
    next: 'road_depart',
  },

  {
    id: 'mira_intro',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'You came. Good. I will not pretend we can pay you much.',
      'The quarry stopped a month ago. No carts, no word, and the four people I sent up to ask have not come back down.',
      'Whatever is up there, it is not a rockfall. Rockfalls do not post guards on the gate.',
      'Find out what it is. Bring my people home if you can.',
    ],
    next: 'village_explore',
  },
  {
    id: 'mira_epilogue',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'The first cart came down this morning. Cut stone, stacked properly, the way it has been for sixty years.',
      'Whatever you did up there — thank you.',
      'Rest. There is more road after this one, and I think you already know it.',
    ],
    next: 'village_explore',
  },
  {
    id: 'gao_friendly',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'Heading up the hill, are you? Take the water skins. No, take them — I would rather be out two coppers than short four neighbours.',
      'And mind the road. There are puddles all along the cutting after the rain. Step in one and you will be soaked through.',
      'Mind you, so will whoever you are fighting.',
    ],
    next: 'village_explore',
  },
  {
    id: 'gao_cold',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'You sold a man. To Jin.',
      'I do not care what he did. I care that you handed a person over for a key, and then walked into my shop like it was a Tuesday.',
      'Prices are double. Pay or get out.',
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
      'Are you the ones going up the quarry? Can I come? No? Fine.',
      'My brother says the trick in a fight is that the ground does the work. Puddles, fire, mud — all of it counts.',
      'He says if someone is standing in water and you hit them with lightning, the whole puddle goes. He says he saw it once. I think he is lying, but you should check.',
      'His name is Bo-shan. He drives the produce cart up to the quarry crews on a Tuesday and he has not come back either, and Elder Mira keeps saying "the four people" like he is not one of them.',
      'If you see a cart with too many cabbages on it, that is his. He stacks them stupidly. Tell him I said so.',
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
      'Too many cabbages. You will know it when you see it.',
      'And do not let anyone tell you the cabbages are not important.',
    ],
    next: 'village_explore',
  },
  {
    id: 'dorin_directions',
    kind: 'dialogue',
    speaker: 'Gate Guard Dorin',
    portrait: 'portrait.dorin',
    lines: [
      'East road, then up the switchbacks. Two hours if you walk it properly.',
      'I would go with you. Elder says somebody has to be standing here when the carts come back.',
      'Go on, then. East gate is open.',
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
      'The road climbs out of the village and into pine. The rain has left the ruts full of standing water.',
      'Half a league up, the birds stop.',
    ],
    next: 'battle_forest_road',
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
   * story and the story carries on: you lose the fight, you lose the cargo, and
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
      'You come round on the verge with your pockets turned out and the cart wheel gone. They took the wheel. Who takes a wheel?',
      'Nobody is dead. Everybody is furious. Pella will not stop apologising for something that was not her fault.',
      'The road still goes up the hill, and you have nothing left worth robbing, which is its own kind of freedom.',
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
    speaker: 'Kaya',
    portrait: 'portrait.narrator',
    lines: [
      'They are quarry workers. Look at the hands — every one of them has cut stone for a living.',
      'Whoever is up there did not bring an army. They took one.',
    ],
    // Straight into the parley now, rather than straight into the fight.
    next: 'gate_parley',
    variants: [
      {
        // Losing the road makes the same observation land very differently.
        when: { kind: 'flag', key: 'lost_forest_road', op: 'set' },
        speaker: 'Kaya',
        lines: [
          'They were quarry workers. Did you see the hands? Every one of them has cut stone for a living, and every one of them has just robbed us.',
          'Whoever is up the hill did not bring an army. They took one, and they took it from people who had nothing left to say no with.',
          'I want to be angry about the wheel. I am finding it difficult.',
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
      'The gate is shut and there are people on it. Somebody has to go first — and who goes first is going to matter.',
    options: [
      {
        label: 'Walk up and knock',
        detail:
          'No angle, no leverage. Whatever is behind that gate, you meet it on its own terms.',
        next: 'battle_quarry_gate',
      },
      {
        label: 'Let the firebender do the talking',
        detail:
          'A deserter is still Fire Nation enough to flinch at the colours. He will stand down. His quarry crew will not, and they will be angrier for it.',
        next: 'gate_bluff',
        speaker: { element: 'fire' },
        requires: { kind: 'partyHas', element: 'fire' },
        lockedHint: 'Nobody here can sell it. You would need a firebender.',
        // Trading on Fire Nation fear works, and it is remembered on both sides.
        adjust: { fire: 1, earth: -1 },
      },
      {
        label: 'Let the earthbender speak — these are quarry workers',
        detail:
          'They cut stone for a living and so did your grandmother. That is not nothing, and Ruon knows it is not nothing.',
        next: 'gate_kinship',
        speaker: { element: 'earth' },
        requires: { kind: 'partyHas', element: 'earth' },
        lockedHint: 'It would have to come from an earthbender to mean anything.',
        adjust: { earth: 2 },
      },
    ],
    footer: 'Who speaks changes what happens. It is meant to.',
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
      'Stop. Stop — say that again. Say the part about the galleries.',
      'You have cut stone. You know what it does to a back, and you know what it does to a village when the cutting stops.',
      'Then you know exactly why my people are on this gate, and you know I cannot pay them either.',
      'Put it down. All of you, put it down. I am not going to be the man who set quarry workers on quarry workers.',
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
      'The oil went up, and then everything went up, and then somebody dragged you back down the switchbacks with your eyebrows gone.',
      'When you come back the gate is open and nobody is on it. Not abandoned — opened. Somebody decided you were not worth the barrels.',
      'Captain Ruon is waiting in the yard with his sword on the ground in front of him, which is somehow more insulting than the fight was.',
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
      'Enough. Enough! Put it down — all of you, put it down.',
      'My name is Ruon. I was a captain of the provincial guard for nineteen years, and I have been running this gate for one month, and I would like you to understand that those two facts are related.',
      'The quarry stopped paying. Then the province stopped paying. Then my people started eating stone dust and pride.',
      'I am not asking you to forgive it. I am telling you it is mine. Do what you want with me.',
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
          'The right thing, and the slow thing. Word will travel, and somebody will come out to meet you on the road.',
        next: 'escort_chosen',
        setFlags: { ruon_spared: true },
        // Ba Dan is an Earth Kingdom village and Ruon was its province's guard.
        // Handing him to a court rather than a mercenary is noticed.
        adjust: { earth: 2 },
      },
      {
        label: 'Trade him to Jin for the quarry key',
        detail:
          'The mercenary wants Ruon and will hand over the gate key. Fast, certain — and Ba Dan will hear about it.',
        next: 'trade_payment',
        setFlags: { ruon_traded: true },
        adjust: { earth: -2 },
      },
    ],
    footer: 'There is no right answer here. Both roads lead to the quarry.',
  },

  /* ----------------------------------------------------- Branch A: escort */
  {
    id: 'escort_chosen',
    kind: 'dialogue',
    speaker: 'Captain Ruon',
    portrait: 'portrait.ruon',
    lines: [
      'Trial. Right. I would have picked the other one.',
      'Understand what you have done: Jin wanted me, and now Jin does not have me. She will be along.',
      'Give me back my sabre when she is. I am not going to stand there and be a parcel.',
    ],
    next: 'battle_ambush',
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
      "Jin's people are professionals, and the cutting is narrow enough that being surrounded is a choice you made.",
      'Ruon gets three of you out through the scree and goes back for the rest, which is not what anybody expected of him.',
      "Jin has what she came for. You have a captain who chose you over a clear road, and a long walk to think about it.",
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
      'That was three of hers. She has more.',
      'The thing in the quarry is not Jin, though. That one is mine too, in a way — he was my quartermaster before he found the driller.',
      'His name is Grumbler. It was a joke once.',
    ],
    next: 'quarry_descent',
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
      'Sensible. Here — gate key, and the road is yours.',
      'Captain. Walk.',
      'Oh — do not look at me like that. He is worth more to the province than he is to you, and I am taking him to the province. Eventually.',
      'My people are already in the quarry, by the way. Do try not to get in their way.',
    ],
    next: 'quarry_descent',
  },

  /* ------------------------------------------------------------ The boss */
  {
    id: 'quarry_descent',
    kind: 'dialogue',
    speaker: 'The Quarry',
    portrait: 'portrait.narrator',
    lines: [
      'The quarry floor is a bowl of cut stone four hundred paces across, ringed by ledges.',
      'Something is idling at the bottom of it. It is the size of a barn, it stands on two treads, and one of its arms is a drill.',
      'Oil runs out from under it in slow black fingers.',
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
      'The driller does not celebrate. It simply goes back to idling, which is somehow worse.',
      'You wake up on the switchback with every bone complaining and the quarry still running behind you.',
      'Elder Mira comes up the road herself to fetch you down. She does not say a word about the stone. She does not have to.',
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
      'Ba Dan does not fall. That is the strange part. The quarry keeps cutting, the carts keep going out, and nobody in the village is asked to leave.',
      'They are simply not asked anything at all any more. Elder Mira still sets a place at her table for whoever is hungry, and there are more of them each week.',
      'Grumbler never comes down the hill to gloat. Somebody else is paying him, and gloating is not in it.',
      'The obvious question is still the obvious one: a mecha-driller is Republic City engineering, and nobody in this province could have built it, bought it, or driven it here.',
    ],
    teaser:
      'Across the bay, a Fire Nation outpost that was decommissioned nine years ago has its lamps lit. Whoever lit them already knows your names.',
  },
  {
    id: 'act1_victory',
    kind: 'flags',
    set: { act1_complete: true },
    next: 'act1_epilogue',
  },
  {
    id: 'act1_epilogue',
    kind: 'end',
    title: 'The Quarry of Ba Dan',
    lines: [
      'The driller comes apart in the middle of the quarry floor and stays apart. Grumbler climbs out of the cabin with his hands up and an expression of enormous relief.',
      'The quarry workers come out of the lower galleries one at a time, blinking. Elder Mira gets her people back. Ba Dan gets its stone.',
      'Somebody eventually asks the obvious question: a mecha-driller is Republic City engineering, and nobody in this province could have built it, bought it, or driven it here.',
      'So who gave it to him?',
    ],
    teaser:
      'Across the bay, a Fire Nation outpost that was decommissioned nine years ago has its lamps lit.',
  },
];
