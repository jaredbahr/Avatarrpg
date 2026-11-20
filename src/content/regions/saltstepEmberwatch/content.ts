/** Saltstep and Emberwatch's data (see `manifest.ts`). */
import type { RegionContent, StoryGroup } from '../../regions/types';
import { withPartyVoices } from '../../story/partyVoices';
import { SALTSTEP_EMBERWATCH_MAPS } from './maps';
import { SALTSTEP_EMBERWATCH_ENCOUNTERS } from './encounters';
import { MQ02_STORY } from './mq02';
import { EMBERWATCH_STORY } from './emberwatch';
import { SF22_STORY } from './sf22';

const STORY_GROUPS: readonly StoryGroup[] = [
  {
    slug: 'mq02-paper-and-stone',
    title: 'MQ-02 Paper and Stone',
    source: '../regions/saltstepEmberwatch/mq02.ts',
    nodes: MQ02_STORY,
  },
  {
    slug: 'emberwatch',
    title: 'Emberwatch (Scene 3.1 and SF-2.1)',
    source: '../regions/saltstepEmberwatch/emberwatch.ts',
    nodes: EMBERWATCH_STORY,
  },
  {
    slug: 'sf22-tipping-platform',
    title: 'SF-2.2 The tipping platform',
    source: '../regions/saltstepEmberwatch/sf22.ts',
    nodes: SF22_STORY,
  },
];

export const SALTSTEP_EMBERWATCH_CONTENT: RegionContent = {
  id: 'saltstep_emberwatch',
  maps: SALTSTEP_EMBERWATCH_MAPS,
  storyGroups: STORY_GROUPS,
  story: withPartyVoices(STORY_GROUPS.flatMap((group) => group.nodes)),
  encounters: SALTSTEP_EMBERWATCH_ENCOUNTERS,
  anchors: [],
  residents: [],
  backgroundRoles: [],
};
