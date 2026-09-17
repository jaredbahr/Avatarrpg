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
import { WORLD_STORY } from './story/world';
import { PROPS, PROP_BY_ID } from './props';
import { STATUSES, STATUS_BY_ID } from './statuses';
import { SURFACES, SURFACE_BY_ID } from './surfaces';
import { UNIVERSAL_ABILITY_IDS } from './abilities';
import { ACT1_NODES } from './story/act1';
import type { ContentBundle } from './schemas';
import type { MapDef, StoryNode } from '../core/types';

export const ALL_MAPS: readonly MapDef[] = [BA_DAN_VILLAGE, RIVERSIDE, ...COMBAT_MAPS].map(
  connectAct1,
);
export const ALL_STORY: readonly StoryNode[] = [...ACT1_NODES, ...RIVERSIDE_STORY, ...WORLD_STORY];

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
export type { AssetEntry } from './assets/manifest';
