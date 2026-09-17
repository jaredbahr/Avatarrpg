import { describe, expect, it } from 'vitest';
import { atlasJsonText, parseAtlasJson } from './atlasJson';

const sample = {
  frames: {
    'unit.x/idle/0': { frame: { x: 0, y: 0, w: 128, h: 192 } },
    'unit.x/idle/1': { frame: { x: 128, y: 0, w: 128, h: 192 } },
  },
  meta: { image: 'x.png', size: { w: 256, h: 192 } },
};

describe('parseAtlasJson', () => {
  it('reads the frames and the image out of the hash layout', () => {
    const atlas = parseAtlasJson(sample);
    expect(atlas.image).toBe('x.png');
    expect(atlas.width).toBe(256);
    expect(atlas.frames.get('unit.x/idle/1')).toEqual({ x: 128, y: 0, w: 128, h: 192 });
  });

  it('accepts text and round-trips what the writer emits', () => {
    const atlas = parseAtlasJson(JSON.stringify(sample));
    const text = atlasJsonText(atlas.frames, atlas.image, atlas.width, atlas.height);
    expect(parseAtlasJson(text)).toEqual(atlas);
  });

  it('refuses a frame that runs off the image, and a file with no frames', () => {
    const off = {
      ...sample,
      frames: { bad: { frame: { x: 200, y: 0, w: 128, h: 192 } } },
    };
    expect(() => parseAtlasJson(off)).toThrow(/runs off/);
    expect(() => parseAtlasJson({ meta: sample.meta })).toThrow(/no frames/);
    expect(() => parseAtlasJson('not json')).toThrow();
  });

  it('refuses empty image names and zero-sized images or frames', () => {
    expect(() => parseAtlasJson({ ...sample, meta: { ...sample.meta, image: '  ' } })).toThrow(
      /meta\.image/,
    );
    expect(() =>
      parseAtlasJson({ ...sample, meta: { ...sample.meta, size: { w: 0, h: 192 } } }),
    ).toThrow(/meta\.size/);
    expect(() =>
      parseAtlasJson({
        ...sample,
        frames: { empty: { frame: { x: 0, y: 0, w: 0, h: 192 } } },
      }),
    ).toThrow(/no rectangle/);
  });
});
