import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  collectPlayerFacingHits,
  formatCanonHit,
  scanPlainText,
  scanTypeScript,
} from './canon-text';

const root = fileURLToPath(new URL('../..', import.meta.url));
const denylist = JSON.parse(
  readFileSync(new URL('./canon-denylist.json', import.meta.url), 'utf8'),
) as {
  canonNames: string[];
  allowedGenericWords: Record<string, string>;
  allowedContext: Record<string, Record<string, string>>;
};
const disclaimer = `> **Non-commercial fan work.** Avatar: The Last Airbender and The Legend of Korra
> are the property of Nickelodeon / Paramount. This is a private fan project made
> for one family to play. It is not for sale, not for distribution, and uses no
> canon characters — only original characters in a reused setting. Please do not
> sell, market, or monetise it.`;

describe('fan-work copy guard', () => {
  it('keeps the README disclaimer paragraph verbatim', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8').replaceAll(
      '\r\n',
      '\n',
    );
    expect(readme).toContain(disclaimer);
  });

  it('keeps the denylist distinct from documented generic words', () => {
    expect(denylist.canonNames).toContain('Korra');
    expect(new Set(denylist.canonNames.map((name) => name.toLowerCase())).size).toBe(
      denylist.canonNames.length,
    );
    const names = denylist.canonNames.map((name) => name.toLowerCase());
    for (const generic of Object.keys(denylist.allowedGenericWords).filter(
      (key) => !key.startsWith('$'),
    )) {
      expect(denylist.allowedGenericWords[generic]).toBeTruthy();
      expect(names).not.toContain(generic);
    }
  });

  it('allows setting references and restricts approved era copy to exact literals in one file', () => {
    const file = 'src/app/scenes/TitleScene.ts';
    const allowed = denylist.allowedContext[file]!;
    const tagline = Object.keys(allowed).find((copy) => copy.includes('set after Korra'))!;
    const original = `const tagline = ${JSON.stringify(tagline)};`;
    expect(scanTypeScript(original, file, denylist.canonNames, allowed)).toEqual([]);
    expect(scanTypeScript(original, 'src/content/characters.ts', denylist.canonNames)).toEqual([
      expect.objectContaining({ name: 'Korra' }),
    ]);
    const changed = `${original}\nconst cast = { speaker: 'Korra', place: 'Republic City' };`;
    expect(scanTypeScript(changed, file, denylist.canonNames, allowed)).toEqual([
      expect.objectContaining({ file, line: 2, name: 'Korra' }),
    ]);
    const editedTagline = original.replace('set after Korra.', 'starring Korra.');
    expect(scanTypeScript(editedTagline, file, denylist.canonNames, allowed)).toEqual([
      expect.objectContaining({ file, line: 1, name: 'Korra' }),
    ]);
  });

  it('rejects a planted whole canon name with file and line, ignoring comments and substrings', () => {
    const file = 'scripts/lint/fixtures/planted-canon.ts.txt';
    const fixture = readFileSync(
      new URL('./fixtures/planted-canon.ts.txt', import.meta.url),
      'utf8',
    );
    const hits = scanTypeScript(fixture, file, denylist.canonNames);
    expect(hits).toEqual([{ file, line: 3, column: 25, name: 'Sokka' }]);
    expect(formatCanonHit(hits[0]!)).toBe(`${file}:3:25: canon name "Sokka"`);
    expect(scanPlainText('<title>KORRA</title>', 'index.html', denylist.canonNames)).toEqual([
      { file: 'index.html', line: 1, column: 8, name: 'Korra' },
    ]);
  });

  it('reports decoded names alongside plain names in one literal without duplicate diagnostics', () => {
    const file = 'mixed.ts';
    const text = 'const line = "Korra and So\\u006bka and Ko\\u0072ra";';
    expect(scanTypeScript(text, file, denylist.canonNames)).toEqual([
      { file, line: 1, column: 15, name: 'Korra' },
      { file, line: 1, column: 14, name: 'Sokka' },
      { file, line: 1, column: 14, name: 'Korra' },
    ]);
  });

  it('checks decoded player-facing JSON and web manifest strings', () => {
    const document =
      '{\n  "name": "So\\u006bka",\n  "description": "Republic City after the war"\n}';
    for (const file of ['src/content/cast.json', 'public/manifest.webmanifest']) {
      expect(scanTypeScript(document, file, denylist.canonNames)).toEqual([
        { file, line: 2, column: 11, name: 'Sokka' },
      ]);
    }
  });

  it('finds no canon names in shipped player-facing copy', () => {
    const hits = collectPlayerFacingHits(root, denylist.canonNames, denylist.allowedContext);
    expect(hits, hits.map(formatCanonHit).join('\n')).toEqual([]);
  });
});
