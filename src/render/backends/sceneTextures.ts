import { Rectangle, Texture } from 'pixi.js';
import type { SceneImage } from '../../core/types';
import { sceneImage, sceneSourceRect } from '../scene';

interface Page {
  image: HTMLImageElement;
  texture: Texture;
  slices: Map<string, Texture>;
}

/** Scene-owned page sources and non-owning crop views; never Pixi's global cache. */
export class SceneTextures {
  private pages = new Map<string, Page>();
  private used = new Map<string, Set<string>>();

  begin(): void {
    this.used.clear();
  }

  get(piece: SceneImage): Texture | null {
    const image = sceneImage(piece);
    if (!image) return null;
    const rect = sceneSourceRect(piece, image);
    if (!rect) return null;
    let page = this.pages.get(piece.url);
    if (page?.image !== image) {
      if (page) this.drop(page);
      page = { image, texture: Texture.from(image, true), slices: new Map() };
      this.pages.set(piece.url, page);
    }
    let keys = this.used.get(piece.url);
    if (!keys) {
      keys = new Set();
      this.used.set(piece.url, keys);
    }
    if (!piece.sourceRect) return page.texture;
    const key = `${rect.x},${rect.y},${rect.width},${rect.height}`;
    keys.add(key);
    let texture = page.slices.get(key);
    if (!texture) {
      texture = new Texture({
        source: page.texture.source,
        frame: new Rectangle(rect.x, rect.y, rect.width, rect.height),
      });
      page.slices.set(key, texture);
    }
    return texture;
  }

  /** Call after sprites have switched textures or been removed. */
  end(): void {
    for (const [url, page] of this.pages) {
      const keys = this.used.get(url);
      if (!keys) {
        this.drop(page);
        this.pages.delete(url);
        continue;
      }
      for (const [key, texture] of page.slices) {
        if (!keys.has(key)) {
          texture.destroy(false);
          page.slices.delete(key);
        }
      }
    }
  }

  clear(): void {
    for (const page of this.pages.values()) this.drop(page);
    this.pages.clear();
    this.used.clear();
  }

  private drop(page: Page): void {
    for (const texture of page.slices.values()) texture.destroy(false);
    page.slices.clear();
    page.texture.destroy(true);
  }
}
