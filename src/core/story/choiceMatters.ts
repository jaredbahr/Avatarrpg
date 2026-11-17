/**
 * Which story choices are worth a table vote (#846).
 *
 * A vote slows the table down, so it is kept for choices that change the story
 * or the game. That is read from the data, never declared: a choice matters when
 * any option sets a flag or moves a nation's standing, or when the options lead
 * to different places. Options whose replies are only dialogue and then run into
 * the very same next beat ("Rest here" / "Let's keep going", a different thing to
 * say) change nothing, and the player in charge answers them alone.
 *
 * Pure: it reads the story graph and nothing else.
 */

import type { ContentIndex, StoryNode, StoryOption } from '../types';

/** How far a reply may run on before it is called different. A longer reply is a scene. */
const MAX_REPLY_NODES = 12;

function hasEffect(option: StoryOption): boolean {
  if (option.setFlags && Object.keys(option.setFlags).length > 0) return true;
  return Object.values(option.adjust ?? {}).some((delta) => delta !== 0);
}

/**
 * Where a reply ends: the first node that is not plain dialogue (a fight, a map,
 * a flag node, another choice, the ending). Undefined when the graph does not say
 * (a region not loaded, a cycle, a very long reply), which counts as different.
 */
function whereReplyEnds(content: ContentIndex, start: string): string | undefined {
  const seen = new Set<string>();
  let id = start;
  for (let step = 0; step <= MAX_REPLY_NODES; step++) {
    const node = content.story.get(id);
    if (!node || seen.has(id)) return undefined;
    if (node.kind !== 'dialogue') return id;
    seen.add(id);
    id = node.next;
  }
  return undefined;
}

export function choiceMatters(
  content: ContentIndex,
  node: Extract<StoryNode, { kind: 'choice' }>,
): boolean {
  if (node.options.some(hasEffect)) return true;
  const ends = node.options.map((option) => whereReplyEnds(content, option.next));
  const first = ends[0];
  return first === undefined || ends.some((end) => end !== first);
}
