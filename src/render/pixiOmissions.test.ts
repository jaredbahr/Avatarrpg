import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * The production build strips Pixi code the game never reaches (ADR 0057).
 * Calling any of it throws at runtime, and only on the path that calls it, so
 * catch the call in source first. Restore the matching registration in
 * `vite.config.ts` before removing a rule here.
 */
const OMITTED: readonly { what: string; pattern: RegExp; pixiOnly?: boolean }[] = [
  { what: 'Graphics.svg()', pattern: /\.svg\s*\(/ },
  { what: 'TextStyle tagStyles', pattern: /\btagStyles\b/ },
  { what: 'GraphicsPath built from an SVG string', pattern: /new\s+GraphicsPath\s*\(\s*[`'"]/ },
  { what: 'autoDetectRenderer', pattern: /\bautoDetectRenderer\b/ },
  { what: 'WebGPURenderer', pattern: /\bWebGPURenderer\b/ },
  { what: 'CanvasRenderer', pattern: /\bCanvasRenderer\b/ },
  { what: 'a renderer preference', pattern: /\bpreference\s*:/, pixiOnly: true },
  {
    what: 'a ParticleContainer with its own shader',
    pattern: /new\s+ParticleContainer\s*\(\s*\{[^}]*\bshader\s*[:,}]/,
  },
  { what: "Pixi's Assets", pattern: /import\s*\{[^}]*\bAssets\b[^}]*\}\s*from\s*'pixi\.js'/ },
  { what: "Pixi's Assets", pattern: /\bAssets\s*\.\s*\w/ },
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe('Pixi code omitted from the production build (ADR 0057)', () => {
  it('is not used anywhere in src', () => {
    const root = resolve('src');
    const hits: string[] = [];
    for (const file of sources(root)) {
      const code = readFileSync(file, 'utf8');
      const pixi = /from\s*'pixi\.js'/.test(code);
      for (const { what, pattern, pixiOnly } of OMITTED) {
        if (pixiOnly && !pixi) continue;
        if (pattern.test(code)) hits.push(`${relative(root, file)}: ${what}`);
      }
    }
    expect(
      hits,
      'The production build omits this Pixi code (ADR 0057). Restore its registration in ' +
        'vite.config.ts and update docs/adr/0057-javascript-headroom.md first.',
    ).toEqual([]);
  });
});
