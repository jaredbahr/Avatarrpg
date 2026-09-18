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
 * Keep both routes playable and their consequences clear.
 * Dialogue voice and humor are governed by docs/writing-guide.md.
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
      'For three generations, a cart of cut blocks has come down the east road every week. People used to set their work by its arrival.',
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
      'There are guards on the gate now. They turn everyone away.',
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
      'Bo-shan is home. So are all four people I sent. Thank you.',
      'There is a place for you at supper. Stay as long as you need.',
    ],
    next: 'village_explore',
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
      'You sold a man. To Jin.',
      'He surrendered. You could have brought him here. Instead you left him with her.',
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
      'Look for my brother, too. Bo-shan. He took the produce cart up before Mira sent the others. That makes five.',
      'You will know his cart. He piles the cabbages so high he has to stand up to see the road. I keep telling him to make two trips.',
      'He told me to watch the ground if there was ever trouble. Fire catches the oil, mud slows you down, and lightning spreads through a puddle.',
      'I remembered all of it. Tell him when you find him.',
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
      'His cart is the one piled up with cabbages. Bo-shan is his name.',
      'I will be here if you hear anything.',
    ],
    next: 'village_explore',
  },
  {
    id: 'dorin_directions',
    kind: 'dialogue',
    speaker: 'Gate Guard Dorin',
    portrait: 'portrait.dorin',
    lines: [
      'East road, then up the switchbacks. Allow two hours. The steps get slippery after rain.',
      'Mira needs me here. If anyone comes down from the quarry, I will send word.',
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
      'You come round beside the road. The attackers have gone through your supplies and taken what they could carry.',
      'You check your injuries and gather what is left. You can still travel.',
      'The path back to Ba Dan is clear. The quarry road continues uphill.',
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
        // Losing the road makes the same observation land very differently.
        when: { kind: 'flag', key: 'lost_forest_road', op: 'set' },
        lines: [
          "You remember stone dust on the attackers' clothes and the worn hands of people who cut rock for a living.",
          'Quarry workers have robbed you. There is still no word from the people Mira sent.',
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
      'Guards watch from the shut gate. Several carry quarry tools. How will you approach them?',
    options: [
      {
        label: 'Walk up and knock',
        detail: 'Approach openly and ask to enter. Be ready if the guards refuse.',
        next: 'battle_quarry_gate',
      },
      {
        label: 'Let the firebender do the talking',
        detail:
          'Use a show of fire to intimidate the deserter on the gate. He will step back; the quarry crew will take his place.',
        next: 'gate_bluff',
        speaker: { element: 'fire' },
        requires: { kind: 'partyHas', element: 'fire' },
        lockedHint: 'Requires a firebender in the party.',
        // Trading on Fire Nation fear works, and it is remembered on both sides.
        adjust: { fire: 1, earth: -1 },
      },
      {
        label: 'Let the earthbender speak — these are quarry workers',
        detail:
          'Use earthbending knowledge to discuss the unsafe galleries and ask why the crews are guarding them.',
        next: 'gate_kinship',
        speaker: { element: 'earth' },
        requires: { kind: 'partyHas', element: 'earth' },
        lockedHint: 'Requires an earthbender in the party.',
        adjust: { earth: 2 },
      },
    ],
    footer: 'Your approach changes how the guards respond.',
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
      'Wait. What did you say about the galleries?',
      'We have had cracks opening down there since the driller arrived. Nobody will listen to the crews.',
      'They have not been paid. Neither have my guards. I kept them here and said I would sort it out.',
      'Lower your weapons. Let them in.',
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
      'The guards drive you back down the switchbacks. You stop below the gate to catch your breath.',
      'From the yard, Ruon orders his people to stand down. After a while, the gate opens.',
      'He waits inside with his sword on the ground. You approach carefully.',
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
      'Captain Ruon. Nineteen years in the provincial guard. I have held this gate for a month.',
      'The quarry stopped paying the crews. Then our wages stopped too. I said holding the gate would make somebody listen.',
      'I gave the orders. Take me. Let the crews go.',
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
          'Keep him in your custody for a public hearing. Jin may try to take him on the road.',
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
    footer: 'Both routes reach the quarry. You are deciding who holds Ruon in custody.',
  },

  /* ----------------------------------------------------- Branch A: escort */
  {
    id: 'escort_chosen',
    kind: 'dialogue',
    speaker: 'Captain Ruon',
    portrait: 'portrait.ruon',
    lines: [
      'A hearing in Ba Dan. Understood.',
      'Jin wants me. She will have people watching the road.',
      'If they come, let me use my sabre. I know how they fight.',
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
      "Jin's people block the cutting. Ruon leads you over the scree, helping anyone who cannot climb without him.",
      'The raiders take his dispatch satchel while you withdraw. Ruon stays with you.',
      'You wait above the path until the raiders leave, then make your way back down.',
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
      "Those were Jin's people. She has others.",
      'The man running the quarry was my quartermaster. We called him Grumbler. He could keep a whole storehouse in order and still complain about one missing nail.',
      'I put him in charge of the supplies. Now he has a driller and workers who are not allowed to leave.',
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
      'Sensible. Here — gate key, and the road is yours.',
      'Captain. Walk.',
      'The province wants his account of what happened here. I intend to be paid for delivering it.',
      'My people are already in the quarry. Your key will get you in. It does not mean they will let you through.',
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
      'You reach the switchback and stop. Behind you, the driller starts again.',
      'The missing people are still inside. You are too badly hurt to make another attempt today.',
      'Elder Mira comes up with help from the village. She asks who needs carrying, then leads the way home.',
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
      'Ba Dan stays standing. Stone carts leave the quarry by another road while the village waits for news.',
      'Mira keeps the supper table open. Pella comes each evening to ask whether anyone has heard from Bo-shan.',
      'A message gets out: Bo-shan, all four messengers, and the quarry crews are alive. Grumbler is still holding them. The rescue will need another attempt.',
      'The driller came from Republic City. Ba Dan ordered no such machine, and Mira wants to know who sent it.',
    ],
    teaser:
      'Across the bay, a Fire Nation outpost that was decommissioned nine years ago has its lamps lit.',
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
      'Workers emerge from the lower galleries. Mira finds all four people she sent. Bo-shan comes out behind them and asks whether Pella is at home.',
      'The driller came from Republic City. Mira checks the quarry accounts: there is no order for it.',
      'Someone sent Grumbler this machine. Once the workers are safely home, there will be time to find out who.',
    ],
    teaser:
      'Across the bay, a Fire Nation outpost that was decommissioned nine years ago has its lamps lit.',
  },
];
