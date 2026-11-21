/**
 * The story's say over a scene's set dressing (ADR 0123). A scene piece (a ground overlay or an upright)
 * carrying `gate` draws only while its map's `sceneGates[gate]` holds, so a camp can stand at the bridge until
 * the fight and be gone after it. The renderer never reads the story: the app hands it the scene with the
 * pieces that do not hold already left out.
 */
import { evaluate } from '../../core/story/conditions';
import type { GameState, MapDef, MapScene } from '../../core/types';

const cache = new WeakMap<MapScene, { readonly key: string; readonly scene: MapScene }>();

/** Whether every gate a scene's pieces name is one its map defines (the content validation's rule). */
export function gatesOf(scene: MapScene): ReadonlySet<string> {
  const out = new Set<string>();
  for (const piece of [...scene.ground, ...scene.scenery]) if (piece.gate) out.add(piece.gate);
  return out;
}

/**
 * The map's scene as the story stands: every gated piece whose gate does not hold (or names no gate the map
 * defines) left out. The same object comes back while nothing a gate reads has changed, so the renderer's
 * caches keyed on the scene stay warm.
 */
export function sceneForStory(map: MapDef, state: GameState | null): MapScene | undefined {
  const scene = map.scene;
  if (!scene) return scene;
  const gates = gatesOf(scene);
  if (gates.size === 0) return scene;
  const open = new Set(
    [...gates].filter((gate) => {
      const when = map.sceneGates?.[gate];
      return when !== undefined && state !== null && evaluate(state, when);
    }),
  );
  const key = [...open].sort().join('|');
  const hit = cache.get(scene);
  if (hit && hit.key === key) return hit.scene;
  const shows = (piece: { readonly gate?: string }): boolean =>
    piece.gate === undefined || open.has(piece.gate);
  const filtered: MapScene = {
    ...scene,
    ground: scene.ground.filter(shows),
    scenery: scene.scenery.filter(shows),
  };
  cache.set(scene, { key, scene: filtered });
  return filtered;
}
