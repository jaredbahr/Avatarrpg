import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newImage, readPng, setPixel, writePng } from './lib/image';
import { main } from './normalise';

/** A `w` x `h` pose on `background` with a figure of `figure` px tall in the middle. */
function pose(w: number, h: number, figure: number, background: readonly number[]) {
  const image = newImage(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPixel(image, x, y, background);
  const top = Math.floor((h - figure) / 2);
  for (let y = top; y < top + figure; y++) {
    for (let x = Math.floor(w / 2) - 8; x < Math.floor(w / 2) + 8; x++) {
      setPixel(image, x, y, [120, 60, 40, 255]);
    }
  }
  return image;
}

const GREEN = [0, 255, 0, 255];
const PARCHMENT = [244, 233, 216, 255];

describe('art:normalise on generator output', () => {
  const logs: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((line: string) => void logs.push(line));
  vi.spyOn(console, 'error').mockImplementation((line: string) => void logs.push(line));
  afterEach(() => logs.splice(0));

  function unit(name: string, background: readonly number[], figure: number): string {
    const raw = mkdtempSync(join(tmpdir(), 'fnt-normalise-'));
    const idle = join(raw, name, 'idle');
    mkdirSync(idle, { recursive: true });
    writePng(join(idle, '0.png'), pose(128, 192, figure, background));
    writePng(join(idle, '1.png'), pose(128, 192, figure, background));
    return raw;
  }

  it('stops when the background is not the key colour', () => {
    const raw = unit('unit.test.parchment', PARCHMENT, 120);
    expect(main(['--unit', 'unit.test.parchment', '--raw', raw, '--out', join(raw, 'out')])).toBe(
      1,
    );
    expect(logs.join('\n')).toMatch(/the corners are #f4e9d8, not #00ff00/);
  });

  it('reports a figure too small to stand its height in the frame', () => {
    const raw = unit('unit.test.short', GREEN, 40);
    expect(main(['--unit', 'unit.test.short', '--raw', raw, '--out', join(raw, 'out')])).toBe(1);
    expect(logs.join('\n')).toMatch(/40 px tall and would stand 121 px/);
  });

  it('preserves opaque green costume colours when the input already has alpha', () => {
    const name = 'unit.test.alpha';
    const raw = unit(name, [0, 0, 0, 0], 140);
    const path = join(raw, name, 'idle', '0.png');
    const source = readPng(path);
    for (let i = 0; i < source.data.length; i += 4) {
      if (source.data[i + 3] !== 255) continue;
      source.data[i] = 111;
      source.data[i + 1] = 158;
      source.data[i + 2] = 76;
    }
    writePng(path, source);
    expect(main(['--unit', name, '--raw', raw, '--out', join(raw, 'out'), '--key', 'alpha'])).toBe(
      0,
    );
    const result = readPng(join(raw, 'out', name, 'idle', '0.png'));
    let green = false;
    for (let i = 0; i < result.data.length; i += 4) {
      if (
        result.data[i] === 111 &&
        result.data[i + 1] === 158 &&
        result.data[i + 2] === 76 &&
        result.data[i + 3] === 255
      )
        green = true;
    }
    expect(green).toBe(true);
    expect(result.data[3]).toBe(0);
  });

  it('names files it passed over instead of skipping them silently', () => {
    const raw = unit('unit.test.loose', GREEN, 140);
    writePng(join(raw, 'unit.test.loose', 'idle', 'Idle A.png'), pose(128, 192, 140, GREEN));
    expect(main(['--unit', 'unit.test.loose', '--raw', raw, '--out', join(raw, 'out')])).toBe(0);
    expect(logs.join('\n')).toMatch(/ignored idle\/Idle A.png/);
  });
});
