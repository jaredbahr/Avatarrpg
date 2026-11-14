/**
 * SQ-01, Too Many Cabbages (story bible Part 06, "Ba Dan and the quarry").
 *
 * Entry is the existing `pella_tips` conversation: once `pella_asked` is set, Pella hands over
 * Bo-shan's packing list. With the list, the party can find his tipped sled on the Forest
 * Road (`sq01_sled`, staged in `maps/world.ts`), sort his load from the quarry company's crates,
 * read his note, and decide where the load goes. The choice is recorded in `sq01.cabbages`.
 *
 * Payoffs after the rescue: Pella's homecoming remembers the sled, her corrected list of helpers
 * names the party (with a note in the margin after the leverage choice), and the end card recaps
 * it. Bo-shan's later cart, the persistent change, waits for art; MQ-11 is the payoff after an
 * Act I loss. Nothing here gates the main route: the sled is optional and grants no XP.
 */

import type { Condition, StoryNode } from '../../core/types';

const SLED = 'Overturned sled';
const NARRATOR = 'portrait.narrator';
const PELLA = 'Pella';

export const SQ01_FLAG = 'sq01.cabbages';
const outcome = (value: 'families' | 'crew' | 'leverage'): Condition => ({
  kind: 'flag',
  key: SQ01_FLAG,
  op: 'eq',
  value,
});

/** The party found the sled and chose where the load went. */
export const SQ01_RESOLVED: Condition = { kind: 'flag', key: SQ01_FLAG, op: 'set' };
/** Pella's list, which the sled needs: only the party that heard her can sort the load. */
export const SQ01_HAS_LIST: Condition = { kind: 'visited', nodeId: 'sq01_packing_list' };

export const SQ01_STORY: readonly StoryNode[] = [
  /* -------------------------------------------------- Pella's packing list */
  {
    id: 'sq01_packing_list',
    kind: 'dialogue',
    speaker: PELLA,
    portrait: 'portrait.pella',
    lines: [
      'Wait. Take this. It is his packing list. I wrote it, because he spells turnip with two Ps.',
      'Ten sacks of cabbages. Six of turnips. One cabbage on top, for luck. The luck one was his idea.',
      'Nothing above the seat. I wrote that twice. Underlined.',
    ],
    next: 'village_explore',
  },

  /* ----------------------------------------------------------- The sled */
  {
    id: 'sq01_sled',
    kind: 'dialogue',
    speaker: SLED,
    portrait: NARRATOR,
    lines: [
      'A delivery sled lies on its side in the ditch. Cabbage leaves trail up the verge toward the quarry.',
      'Sacks and crates are tipped in one heap. Some crates carry the quarry company’s stencil: LAMP OIL. ROPE. NOT FOOD.',
      'You check the sacks against Pella’s list. Ten of cabbages, six of turnips. The cabbages were stacked higher than the rail; you can see where they began to slide.',
      'One very round cabbage sits by itself on a crate, as if somebody put it there carefully.',
    ],
    next: 'sq01_note',
  },
  {
    id: 'sq01_note',
    kind: 'dialogue',
    speaker: SLED,
    portrait: NARRATOR,
    lines: [
      'A note is jammed into the sled’s rail, in big letters:',
      '“SLED TIPPED. LEFT IT. THEY SAY PEOPLE ARE STUCK IN THE LOWER GALLERIES. GONE DOWN TO HELP. BACK TUESDAY. — B.”',
      'Underneath, smaller: “P — I WILL DO MY OWN CHORES.”',
      'The sun is already on the sacks. The cabbages will not keep for long.',
    ],
    next: 'sq01_choice',
  },
  {
    id: 'sq01_choice',
    kind: 'choice',
    speaker: SLED,
    portrait: NARRATOR,
    prompt: 'Where does Bo-shan’s load go?',
    options: [
      {
        label: 'Send it home to Ba Dan',
        detail: 'Right the sled and leave word for Dorin’s handcart. Ba Dan’s tables are short.',
        next: 'sq01_families',
        setFlags: { [SQ01_FLAG]: 'families' },
      },
      {
        label: 'Keep some for the trapped crews',
        detail:
          'Tie up a few sacks for whoever comes out of the quarry hungry. The rest goes home.',
        next: 'sq01_crew',
        setFlags: { [SQ01_FLAG]: 'crew' },
      },
      {
        label: 'Hide it all to bargain with',
        detail:
          'Hungry guards might trade for food. Ba Dan goes without, and Pella will hear of it.',
        next: 'sq01_leverage',
        setFlags: { [SQ01_FLAG]: 'leverage' },
      },
    ],
  },
  {
    id: 'sq01_families',
    kind: 'dialogue',
    speaker: SLED,
    portrait: NARRATOR,
    lines: [
      'You heave the sled back onto its runners and stack it the way Pella’s list says. Nothing above the rail.',
      'On the back of the note you write: “FOR BA DAN. ASK DORIN FOR THE HANDCART.” You pin it where the road keeper will see it on her rounds.',
      'The round cabbage goes back on top.',
    ],
    next: 'sq01_leave',
  },
  {
    id: 'sq01_crew',
    kind: 'dialogue',
    speaker: SLED,
    portrait: NARRATOR,
    lines: [
      'You heave the sled back onto its runners and stack it the way Pella’s list says. Nothing above the rail.',
      'Three sacks of cabbages you tie into a bundle to carry. Whoever comes out of those galleries will want feeding.',
      'On the back of the note you write: “SEVEN SACKS FOR BA DAN. THREE WENT UP THE HILL FOR THE CREWS.” You pin it where the road keeper will see it.',
      'The round cabbage goes back on top.',
    ],
    next: 'sq01_leave',
  },
  {
    id: 'sq01_leverage',
    kind: 'dialogue',
    speaker: SLED,
    portrait: NARRATOR,
    lines: [
      'You drag the sled into the bracken and pull ferns over it. Food is worth something to hungry guards. Better to know what the gate wants first.',
      'Bo-shan’s note goes in a pocket.',
      'The round cabbage ends up on top of the ferns. It does not help with the hiding.',
    ],
    next: 'sq01_leave',
  },
  {
    id: 'sq01_sled_again',
    kind: 'dialogue',
    speaker: SLED,
    portrait: NARRATOR,
    lines: [
      'The sled waits upright by the road, its note pinned on top for the handcart.',
      'Something has eaten one corner of the round cabbage. Small teeth.',
    ],
    variants: [
      {
        when: outcome('leverage'),
        lines: [
          'The ferns over the sled have started to wilt. So has the round cabbage.',
          'A turtle duck is standing on it.',
        ],
      },
    ],
    next: 'sq01_leave',
  },
  {
    // Back to the Forest Road hub. The sled lies east of the roadblock, so it is only ever
    // reached once the road is open.
    id: 'sq01_leave',
    kind: 'branch',
    flag: 'act1_complete',
    ifSet: 'forest_return_explore',
    ifUnset: 'forest_after_explore',
  },

  /* ------------------------------------------------- The payoff, at home */
  {
    // Pella's corrected list. Opened from Pella once her homecoming has been heard.
    id: 'sq01_pella_list',
    kind: 'dialogue',
    speaker: PELLA,
    portrait: 'portrait.pella',
    lines: [
      'I made a new list. Everybody who helped bring Bo-shan home. You can read it, but do not touch the chalk.',
      'Leto. Amri. Hesra. Senn. Dorin, for the handcart. Mira, for the soup. And you, for the sled. I wrote yours biggest.',
      'Bo-shan is not on it. He knows what he did.',
    ],
    variants: [
      {
        when: outcome('crew'),
        lines: [
          'I made a new list. Everybody who helped bring Bo-shan home. You can read it, but do not touch the chalk.',
          'Leto. Amri. Hesra. Senn. Dorin, for the handcart. Mira, for the soup. And you, for the sled, and for the cabbages you carried up for the crews.',
          'Hesra says they were the best cabbages she has ever eaten. I am checking with the others.',
          'Bo-shan is not on it. He knows what he did.',
        ],
      },
      {
        when: outcome('leverage'),
        lines: [
          'I made a new list. Everybody who helped bring Bo-shan home.',
          'Leto. Amri. Hesra. Senn. Dorin, for the handcart. Mira, for the soup. Dorin again, for finding the sled under the ferns.',
          'You are on it too. I have not decided about the underline yet.',
          'Gao made the soft ones into pickles. There were a lot of soft ones.',
        ],
      },
    ],
    next: 'village_return_explore',
  },
];
