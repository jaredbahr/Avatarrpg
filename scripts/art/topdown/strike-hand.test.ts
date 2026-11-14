/**
 * The striking hand of a top-down action (ADR 0104): measured on the hit cel at pack time (`strikeHand`) and shipped
 * in each heading of each action, where combat starts the action's attached effects.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newImage, type Image } from '../lib/image';
import { strikeHand } from './pack-sheets';

/** A 30 x 40 cel: a body column (x 12..17, y 5..39), plus `extra` opaque pixels. */
function cel(extra: readonly [number, number][] = []): Image {
  const im = newImage(30, 40);
  const set = (x: number, y: number) => im.data.set([200, 100, 50, 255], (y * 30 + x) * 4);
  for (let y = 5; y < 40; y++) for (let x = 12; x < 18; x++) set(x, y);
  for (const [x, y] of extra) set(x, y);
  return im;
}
const anchor = { x: 15 / 30, y: 39 / 40 };
const arm = (from: number, to: number, y: number): [number, number][] =>
  Array.from({ length: to - from + 1 }, (_, i) => [from + i, y]);

describe('the striking hand', () => {
  it('is the tip of the limb the strike drew, along the aim', () => {
    const hit = cel([...arm(18, 27, 15), ...arm(4, 11, 30)]);
    expect(strikeHand(cel(), hit, anchor, 'east')).toEqual({ x: 27, y: 15 });
    // The stepping foot low on the west side is below the arms' band.
    expect(strikeHand(cel(), hit, anchor, 'west').x).toBeGreaterThan(17);
  });

  it('is the hand raised over the head for an overhead throw', () => {
    const hit = cel(Array.from({ length: 5 }, (_, i) => [14, i] as [number, number]));
    const hand = strikeHand(cel(), hit, anchor, 'southWest');
    expect(hand.x).toBe(14);
    expect(hand.y).toBeLessThan(5);
  });

  it('falls back to the reach of the whole hit cel when the strike drew almost nothing new', () => {
    const hand = strikeHand(cel(), cel(), anchor, 'east');
    // The body's east edge, in the arms' band above 60% of its height.
    expect(hand.x).toBe(17);
    expect(hand.y).toBeLessThan(5 + 0.6 * 34);
  });
});

it('ships a hand inside its cel for every heading of every action', () => {
  const dir = 'public/art/topdown';
  let checked = 0;
  for (const file of readdirSync(dir).filter((name) => name.endsWith('-actions.json'))) {
    if (file.startsWith('driller')) continue;
    type Clip = { hand?: { x: number; y: number }; frameSize: { w: number; h: number } };
    const actions = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as Record<
      string,
      Record<string, Clip>
    >;
    for (const [pose, headings] of Object.entries(actions)) {
      if (pose === 'ko') continue;
      for (const [heading, clip] of Object.entries(headings)) {
        const { hand, frameSize } = clip;
        expect(hand, `${file} ${pose} ${heading}`).toBeDefined();
        expect(
          hand && hand.x >= 0 && hand.y >= 0 && hand.x < frameSize.w && hand.y < frameSize.h,
        ).toBe(true);
        checked++;
      }
    }
  }
  expect(checked).toBeGreaterThan(200);
});
