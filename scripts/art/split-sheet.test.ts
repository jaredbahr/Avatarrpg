import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newImage, readPng, setPixel, writePng } from './lib/image';
import { alphaBounds } from './lib/trim';
import { splitSheet } from './split-sheet';

describe('transparent pose sheet intake', () => {
  it('keeps all six poses intact and assigns the combat clip order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fnt-sheet-'));
    try {
      const image = newImage(300, 300);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          for (let y = row * 150 + 25; y < row * 150 + 125; y++) {
            for (let x = col * 100 + 30; x < col * 100 + 70; x++) {
              setPixel(image, x, y, [30 + row * 3 + col, 158, 76, 255]);
            }
          }
        }
      }
      const input = join(dir, 'sheet.png');
      writePng(input, image);
      splitSheet(input, 'unit.test.sheet', dir);
      const poses = ['idle/0', 'idle/1', 'cast/0', 'cast/1', 'cast/2', 'ko/0'];
      poses.forEach((pose, index) => {
        const frame = readPng(join(dir, 'unit.test.sheet', `${pose}.png`));
        const bounds = alphaBounds(frame);
        expect(bounds).toMatchObject({ width: 40, height: 100 });
        if (!bounds) throw new Error('Empty pose');
        expect(frame.data[(bounds.y * frame.width + bounds.x) * 4]).toBe(30 + index);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses to cut a sheet with no clear gutter', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fnt-sheet-'));
    try {
      const image = newImage(300, 300);
      image.data.fill(255);
      const input = join(dir, 'sheet.png');
      writePng(input, image);
      expect(() => splitSheet(input, 'unit.test.sheet', dir)).toThrow('No clear y gutter');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
