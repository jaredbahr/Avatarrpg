/**
 * The one place the rest of the game gets its content from.
 *
 * `CONTENT` is a `ContentIndex` — maps keyed by id, handed to every core rules
 * call. Building it here (rather than letting core import the data directly)
 * is what keeps `src/core/` runnable against a tiny fixture bundle in tests.
 */

import type { ContentIndex, StatusId, SurfaceId } from '../core/types';
import { ABILITY_BY_ID, ALL_ABILITIES } from './abilities';
import { ASSETS } from './assets/manifest';
import { CHARACTERS, CHARACTER_BY_ID } from './characters';
import { DISCIPLINES, DISCIPLINE_BY_ID } from './disciplines';
import { COMBOS } from './combos';
import { ELEMENT_BY_ID } from './elements';
import { ENCOUNTERS, ENCOUNTER_BY_ID } from './encounters';
import { ENEMIES, ENEMY_BY_ID } from './enemies';
import { RIVERSIDE } from './maps/riverside';
import { RIVERSIDE_STORY } from './story/riverside';
import { BA_DAN_VILLAGE } from './maps/village';
import { COMBAT_MAPS } from './maps/combat';
import { connectAct1 } from './maps/world';
import { DISCOVERY_STORY } from './story/discoveries';
import { WORLD_STORY } from './story/world';
import { PROPS, PROP_BY_ID } from './props';
import { STATUSES, STATUS_BY_ID } from './statuses';
import { SURFACES, SURFACE_BY_ID } from './surfaces';
import { UNIVERSAL_ABILITY_IDS } from './abilities';
import { ACT1_NODES } from './story/act1';
import { withPartyVoices } from './story/partyVoices';
import { RETURN_STORY } from './story/return';
import { BA_DAN_DAY_STORY } from './story/baDanDay';
import type { ContentBundle } from './schemas';
import type { BackgroundRole, MapDef, ResidentDef, StoryNode, WorldAnchor } from '../core/types';
import { BA_DAN_ANCHORS, BA_DAN_BACKGROUND_ROLES, BA_DAN_RESIDENTS } from './residents/baDan';

export const ALL_MAPS: readonly MapDef[] = [BA_DAN_VILLAGE, RIVERSIDE, ...COMBAT_MAPS].map(
  connectAct1,
);
export const ALL_STORY: readonly StoryNode[] = withPartyVoices([
  ...ACT1_NODES,
  ...RIVERSIDE_STORY,
  ...WORLD_STORY,
  ...DISCOVERY_STORY,
  ...RETURN_STORY,
  ...BA_DAN_DAY_STORY,
]);

/** Living-world records (ADR 0047 §2): Ba Dan's anchors, residents and background roles. */
const ANCHORS: readonly WorldAnchor[] = BA_DAN_ANCHORS;
const RESIDENTS: readonly ResidentDef[] = BA_DAN_RESIDENTS;
const BACKGROUND_ROLES: readonly BackgroundRole[] = BA_DAN_BACKGROUND_ROLES;

/** The flat form, used by the validation test and the balance report. */
export const CONTENT_BUNDLE: ContentBundle = {
  abilities: ALL_ABILITIES,
  characters: CHARACTERS,
  disciplines: DISCIPLINES,
  enemies: ENEMIES,
  maps: ALL_MAPS,
  assets: ASSETS,
  encounters: ENCOUNTERS,
  statuses: STATUSES,
  surfaces: SURFACES,
  props: PROPS,
  combos: COMBOS,
  story: ALL_STORY,
  anchors: ANCHORS,
  residents: RESIDENTS,
  backgroundRoles: BACKGROUND_ROLES,
};

/** The indexed form, used by the rules. */
export const CONTENT: ContentIndex = {
  elements: ELEMENT_BY_ID,
  abilities: ABILITY_BY_ID,
  characters: CHARACTER_BY_ID,
  disciplines: DISCIPLINE_BY_ID,
  enemies: ENEMY_BY_ID,
  maps: new Map(ALL_MAPS.map((m) => [m.id, m])),
  encounters: ENCOUNTER_BY_ID,
  statuses: STATUS_BY_ID as ReadonlyMap<StatusId, (typeof STATUSES)[number]>,
  surfaces: SURFACE_BY_ID as ReadonlyMap<SurfaceId, (typeof SURFACES)[number]>,
  props: PROP_BY_ID,
  combos: COMBOS,
  story: new Map(ALL_STORY.map((n) => [n.id, n])),
  anchors: new Map(ANCHORS.map((a) => [a.id, a])),
  residents: new Map(RESIDENTS.map((r) => [r.id, r])),
  backgroundRoles: new Map(BACKGROUND_ROLES.map((r) => [r.id, r])),
  universalAbilities: UNIVERSAL_ABILITY_IDS,
};

/** The node a fresh game starts on. */
export const STORY_ENTRY = 'act1_open';

export {
  CHARACTERS,
  DISCIPLINES,
  ENEMIES,
  ENCOUNTERS,
  STATUSES,
  SURFACES,
  PROPS,
  COMBOS,
  ACT1_NODES,
};
export { ELEMENTS, ELEMENT_BY_ID, elementBase } from './elements';
export { charactersForElement } from './characters';
export { DISCIPLINE_BY_ID, DISCIPLINE_FLAGS, disciplinesForElement } from './disciplines';
export { resolveAsset, ASSETS } from './assets/manifest';
export {
  STORY_PRESENTATIONS,
  WORLD_PRESENTATIONS,
  presentationFor,
  validateStoryPresentations,
  worldConversationFor,
} from './story/presentations';
export type { AssetEntry } from './assets/manifest';
export { RETURNEE_IDS, RETURNEE_PRESENTATIONS, RETURNEE_RECORDS } from './residents/returnees';
