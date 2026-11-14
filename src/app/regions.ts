/**
 * Per-region loading (ADR 0111 §2).
 *
 * The app boots with the core content and no region. A region is fetched when the party needs it:
 * its data (`manifest.load()`, a chunk of its own) and its maps' top-down scenes, together with its
 * neighbours', so an exit or a story link into a neighbour never waits. Loaded regions are added to
 * the one `ContentIndex` the app hands every rules call, in place and in `REGIONS` order, and never
 * removed.
 *
 * The rules are untouched: they read what the index holds. `regions.test.ts` (content) holds that a
 * region's records name only its own and its neighbours', and `App` runs no command until the
 * region the party stands in is ready, so every rules call sees every record it can name.
 */
import type { ContentIndex, MapDef } from '../core/types';
import { CORE_INDEX, emptyRegionIndex, fillRegionIndex } from '../content/core';
import { REGIONS } from '../content/regions';
import type { RegionContent, RegionManifest } from '../content/regions';
import { loadTopDownPresentations, topDownMap } from '../content/topdown';

/** What `App` needs from the loader; a test can hand it a stub. */
export interface RegionLoader {
  /** Null when the region owning `mapId` and its neighbours are loaded (or no region owns it). */
  pendingForMap(mapId: string | null | undefined): Promise<void> | null;
  /** Null when region `id` and its neighbours are loaded. */
  pendingForRegion(id: string): Promise<void> | null;
}

/** Reads a site-relative JSON asset (a fetch in the browser, a file in a test). */
export type AssetReader = (url: string) => Promise<unknown>;

export class RegionStore implements RegionLoader {
  private readonly index = emptyRegionIndex();
  /** The index every rules call reads; its region maps fill in place as regions load. */
  readonly content: ContentIndex = { ...CORE_INDEX, ...this.index };
  private readonly loaded = new Map<string, RegionContent>();
  private readonly loading = new Map<string, Promise<void>>();

  constructor(
    private readonly readAsset: AssetReader,
    private readonly regions: readonly RegionManifest[] = REGIONS,
  ) {}

  /** Whether region `id` itself is in the index. */
  isLoaded(id: string): boolean {
    return this.loaded.has(id);
  }

  /** Region `id` and its neighbours, the set that must be loaded before the party is in `id`. */
  private closure(id: string): readonly string[] {
    const region = this.regions.find((candidate) => candidate.id === id);
    return region ? [region.id, ...region.neighbours] : [];
  }

  pendingForRegion(id: string): Promise<void> | null {
    const missing = this.closure(id).filter((member) => !this.loaded.has(member));
    if (missing.length === 0) return null;
    return Promise.all(missing.map((member) => this.load(member))).then(() => undefined);
  }

  pendingForMap(mapId: string | null | undefined): Promise<void> | null {
    const region = mapId
      ? this.regions.find((candidate) => candidate.mapIds.includes(mapId))
      : undefined;
    return region ? this.pendingForRegion(region.id) : null;
  }

  /** Loads region `id` and its neighbours; resolves at once when they are already loaded. */
  ensure(id: string): Promise<void> {
    return this.pendingForRegion(id) ?? Promise.resolve();
  }

  private load(id: string): Promise<void> {
    const inFlight = this.loading.get(id);
    if (inFlight) return inFlight;
    const manifest = this.regions.find((candidate) => candidate.id === id);
    if (!manifest) return Promise.reject(new Error(`No region "${id}".`));
    const promise = Promise.all([manifest.load(), this.presentations(manifest)]).then(
      ([content, presentations]) => {
        const maps: MapDef[] = content.maps.map((map) => {
          const presentation = presentations.get(map.id);
          return presentation ? topDownMap(map, presentation) : map;
        });
        this.loaded.set(id, { ...content, maps });
        fillRegionIndex(
          this.index,
          this.regions.flatMap((region) => this.loaded.get(region.id) ?? []),
        );
      },
    );
    this.loading.set(id, promise);
    // A failed fetch (offline before a first visit) may be retried by the next request.
    promise.catch(() => this.loading.delete(id));
    return promise;
  }

  /**
   * The region's top-down scenes (ADR 0104). Without them its maps draw their bare boards: the
   * rules never read a scene's art, so a failed scene is logged and play goes on.
   */
  private async presentations(manifest: RegionManifest) {
    try {
      return await loadTopDownPresentations(
        this.readAsset,
        new Map(Object.entries(manifest.scenes)),
      );
    } catch (error: unknown) {
      console.error(
        `The top-down scenes did not load; drawing the bare boards. (${manifest.id})`,
        error,
      );
      return new Map();
    }
  }
}
