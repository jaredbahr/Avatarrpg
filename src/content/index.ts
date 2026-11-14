/**
 * The one place the rest of the game gets its content from.
 *
 * `CONTENT` is a `ContentIndex` — maps keyed by id, handed to every core rules
 * call. Building it here (rather than letting core import the data directly)
 * is what keeps `src/core/` runnable against a tiny fixture bundle in tests.
 */

import type { ContentIndex } from '../core/types';
import { ALL_ABILITIES } from './abilities';
import { ASSETS } from './assets/manifest';
import { CHARACTERS } from './characters';
import { DISCIPLINES } from './disciplines';
import { COMBOS } from './combos';
import { ENCOUNTERS } from './encounters';
import { ENEMIES } from './enemies';
import { PROPS } from './props';
import { STATUSES } from './statuses';
import { SURFACES } from './surfaces';
import { CORE_INDEX, emptyRegionIndex, fillRegionIndex } from './core';
import { ACT1_NODES } from './story/act1';
import type { ContentBundle } from './schemas';
import type {
  BackgroundRole,
  EncounterDef,
  MapDef,
  ResidentDef,
  StoryNode,
  WorldAnchor,
} from '../core/types';
import { REGION_CONTENT } from './regions/content';

/*
 * Everything a region owns is registered by its manifest (ADR 0111), and the whole world is the
 * regions in order. The app loads them one at a time; tests, the balance report and the docs read
 * this full index.
 */
export const ALL_MAPS: readonly MapDef[] = REGION_CONTENT.flatMap((region) => region.maps);
export const ALL_STORY: readonly StoryNode[] = REGION_CONTENT.flatMap((region) => region.story);
const ALL_ENCOUNTERS: readonly EncounterDef[] = REGION_CONTENT.flatMap(
  (region) => region.encounters,
);

/** Living-world records (ADR 0047 §2): each region's anchors, residents and background roles. */
const ANCHORS: readonly WorldAnchor[] = REGION_CONTENT.flatMap((region) => region.anchors);
const RESIDENTS: readonly ResidentDef[] = REGION_CONTENT.flatMap((region) => region.residents);
const BACKGROUND_ROLES: readonly BackgroundRole[] = REGION_CONTENT.flatMap(
  (region) => region.backgroundRoles,
);

/** The flat form, used by the validation test and the balance report. */
export const CONTENT_BUNDLE: ContentBundle = {
  abilities: ALL_ABILITIES,
  characters: CHARACTERS,
  disciplines: DISCIPLINES,
  enemies: ENEMIES,
  maps: ALL_MAPS,
  assets: ASSETS,
  encounters: ALL_ENCOUNTERS,
  statuses: STATUSES,
  surfaces: SURFACES,
  props: PROPS,
  combos: COMBOS,
  story: ALL_STORY,
  anchors: ANCHORS,
  residents: RESIDENTS,
  backgroundRoles: BACKGROUND_ROLES,
};

const REGION_INDEX = emptyRegionIndex();
fillRegionIndex(REGION_INDEX, REGION_CONTENT);

/** The indexed form, used by the rules: the core and every region. */
export const CONTENT: ContentIndex = {
  elements: CORE_INDEX.elements,
  abilities: CORE_INDEX.abilities,
  characters: CORE_INDEX.characters,
  disciplines: CORE_INDEX.disciplines,
  enemies: CORE_INDEX.enemies,
  maps: REGION_INDEX.maps,
  encounters: REGION_INDEX.encounters,
  statuses: CORE_INDEX.statuses,
  surfaces: CORE_INDEX.surfaces,
  props: CORE_INDEX.props,
  combos: CORE_INDEX.combos,
  tuning: CORE_INDEX.tuning,
  story: REGION_INDEX.story,
  anchors: REGION_INDEX.anchors,
  residents: REGION_INDEX.residents,
  backgroundRoles: REGION_INDEX.backgroundRoles,
  universalAbilities: CORE_INDEX.universalAbilities,
};

export { STORY_ENTRY } from './entry';

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
