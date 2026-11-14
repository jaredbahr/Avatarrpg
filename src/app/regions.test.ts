import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { MapDef, StoryNode } from '../core/types';
import type { RegionContent, RegionManifest } from '../content/regions';
import { CONTENT } from '../content';
import { REGIONS } from '../content/regions';
import { RegionStore } from './regions';

const map = (id: string) => ({ id }) as unknown as MapDef;
const node = (id: string, mapId: string) =>
  ({ id, kind: 'explore', mapId, objective: '', next: id }) as unknown as StoryNode;

function region(id: string, neighbours: readonly string[] = [], scenes = {}) {
  const content: RegionContent = {
    id,
    maps: [map(`${id}_map`)],
    storyGroups: [],
    story: [node(`${id}_explore`, `${id}_map`)],
    encounters: [],
    anchors: [],
    residents: [],
    backgroundRoles: [],
  };
  const load = vi.fn(() => Promise.resolve(content));
  const manifest: RegionManifest = {
    id,
    name: id,
    mapIds: [`${id}_map`],
    neighbours,
    music: {},
    scenes,
    load,
  };
  return { manifest, load };
}

const noAssets = () => Promise.reject(new Error('no assets in this test'));

describe('RegionStore (ADR 0111 §2)', () => {
  it('starts with the core content and no region', () => {
    const store = new RegionStore(noAssets, [region('a').manifest]);
    expect(store.content.maps.size).toBe(0);
    expect(store.content.story.size).toBe(0);
    expect(store.content.abilities).toBe(CONTENT.abilities);
    expect(store.pendingForMap('a_map')).not.toBeNull();
  });

  it('loads a region with its neighbours, and only those', async () => {
    const a = region('a', ['b']);
    const b = region('b', ['a', 'c']);
    const c = region('c', ['b']);
    const store = new RegionStore(noAssets, [a.manifest, b.manifest, c.manifest]);
    await store.ensure('a');
    expect([...store.content.maps.keys()]).toEqual(['a_map', 'b_map']);
    expect(c.load).not.toHaveBeenCalled();
    // Ready for a: it and its neighbour are in. Not for b, whose neighbour c is not.
    expect(store.pendingForMap('a_map')).toBeNull();
    expect(store.pendingForMap('b_map')).not.toBeNull();
    // A map no region owns has nothing to wait for.
    expect(store.pendingForMap('elsewhere')).toBeNull();
  });

  it('keeps the index in region order whatever order regions load in', async () => {
    const a = region('a');
    const b = region('b');
    const c = region('c');
    const store = new RegionStore(noAssets, [a.manifest, b.manifest, c.manifest]);
    await store.ensure('c');
    await store.ensure('a');
    expect([...store.content.maps.keys()]).toEqual(['a_map', 'c_map']);
    expect([...store.content.story.keys()]).toEqual(['a_explore', 'c_explore']);
    await store.ensure('b');
    expect([...store.content.maps.keys()]).toEqual(['a_map', 'b_map', 'c_map']);
  });

  it('fetches a region once, however many ask at the same time', async () => {
    const a = region('a');
    const store = new RegionStore(noAssets, [a.manifest]);
    await Promise.all([store.ensure('a'), store.ensure('a'), store.pendingForMap('a_map')]);
    await store.ensure('a');
    expect(a.load).toHaveBeenCalledTimes(1);
  });

  it('fetches a failed region again on the next request', async () => {
    const a = region('a');
    a.load.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const store = new RegionStore(noAssets, [a.manifest]);
    await expect(store.ensure('a')).rejects.toThrow('offline');
    expect(store.isLoaded('a')).toBe(false);
    await store.ensure('a');
    expect(store.isLoaded('a')).toBe(true);
    expect(a.load).toHaveBeenCalledTimes(2);
  });

  it('draws bare boards when a scene does not load, as boot did', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = region('a', [], { a_map: { url: 'art/topdown/a/scene.json' } });
    const store = new RegionStore(noAssets, [a.manifest]);
    await store.ensure('a');
    expect(store.content.maps.get('a_map')).toEqual(map('a_map'));
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it('holds every shipped region, loaded, exactly as the full index does', async () => {
    const store = new RegionStore(noAssets, REGIONS);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const manifest of REGIONS) await store.ensure(manifest.id);
    vi.restoreAllMocks();
    for (const key of ['story', 'encounters', 'anchors', 'residents', 'backgroundRoles'] as const)
      expect([...store.content[key]], key).toEqual([...CONTENT[key]]);
    expect([...store.content.maps.keys()]).toEqual([...CONTENT.maps.keys()]);
  });
});

/** Modules a region's `content.ts` imports, which must reach the game only through `load()`. */
function regionModules(root: string): Set<string> {
  const out = new Set<string>([join(root, 'src/content/index.ts')]);
  const regionsDir = join(root, 'src/content/regions');
  out.add(join(regionsDir, 'content.ts'));
  out.add(join(regionsDir, 'layouts.ts'));
  for (const entry of readdirSync(regionsDir)) {
    const dir = join(regionsDir, entry);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of ['content.ts', 'layouts.ts']) {
      const path = join(dir, file);
      out.add(path);
      for (const spec of imports(readFileSync(path, 'utf8')))
        if (!spec.includes('/types')) out.add(resolve(dir, `${spec}.ts`));
    }
  }
  return out;
}

function imports(source: string): string[] {
  return [...source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map(
    (match) => match[1] ?? '',
  );
}

function shippedFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return shippedFiles(path);
    return path.endsWith('.ts') && !/\.(test|fixture)\.ts$/.test(path) ? [path] : [];
  });
}

describe('the boot chunk', () => {
  it('never imports a region’s data, so the bundler keeps it in the region’s chunk', () => {
    const root = resolve(__dirname, '../..');
    const forbidden = regionModules(root);
    const offenders: string[] = [];
    for (const file of [
      ...shippedFiles(join(root, 'src/app')),
      ...shippedFiles(join(root, 'src/render')),
      join(root, 'src/main.ts'),
    ]) {
      const source = readFileSync(file, 'utf8')
        // The dev-only validator imports the full index behind `import.meta.env.DEV`.
        .replace(/import\('\.\/content'\)/g, '');
      for (const spec of imports(source)) {
        if (!spec.startsWith('.')) continue;
        const target = resolve(join(file, '..'), spec);
        const candidates = [`${target}.ts`, join(target, 'index.ts')];
        if (candidates.some((candidate) => forbidden.has(candidate)))
          offenders.push(`${relative(root, file)} imports ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
