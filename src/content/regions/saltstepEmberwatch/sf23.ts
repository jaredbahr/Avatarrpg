/**
 * SF-2.3, "The bridge toll" (the river road; optional): a corporal and six guards from another quarry on the
 * supply-control list, unpaid for two months, have put a pole across the plank bridge and ask a "toll" in food.
 *
 * Lines are the merged script's (`docs/story/scripts/act2-sparks.md`, SF-2.3), word for word. The win ("the pole
 * comes up") and the Carry on ("they take one sack of cabbages and wave the cart through") are prose in the script and
 * narrator lines here, as SF-2.1's are; on the Act I loss branch the driver is Dorin and says his line instead of
 * Bo-shan's. The script gives no words for taking the fight up or walking away from it: those are placeholders for
 * the writing pass. It pays a token `SF23_XP_PER_HEAD` on a win (the encounter's `xpPerHead`) and on "Carry on"
 * (`grantXp`) alike, as SF-2.2 does.
 *
 * The river road's later states follow `sf23_pole_up` and `sf23_one_sack` (`RIVER_ROAD.sceneGates`, ADR 0123): the
 * pole raised and the camp gone after a win, the pole raised and one sack by the cold fire after Carry on.
 */
import type { Condition, StoryNode } from '../../../core/types';
import { staged } from './stage';

/** XP the toll fight pays a head, won or carried on: a token, as SF-2.2's, so RG-02 stays inside its band. */
export const SF23_XP_PER_HEAD = 15;

const LOST: Condition = { kind: 'flag', key: 'act1_lost', op: 'set' };
const NARRATOR = 'portrait.narrator';
const CORPORAL = 'Corporal';
const ROAD = 'river_road_explore';

const NODES: readonly StoryNode[] = [
  {
    id: 'sf23_toll',
    kind: 'dialogue',
    speaker: CORPORAL,
    portrait: NARRATOR,
    lines: [
      'One sack off every cart. I’m not proud of it. I’ve got six who haven’t eaten hot since the last moon, and I’m the one they look at.',
    ],
    next: 'sf23_choice',
  },
  {
    id: 'sf23_choice',
    kind: 'choice',
    speaker: CORPORAL,
    portrait: NARRATOR,
    prompt: 'PLACEHOLDER (story): the party decides whether to fight for the bridge.',
    options: [
      {
        label: 'PLACEHOLDER (story): take the bridge.',
        detail: 'PLACEHOLDER (story): the guards hold the bridge; the ford is the way round.',
        next: 'sf23_battle',
      },
      {
        label: 'PLACEHOLDER (story): not now.',
        detail: 'PLACEHOLDER (story): the party walks away; the corporal stays at the camp.',
        next: 'sf23_not_now',
      },
    ],
  },
  {
    id: 'sf23_not_now',
    kind: 'dialogue',
    speaker: CORPORAL,
    portrait: NARRATOR,
    lines: ['PLACEHOLDER (story): the corporal’s answer when the party walks away.'],
    next: ROAD,
  },
  {
    id: 'sf23_battle',
    kind: 'battle',
    encounterId: 'enc_sf23_bridge_toll',
    next: 'sf23_pole_up',
    onDefeat: 'sf23_lost',
  },
  {
    id: 'sf23_pole_up',
    kind: 'dialogue',
    speaker: 'The River Road',
    portrait: NARRATOR,
    lines: ['The pole comes up.'],
    next: 'sf23_won',
  },
  {
    id: 'sf23_won',
    kind: 'dialogue',
    speaker: CORPORAL,
    portrait: NARRATOR,
    lines: [
      'Where did you say? A kitchen with a late shelf? ...We’ll walk it. We’ll keep our hands where the cook can see them.',
    ],
    next: ROAD,
  },
  {
    // Carry on: a side fight pays its XP on a loss too (the script's rule for every side fight).
    id: 'sf23_lost',
    kind: 'flags',
    set: {},
    grantXp: SF23_XP_PER_HEAD,
    next: 'sf23_one_sack',
  },
  {
    id: 'sf23_one_sack',
    kind: 'dialogue',
    speaker: 'The River Road',
    portrait: NARRATOR,
    lines: ['They take one sack of cabbages and wave the cart through.'],
    next: 'sf23_driver',
  },
  {
    id: 'sf23_driver',
    kind: 'dialogue',
    speaker: 'Bo-shan',
    portrait: 'portrait.bo_shan',
    lines: ['That was the good sack.'],
    next: ROAD,
    variants: [
      {
        when: LOST,
        speaker: 'Gate Guard Dorin',
        portrait: 'portrait.dorin',
        lines: ['I have entered it as a delivery. It was, in a sense, delivered.'],
      },
    ],
  },
];

/** The toll's conversations, played over the river road beside the corporal at the guards' camp. */
export const SF23_STORY: readonly StoryNode[] = staged(NODES, 'river_road', {
  sf23_toll: 'sf23_corporal',
  sf23_choice: 'sf23_corporal',
  sf23_not_now: 'sf23_corporal',
});
