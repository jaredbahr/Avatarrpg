import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encode as encodeJpeg } from 'jpeg-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageSize, newImage, pixelAt, readImage, setPixel, writePng } from './lib/image';
import { main, manifestLine } from './portrait';

/** A `w` x `h` candidate: parchment with a red bust-sized block in the middle. */
function candidate(w: number, h: number, background = [244, 233, 216, 255]) {
  const image = newImage(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPixel(image, x, y, background);
  for (let y = Math.floor(h * 0.3); y < h * 0.7; y++) {
    for (let x = Math.floor(w * 0.3); x < w * 0.7; x++) setPixel(image, x, y, [214, 58, 52, 255]);
  }
  return image;
}

describe('art:portrait', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fnt-portrait-'));
  const out = join(dir, 'public', 'art', 'portraits');
  const logs: string[] = [];
  vi.spyOn(console, 'warn').mockImplementation((line: string) => void logs.push(line));
  vi.spyOn(console, 'error').mockImplementation((line: string) => void logs.push(line));
  afterEach(() => logs.splice(0));

  it('squares, flattens and downsizes a tall PNG to the 512 px portrait', () => {
    writePng(join(dir, 'kaya.png'), candidate(1024, 1536));
    expect(main(['--key', 'kaya', '--in', join(dir, 'kaya.png'), '--out', out])).toBe(0);
    const file = join(out, 'kaya.png');
    expect(imageSize(new Uint8Array(readFileSync(file)))).toEqual({
      format: 'png',
      width: 512,
      height: 512,
    });
    const image = readImage(file);
    expect(pixelAt(image, 4, 4)).toEqual([244, 233, 216, 255]);
    expect(pixelAt(image, 256, 256)).toEqual([214, 58, 52, 255]);
    expect(logs.join('\n')).toMatch(/512 px off the top and bottom/);
    expect(logs.join('\n')).toContain(
      "'portrait.kaya': { kind: 'image', url: 'art/portraits/kaya.png', palette: 'fire' },",
    );
  });

  it('takes a JPEG and keys the manifest line by the full key too', () => {
    const jpeg = encodeJpeg(
      { width: 1024, height: 1024, data: Buffer.from(candidate(1024, 1024).data) },
      92,
    );
    writeFileSync(join(dir, 'bo.jpg'), jpeg.data);
    expect(main(['--key', 'portrait.bo', '--in', join(dir, 'bo.jpg'), '--out', out])).toBe(0);
    const image = readImage(join(out, 'bo.png'));
    expect([image.width, image.height]).toEqual([512, 512]);
    expect(pixelAt(image, 256, 256)[0]).toBeGreaterThan(180);
    expect(logs.join('\n')).toContain("palette: 'earth'");
  });

  it('refuses a small candidate and an unknown portrait', () => {
    writePng(join(dir, 'tiny.png'), candidate(256, 256));
    expect(main(['--key', 'kaya', '--in', join(dir, 'tiny.png'), '--out', out])).toBe(1);
    expect(logs.join('\n')).toMatch(/scaled down, never up/);
    expect(main(['--key', 'nobody', '--in', join(dir, 'tiny.png'), '--out', out])).toBe(1);
    expect(logs.join('\n')).toMatch(/No portrait "portrait.nobody"/);
  });

  it('warns when the background is not the parchment', () => {
    writePng(join(dir, 'dark.png'), candidate(600, 600, [40, 40, 40, 255]));
    expect(main(['--key', 'nima', '--in', join(dir, 'dark.png'), '--out', out])).toBe(0);
    expect(logs.join('\n')).toMatch(/not the parchment/);
  });

  it('prints the palette the manifest carries', () => {
    expect(manifestLine('portrait.nilak', 'art/portraits/nilak.png')).toBe(
      "'portrait.nilak': { kind: 'image', url: 'art/portraits/nilak.png', palette: 'water' },",
    );
  });
});
