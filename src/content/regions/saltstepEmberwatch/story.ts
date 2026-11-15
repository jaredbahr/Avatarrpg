/**
 * Saltstep and Emberwatch's story. TODO(region): the beat sheet's scenes (`docs/pipeline-proof-plan.md` §3),
 * read against `docs/writing-guide.md` and `docs/story-bible.md`.
 */
import type { StoryNode } from '../../../core/types';

export const SALTSTEP_EMBERWATCH_STORY: readonly StoryNode[] = [
  {
    id: 'saltstep_emberwatch_welcome',
    kind: 'dialogue',
    speaker: 'Guide',
    portrait: 'npc.elder',
    lines: ['TODO(region): the first thing anybody says here.'],
    next: 'saltstep_emberwatch_explore',
    // Played over the map with the guide framed, not on the dialogue scene.
    presentation: { mapId: 'saltstep_emberwatch_hub', stage: { npc: 'saltstep_emberwatch_guide' } },
  },
  {
    id: 'saltstep_emberwatch_explore',
    kind: 'explore',
    mapId: 'saltstep_emberwatch_hub',
    objective: 'TODO(region): what the party is here to do.',
    next: 'saltstep_emberwatch_explore',
  },
];
