/**
 * Emberwatch in the trial slice (RG-02): the arrival from Scene 3.1 and SF-2.1, "Wet ground".
 *
 * Lines are the merged script's (`docs/story/scripts/act2-sparks.md`), word for word. The slice
 * takes only what makes Emberwatch a place to land and the side fight's setting: Scene 3.1's
 * arrival, the retired cook, Tavi's introduction and Luli at the power yard (with her invitation
 * to a firebender, TR-01). The rest of MQ-03 (Edda, the clinic, Scenes 3.2 to 3.9) comes after the
 * pipeline is proven (owner, 2026-11-15).
 *
 * SF-2.1 is optional and pays its XP on a win and on "Carry on" alike (the script's rule for every
 * side fight). Not wired yet (trial log): the in-fight lines for the first time a puddle sparks
 * (no hook for a line on a combo event), the fight at night after rain (the slice keeps the
 * clock as it is), and the live line's shock (needs a surface rule).
 */
import type { Condition, DialogueVariant, StoryNode } from '../../../core/types';
import { PLACEHOLDER_PORTRAIT } from './placeholders';
import { staged } from './stage';

const LOST: Condition = { kind: 'flag', key: 'act1_lost', op: 'set' };
const NARRATOR = 'portrait.narrator';
const LULI = 'Luli';

/** XP SF-2.1 pays a head (4 line riggers at 100 over a baseline of 3), on a win or a loss. */
export const SF21_XP_PER_HEAD = 133;

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

const NODES: readonly StoryNode[] = [
  /* --------------------------------------- Scene 3.1, the parade ground (arrival) */
  say(
    'mq03_parade_ground',
    'Emberwatch',
    NARRATOR,
    [
      'Emberwatch was built for soldiers. The parade ground is covered in beans, spread out to dry on old tent canvas. More beans climb a rack that once held spears.',
    ],
    'mq03_emberwatch_explore',
  ),
  {
    id: 'mq03_emberwatch_explore',
    kind: 'explore',
    mapId: 'emberwatch_parade',
    objective: 'Look around Emberwatch. The power yard is east.',
    next: 'mq03_emberwatch_explore',
  },
  say(
    'mq03_retired_cook',
    'Retired cook',
    NARRATOR,
    [
      'Mind the edge. Those are the red ones and they roll. The spear rack’s the best trellis I ever had. Somebody spent real money making sure it wouldn’t fall over.',
    ],
    'mq03_slogans',
  ),
  say(
    'mq03_slogans',
    'Emberwatch',
    NARRATOR,
    [
      'Someone has painted over the slogans on the barracks wall. Where the paint is thin you can still read one word of the old one, under the new one: “Sow by the second moon.”',
    ],
    'mq03_emberwatch_explore',
  ),
  say(
    'mq03_tavi',
    'Tavi Ren',
    PLACEHOLDER_PORTRAIT,
    [
      'Come and meet the two people who’ll actually tell you things. Luli! Edda! I’ve brought you some trouble with good manners.',
    ],
    'mq03_emberwatch_explore',
  ),

  /* -------------------------------------------------------- The power yard */
  {
    id: 'mq03_power_yard_explore',
    kind: 'explore',
    mapId: 'emberwatch_power_yard',
    objective: 'The power yard. Luli keeps the line here.',
    next: 'mq03_power_yard_explore',
  },
  say(
    'mq03_luli',
    LULI,
    PLACEHOLDER_PORTRAIT,
    [
      'Mind the line. It’s live. That one lights the clinic, the ferry steps and forty kitchens over in Saltstep.',
    ],
    'mq03_luli_laughs',
  ),
  say(
    'mq03_luli_laughs',
    'The Power Yard',
    NARRATOR,
    ['She laughs. It sounds like an engine trying to start.'],
    'mq03_luli_proud',
  ),
  say(
    'mq03_luli_proud',
    LULI,
    PLACEHOLDER_PORTRAIT,
    [
      'Lightning into a wire, all day, in little careful pieces. Used to be a thing you did to show off. Now somebody’s grandmother can see her stairs. I’m proud of that. I’m also on my ninth day without a day off, so ask me again tomorrow and I’ll say something ruder.',
    ],
    'mq03_power_yard_explore',
    [
      // TR-01, the invitation only: a firebender in the party (Kaya or Tenzo) hears the offer.
      // The offer follows her line in the script, so the variant keeps both.
      {
        when: { kind: 'partyHas', element: 'fire' },
        lines: [
          'Lightning into a wire, all day, in little careful pieces. Used to be a thing you did to show off. Now somebody’s grandmother can see her stairs. I’m proud of that. I’m also on my ninth day without a day off, so ask me again tomorrow and I’ll say something ruder.',
          'You’ve got the hands for it. I’ll teach you. Not today, and not as a dare. First lesson is when to stop. If you want the lesson where you show how brave you are, find somebody else.',
        ],
      },
    ],
  ),

  /* --------------------------------------------- SF-2.1, Wet ground (optional) */
  say(
    'sf21_wet_ground',
    LULI,
    PLACEHOLDER_PORTRAIT,
    [
      'Off the wet! All of you! That line is live, and I am not explaining a puddle to four families!',
    ],
    'sf21_sabi',
  ),
  say(
    'sf21_sabi',
    'Sabi',
    NARRATOR,
    [
      'We strung that spur. Nine weeks. Then they said the job was done and so were we. It’s not stealing if nobody paid for the hanging of it.',
    ],
    'sf21_driver',
  ),
  say(
    'sf21_driver',
    'Bo-shan',
    'portrait.bo_shan',
    [
      'Lightning goes straight across a puddle. I told Pella. I saw it happen to a whole crew. She said ask someone else.',
    ],
    'sf21_battle',
    [
      {
        when: LOST,
        speaker: 'Gate Guard Dorin',
        portrait: 'portrait.dorin',
        lines: [
          'Pella told me Bo-shan says lightning can cross a puddle. She told me to ask someone else. Luli, I am asking. ...I see. I will write to her that he was right. She will not enjoy it.',
        ],
      },
    ],
  ),
  {
    id: 'sf21_battle',
    kind: 'battle',
    encounterId: 'enc_sf21_wet_ground',
    next: 'sf21_won',
    onDefeat: 'sf21_lost',
  },
  say(
    'sf21_won',
    LULI,
    PLACEHOLDER_PORTRAIT,
    [
      'I’m owed nine days off and nobody to cover them. Two of you can splice. Come back at six. It’s day wages. It’s something.',
    ],
    'mq03_power_yard_explore',
  ),
  {
    // Carry on: a side fight pays its XP on a loss too (the script's rule for every side fight).
    id: 'sf21_lost',
    kind: 'flags',
    set: {},
    grantXp: SF21_XP_PER_HEAD,
    next: 'sf21_lost_luli',
  },
  say(
    'sf21_lost_luli',
    LULI,
    PLACEHOLDER_PORTRAIT,
    ['I’d have given them the scrap. They only had to ask in daylight.'],
    'mq03_power_yard_explore',
  ),
];

/** Emberwatch's found conversations, each played over its own map beside its person. */
export const EMBERWATCH_STORY: readonly StoryNode[] = staged(
  staged(NODES, 'emberwatch_parade', {
    mq03_retired_cook: 'mq03_retired_cook',
    mq03_tavi: 'mq03_tavi',
  }),
  'emberwatch_power_yard',
  { mq03_luli: 'mq03_luli', sf21_wet_ground: 'sf21_sabi' },
);
