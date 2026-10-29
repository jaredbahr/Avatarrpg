import type { StoryNode, Vec2 } from '../types';

type BattleNode = Extract<StoryNode, { kind: 'battle' }>;
type Entry = NonNullable<BattleNode['approach']>['entries'][number];

/** A story crossing can choose positions; direct battle creation keeps the map's spawns. */
export function approachEntry(node: BattleNode, mapId: string, pos: Vec2): Entry | undefined {
  if (node.approach?.mapId !== mapId) return undefined;
  return node.approach.entries.find(({ at }) => at.x === pos.x && at.y === pos.y);
}
