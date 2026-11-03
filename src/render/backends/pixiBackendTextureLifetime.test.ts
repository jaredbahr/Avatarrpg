import { Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PixiBackend } from './pixi';

type CacheHarness = {
  texture(source: HTMLCanvasElement): Texture;
  frameTexture(frame: {
    source: HTMLCanvasElement;
    frame: { x: number; y: number; w: number; h: number };
  }): Texture;
  trimTextures(): void;
  unitSprite(key: string): Sprite;
  retireInactiveSprites(sprites: Map<string, Sprite>, live: Set<string>): void;
};

function canvasKey(): HTMLCanvasElement {
  // Texture.from is stubbed; the backend cache only needs canvas identity.
  return {} as HTMLCanvasElement;
}

function backendWithStage(): {
  backend: CacheHarness;
  stage: Container;
  shadowMaskSources: Container;
  unitLayer: Container;
  unitSprites: Map<string, Sprite>;
  castSprites: Map<string, Sprite>;
} {
  // The real backend methods run without constructing a WebGL renderer.
  const backend = Object.create(PixiBackend.prototype) as CacheHarness;
  const stage = new Container();
  const shadowMaskSources = new Container();
  const unitLayer = new Container();
  const unitSprites = new Map<string, Sprite>();
  const castSprites = new Map<string, Sprite>();
  stage.addChild(unitLayer);
  Reflect.set(backend, 'app', { stage });
  Reflect.set(backend, 'shadowMaskSources', shadowMaskSources);
  Reflect.set(backend, 'unitLayer', unitLayer);
  Reflect.set(backend, 'unitSprites', unitSprites);
  Reflect.set(backend, 'castSprites', castSprites);
  Reflect.set(backend, 'textureCache', new Map());
  Reflect.set(backend, 'frameTextures', new Map());
  vi.spyOn(Texture, 'from').mockImplementation(
    () => new Texture({ source: new TextureSource({ width: 1024, height: 1 }) }),
  );
  return { backend, stage, shadowMaskSources, unitLayer, unitSprites, castSprites };
}

afterEach(() => vi.restoreAllMocks());

describe('PixiBackend cache entry points', () => {
  it('does not destroy an attached elevation sprite when the canvas cache exceeds its budget', () => {
    const { backend, stage } = backendWithStage();
    const elevationBaseLayer = new Container();
    stage.addChild(elevationBaseLayer);
    const live = backend.texture(canvasKey());
    elevationBaseLayer.addChild(new Sprite(live));
    const firstIdle = backend.texture(canvasKey());
    for (let i = 2; i <= 128; i++) backend.texture(canvasKey());

    // The old backend destroyed the oldest entry during the 129th texture() call.
    expect(live.destroyed).toBe(false);
    expect(elevationBaseLayer.children[0]).toBeInstanceOf(Sprite);
    expect((elevationBaseLayer.children[0] as Sprite).texture.source.alphaMode).toBeDefined();

    backend.trimTextures();
    expect(live.destroyed).toBe(false);
    expect(firstIdle.destroyed).toBe(true);
    expect((elevationBaseLayer.children[0] as Sprite).texture.source.alphaMode).toBeDefined();
  });

  it('does not destroy an attached shadow frame view when the frame cache exceeds its budget', () => {
    const { backend, shadowMaskSources } = backendWithStage();
    const source = canvasKey();
    const frameAt = (x: number) => ({ source, frame: { x, y: 0, w: 1, h: 1 } });
    const live = backend.frameTexture(frameAt(0));
    shadowMaskSources.addChild(new Sprite(live));
    const firstIdle = backend.frameTexture(frameAt(1));
    for (let i = 2; i <= 512; i++) backend.frameTexture(frameAt(i));

    // The old backend destroyed the oldest frame view during the 513th call.
    expect(live.destroyed).toBe(false);
    expect((shadowMaskSources.children[0] as Sprite).texture.source.alphaMode).toBeDefined();

    backend.trimTextures();
    expect(live.destroyed).toBe(false);
    expect(firstIdle.destroyed).toBe(true);
    expect((shadowMaskSources.children[0] as Sprite).texture.source.alphaMode).toBeDefined();
  });

  it('retires absent actors and casts so long routes can evict their textures and rebind on return', () => {
    const { backend, unitLayer, unitSprites, castSprites, shadowMaskSources } = backendWithStage();
    const firstCanvas = canvasKey();
    const firstTexture = backend.texture(firstCanvas);

    for (let i = 0; i < 160; i++) {
      const actor = backend.unitSprite(`unit:${i}`);
      actor.texture = i === 0 ? firstTexture : backend.texture(canvasKey());
      const cast = new Sprite(backend.texture(canvasKey()));
      castSprites.set(`cast:${i}`, cast);
      shadowMaskSources.addChild(cast);
      backend.retireInactiveSprites(unitSprites, new Set([`unit:${i}`]));
      backend.retireInactiveSprites(castSprites, new Set([`cast:${i}`]));
      backend.trimTextures();

      expect(unitSprites.size).toBe(1);
      expect(castSprites.size).toBe(1);
      expect(unitLayer.children).toHaveLength(1);
      expect(shadowMaskSources.children).toHaveLength(1);
      expect(actor.texture.source.alphaMode).toBeDefined();
      expect(cast.texture.source.alphaMode).toBeDefined();
    }

    expect(firstTexture.destroyed).toBe(true);
    const returning = backend.unitSprite('unit:0');
    returning.texture = backend.texture(firstCanvas);
    backend.retireInactiveSprites(unitSprites, new Set(['unit:0']));
    backend.retireInactiveSprites(castSprites, new Set());
    backend.trimTextures();
    expect(returning.texture).not.toBe(firstTexture);
    expect(returning.texture.source.alphaMode).toBeDefined();
    expect(unitLayer.children).toHaveLength(1);
    expect(shadowMaskSources.children).toHaveLength(0);
  });
});
