/**
 * Where the region's NPC conversations play (#628): over their own map, with the camera keeping the
 * person they are with. A region declares this on its own nodes (`NodePresentation`), so nothing
 * outside the region folder needs an entry.
 */
import type { StoryNode } from '../../../core/types';

/** `nodes` with each listed node played over `mapId`, framing the NpcDef it names. */
export function staged(
  nodes: readonly StoryNode[],
  mapId: string,
  npcByNode: Readonly<Record<string, string>>,
): readonly StoryNode[] {
  return nodes.map((node) => {
    const npc = npcByNode[node.id];
    if (!npc || (node.kind !== 'dialogue' && node.kind !== 'choice')) return node;
    return { ...node, presentation: { mapId, stage: { npc } } };
  });
}
