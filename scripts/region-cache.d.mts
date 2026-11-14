import type { RegionManifest } from '../src/content/regions';
export declare function laterRegions(
  regions: readonly RegionManifest[],
  startId: string,
): RegionManifest[];
export declare function laterRegionIgnores(
  regions: readonly RegionManifest[],
  startId: string,
): string[];
export declare const regionCacheName: (build: string) => string;
export declare function laterRegionRuntimeCaching(
  regions: readonly RegionManifest[],
  startId: string,
  build: string,
): { urlPattern: RegExp; handler: 'CacheFirst'; options: { cacheName: string } }[];
export declare function regionCacheCleanupScript(build: string): string;
