/**
 * What a story module declares about itself, so adding one is a single entry in its region's
 * list (#39 in the pipeline log: a side story used to need rows in four other files).
 */
import type { StoryNode } from '../../core/types';

/**
 * `nodes` with every conversation (dialogue or choice) that does not name a map of its own kept
 * on `mapId`: the exploration scene stays up behind the dialogue (`presentations.ts`). A node on
 * another map says so with its own `presentation`.
 */
export function inWorld(mapId: string, nodes: readonly StoryNode[]): readonly StoryNode[] {
  return nodes.map((node) =>
    (node.kind === 'dialogue' || node.kind === 'choice') && !node.presentation
      ? { ...node, presentation: { mapId } }
      : node,
  );
}
