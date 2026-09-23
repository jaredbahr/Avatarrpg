import type { StoryNode } from '../../core/types';

/**
 * PLACEHOLDERS, NOT WRITING (ADR 0047 W5a). W6 replaces every node here.
 *
 * Hanru's watch and Pella's riverside afternoon need a bound NpcDef before
 * their resident records validate (a slot's `npc`, and the fallback's, must
 * name one), and an NpcDef needs a story node. These nodes exist only for
 * that. Each line is marked in the text itself, so a placeholder can't pass
 * for a finished scene in play. Dialogue for them, the handover scene and the
 * school notice is W6's (§8).
 */
export const RESIDENT_PLACEHOLDER_STORY: readonly StoryNode[] = [
  {
    id: 'hanru_watch',
    kind: 'dialogue',
    speaker: 'Hanru',
    portrait: 'portrait.narrator',
    lines: ["[Placeholder: Hanru's watch conversation. W6 writes it.]"],
    next: 'hanru_watch_leave',
  },
  {
    // Back to whichever village hub is current, as the discoveries do.
    id: 'hanru_watch_leave',
    kind: 'branch',
    flag: 'act1_complete',
    ifSet: 'village_return_explore',
    ifUnset: 'village_explore',
  },
  {
    id: 'riverside_pella',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: ["[Placeholder: Pella's riverside afternoon. W6 writes it.]"],
    next: 'riverside_explore',
  },
];
