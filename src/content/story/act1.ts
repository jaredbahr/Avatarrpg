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
  {
    id: 'pella_tips',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: [
      'Are you the ones going up the quarry? Can I come? No? Fine.',
      'My brother says the trick in a fight is that the ground does the work. Puddles, fire, mud — all of it counts.',
      'He says if someone is standing in water and you hit them with lightning, the whole puddle goes. He says he saw it once. I think he is lying, but you should check.',
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
  {
    id: 'defeat_forest',
    kind: 'dialogue',
    speaker: 'Ba Dan',
    portrait: 'portrait.narrator',
    lines: [
      'You come round in the village, patched up and thoroughly embarrassed. Gao does not say a word about it, which is worse.',
      'The road is still there. So are the bandits.',
      'Try the puddles this time.',
    ],
    next: 'battle_forest_road',
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
    next: 'battle_quarry_gate',
  },

  /* ------------------------------------------------------------ The gate */
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
      'The oil went up, and then everything went up, and then somebody dragged you back down the switchbacks.',
      'Next time: wash the oil off the ground first, or make very sure of where you are standing before anybody lights anything.',
    ],
    next: 'battle_quarry_gate',
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
      },
      {
        label: 'Trade him to Jin for the quarry key',
        detail:
          'The mercenary wants Ruon and will hand over the gate key. Fast, certain — and Ba Dan will hear about it.',
        next: 'trade_payment',
        setFlags: { ruon_traded: true },
      },
    ],
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
      'Ruon hauls what is left of you back down the road, complaining the entire way.',
      'Hold the gap next time. Nobody gets past a tile they cannot stand on.',
    ],
    next: 'battle_ambush',
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
      'You wake up on the switchback with every bone complaining.',
      'Two things kill it: the oil it leaves behind, and the mud it churns up. Light the first. Freeze the second.',
    ],
    next: 'battle_grumbler',
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
