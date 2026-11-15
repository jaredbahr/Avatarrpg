/** Saltstep and Emberwatch's data (see `manifest.ts`). */
import type { RegionContent, StoryGroup } from '../../regions/types';
import { withPartyVoices } from '../../story/partyVoices';
import { SALTSTEP_EMBERWATCH_HUB } from './map';
import { SALTSTEP_EMBERWATCH_STORY } from './story';

const STORY_GROUPS: readonly StoryGroup[] = [
  {
    slug: 'saltstep-emberwatch',
    title: 'Saltstep and Emberwatch',
    source: '../regions/saltstepEmberwatch/story.ts',
    nodes: SALTSTEP_EMBERWATCH_STORY,
  },
];

export const SALTSTEP_EMBERWATCH_CONTENT: RegionContent = {
  id: 'saltstep_emberwatch',
  maps: [SALTSTEP_EMBERWATCH_HUB],
  storyGroups: STORY_GROUPS,
  story: withPartyVoices(STORY_GROUPS.flatMap((group) => group.nodes)),
  encounters: [],
  anchors: [],
  residents: [],
  backgroundRoles: [],
};
