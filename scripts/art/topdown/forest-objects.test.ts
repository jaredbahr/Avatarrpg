/**
 * The forest's runtime objects (ADR 0104 T4) are the prototype's own: each `prototypes/topdown/fc/obj_*.png`
 * is pixel-identical to the image the owner-approved `forest-combat.html` embeds under that name. If a
 * file is redrawn, this test says so before it ships as "the prototype's art".
 */
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

const PAGE = readFileSync('prototypes/topdown/forest-combat.html', 'utf8');
const OBJECTS = [
  'boulder',
  'cart_wheel',
  'earth_wall',
  'hay_bale',
  'log',
  'milestone',
  'oil_flask',
  'pine_a',
  'pine_b',
  'pine_c',
  'puddle',
  'rubble',
  'stump',
] as const;

function embedded(name: string): PNG {
  const match = new RegExp(
    `"${name}"\\s*:\\s*\\{[^{}]*?"(?:src|data|img)"\\s*:\\s*"data:image/png;base64,([A-Za-z0-9+/=]+)"`,
  ).exec(PAGE);
  if (!match?.[1]) throw new Error(`forest-combat.html embeds no "${name}" image`);
  return PNG.sync.read(Buffer.from(match[1], 'base64'));
}

describe('the forest objects match the approved prototype', () => {
  it.each(OBJECTS)('fc/obj_%s.png is the prototype page’s image, pixel for pixel', (name) => {
    const page = embedded(name);
    const file = PNG.sync.read(readFileSync(`prototypes/topdown/fc/obj_${name}.png`));
    expect([file.width, file.height]).toEqual([page.width, page.height]);
    expect(Buffer.compare(file.data, page.data)).toBe(0);
  });
});
