/**
 * SF-2.2, "The tipping platform" (Saltstep; sparring): Tavi's ferry apprentices and a crew of channel
 * hands, on a spare market platform at the midday lull. Losers wash the bowl-seller's bowls.
 *
 * Lines are the merged script's (`docs/story/scripts/act2-sparks.md`), word for word. The bout's rules
 * are ADR 0122 (owner, 2026-11-19). It pays a token `SF22_XP_PER_HEAD` on a win (the encounter's
 * `xpPerHead`) and on "Carry on" (`grantXp`) alike (owner, 2026-11-19).
 *
 * Not built yet: Saltstep's trust rising when the bout is played (community trust, C-25, has no
 * mechanism). The challenge itself has no line in the script: the apprentices' conversation opens
 * on Tavi's rules.
 */
import type { StoryNode } from '../../../core/types';
import { staged } from './stage';

/** XP the bout pays a head, won or carried on: a token, so RG-02 stays inside its band. */
export const SF22_XP_PER_HEAD = 15;

const NARRATOR = 'portrait.narrator';

const NODES: readonly StoryNode[] = [
  {
    id: 'sf22_rules',
    kind: 'dialogue',
    speaker: 'Tavi Ren',
    portrait: 'portrait.tavi',
    lines: [
      'No bending the platform. Bend whatever else you like. If you fall in, swim to the left. The right’s where the fish-seller empties her bucket.',
    ],
    next: 'sf22_battle',
  },
  {
    id: 'sf22_battle',
    kind: 'battle',
    encounterId: 'enc_sf22_platform',
    next: 'sf22_won',
    onDefeat: 'sf22_lost',
  },
  {
    id: 'sf22_won',
    kind: 'dialogue',
    speaker: 'Channel hand',
    portrait: NARRATOR,
    lines: ['Fair. We wash. You can dry, since you’re so quick.'],
    next: 'mq02_market_explore',
  },
  {
    // Carry on: a side fight pays its XP on a loss too (the script's rule for every side fight).
    id: 'sf22_lost',
    kind: 'flags',
    set: {},
    grantXp: SF22_XP_PER_HEAD,
    next: 'sf22_bowls',
  },
  {
    id: 'sf22_bowls',
    kind: 'dialogue',
    speaker: 'Bowl-seller',
    portrait: NARRATOR,
    lines: ['Sixty bowls. Sand’s in the tub. Don’t stack them wet.'],
    next: 'mq02_market_explore',
  },
];

/** The bout's conversations, played over the market beside the apprentices or the bowl-seller. */
export const SF22_STORY: readonly StoryNode[] = staged(NODES, 'saltstep_market', {
  sf22_rules: 'sf22_apprentices',
  sf22_won: 'sf22_apprentices',
  sf22_bowls: 'mq02_bowl_seller',
});
