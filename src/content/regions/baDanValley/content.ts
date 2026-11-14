/** Ba Dan valley's data (see `manifest.ts`). */
import type { StoryGroup, RegionContent } from '../types';
import { ENCOUNTERS } from '../../encounters';
import { BA_DAN_VILLAGE } from '../../maps/village';
import { RIVERSIDE } from '../../maps/riverside';
import { COMBAT_MAPS } from '../../maps/combat';
import { connectAct1 } from '../../maps/world';
import { stageGateWatch } from '../../maps/gateWatch';
import { ACT1_NODES } from '../../story/act1';
import { RIVERSIDE_STORY } from '../../story/riverside';
import { WORLD_STORY } from '../../story/world';
import { DISCOVERY_STORY } from '../../story/discoveries';
import { RETURN_STORY } from '../../story/return';
import { BA_DAN_DAY_STORY } from '../../story/baDanDay';
import { SQ01_STORY } from '../../story/sq01Cabbages';
import { SQ02_STORY } from '../../story/sq02OfficialGate';
import { SQ03_STORY } from '../../story/sq03GaosLedger';
import { withPartyVoices } from '../../story/partyVoices';
import { BA_DAN_ANCHORS, BA_DAN_BACKGROUND_ROLES, BA_DAN_RESIDENTS } from '../../residents/baDan';

const STORY_GROUPS: readonly StoryGroup[] = [
  { slug: 'act1', title: 'Act 1', source: 'act1.ts', nodes: ACT1_NODES },
  { slug: 'riverside', title: 'Riverside', source: 'riverside.ts', nodes: RIVERSIDE_STORY },
  { slug: 'world', title: 'World', source: 'world.ts', nodes: WORLD_STORY },
  { slug: 'discoveries', title: 'Discoveries', source: 'discoveries.ts', nodes: DISCOVERY_STORY },
  { slug: 'return', title: 'Return', source: 'return.ts', nodes: RETURN_STORY },
  { slug: 'ba-dan-day', title: 'Ba Dan day', source: 'baDanDay.ts', nodes: BA_DAN_DAY_STORY },
  {
    slug: 'sq01-cabbages',
    title: 'SQ-01 Too Many Cabbages',
    source: 'sq01Cabbages.ts',
    nodes: SQ01_STORY,
  },
  {
    slug: 'sq02-official-gate',
    title: 'SQ-02 A Very Official Gate',
    source: 'sq02OfficialGate.ts',
    nodes: SQ02_STORY,
  },
  {
    slug: 'sq03-gaos-ledger',
    title: 'SQ-03 Gao’s Other Ledger',
    source: 'sq03GaosLedger.ts',
    nodes: SQ03_STORY,
  },
];

export const BA_DAN_VALLEY_CONTENT: RegionContent = {
  id: 'ba_dan_valley',
  maps: [BA_DAN_VILLAGE, RIVERSIDE, ...COMBAT_MAPS].map(connectAct1).map(stageGateWatch),
  storyGroups: STORY_GROUPS,
  story: withPartyVoices(STORY_GROUPS.flatMap((group) => group.nodes)),
  encounters: ENCOUNTERS,
  anchors: BA_DAN_ANCHORS,
  residents: BA_DAN_RESIDENTS,
  backgroundRoles: BA_DAN_BACKGROUND_ROLES,
};
