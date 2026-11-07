import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aggregate,
  analyzeChunk,
  decodeMappings,
  foldFolder,
  renderMarkdown,
} from './bundle-report-lib.mjs';

const temporary = new Set<string>();
afterEach(() => {
  for (const folder of temporary) rmSync(folder, { recursive: true, force: true });
  temporary.clear();
});

function makeTemp() {
  const folder = mkdtempSync(join(tmpdir(), 'bundle-report-test-'));
  temporary.add(folder);
  return folder;
}

describe('bundle report sourcemap attribution', () => {
  it('decodes mapped and unmapped segments, resetting generated columns per line', () => {
    // A=0; C=1. Line two starts at generated column 1, not column 2.
    expect(decodeMappings('AAAA,C;C')).toEqual([[[0, 0, 0, 0], [1]], [[1]]]);
  });

  it('uses UTF-16 columns, apportions UTF-8 spans, and allocates the exact gzip total', () => {
    const folder = makeTemp();
    const mapFile = join(folder, 'chunk.js.map');
    const code = Buffer.from('😅aZq');
    // The second segment starts at UTF-16 column 2 after a four-byte character;
    // the final segment leaves the trailing two bytes unmapped.
    writeFileSync(
      mapFile,
      JSON.stringify({
        version: 3,
        sources: ['src/a.ts', 'src/b.ts'],
        names: [],
        mappings: 'AAAA,ECAA,C',
      }),
    );
    const report = analyzeChunk({ file: 'chunk.js', mapFile, rootDir: folder, content: code });
    expect([...report.modules.values()].reduce((sum, bytes) => sum + bytes, 0)).toBe(
      gzipSync(code).length,
    );
    expect(report.modules.has('[generated / unmapped]')).toBe(true);
    const aBytes = report.modules.get('src/a.ts') ?? 0;
    const bBytes = report.modules.get('src/b.ts') ?? 0;
    expect(aBytes).toBeGreaterThan(bBytes);
    expect(Math.abs(aBytes - (report.compressedBytes * 4) / 7)).toBeLessThanOrEqual(1);
    expect([...report.modules]).toEqual([
      ...analyzeChunk({ file: 'chunk.js', mapFile, rootDir: folder, content: code }).modules,
    ]);
  });

  it('normalizes file URLs and sourceRoot paths to stable repository module keys', () => {
    const folder = makeTemp();
    const mapFile = join(folder, 'dist', 'app.js.map');
    mkdirSync(join(folder, 'dist'), { recursive: true });
    const fileSource = pathToFileURL(join(folder, 'src', 'entry.ts')).href;
    writeFileSync(
      mapFile,
      JSON.stringify({
        version: 3,
        sourceRoot: '',
        sources: [fileSource],
        names: [],
        mappings: 'AAAA',
      }),
    );
    const report = analyzeChunk({
      file: 'app.js',
      mapFile,
      rootDir: folder,
      content: Buffer.from('x'),
    });
    expect(report.modules.has('src/entry.ts')).toBe(true);
    writeFileSync(
      mapFile,
      JSON.stringify({
        version: 3,
        sourceRoot: '../src/',
        sources: ['entry.ts'],
        names: [],
        mappings: 'AAAA',
      }),
    );
    const rooted = analyzeChunk({
      file: 'app.js',
      mapFile,
      rootDir: folder,
      content: Buffer.from('x'),
    });
    expect(rooted.modules.has('src/entry.ts')).toBe(true);
  });

  it('keeps outside-root generated sources private and folds generated dependency paths', () => {
    const folder = makeTemp();
    const mapFile = join(folder, 'dist', 'sw.js.map');
    mkdirSync(join(folder, 'dist'), { recursive: true });
    const externalSource = pathToFileURL(join(tmpdir(), 'build-temp', 'sw.js')).href;
    writeFileSync(
      mapFile,
      JSON.stringify({ version: 3, sources: [externalSource], names: [], mappings: 'AAAA' }),
    );
    const outside = analyzeChunk({
      file: 'sw.js',
      mapFile,
      rootDir: folder,
      content: Buffer.from('x'),
    });
    expect(outside.modules.has('[generated / unmapped]')).toBe(true);
    expect([...outside.modules.keys()].some((name) => name.includes('build-temp'))).toBe(false);

    writeFileSync(
      mapFile,
      JSON.stringify({
        version: 3,
        sources: ['./node_modules/workbox-strategies/index.ts'],
        names: [],
        mappings: 'AAAA',
      }),
    );
    const dependency = analyzeChunk({
      file: 'sw.js',
      mapFile,
      rootDir: folder,
      content: Buffer.from('x'),
    });
    expect(dependency.modules.has('node_modules/workbox-strategies/index.ts')).toBe(true);
  });

  it('accepts equal generated columns and gives the following span to the last segment', () => {
    const folder = makeTemp();
    const mapFile = join(folder, 'duplicate.map');
    writeFileSync(
      mapFile,
      JSON.stringify({ version: 3, sources: ['src/a.ts'], names: [], mappings: 'AAAA,CACA,A' }),
    );
    const code = Buffer.from('ab');
    const report = analyzeChunk({ file: 'duplicate.js', mapFile, rootDir: folder, content: code });
    expect(report.modules.get('src/a.ts')).toBeGreaterThan(0);
    expect(report.modules.get('[generated / unmapped]')).toBeGreaterThan(0);
    expect([...report.modules.values()].reduce((sum, bytes) => sum + bytes, 0)).toBe(
      report.compressedBytes,
    );
  });

  it('rejects decreasing columns, truncated VLQ, invalid source indexes, and malformed segments', () => {
    const folder = makeTemp();
    const mapFile = join(folder, 'bad.map');
    const code = Buffer.from('ab');
    const analyze = (mappings: string, sources = ['src/a.ts']) => {
      writeFileSync(mapFile, JSON.stringify({ version: 3, sources, names: [], mappings }));
      return () => analyzeChunk({ file: 'bad.js', mapFile, rootDir: folder, content: code });
    };
    expect(analyze('AAAA,C,D')).toThrow(/generated column/);
    expect(analyze('AAAA,')).toThrow(/VLQ/);
    expect(analyze('AAAA', [])).toThrow(/source index/);
  });

  it('counts sourcemap-free output in the generated bucket and compares added or removed modules', () => {
    const chunk = analyzeChunk({
      file: 'sw.js',
      rootDir: process.cwd(),
      content: Buffer.from('self.x=1'),
    });
    const now = aggregate([
      {
        compressedBytes: 12,
        modules: new Map([
          ['src/new.ts', 9],
          ['src/keep.ts', 3],
        ]),
      },
    ]);
    const before = aggregate([
      {
        compressedBytes: 12,
        modules: new Map([
          ['src/old.ts', 4],
          ['src/keep.ts', 8],
        ]),
      },
    ]);
    const markdown = renderMarkdown(now, before);
    expect(chunk.modules.has('[generated / unmapped]')).toBe(true);
    expect(markdown).toContain('`src/new.ts`');
    expect(markdown).toContain('`src/old.ts`');
    expect(markdown).toContain(`${now.total.toLocaleString()} B`);
    expect(markdown).toContain(`${before.total.toLocaleString()} B`);
    expect(foldFolder('node_modules/@jridgewell/trace-mapping/dist/index.js')).toBe(
      'node_modules/@jridgewell/trace-mapping',
    );
    expect(
      foldFolder('node_modules/.pnpm/pixi.js@8.20.1/node_modules/pixi.js/lib/rendering/index.mjs'),
    ).toBe('node_modules/pixi.js');
    expect(foldFolder('src/render/topdown/terrain.ts')).toBe('src/render/topdown');
  });
});
