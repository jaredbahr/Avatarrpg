import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT, STORY_ENTRY } from '../index';
import { REGIONS, START_REGION_ID, regionOfMap } from './index';
import { REGION_CONTENT } from './content';
import { REGION_LAYOUTS } from './layouts';
import type { RegionContent } from './types';

/** Every id a region's data names in another record: what must be loaded beside it. */
function references(region: RegionContent) {
  const out: { kind: 'map' | 'story' | 'encounter'; id: string; from: string }[] = [];
  const story = (id: string | undefined, from: string) => {
    if (id) out.push({ kind: 'story', id, from });
  };
  for (const node of region.story) {
    const from = `story "${node.id}"`;
    switch (node.kind) {
      case 'dialogue':
      case 'flags':
        story(node.next, from);
        break;
      case 'explore':
        story(node.next, from);
        out.push({ kind: 'map', id: node.mapId, from });
        break;
      case 'battle':
        story(node.next, from);
        story(node.onDefeat, from);
        out.push({ kind: 'encounter', id: node.encounterId, from });
        break;
      case 'choice':
        for (const option of node.options) story(option.next, from);
        break;
      case 'branch':
        story(node.ifSet, from);
        story(node.ifUnset, from);
        break;
      case 'end':
        story(node.next, from);
        break;
    }
  }
  for (const map of region.maps) {
    const from = `map "${map.id}"`;
    for (const exit of map.exits ?? []) out.push({ kind: 'map', id: exit.toMapId, from });
    for (const trigger of map.triggers ?? []) story(trigger.node, from);
    for (const npc of map.npcs) {
      story(npc.node, from);
      for (const route of npc.routes ?? []) story(route.node, from);
    }
  }
  for (const encounter of region.encounters)
    out.push({ kind: 'map', id: encounter.mapId, from: `encounter "${encounter.id}"` });
  for (const anchor of region.anchors) {
    const mapId = anchor.site.kind === 'map' ? anchor.site.mapId : anchor.site.door.mapId;
    out.push({ kind: 'map', id: mapId, from: `anchor "${anchor.id}"` });
  }
  return out;
}

describe('regions (ADR 0111)', () => {
  it('lists every region folder once, in the same order in all three lists', () => {
    const folders = readdirSync(__dirname)
      .filter((entry) => statSync(join(__dirname, entry)).isDirectory())
      .sort();
    expect(REGIONS.length).toBe(folders.length);
    expect(REGION_CONTENT.map((region) => region.id)).toEqual(REGIONS.map((region) => region.id));
    expect(REGION_LAYOUTS).toHaveLength(REGIONS.length);
    expect(new Set(REGIONS.map((region) => region.id)).size).toBe(REGIONS.length);
  });

  it("matches each manifest to its content's maps", () => {
    for (const [index, manifest] of REGIONS.entries()) {
      const content = REGION_CONTENT[index];
      expect(
        content?.maps.map((map) => map.id),
        manifest.id,
      ).toEqual(manifest.mapIds);
      for (const mapId of [...Object.keys(manifest.music), ...Object.keys(manifest.scenes)])
        expect(manifest.mapIds, `${manifest.id} names ${mapId}`).toContain(mapId);
      for (const layout of REGION_LAYOUTS[index] ?? [])
        expect(manifest.mapIds, `${manifest.id} layout ${layout.mapId}`).toContain(layout.mapId);
    }
  });

  it('gives every record exactly one region', () => {
    const kinds = [
      'maps',
      'story',
      'encounters',
      'anchors',
      'residents',
      'backgroundRoles',
    ] as const;
    for (const kind of kinds) {
      const ids = REGION_CONTENT.flatMap((region) => region[kind].map((record) => record.id));
      expect(new Set(ids).size, kind).toBe(ids.length);
      expect(ids.length, kind).toBe(CONTENT[kind].size);
    }
    for (const map of CONTENT.maps.values()) expect(regionOfMap(map.id), map.id).toBeDefined();
  });

  it("keeps each region's story in its story files' order", () => {
    for (const region of REGION_CONTENT)
      expect(region.story.map((node) => node.id)).toEqual(
        region.storyGroups.flatMap((group) => group.nodes.map((node) => node.id)),
      );
  });

  it('starts a fresh game in the region that owns the story entry', () => {
    const start = REGION_CONTENT.find((region) => region.id === START_REGION_ID);
    expect(start?.story.some((node) => node.id === STORY_ENTRY)).toBe(true);
  });

  it('names only its own records and its neighbours', () => {
    const byId = new Map(REGION_CONTENT.map((region) => [region.id, region]));
    for (const manifest of REGIONS) {
      for (const neighbour of manifest.neighbours) {
        expect(byId.has(neighbour), `${manifest.id} neighbour ${neighbour}`).toBe(true);
        expect(neighbour).not.toBe(manifest.id);
      }
      const loaded = [manifest.id, ...manifest.neighbours].flatMap((id) => {
        const region = byId.get(id);
        return region ? [region] : [];
      });
      const known = {
        map: new Set(loaded.flatMap((region) => region.maps.map((record) => record.id))),
        story: new Set(loaded.flatMap((region) => region.story.map((record) => record.id))),
        encounter: new Set(
          loaded.flatMap((region) => region.encounters.map((record) => record.id)),
        ),
      };
      const content = byId.get(manifest.id);
      const stray = (content ? references(content) : [])
        .filter((ref) => !known[ref.kind].has(ref.id))
        .map((ref) => `${ref.from} names ${ref.kind} "${ref.id}" outside ${manifest.id}`);
      expect(stray).toEqual([]);
    }
  });
});
