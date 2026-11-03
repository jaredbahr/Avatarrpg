import { Sprite } from 'pixi.js';
import type { Container, Texture } from 'pixi.js';

/** Evict idle entries only after the frame has rendered and all sprites are bound. */
export function trimPixiTextureCaches(
  textures: Map<HTMLCanvasElement | HTMLImageElement, Texture>,
  frames: Map<string, Texture>,
  stage: Container | null,
  shadowMaskSources: Container,
  maxTextures: number,
  maxFrames: number,
): void {
  if (textures.size <= maxTextures && frames.size <= maxFrames) return;

  const live = new Set<Texture>();
  const sources = new Set<Texture['source']>();
  const visit = (node: Container): void => {
    if (node instanceof Sprite) {
      live.add(node.texture);
      sources.add(node.texture.source);
    }
    for (const child of node.children) visit(child);
  };
  if (stage) visit(stage);
  // This offstage container is rendered separately into the cast-shadow mask.
  visit(shadowMaskSources);

  for (const [key, texture] of frames) {
    if (frames.size <= maxFrames) break;
    if (live.has(texture)) continue;
    frames.delete(key);
    texture.destroy(false);
  }
  for (const [canvas, texture] of textures) {
    if (textures.size <= maxTextures) break;
    if (sources.has(texture.source)) continue;
    textures.delete(canvas);
    texture.destroy(true);
  }
}
