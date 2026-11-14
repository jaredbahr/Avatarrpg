/**
 * Why each hero keeps going (saga outline, decision 22; story bible C-31).
 *
 * After the Driller, the quarry floor holds the off-ledger cargo and the
 * Driller's cab, and each selected hero finds one thing there that their own
 * personal quest pays off later. A find's marker stands on the map only while
 * its hero is in the party, so an absent hero is never voiced; its base lines
 * are a narrator's description of the same object, kept for a hero who drops
 * out mid-conversation. Jinu's find is in the gate office on the walk home.
 * Sura's is the culvert in the Cutting (`cutting_culvert`), not here.
 *
 * The party-neutral reason always plays: Bo-shan's delivery book, found in the
 * Driller's cab, lists deliveries to places no map shows (`quarry_ledger`).
 *
 * Each find sets `reason.<hero>`, which hides its marker and is what a later
 * act reads (the PQ named beside each entry). Nothing here grants anything.
 */

import type { Condition, NpcDef, StoryNode, Vec2 } from '../../core/types';
import { CHARACTER_BY_ID } from '../characters';

interface ReasonFind {
  readonly hero: string;
  /** The personal quest that pays it off. */
  readonly pays: string;
  readonly map: 'quarry_floor' | 'quarry_gate';
  readonly pos: Vec2;
  /** What the marker is called on the map: the object, never the hero. */
  readonly name: string;
  /** A placeholder until the art batch draws the object (see the PR's art list). */
  readonly sprite: string;
  /** The object as the narrator sees it. */
  readonly seen: readonly string[];
  /** The hero's own lines. */
  readonly lines: readonly string[];
}

export const REASON_FINDS: readonly ReasonFind[] = [
  {
    hero: 'kaya',
    pays: 'PQ-01',
    map: 'quarry_floor',
    pos: { x: 14, y: 3 },
    name: 'Crate with a lantern stamp',
    sprite: 'prop.barrel',
    seen: [
      'A crate stamped with a lantern with a crooked handle. Inside, lamp glass is packed in straw.',
    ],
    lines: [
      'Hold on. That stamp, the lantern with the crooked handle. That’s my old neighbour’s workshop. We grew up two doors apart.',
      'Lamp glass, packed in straw. She always packed it like that, so it wouldn’t chime in the cart.',
      'She wrote to me after the fire. I never wrote back.',
    ],
  },
  {
    hero: 'tenzo',
    pays: 'PQ-02',
    map: 'quarry_floor',
    pos: { x: 15, y: 3 },
    name: 'Ration crates',
    sprite: 'prop.barrel',
    seen: [
      'Ration crates addressed to the workers’ cookhouse. Someone signed for them a month ago. The seals have never been broken.',
    ],
    lines: [
      'Rice, dried beans, salt fish. Addressed to the workers’ cookhouse and signed for a month ago.',
      'The seals have never been broken. Somebody signed for these and let the cookhouse go cold. Very neat signature.',
      'I’m keeping the receipt.',
    ],
  },
  {
    hero: 'nilak',
    pays: 'PQ-03',
    map: 'quarry_floor',
    pos: { x: 14, y: 8 },
    name: 'Crate marked “medical supplies”',
    sprite: 'prop.barrel',
    seen: [
      'A crate stencilled “medical supplies” under a healing-house emblem. Inside are wrist straps and buckled cuffs, and nothing else.',
    ],
    lines: [
      'That emblem is from the healing house I trained in. I used to doodle it in the margins of every lesson.',
      '“Medical supplies,” it says. Straps and cuffs. Not a single bandage.',
      'They put my house’s name on this.',
    ],
  },
  {
    hero: 'nima',
    pays: 'PQ-07',
    map: 'quarry_floor',
    pos: { x: 15, y: 8 },
    name: 'Crate tied with a ribbon',
    sprite: 'prop.barrel',
    seen: [
      'A supply crate tied with a faded ribbon in an odd, flat knot. Its address has been scraped off and painted over.',
    ],
    lines: [
      'That knot. You tie it so it comes undone with one pull and never by itself. It’s a sanctuary knot.',
      'They tie it on supplies for the shelters up the mountain. Somebody scraped the address off and sent this here instead.',
      'I left there without telling anyone. I kept waiting for a good excuse to go back.',
    ],
  },
  {
    hero: 'bo',
    pays: 'PQ-05',
    map: 'quarry_floor',
    pos: { x: 13, y: 5 },
    name: 'Labour roster in the Driller’s cab',
    sprite: 'world.school_notice',
    seen: [
      'A labour roster is pinned inside the Driller’s cab: names, shifts, and a column headed “owed” that nobody has filled in.',
    ],
    lines: [
      'A labour roster. Names, shifts, and a column for what each of them is owed. Empty, all the way down.',
      'Next month’s shift has my old crew on it. Renn first. He ran the hoist for me for six years.',
      'He doesn’t know yet what he’d be coming to.',
    ],
  },
  {
    hero: 'wen',
    pays: 'PQ-10',
    map: 'quarry_floor',
    pos: { x: 13, y: 6 },
    name: 'The Driller’s drive housing',
    sprite: 'world.runoff_marker',
    seen: [
      'The Driller’s drive housing hangs open. Inside, a pressure regulator has been fitted without a manual release.',
    ],
    lines: [
      'That regulator is mine. I drew it on a napkin in a Republic City tea shop, then for a patent clerk who yawned the whole time.',
      'There should be a release lever right here, so a driver can dump the pressure by hand. Someone took it out.',
      'Without it, this thing stops when somebody else decides it should.',
    ],
  },
  {
    hero: 'lin_mei',
    pays: 'PQ-06',
    map: 'quarry_floor',
    pos: { x: 5, y: 2 },
    name: 'Gallery plan',
    sprite: 'world.school_notice',
    seen: [
      'A gallery plan is nailed up beside the barred doors. A new tunnel has been drawn straight through a section hatched as unsafe.',
    ],
    lines: [
      'That hatching is mine. I surveyed this face three years ago and marked that section unsafe. My initials, there.',
      'He drew his gallery straight through it. He didn’t even rub my mark out. He drew right over the top.',
      'I thought the mark was enough.',
    ],
  },
  {
    hero: 'riko',
    pays: 'PQ-09',
    map: 'quarry_floor',
    pos: { x: 5, y: 9 },
    name: 'Guards’ practice board',
    sprite: 'world.school_notice',
    seen: [
      'A board by the guards’ shelter is chalked with diagrams of holds: how to turn a wrist, where to set a thumb.',
    ],
    lines: [
      'Grips. Somebody taught the guards here how to hold a person still.',
      'That one, thumb behind the elbow and turn at the wrist. My teacher taught me that, above a laundry, with the sheets drying round us.',
      'She told me it was for keeping people from getting hurt.',
    ],
  },
  {
    hero: 'jinu',
    pays: 'PQ-08',
    map: 'quarry_gate',
    pos: { x: 6, y: 1 },
    name: 'Bundle in the gate office',
    sprite: 'world.school_notice',
    seen: [
      'In the gate office, a bundle of letters sits under a stone: the ones Mira’s messengers carried up the hill. The seals are whole.',
    ],
    lines: [
      'Letters. A whole bundle of them, under a stone. Mira’s, and the ones her messengers carried up for everybody else.',
      'Nobody opened them. Nobody sent them on, either. They just put a rock on them.',
      'I’ll carry them down. Whoever these are addressed to has been waiting a month.',
    ],
  },
];

export const reasonFlag = (hero: string): string => `reason.${hero}`;

const rescued: Condition = { kind: 'flag', key: 'act1_complete', op: 'set' };

/** The markers a map shows for the finds on it: only while their hero is in the party. */
export function reasonMarkers(mapId: string): NpcDef[] {
  return REASON_FINDS.filter((find) => find.map === mapId).map((find) => ({
    id: `reason_${find.hero}`,
    name: find.name,
    pos: find.pos,
    sprite: find.sprite,
    node: `reason_${find.hero}`,
    when: {
      kind: 'all',
      of: [
        rescued,
        { kind: 'partyHas', characterId: find.hero },
        { kind: 'flag', key: reasonFlag(find.hero), op: 'unset' },
      ],
    },
  }));
}

const BACK: Readonly<Record<ReasonFind['map'], string>> = {
  quarry_floor: 'quarry_after_explore',
  quarry_gate: 'gate_return_explore',
};

export const REASON_STORY: readonly StoryNode[] = [
  /*
   * The party-neutral reason, after the workers are out. Senn, the quarry
   * company's old tallyman, reads it: one passing detail of his outsider's
   * background (C-33). The book names no place; the erased places surface in
   * MQ-05.
   */
  {
    id: 'quarry_ledger',
    kind: 'dialogue',
    speaker: 'The Quarry',
    portrait: 'portrait.narrator',
    lines: [
      'Behind the Driller’s seat, wedged under a coil of hose, is the delivery book from Bo-shan’s cart.',
      'His handwriting stops a month ago, at a sack of cabbages. After that the entries carry on in another hand: sealed crates, counted out at night.',
      'Senn kept the tallies here for the quarry company, before the company left. He reads the last pages twice. “I know every road this quarry ever sent stone down. These aren’t on any of them.”',
      'Bo-shan takes the book back and turns the pages slowly. He does not hand it to anyone else.',
    ],
    next: 'act1_evening',
  },
  ...REASON_FINDS.flatMap((find): StoryNode[] => {
    const hero = CHARACTER_BY_ID.get(find.hero);
    if (!hero) throw new Error(`Unknown hero for a reason find: ${find.hero}`);
    return [
      {
        id: `reason_${find.hero}`,
        kind: 'dialogue',
        speaker: find.name,
        portrait: 'portrait.narrator',
        lines: find.seen,
        variants: [
          {
            when: { kind: 'partyHas', characterId: hero.id },
            speaker: hero.name,
            portrait: hero.portrait,
            lines: find.lines,
          },
        ],
        next: `reason_${find.hero}_kept`,
      },
      {
        id: `reason_${find.hero}_kept`,
        kind: 'flags',
        set: { [reasonFlag(find.hero)]: true },
        next: BACK[find.map],
      },
    ];
  }),
];
