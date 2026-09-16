/**
 * Act 1 encounters.
 *
 * Difficulty ramps by adding *kinds* of problem rather than by inflating HP:
 *
 *   forest road  three bandits and a puddle        -> learn Wet / Frozen / Shocked
 *   quarry gate  a deserter who sets the oil alight -> learn that fire spreads
 *   the cutting  professionals, in a chokepoint     -> learn positioning
 *   quarry floor a two-tile boss rewriting the map  -> use everything at once
 *
 * A flag-gated `variant` is how the Act 1 choice reaches the boss fight: trade
 * Ruon away and Jin's mercenaries are standing in the quarry when you get there,
 * in place of the quarry crew rather than alongside them. Swapping the roster
 * rather than adding to it is deliberate — see the note on that encounter.
 *
 * `reinforcements` scale the fight to the table. Every roster below is tuned
 * for a party of three; each player beyond that pulls in one more enemy. The
 * simulator put a six-player party at a 100% win rate in under three rounds
 * before this existed.
 */

import type { EncounterDef } from '../core/types';

export const ENCOUNTERS: readonly EncounterDef[] = [
  {
    id: 'enc_forest_road',
    name: 'Ambush on the Forest Road',
    mapId: 'forest_road',
    expectedLevel: 1,
    enemies: [
      { enemyId: 'bandit_thug', pos: { x: 17, y: 5 } },
      { enemyId: 'bandit_thug', pos: { x: 17, y: 7 } },
      { enemyId: 'bandit_slinger', pos: { x: 18, y: 3 } },
    ],
    allies: [],
    conditionalEnemies: [],
    baselinePartySize: 3,
    /*
     * Three rosters at an identical 300-XP budget, and this is the whole
     * argument for XP-as-budget in one encounter: the same cost buys three
     * completely different lessons.
     *
     *   thugs     100 + 100 + 100  two in your face, one throwing rocks
     *   slingers  100 + 100 + 100  nothing melee at all; you have to close
     *   bruisers  150 + 150        two heavies; you have to focus fire
     *
     * Because `xpRoster` always scores the *authored* roster whatever spawned,
     * all three pay exactly the same and progression.test.ts never notices.
     */
    variants: [
      {
        id: 'thugs',
        weight: 2,
        intro: 'They step out of the trees. They were waiting for somebody.',
      },
      {
        id: 'slingers',
        weight: 1,
        enemies: [
          { enemyId: 'bandit_slinger', pos: { x: 17, y: 5 } },
          { enemyId: 'bandit_slinger', pos: { x: 18, y: 3 } },
          { enemyId: 'bandit_slinger', pos: { x: 18, y: 7 } },
        ],
        intro: 'Stones come out of the trees before anybody does.',
        tip: 'Nobody up there wants to come close. Get among them — a slinger with somebody in its face is not much use.',
      },
      {
        id: 'bruisers',
        weight: 1,
        enemies: [
          { enemyId: 'bandit_bruiser', pos: { x: 17, y: 5 } },
          { enemyId: 'bandit_bruiser', pos: { x: 17, y: 7 } },
        ],
        intro: 'Only two of them step out. They do not look worried about it.',
        tip: 'Two big ones instead of three small ones. Everybody hit the same one — a bruiser at half health hits just as hard as a fresh one.',
      },
    ],
    // Deliberately short. This is the tutorial fight: a full table should be
    // able to make mistakes here and still walk away.
    reinforcements: [
      { enemyId: 'bandit_thug', pos: { x: 18, y: 6 } },
      { enemyId: 'bandit_slinger', pos: { x: 16, y: 2 } },
    ],
    intro: 'They step out of the trees. They were waiting for somebody.',
    tip: 'There are puddles in the road. Anything standing in water gets Wet — and Wet things freeze easily and take double lightning damage.',
  },
  {
    id: 'enc_quarry_gate',
    name: 'The Quarry Gate',
    mapId: 'quarry_gate',
    expectedLevel: 2,
    enemies: [
      { enemyId: 'fire_deserter', pos: { x: 16, y: 3 } },
      { enemyId: 'bandit_thug', pos: { x: 17, y: 6 } },
      { enemyId: 'bandit_bruiser', pos: { x: 16, y: 8 } },
    ],
    allies: [],
    conditionalEnemies: [],
    baselinePartySize: 3,
    /*
     * The firebender's bluff at the gate does not skip the fight — it changes
     * who is in it. The deserter steps back rather than raise a hand to Fire
     * Nation colours, and the quarry crew comes forward in his place, angrier
     * for having been left to it.
     *
     * Same 450-XP cost as the authored roster (150 x 3 against 200 + 100 + 150),
     * and a very different fight: no firebender on the field means the oil only
     * lights if *you* light it.
     */
    variants: [
      {
        id: 'bluffed',
        weight: 1,
        when: { kind: 'flag', key: 'gate_fire_bluff', op: 'set' },
        enemies: [
          { enemyId: 'bandit_bruiser', pos: { x: 16, y: 3 } },
          { enemyId: 'bandit_earthbender', pos: { x: 17, y: 6 } },
          { enemyId: 'bandit_bruiser', pos: { x: 16, y: 8 } },
        ],
        intro:
          'The deserter looks at your colours, looks at the ground, and steps back off the gate. The quarry crew does not.',
        tip: 'Nobody up there bends fire any more — so the oil only goes up if you light it. That makes the brazier yours to spend.',
      },
    ],
    /*
     * Also short: the oil is what makes this fight, not the head count.
     *
     * Order matters here, and it is the whole fix for a cliff that sat in this
     * encounter for a while. `encounterRoster` takes reinforcements off the
     * *front* of this list, so the first entry is what a table one player above
     * the baseline receives — and this list used to lead with the slinger.
     *
     * One slinger measured a 30-point hole at a four-player table: 69.5% with
     * it against 100% with no reinforcement at all, and 61.5% against 98% on
     * the bluffed roster. A four-player table was having a *harder* time than a
     * three-player one, which is the opposite of what a scaling lever is for.
     *
     * The slinger is the harshest possible single addition and its stat block
     * is the reason it looks innocent: 22 HP and 4 power, but `cautious` and
     * ranged, so it never closes, never presents a target, and simply extends
     * the fight — and on a map whose whole point is a spreading oil fire, an
     * extra round is expensive. The thug walks into the party's threat range
     * and dies. Leading with it recovers the fight (94.5% / 99.5%).
     *
     * Every other encounter in the act already leads with a melee body; this
     * one was the odd one out rather than the deliberate exception.
     */
    reinforcements: [
      { enemyId: 'bandit_thug', pos: { x: 17, y: 4 } },
      { enemyId: 'bandit_slinger', pos: { x: 17, y: 9 } },
    ],
    intro: 'Barrels are stacked against the gatehouse, and the ground around them is slick.',
    /*
     * This used to say "or wash it away with water first". It does not work:
     * `water-into-oil` in combos.ts keeps the oil and prints "The oil floats on
     * the water, untouched." Teaching a child a plan the rules refuse is worse
     * than teaching them nothing.
     *
     * Burning it off early *is* a real counter — fire on oil expires after a few
     * rounds and leaves bare ground — so the tip now points at that.
     */
    tip: 'That dark stripe down the middle is spilled oil. Fire turns it into a spreading blaze that chases people — so either stay off it, or light it early, while nobody is standing in it.',
  },
  {
    id: 'enc_ambush',
    name: 'The Cutting',
    mapId: 'ambush_road',
    expectedLevel: 3,
    enemies: [
      { enemyId: 'merc_blade', pos: { x: 17, y: 5 } },
      { enemyId: 'merc_blade', pos: { x: 17, y: 6 } },
      { enemyId: 'merc_crossbow', pos: { x: 16, y: 3 } },
    ],
    allies: [{ enemyId: 'ruon_ally', pos: { x: 5, y: 5 } }],
    conditionalEnemies: [],
    baselinePartySize: 3,
    variants: [],
    reinforcements: [
      { enemyId: 'merc_blade', pos: { x: 16, y: 7 } },
      { enemyId: 'merc_crossbow', pos: { x: 18, y: 8 } },
      { enemyId: 'merc_blade', pos: { x: 15, y: 8 } },
      { enemyId: 'merc_sergeant', pos: { x: 17, y: 9 } },
    ],
    intro: "Jin's people are already in the cutting. They knew which road you would take.",
    tip: 'The walls are high here, so there is only one way through. Push someone back into the gap and nobody gets past them.',
  },
  {
    id: 'enc_grumbler',
    name: 'Grumbler',
    mapId: 'quarry_floor',
    expectedLevel: 3,
    enemies: [
      { enemyId: 'grumbler', pos: { x: 15, y: 5 } },
      { enemyId: 'bandit_earthbender', pos: { x: 16, y: 2 } },
    ],
    allies: [],
    /*
     * Empty on purpose, and it is worth saying why rather than leaving a bare
     * `[]` for somebody to helpfully fill in again.
     *
     * Trading Ruon away used to add *two* of Jin's mercenaries here on top of
     * the authored roster. `conditionalEnemies` is the one roster lever with no
     * budget rule on it — `validateContent` holds variants within 10% of the
     * authored XP, but a conditional group can add whatever it likes — and on a
     * boss floor that turned out to be catastrophic. Measured at a 3-player
     * table the branch ran at a 9% win rate against the other branch's 62%, and
     * nothing in the repo could see it: the balance harness never set a story
     * flag, so every published number described the fight the *other* choice
     * gets. A family that traded Ruon away hit a wall the simulator said was
     * fine.
     *
     * It is not that two was one too many. This fight is extraordinarily
     * sensitive to head count — a *single* extra body still measured 32-46%
     * against 82% — because a boss plus one support is already the whole
     * action-economy budget of the floor. Bodies are the wrong lever here, so
     * the branch swaps the roster instead of growing it, below.
     */
    conditionalEnemies: [],
    baselinePartySize: 3,
    /*
     * Jin said his people were already in the quarry, so they are — standing
     * where the quarry crew would have been, not alongside it. Same 510-XP cost
     * as the authored roster (360 + 150 either way), which is what makes the
     * two branches comparable, and it is the same flag-gated variant the quarry
     * gate already uses for the firebender's bluff.
     *
     * Being a variant rather than a conditional group is also what makes it
     * *visible*: `BALANCE_VARIANTS=1` reports it on its own line, so the next
     * person to touch this fight measures both branches instead of one.
     *
     * Honest caveat: at a matched budget this branch still measures easier than
     * the authored one (roughly 97-100% against 78-82%). The quarry bender
     * plays well above its 150 XP here — it is an earthbender, so it picks up
     * the level scaling's earth defence bonus, and `raise_rubble` keeps feeding
     * the boss cover. No 150-XP mercenary matches that, and the next one up
     * (the sergeant, 210) breaks the 10% budget rule at 570. Erring toward
     * "both roads are passable" is the right side to err on for a choice the
     * story explicitly says has no right answer.
     */
    variants: [
      {
        id: 'jins_people',
        weight: 1,
        when: { kind: 'flag', key: 'ruon_traded', op: 'set' },
        enemies: [
          { enemyId: 'grumbler', pos: { x: 15, y: 5 } },
          { enemyId: 'merc_crossbow', pos: { x: 16, y: 2 } },
        ],
        intro:
          'The driller comes up out of the pit on two treads. One of Jin’s people is already on the rim above it, crossbow braced, and does not look surprised to see you.',
        tip: 'No quarry bender up there raising cover this time — just a crossbow that outranges most of you. Close the distance or break line of sight, and the driller is still the driller.',
      },
    ],
    reinforcements: [
      { enemyId: 'bandit_thug', pos: { x: 14, y: 3 } },
      { enemyId: 'bandit_thug', pos: { x: 14, y: 8 } },
      { enemyId: 'bandit_slinger', pos: { x: 13, y: 1 } },
      { enemyId: 'bandit_earthbender', pos: { x: 13, y: 10 } },
    ],
    intro:
      'The driller comes up out of the pit on two treads, dragging a plume of oil smoke behind it.',
    tip: 'It leaks oil and churns the floor to mud. Firebenders: light the oil. Waterbenders: freeze the mud and the treads stop dead.',
  },
];

export const ENCOUNTER_BY_ID: ReadonlyMap<string, EncounterDef> = new Map(
  ENCOUNTERS.map((e) => [e.id, e]),
);
