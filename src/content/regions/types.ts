/**
 * A region (ADR 0011, ADR 0111): the unit the world is authored, loaded and budgeted in.
 *
 * Each region is one folder under `src/content/regions/` with three files:
 *
 * - `manifest.ts`, a `RegionManifest`: small, always shipped. What the app must know about a
 *   region before its data is loaded (its maps' ids, its neighbours, its music and scene assets).
 * - `content.ts`, a `RegionContent`: the data the rules read (maps, story, encounters, residents).
 * - `layouts.ts`: the top-down layouts the content validation and the ground packer read. CI and
 *   the packer only; the shipped game never imports it.
 *
 * The lists in `index.ts`, `content.ts` and `layouts.ts` beside this file register a region; nothing
 * else in the game names one (`regions.test.ts` holds that).
 */
import type {
  BackgroundRole,
  EncounterDef,
  MapDef,
  ResidentDef,
  StoryNode,
  WorldAnchor,
} from '../../core/types';
import type { MusicTrackId } from '../music';

/** Where a map's top-down scene is (a `MapScene` as JSON, relative to the site), and its margin. */
export interface TopDownSceneSource {
  readonly url: string;
  readonly cameraCentreMargin?: number;
}

/** One story file's nodes, as the story diagrams group them (`docs/story/`). */
export interface StoryGroup {
  readonly slug: string;
  readonly title: string;
  /** The file, relative to `src/content/story/`. */
  readonly source: string;
  readonly nodes: readonly StoryNode[];
}

/** What the game knows about a region without loading its data. */
export interface RegionManifest {
  readonly id: string;
  readonly name: string;
  /** Every map the region owns, in content order. Equal to its content's map ids. */
  readonly mapIds: readonly string[];
  /**
   * Regions whose content this region's content may name (an exit's map, a story link, an
   * encounter's board). They are loaded with it, so crossing into one never waits.
   */
  readonly neighbours: readonly string[];
  /** Map id to area track (ADR 0108). A map with no row keeps whatever is playing. */
  readonly music: Readonly<Record<string, MusicTrackId>>;
  /** Map id to its top-down scene asset (ADR 0104); a map not listed draws its bare board. */
  readonly scenes: Readonly<Record<string, TopDownSceneSource>>;
  /**
   * The region's data, as a dynamic `import()` of its `content.ts` (ADR 0111 §2), so the bundler
   * gives each region a chunk of its own and the app fetches it only when the region is needed.
   */
  readonly load: () => Promise<RegionContent>;
}

/** The data a region adds to the content index. */
export interface RegionContent {
  readonly id: string;
  readonly maps: readonly MapDef[];
  /** The story files, raw, for the diagrams. */
  readonly storyGroups: readonly StoryGroup[];
  /** The nodes the rules read: `storyGroups` in order, with the region's party voices applied. */
  readonly story: readonly StoryNode[];
  readonly encounters: readonly EncounterDef[];
  readonly anchors: readonly WorldAnchor[];
  readonly residents: readonly ResidentDef[];
  readonly backgroundRoles: readonly BackgroundRole[];
}
