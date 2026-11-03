import { Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { trimPixiTextureCaches } from './pixiTextureCache';

function texture(): Texture {
  return new Texture({ source: new TextureSource({ width: 1, height: 1 }) });
}

function canvasKey(): HTMLCanvasElement {
  // The cache only uses canvas identity; no DOM or GPU is needed for this test.
  return {} as HTMLCanvasElement;
}

function readSpriteSources(root: Container): void {
  for (const child of root.children) {
    if (child instanceof Sprite) {
      // Pixi's render batch reads alphaMode here. A destroyed texture has a null source.
      expect(child.texture.source.alphaMode).toBeDefined();
    }
    readSpriteSources(child);
  }
}

describe('Pixi texture cache lifetime', () => {
  it('keeps an attached elevation sprite alive when its oldest canvas entry is evicted', () => {
    const stage = new Container();
    const elevationBaseLayer = new Container();
    stage.addChild(elevationBaseLayer);
    const shadowMaskSources = new Container();
    const textures = new Map<HTMLCanvasElement | HTMLImageElement, Texture>();
    const live = texture();
    const liveKey = canvasKey();
    textures.set(liveKey, live);
    elevationBaseLayer.addChild(new Sprite(live));

    const nextIdle = texture();
    textures.set(canvasKey(), nextIdle);
    for (let i = 2; i <= 128; i++) textures.set(canvasKey(), texture());

    trimPixiTextureCaches(textures, new Map(), stage, shadowMaskSources, 128, 512);
    readSpriteSources(stage);
    expect(textures.has(liveKey)).toBe(true);
    expect(nextIdle.destroyed).toBe(true);
    expect(textures.size).toBe(128);

    elevationBaseLayer.removeChildren();
    textures.set(canvasKey(), texture());
    trimPixiTextureCaches(textures, new Map(), stage, shadowMaskSources, 128, 512);
    expect(live.destroyed).toBe(true);
    expect(textures.has(liveKey)).toBe(false);
  });

  it('keeps an offstage shadow frame view and its shared base source alive', () => {
    const stage = new Container();
    const shadowMaskSources = new Container();
    const textures = new Map<HTMLCanvasElement | HTMLImageElement, Texture>();
    const base = texture();
    const baseKey = canvasKey();
    textures.set(baseKey, base);
    const view = new Texture({ source: base.source });
    const frames = new Map<string, Texture>([['live', view]]);
    shadowMaskSources.addChild(new Sprite(view));

    const nextIdle = texture();
    frames.set('idle', nextIdle);
    for (let i = 2; i <= 512; i++) frames.set(String(i), texture());
    for (let i = 1; i <= 128; i++) textures.set(canvasKey(), texture());

    trimPixiTextureCaches(textures, frames, stage, shadowMaskSources, 128, 512);
    readSpriteSources(shadowMaskSources);
    expect(frames.has('live')).toBe(true);
    expect(nextIdle.destroyed).toBe(true);
    expect(textures.has(baseKey)).toBe(true);
    expect(frames.size).toBe(512);
    expect(textures.size).toBe(128);
  });
});
