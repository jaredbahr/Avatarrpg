import { describe, expect, it } from 'vitest';
import { TITLE_ART, parseTitleArtHold, pickTitleArt, titleArtById } from './titleArt';

describe('title art hold hook', () => {
  it('accepts 0 and values of 3000 ms or more', () => {
    expect(parseTitleArtHold('0')).toBe(0);
    expect(parseTitleArtHold('3000')).toBe(3000);
    expect(parseTitleArtHold('20000')).toBe(20000);
  });

  it('falls back to the default for anything shorter or malformed', () => {
    for (const raw of [
      null,
      '',
      ' ',
      '1',
      '999',
      '2999',
      '-5',
      '-3000',
      'abc',
      'NaN',
      'Infinity',
    ]) {
      expect(parseTitleArtHold(raw)).toBeUndefined();
    }
  });
});

describe('title art rotation', () => {
  it('never repeats the previous painting, whatever the roll', () => {
    for (const art of TITLE_ART) {
      for (const roll of [0, 0.25, 0.49, 0.5, 0.75, 0.999999]) {
        expect(pickTitleArt(art.id, () => roll).id).not.toBe(art.id);
      }
    }
  });

  it('can reach every other painting', () => {
    for (const art of TITLE_ART) {
      const reached = new Set([0, 0.99].map((roll) => pickTitleArt(art.id, () => roll).id));
      expect(reached.size).toBe(TITLE_ART.length - 1);
    }
  });

  it('picks from all of them on a first visit or an unknown previous', () => {
    expect(new Set([0, 0.4, 0.7, 0.99].map((r) => pickTitleArt(null, () => r).id)).size).toBe(3);
    expect(pickTitleArt('zzz', () => 0).id).toBe('a');
  });

  it('looks a painting up by id and rejects anything else', () => {
    expect(titleArtById('b')?.side).toBe('right');
    expect(titleArtById('nope')).toBeUndefined();
    expect(titleArtById(null)).toBeUndefined();
  });

  it('declares a landscape and a portrait file for each painting', () => {
    for (const art of TITLE_ART) {
      expect(art.wide.file).toBe(`title-${art.id}-wide.webp`);
      expect(art.portrait.file).toBe(`title-${art.id}-portrait.webp`);
    }
  });
});
