/** Saltstep and Emberwatch's data (see `manifest.ts`). */
import type { RegionContent, StoryGroup } from '../../regions/types';
import { withPartyVoices } from '../../story/partyVoices';
import { SALTSTEP_EMBERWATCH_MAPS } from './maps';
import { SALTSTEP_EMBERWATCH_ENCOUNTERS } from './encounters';
import { MQ02_STORY } from './mq02';
import { EMBERWATCH_STORY } from './emberwatch';
import { RIVER_ROAD_STORY } from './riverRoad';
import { SF22_STORY } from './sf22';
import { SF23_STORY } from './sf23';

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
  {
    slug: 'river-road',
    title: 'The river road (blockout)',
    source: '../regions/saltstepEmberwatch/riverRoad.ts',
    nodes: RIVER_ROAD_STORY,
  },
  {
    slug: 'sf23-bridge-toll',
    title: 'SF-2.3 The bridge toll',
    source: '../regions/saltstepEmberwatch/sf23.ts',
    nodes: SF23_STORY,
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
