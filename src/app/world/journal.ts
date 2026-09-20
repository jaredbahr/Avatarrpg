import type { ContentIndex, GameState } from '../../core/types';
import { evaluate } from '../../core/story/conditions';
import { worldObjective } from '../../core/story/world';
import { JOURNAL_NOTES } from '../../content/journal';

export function travelJournal(content: ContentIndex, state: GameState) {
  const visited = new Set([state.location.mapId, ...Object.keys(state.world.returnPos)]);
  // Old saves already remember story visits, even before world memory existed.
  for (const id of state.story.visited) {
    const node = content.story.get(id);
    if (node?.kind === 'explore') visited.add(node.mapId);
  }
  const known = new Set(visited);
  for (const id of visited)
    for (const exit of content.maps.get(id)?.exits ?? []) known.add(exit.toMapId);
  const map = content.maps.get(state.location.mapId);
  return {
    location: map?.name ?? 'On the road',
    objective: worldObjective(content, state) ?? 'Take your time and follow the paths.',
    places: [...content.maps.values()]
      .filter((place) => known.has(place.id))
      .map((place) => ({
        id: place.id,
        name: place.name,
        status:
          place.id === state.location.mapId
            ? 'You are here'
            : visited.has(place.id)
              ? 'Visited'
              : 'Not yet visited',
      })),
    routes: (map?.exits ?? []).map((exit) => ({
      label: exit.label,
      detail: evaluate(state, exit.requires) ? 'Open path' : (exit.lockedHint ?? 'Not open yet'),
    })),
    discoveries: JOURNAL_NOTES.filter(
      (note) => visited.has(note.mapId) || evaluate(state, note.when),
    ).map((note) => ({
      id: note.id,
      title: note.title,
      location: content.maps.get(note.mapId)?.name ?? '',
      found: evaluate(state, note.when),
      text: evaluate(state, note.when) ? note.found : note.hint,
    })),
  };
}
